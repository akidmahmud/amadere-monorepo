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
// Auth routes, under both the customer (`/api/v1/auth/...`) and admin
// (`/api/v1/admin/auth/...`) controllers.
const AUTH_ROUTE = /^\/api\/v1\/(admin\/)?auth\//;

@Injectable()
export class ClientThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const headers = (req as { headers?: Record<string, unknown> }).headers ?? {};

    // Auth routes must NOT be keyed on the client-supplied identity headers
    // used below. Those headers are the whole point of this guard everywhere
    // else, but on a login endpoint they are attacker-controlled: minting a
    // fresh `x-device-id` (or `x-guest-token`) per request hands out a brand
    // new bucket every time, so the `@Throttle({ limit: 5 })` on
    // admin-auth.controller.ts and auth.controller.ts never actually binds.
    // That was a real bypass, introduced as a side effect of the CGNAT fix
    // described below.
    //
    // Key on network origin + the account being targeted instead. IP alone
    // would be wrong for the same CGNAT reason: a carrier IP shared by many
    // real customers would let one person's failed logins lock out everyone
    // else's. Pairing it with the identifier means brute-forcing a single
    // account is capped no matter how many device ids are minted, while two
    // genuine customers behind one carrier IP still get independent buckets.
    if (AUTH_ROUTE.test(String((req as { url?: string }).url ?? ''))) {
      const body = (req as { body?: Record<string, unknown> }).body ?? {};
      // `email` on AdminLoginDto, `identifier` on the customer LoginDto
      // (phone OR email), `phone` on the OTP routes.
      const account = [body.email, body.identifier, body.phone].find(
        (v): v is string => typeof v === 'string' && v.length > 0,
      );
      const ip = (req as { ip?: string }).ip ?? 'unknown';
      // Prefix deliberately distinct from the `auth:` used for the
      // Authorization header below — sharing it would let someone send a
      // crafted Authorization value that lands in a victim's login bucket
      // and exhausts their 5/min, locking them out.
      return `authroute:${ip}:${account?.toLowerCase() ?? ''}`;
    }

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
