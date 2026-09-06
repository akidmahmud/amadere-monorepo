import { Prisma } from '@amader/db';
import { STEADFAST_SHIPPING_RULES } from '@amader/shared';
import { ShippingRulesService } from './shipping-rules.service';
import { ShippingRulesController } from './shipping-rules.controller';
import { ShippingZonesService } from '../shipping-zones/shipping-zones.service';
import { SHIPPING_ZONES_DEFAULTS } from '../shipping-zones/shipping-zones.defaults';
import { PrismaService } from '../../common/prisma/prisma.service';
import { computeCheckoutFees } from '../net-profit/accounts/accounts.constants';

describe('active shipping configuration', () => {
  let rules = structuredClone(STEADFAST_SHIPPING_RULES);
  let zones = structuredClone(SHIPPING_ZONES_DEFAULTS);
  const service = new ShippingRulesService({ client: {
    setting: { findUnique: jest.fn(async () => ({ value: rules })) },
    product: { findMany: jest.fn(async () => [{ id: 1, shippableWeight: new Prisma.Decimal(2) }]) },
    productVariant: { findMany: jest.fn(async () => [
      { id: 2, weightOverride: new Prisma.Decimal(0.5), product: { shippableWeight: new Prisma.Decimal(2) } },
    ]) },
  } } as unknown as PrismaService, {
    getConfig: jest.fn(async () => zones),
  } as unknown as ShippingZonesService);
  const items = [{ productId: 1, quantity: 2 }];

  beforeEach(() => {
    rules = structuredClone(STEADFAST_SHIPPING_RULES);
    zones = structuredClone(SHIPPING_ZONES_DEFAULTS);
  });

  it.each([
    [true, true, 165], [true, false, 165], [false, true, 80], [false, false, 0],
  ])('rules %s / zones %s gives checkout and quick fee %s', async (ruleOn, zoneOn, expected) => {
    rules.applyOnCheckout = ruleOn;
    zones.showOnCheckout = zoneOn;
    const override = await service.checkoutFee('Dhaka', items);
    expect(computeCheckoutFees(false, 'Dhaka', zones, override).shippingFee.toNumber()).toBe(expected);
    const quick = await service.quote({ district: 'Dhaka', items }, true);
    expect(quick.amount).toBe(expected);
    expect(quick.weightKg).toBe(4);
    expect(computeCheckoutFees(true, 'Dhaka', zones, override).shippingFee.toNumber()).toBe(0);
  });

  it('does not fall back to disabled zones when no rule matches', async () => {
    rules.applyOnCheckout = true;
    rules.rules = [];
    zones.showOnCheckout = false;
    expect((await service.quote({ district: 'Dhaka', items }, true)).amount).toBe(0);
    expect(computeCheckoutFees(false, 'Dhaka', zones, await service.checkoutFee('Dhaka', items)).shippingFee.toNumber()).toBe(0);
  });

  it('uses variant weight overrides and quantity in both customer quotes', async () => {
    rules.applyOnCheckout = true;
    const variantItems = [{ productId: 1, variantId: 2, quantity: 3 }];
    expect((await service.checkoutFee('Dhaka', variantItems))?.toNumber()).toBe(125);
    expect((await service.quote({ district: 'Dhaka', items: variantItems }, true)).amount).toBe(125);
  });

  it('exposes only active home-delivery rules to checkout', async () => {
    const controller = new ShippingRulesController(service);
    expect((await controller.get()).rules).toEqual([]);
    rules.applyOnCheckout = true;
    const config = await controller.get();
    expect(config.rules.length).toBeGreaterThan(0);
    expect(config.rules.every((r) => r.deliveryType === 'HOME')).toBe(true);
  });
});
