import { ClientThrottlerGuard } from './client-throttler.guard';

// getTracker is protected; this exposes it for the test without changing
// the production surface.
class Probe extends ClientThrottlerGuard {
  track(req: Record<string, unknown>) {
    return this.getTracker(req);
  }
}

// Only getTracker is under test, so the ThrottlerGuard constructor
// dependencies are never touched.
const guard = Object.create(Probe.prototype) as Probe;

const req = (over: Record<string, unknown> = {}) => ({
  url: '/api/v1/products',
  headers: {},
  body: {},
  ip: '1.1.1.1',
  ...over,
});

describe('ClientThrottlerGuard.getTracker', () => {
  describe('auth routes', () => {
    // The bypass this guard was fixed for: a client-supplied x-device-id
    // must not create a fresh rate-limit bucket on a login endpoint.
    it('ignores client-supplied identity headers so the limit cannot be bypassed', async () => {
      const one = await guard.track(
        req({
          url: '/api/v1/admin/auth/login',
          headers: { 'x-device-id': 'minted-1', 'x-guest-token': 'g1' },
          body: { email: 'admin@amadere.com', password: 'a' },
        }),
      );
      const two = await guard.track(
        req({
          url: '/api/v1/admin/auth/login',
          headers: { 'x-device-id': 'minted-2', 'x-guest-token': 'g2' },
          body: { email: 'admin@amadere.com', password: 'b' },
        }),
      );
      expect(one).toBe(two);
    });

    it('gives two accounts on one CGNAT IP independent buckets', async () => {
      const a = await guard.track(
        req({ url: '/api/v1/auth/login', body: { identifier: '01700000001' } }),
      );
      const b = await guard.track(
        req({ url: '/api/v1/auth/login', body: { identifier: '01700000002' } }),
      );
      expect(a).not.toBe(b);
    });

    it('separates the same account arriving from different IPs', async () => {
      const a = await guard.track(
        req({ url: '/api/v1/auth/login', ip: '1.1.1.1', body: { email: 'x@y.z' } }),
      );
      const b = await guard.track(
        req({ url: '/api/v1/auth/login', ip: '2.2.2.2', body: { email: 'x@y.z' } }),
      );
      expect(a).not.toBe(b);
    });

    it('covers admin and customer auth, and the OTP phone field', async () => {
      expect(
        await guard.track({ ...req({ url: '/api/v1/auth/otp/request', body: { phone: '01700000003' } }) }),
      ).toBe('authroute:1.1.1.1:01700000003');
      expect(
        await guard.track({ ...req({ url: '/api/v1/admin/auth/2fa/verify', body: {} }) }),
      ).toBe('authroute:1.1.1.1:');
    });

    it('cannot be collided with from the Authorization header', async () => {
      const victim = await guard.track(
        req({ url: '/api/v1/auth/login', body: { email: 'victim@x.z' } }),
      );
      const crafted = await guard.track(
        req({ headers: { authorization: '1.1.1.1:victim@x.z' } }),
      );
      expect(crafted).not.toBe(victim);
    });
  });

  describe('non-auth routes keep the CGNAT-safe behaviour', () => {
    it('prefers guest token, then authorization, then device id, then ip', async () => {
      expect(await guard.track(req({ headers: { 'x-guest-token': 'g' } }))).toBe('guest:g');
      expect(await guard.track(req({ headers: { authorization: 'Bearer t' } }))).toBe('auth:Bearer t');
      expect(await guard.track(req({ headers: { 'x-device-id': 'd' } }))).toBe('device:d');
      expect(await guard.track(req())).toBe('1.1.1.1');
    });
  });
});
