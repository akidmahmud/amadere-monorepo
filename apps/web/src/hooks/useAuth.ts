import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { proxyFetch } from "@/lib/api/proxy-client";
import { mergeGuestCartOnLogin } from "@/hooks/useCart";
import type { components } from "@/lib/api/schema";

type CustomerProfileDto = components["schemas"]["CustomerProfileDto"];

// `details` carries structured extras the backend attaches to some errors
// (e.g. register()'s duplicate-phone/email conflict sets `details.field` so
// the UI can place the message under the right input instead of a generic
// banner) — a plain Error has nowhere to put that, so callers that care
// narrow on this subclass instead of just reading `.message`.
export class LocalAuthError extends Error {
  details?: unknown;
  constructor(message: string, details?: unknown) {
    super(message);
    this.details = details;
  }
}

// Returns the response payload (was `void`) — register() now needs to know
// which channel the code actually went to. Every other caller ignores the
// return value, so widening it changes nothing for them.
async function localAuthCall<T = void>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.success) throw new LocalAuthError(json.error?.message ?? "Request failed", json.error?.details);
  return json.data as T;
}

// Every successful login/OTP-verify needs the same follow-up: the account
// query becomes valid, and anything added to the cart as a guest should
// fold into the now-known customer's cart (the merge function itself was
// written back in F6, waiting for this exact call site). Plain register()
// does NOT get this — it only sends an OTP and doesn't sign anyone in;
// verifying that OTP (useVerifyOtp, purpose=REGISTER) is what actually
// authenticates.
function useAfterAuthSuccess(locale: string) {
  const queryClient = useQueryClient();
  return async () => {
    // Cart-merge is a convenience, not a login requirement — a stale/
    // already-consumed guest token (e.g. this isn't the first login on this
    // browser) throwing here must never block the sign-in itself from
    // completing (previously an unhandled rejection here silently stopped
    // the caller's own onSuccess, e.g. the post-login redirect, from
    // running at all — login *looked* broken when only the merge failed).
    try {
      await mergeGuestCartOnLogin(locale);
    } catch {
      // Ignored — see above.
    }
    await queryClient.invalidateQueries({ queryKey: ["me"] });
    await queryClient.invalidateQueries({ queryKey: ["cart"] });
  };
}

// `identifier` is a phone number OR an email — the backend resolves either
// via findByIdentifier (same helper the OTP flows use). It still accepts the
// old `phone` key as a deprecated alias, so this rename doesn't have to land
// in the same deploy as the backend.
export function useLogin(locale: string) {
  const onAuthed = useAfterAuthSuccess(locale);
  return useMutation({
    mutationFn: (args: { identifier: string; password: string }) => localAuthCall("/auth/login", args),
    onSuccess: onAuthed,
  });
}

export function useSocialLogin(locale: string) {
  const onAuthed = useAfterAuthSuccess(locale);
  return useMutation({
    mutationFn: (args: { provider: "GOOGLE" | "FACEBOOK"; accessToken: string }) =>
      localAuthCall("/auth/social-login", args),
    onSuccess: onAuthed,
  });
}

// Sends the registration OTP — does not create a session. Safe to call
// again with the same phone (e.g. "Resend code" or fixing a typo before the
// code arrives): the backend upserts the same pending row and re-sends.
export function useRegister() {
  return useMutation({
    mutationFn: (
      args: {
        firstName: string;
        lastName: string;
        phone: string;
        email?: string;
        password: string;
        // Omitted = PHONE. Only ever sent as EMAIL when the customer both
        // supplied an email and picked it.
        otpChannel?: "PHONE" | "EMAIL";
      },
    ) =>
      localAuthCall<{
        pending: true;
        otpChannel: "PHONE" | "EMAIL";
        // Echo this back to /auth/otp/verify — the code is stored under this
        // exact string, so guessing "phone" would fail an email signup.
        otpIdentifier: string;
      }>("/auth/register", args),
  });
}

export function useRequestOtp() {
  return useMutation({
    mutationFn: async (args: { identifier: string; purpose: "REGISTER" | "LOGIN" }) => {
      const { error } = await api.POST("/api/v1/auth/otp/request", { body: args });
      if (error) throw error;
    },
  });
}

export function useVerifyOtp(locale: string) {
  const onAuthed = useAfterAuthSuccess(locale);
  return useMutation({
    mutationFn: (args: { identifier: string; code: string; purpose: "REGISTER" | "LOGIN" }) =>
      localAuthCall("/auth/otp/verify", args),
    onSuccess: onAuthed,
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => localAuthCall("/auth/logout", {}),
    onSuccess: () => queryClient.setQueryData(["me"], null),
  });
}

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        return await proxyFetch<CustomerProfileDto>("/customers/me");
      } catch {
        return null;
      }
    },
  });
}
