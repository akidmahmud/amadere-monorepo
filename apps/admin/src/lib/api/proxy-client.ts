import type { ApiErrorResponse } from "@amader/shared";

export class ProxyApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    /** The API's `error.details`. Carried through because some failures are
     *  only useful as a list -- publish validation names every missing block,
     *  and collapsing that to a one-line message throws away the only part the
     *  owner can act on. */
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ProxyApiError";
  }
}

// Client-side helper for authenticated calls — hits this app's own
// `/api/backend/[...path]` Route Handler (never the backend directly), which
// is what actually attaches the Bearer token from the httpOnly cookie.
export async function proxyFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/backend${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = (await res.json()) as { success: true; data: T } | ApiErrorResponse;
  if (!body.success) {
    throw new ProxyApiError(
      res.status,
      body.error.code,
      body.error.message,
      (body.error as { details?: unknown }).details,
    );
  }
  return body.data;
}
