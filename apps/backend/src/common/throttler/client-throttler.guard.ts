import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

// Replaces the plain @nestjs/throttler ThrottlerGuard as the global
// APP_GUARD (see app.module.ts) — PERF-BRIEF.md §7.
//
// Raw IP is the wrong tracker key for this app on two separate counts:
//  1. Bangladeshi mobile carriers (Grameenphone, Robi, Banglalink) put large
//     numbers of subscribers behind a small pool of public IPv4 addresses
//     (CGNAT). A burst of ad traffic can make dozens of distinct real
//     customers look like one IP and collectively blow through the shared
//     120/min budget on search-as-you-type and cart writes.
//  2. Several customer-authenticated endpoints (orders, wishlist,
//     addresses, and — as of the cart-merge-on-login fix — every cart call)
//     are proxied server-side through this app's own Next.js frontend
//     (apps/web's `/api/backend/[...path]` route), which does a plain
//     server-to-server `fetch()` with no `X-Forwarded-For` at all. Every
//     proxied request from every real user collapses onto the exact same
//     `req.ip` (this Next.js server's own outbound address) — worse than
//     CGNAT, since it throttles the whole site's proxied traffic as if it
//     were one visitor. `trust proxy` can't fix this by itself either: the
//     real topology is mixed (some requests reach this app directly behind
//     just Caddy, others go through Caddy *and* the Next.js server), so a
//     single global hop-count can't be correct for both paths.
//
// Fix: track by application-level identity instead, which is stable and
// correct regardless of how many network hops a request took or how many
// real users share a carrier IP. Falls back to `req.ip` only when none of
// these are present (an anonymous, unauthenticated, non-cart GET).
@Injectable()
export class ClientThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const headers = (req as { headers?: Record<string, unknown> }).headers ?? {};

    const guestToken = headers['x-guest-token'];
    if (typeof guestToken === 'string' && guestToken) return `guest:${guestToken}`;

    const auth = headers['authorization'];
    if (typeof auth === 'string' && auth) return `auth:${auth}`;

    // Client-generated, localStorage-persisted UUID (apps/web's
    // lib/device-id.ts) — sent on search-as-you-type specifically, the one
    // other endpoint the brief flagged as CGNAT-exposed and hit directly
    // from the browser (not proxied, no guest/auth header of its own).
    const deviceId = headers['x-device-id'];
    if (typeof deviceId === 'string' && deviceId) return `device:${deviceId}`;

    return (req as { ip?: string }).ip ?? 'unknown';
  }
}
