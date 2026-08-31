import { PaymentsService } from './payments.service';
import { BkashSettingsService } from './bkash/bkash-settings.service';
import { BkashPaymentProvider } from './bkash/bkash-payment.provider';
import { CodPaymentProvider } from './providers/cod-payment.provider';
import { ManualPaymentProvider } from './providers/manual-payment.provider';

// The whole point of the BKASH branch: a half-configured or switched-off
// gateway must fall back to the manual pay-to-a-merchant-number flow, never
// strand a customer on a dead redirect mid-checkout.
describe('PaymentsService.resolve', () => {
  const cod = new CodPaymentProvider();
  const manual = new ManualPaymentProvider();
  const bkash = {} as BkashPaymentProvider;

  function makeService(gatewayLive: boolean) {
    const settings = {
      isGatewayLive: jest.fn().mockResolvedValue(gatewayLive),
    } as unknown as BkashSettingsService;
    return new PaymentsService(
      {} as never,
      {} as never,
      cod,
      manual,
      bkash,
      settings,
    );
  }

  it('routes BKASH to the gateway when it is active and fully configured', async () => {
    await expect(makeService(true).resolve('BKASH')).resolves.toBe(bkash);
  });

  it('falls back to the manual flow when the gateway is not live', async () => {
    await expect(makeService(false).resolve('BKASH')).resolves.toBe(manual);
  });

  it('never sends the other providers through the bKash branch', async () => {
    const service = makeService(true);
    await expect(service.resolve('COD')).resolves.toBe(cod);
    await expect(service.resolve('NAGAD')).resolves.toBe(manual);
    await expect(service.resolve('ROCKET')).resolves.toBe(manual);
    await expect(service.resolve('UPAY')).resolves.toBe(manual);
  });
});
