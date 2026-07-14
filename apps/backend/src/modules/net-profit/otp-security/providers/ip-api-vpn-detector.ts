import { Injectable, Logger } from '@nestjs/common';
import { VpnCheckOutcome, VpnDetector } from '../vpn-detector.interface';

// ip-api.com's free tier (no API key, ~45 req/min) exposes a `proxy` field
// (known VPN/proxy/Tor/hosting-relay) as part of its extended field set —
// a real, keyless IP-intelligence source, not a paid service this
// environment has no credentials for. HTTP-only (their free tier doesn't
// support HTTPS) and rate-limited, so this degrades to `{ unavailable:
// true }` on any failure/rate-limit rather than blocking OTP requests.
const BASE_URL = 'http://ip-api.com/json';

interface IpApiResponse {
  status?: string;
  proxy?: boolean;
  hosting?: boolean;
}

@Injectable()
export class IpApiVpnDetector implements VpnDetector {
  private readonly logger = new Logger(IpApiVpnDetector.name);

  async check(ip: string): Promise<VpnCheckOutcome> {
    // Private/local addresses (dev environment, behind a proxy with no
    // real client IP forwarded) can't be looked up — treat as unavailable
    // rather than sending a useless request.
    if (!ip || /^(127\.|10\.|192\.168\.|::1)/.test(ip)) return { unavailable: true };

    try {
      const res = await fetch(`${BASE_URL}/${ip}?fields=status,proxy,hosting`);
      const json = (await res.json().catch(() => ({}))) as IpApiResponse;
      if (!res.ok || json.status !== 'success') return { unavailable: true };
      return { isVpn: Boolean(json.proxy || json.hosting) };
    } catch (err) {
      this.logger.warn(`VPN check failed for ${ip}: ${err instanceof Error ? err.message : String(err)}`);
      return { unavailable: true };
    }
  }
}
