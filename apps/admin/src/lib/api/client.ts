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
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Every response is wrapped as { success, data } / { success: false, error }
// (apps/backend ResponseInterceptor / HttpExceptionFilter) — unwrap once here
// so call sites just get `data`, never the envelope.
const unwrapEnvelope: Middleware = {
  async onResponse({ response }) {
    let body: { success: true; data: unknown } | ApiErrorResponse;
    try {
      body = (await response.clone().json()) as typeof body;
    } catch {
      throw new ApiError(response.status, "invalid_response", "Response body was not valid JSON");
    }

    if (!body.success) {
      throw new ApiError(response.status, body.error.code, body.error.message);
    }

    return new Response(JSON.stringify(body.data), {
      status: response.status,
      headers: response.headers,
    });
  },
};

export const api = createClient<paths>({ baseUrl });
api.use(unwrapEnvelope);

// Only used for build-time-safe reads (none yet in the admin app — every
// admin call needs the Bearer token, so real fetches go through
// proxyFetch/the /api/backend proxy instead). Kept for parity with the
// storefront's client shape in case a public, unauthenticated read is ever
// needed here.
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
