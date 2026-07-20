import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";

type AdminProfileDto = components["schemas"]["AdminProfileDto"];

interface TwoFactorRequired {
  requiresTwoFactor: true;
  twoFactorToken: string;
}

async function localAuthCall<T = undefined>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message ?? "Request failed");
  return json.data as T;
}

// Resolves to `undefined` on a normal login (tokens are already set as
// httpOnly cookies server-side) or `TwoFactorRequired` when the account has
// 2FA enabled — the caller decides whether to show the code step.
export function useAdminLogin() {
  return useMutation({
    mutationFn: (args: { email: string; password: string }) =>
      localAuthCall<TwoFactorRequired | undefined>("/auth/login", args),
  });
}

export function useAdminVerifyTwoFactor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { twoFactorToken: string; code: string }) => localAuthCall("/auth/2fa-verify", args),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-me"] }),
  });
}

export function useAdminMe() {
  return useQuery({
    queryKey: ["admin-me"],
    queryFn: () => proxyFetch<AdminProfileDto>("/admin/auth/me"),
    retry: false,
  });
}

export function useAdminLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => localAuthCall("/auth/logout", {}),
    onSuccess: () => queryClient.clear(),
  });
}

// Email-OTP 2FA enrollment for the signed-in admin's own account — a
// regular authenticated call (proxyFetch), unlike login/2fa-verify above
// which need the special cookie-setting Next.js route since there's no
// session yet at that point.
export function useSetupTwoFactor() {
  return useMutation({
    mutationFn: () => proxyFetch<void>("/admin/auth/2fa/setup", { method: "POST" }),
  });
}

export function useEnableTwoFactor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => proxyFetch<void>("/admin/auth/2fa/enable", { method: "POST", body: JSON.stringify({ code }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-me"] }),
  });
}

export function useDisableTwoFactor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => proxyFetch<void>("/admin/auth/2fa/disable", { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-me"] }),
  });
}
