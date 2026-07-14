import { Injectable, Logger } from '@nestjs/common';
import { VpnCheckOutcome, VpnDetector } from '../vpn-detector.interface';

// ip-api.com's free tier (no API key, ~45 req/min) exposes a `proxy` field
// (known VPN/proxy/Tor/hosting-relay) as part of its extended field set —
// a real, keyless IP-intelligence source, not a paid service this
// environment has no credentials for. HTTP-only (their free tier doesn't
// support HTTPS) and rate-limited, so this degrades to `{ unavailable:
// true }` on any failure/rate-limit rather than blocking OTP requests.
const BASE_URL = 'http://ip-api.com/json';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour — matches the reference plugin's cache window

interface IpApiResponse {
  status?: string;
  proxy?: boolean;
  hosting?: boolean;
}

@Injectable()
export class IpApiVpnDetector implements VpnDetector {
  private readonly logger = new Logger(IpApiVpnDetector.name);
  // ponytail: process-local Map, per-instance cache; a shared/Redis cache
  // only matters once this runs behind multiple backend instances.
  private readonly cache = new Map<string, { outcome: VpnCheckOutcome; expiresAt: number }>();

  async check(ip: string): Promise<VpnCheckOutcome> {
    // Private/local addresses (dev environment, behind a proxy with no
    // real client IP forwarded) can't be looked up — treat as unavailable
    // rather than sending a useless request.
    if (!ip || /^(127\.|10\.|192\.168\.|::1)/.test(ip)) return { unavailable: true };

    const cached = this.cache.get(ip);
    if (cached && cached.expiresAt > Date.now()) return cached.outcome;

    const outcome = await this.fetchLive(ip);
    // Don't cache a transient "unavailable" (rate-limited/network hiccup) —
    // only cache a real, successful lookup result.
    if (!('unavailable' in outcome)) {
      this.cache.set(ip, { outcome, expiresAt: Date.now() + CACHE_TTL_MS });
    }
    return outcome;
  }

  private async fetchLive(ip: string): Promise<VpnCheckOutcome> {
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
