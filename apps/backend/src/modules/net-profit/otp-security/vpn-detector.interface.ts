export type VpnCheckOutcome = { isVpn: boolean } | { unavailable: true };

// ADDENDUM §I — swap point for whichever IP-intelligence source is
// configured, matching every other provider interface in this codebase.
export interface VpnDetector {
  check(ip: string): Promise<VpnCheckOutcome>;
}
