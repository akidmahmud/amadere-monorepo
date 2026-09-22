import { FraudService } from './fraud.service';

// The gate must fail open when the courier lookup itself fails — it used to
// score that as "no history", so with allowNoHistory=false every customer
// came back HIGH and got the OTP box.
function makeService(outcome: unknown) {
  const upsert = jest.fn(async ({ create }: { create: Record<string, unknown> }) => ({
    id: 1,
    checkedAt: new Date(),
    ...create,
  }));
  const prisma = { client: { fraudCheck: { findUnique: jest.fn(async () => null), upsert } } };
  const settings = {
    getNamespace: jest.fn(async (_ns: string, defaults: object) => ({
      ...defaults,
      enabled: true,
      allowNoHistory: false,
      otpOnRiskEnabled: true,
    })),
  };
  const credentials = { getCredential: jest.fn(async () => 'key') };
  const bdCourier = { name: 'BDCOURIER', check: jest.fn(async () => outcome) };
  return new FraudService(prisma as never, settings as never, credentials as never, bdCourier as never, {} as never);
}

describe('FraudService.evaluateCheckoutGate', () => {
  it('passes without OTP when the courier source is unavailable', async () => {
    const gate = await makeService({ unavailable: true }).evaluateCheckoutGate('01840193060');
    expect(gate).toEqual({ allowed: true, riskLevel: 'UNKNOWN', verdict: 'pass' });
  });

  it('still requires OTP for a genuine no-history phone', async () => {
    const gate = await makeService({ total: 0, delivered: 0, cancelled: 0 }).evaluateCheckoutGate('01840193060');
    expect(gate.requiresOtp).toBe(true);
  });

  it('passes a customer at or above the accept threshold without OTP', async () => {
    const gate = await makeService({ total: 10, delivered: 9, cancelled: 1 }).evaluateCheckoutGate('01840193060');
    expect(gate).toEqual({ allowed: true, riskLevel: 'LOW', verdict: 'pass' });
  });
});
