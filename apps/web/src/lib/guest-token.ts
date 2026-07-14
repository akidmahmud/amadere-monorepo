const COOKIE_NAME = "guest_cart_token";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

// Plain document.cookie is all this needs — one string, read/written only in
// the browser (every cart call is client-side). No cookie library pulled in
// for something this small.
export function getGuestToken(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

export function setGuestToken(token: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(token)}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
}

export function clearGuestToken(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`;
}
