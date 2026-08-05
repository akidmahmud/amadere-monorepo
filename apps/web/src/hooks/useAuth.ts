import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { proxyFetch } from "@/lib/api/proxy-client";
import { mergeGuestCartOnLogin } from "@/hooks/useCart";
import type { components } from "@/lib/api/schema";

type CustomerProfileDto = components["schemas"]["CustomerProfileDto"];

async function localAuthCall(path: string, body: unknown): Promise<void> {
  const res = await fetch(`/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message ?? "Request failed");
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

export function useLogin(locale: string) {
  const onAuthed = useAfterAuthSuccess(locale);
  return useMutation({
    mutationFn: (args: { phone: string; password: string }) => localAuthCall("/auth/login", args),
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
    mutationFn: (args: { firstName: string; lastName: string; phone: string; email?: string; password: string }) =>
      localAuthCall("/auth/register", args),
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
