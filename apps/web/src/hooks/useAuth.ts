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

// Every successful login/register/OTP-verify needs the same follow-up: the
// account query becomes valid, and anything added to the cart as a guest
// should fold into the now-known customer's cart (the merge function itself
// was written back in F6, waiting for this exact call site).
function useAfterAuthSuccess(locale: string) {
  const queryClient = useQueryClient();
  return async () => {
    await mergeGuestCartOnLogin(locale);
    await queryClient.invalidateQueries({ queryKey: ["me"] });
    await queryClient.invalidateQueries({ queryKey: ["cart"] });
  };
}

export function useLogin(locale: string) {
  const onAuthed = useAfterAuthSuccess(locale);
  return useMutation({
    mutationFn: (args: { email: string; password: string }) => localAuthCall("/auth/login", args),
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

export function useRegister(locale: string) {
  const onAuthed = useAfterAuthSuccess(locale);
  return useMutation({
    mutationFn: (args: { email: string; password: string; firstName?: string; lastName?: string }) =>
      localAuthCall("/auth/register", args),
    onSuccess: onAuthed,
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

export function useForgotPassword() {
  return useMutation({
    mutationFn: async (identifier: string) => {
      const { error } = await api.POST("/api/v1/auth/password/forgot", { body: { identifier } });
      if (error) throw error;
    },
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: async (args: { identifier: string; code: string; newPassword: string }) => {
      const { error } = await api.POST("/api/v1/auth/password/reset", { body: args });
      if (error) throw error;
    },
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
