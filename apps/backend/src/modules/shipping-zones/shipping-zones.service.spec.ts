import { ShippingZonesService } from './shipping-zones.service';
import { SHIPPING_ZONES_DEFAULTS } from './shipping-zones.defaults';
import { resolveZoneFee } from './shipping-zones.matcher';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RevalidationService } from '../../common/revalidation/revalidation.service';

describe('ShippingZonesService checkout visibility', () => {
  let stored: unknown;
  const service = new ShippingZonesService(
    { client: { setting: {
      findUnique: jest.fn(async () => stored === undefined ? null : { value: stored }),
      upsert: jest.fn(async ({ update }: { update: { value: unknown } }) => {
        stored = update.value;
      }),
    } } } as unknown as PrismaService,
    { revalidate: jest.fn(async () => undefined) } as unknown as RevalidationService,
  );

  beforeEach(() => { stored = undefined; });

  it('shows rates for existing settings without the flag', async () => {
    const { showOnCheckout: _, ...legacy } = SHIPPING_ZONES_DEFAULTS;
    stored = legacy;
    expect((await service.getConfig()).showOnCheckout).toBe(true);
    expect(await service.getPublic('EN')).toHaveLength(2);
  });

  it('disables display and calculation, and preserves rates for re-enabling', async () => {
    await service.update({ ...SHIPPING_ZONES_DEFAULTS, showOnCheckout: false });
    expect(await service.getPublic('EN')).toEqual([]);
    expect(await service.getPublic('BN')).toEqual([]);
    const config = await service.getConfig();
    expect(config.showOnCheckout).toBe(false);
    expect(resolveZoneFee(config, 'Dhaka').fee).toBe(0);
    expect(resolveZoneFee(config, 'Sylhet').fee).toBe(0);
    expect(resolveZoneFee(config, undefined).fee).toBe(0);
    await service.update({ ...config, showOnCheckout: true });
    expect(await service.getPublic('EN')).toHaveLength(2);
    expect(await service.getPublic('BN')).toHaveLength(2);
    expect(resolveZoneFee(await service.getConfig(), 'Dhaka').fee).toBe(80);
  });
});
