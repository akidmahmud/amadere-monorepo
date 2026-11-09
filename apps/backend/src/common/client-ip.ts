import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { networkInterfaces } from 'node:os';

const clean = (ip: string) => ip.replace(/^::ffff:/, '');

const ownAddresses = new Set<string>(
  Object.values(networkInterfaces())
    .flat()
    .flatMap((i) => (i ? [clean(i.address)] : [])),
);

/**
 * Also the addresses the API's public host resolves to: the storefront calls
 * this API by its public name, which lands back on this same machine, and on
 * a NATed box that address is not on any interface.
 */
export async function loadOwnAddresses(apiBaseUrl?: string): Promise<void> {
  if (!apiBaseUrl) return;
  try {
    const found = await lookup(new URL(apiBaseUrl).hostname, { all: true });
    for (const a of found) ownAddresses.add(clean(a.address));
  } catch {
    // DNS down at boot: the interface addresses above still apply.
  }
}

/** True for this server itself — never a visitor, and never blockable. */
export const isOwnAddress = (ip: string): boolean => ownAddresses.has(clean(ip));

/**
 * The real visitor behind our own storefront proxy.
 *
 * The storefront reaches this API through the public reverse proxy, which
 * reports the storefront server (200.141.0.91) as the client and drops the
 * X-Forwarded-For it sent, so every web order was recorded with our own IP.
 * The storefront now names the visitor in X-Client-IP. That header is only
 * believed when the request really came from this machine, so nobody outside
 * can forge an IP with it.
 */
export function resolveClientIp(
  reqIp: string | undefined,
  header: unknown,
  isOwn: (ip: string) => boolean = isOwnAddress,
): string | undefined {
  if (!reqIp || !isOwn(reqIp) || typeof header !== 'string') return reqIp;
  const ip = header.trim();
  return isIP(ip) ? ip : reqIp;
}
