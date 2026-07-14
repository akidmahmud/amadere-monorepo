import createClient, { type Middleware } from "openapi-fetch";
import type { PathsWithMethod } from "openapi-typescript-helpers";
import type { ApiErrorResponse } from "@amader/shared";
import type { paths } from "./schema";

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Every response is wrapped as { success, data } / { success: false, error }
// (apps/backend ResponseInterceptor / HttpExceptionFilter) — unwrap once here so
// call sites just get `data`, never the envelope.
const unwrapEnvelope: Middleware = {
  async onResponse({ response }) {
    let body: { success: true; data: unknown } | ApiErrorResponse;
    try {
      body = (await response.clone().json()) as typeof body;
    } catch {
      // Non-JSON/empty body — the response didn't come from this app's own
      // ResponseInterceptor at all (wrong baseUrl, proxy in the way, dev
      // server overload). Surface a clean ApiError instead of a raw
      // SyntaxError so every call site's existing error handling still works.
      throw new ApiError(response.status, "invalid_response", "Response body was not valid JSON");
    }

    if (!body.success) {
      throw new ApiError(response.status, body.error.code, body.error.message, body.error.details);
    }

    return new Response(JSON.stringify(body.data), {
      status: response.status,
      headers: response.headers,
    });
  },
};

export const api = createClient<paths>({ baseUrl });
api.use(unwrapEnvelope);

// Server-rendered catalog/blog/category sections degrade to their designed
// empty state rather than failing the whole page (or the whole build, for
// statically-generated routes) if the backend is briefly unreachable. The
// path argument stays typo-checked; re-deriving openapi-fetch's `Init`/
// `FetchResponse` generics just for this fallback isn't worth it, so options
// and the returned `data` are untyped here — callers already treat `data` as
// possibly-absent.
export async function safeGet<P extends PathsWithMethod<paths, "get">>(
  path: P,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options?: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ data: any }> {
  try {
    const result = await api.GET(path, options);
    return { data: result.data };
  } catch {
    return { data: undefined };
  }
}
