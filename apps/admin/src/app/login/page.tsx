"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card } from "@amader/admin-ui";
import { useAdminLogin, useAdminVerifyTwoFactor } from "@/hooks/useAdminAuth";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [twoFactorToken, setTwoFactorToken] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const login = useAdminLogin();
  const verify2fa = useAdminVerifyTwoFactor();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const result = await login.mutateAsync({ email, password });
      if (result?.requiresTwoFactor) {
        setTwoFactorToken(result.twoFactorToken);
      } else {
        router.push(next);
      }
    } catch (err) {
      // Surface the real reason (e.g. "Backend is unreachable") instead of
      // always blaming the credentials — a down backend and a wrong
      // password are different problems and shouldn't look identical.
      setError(err instanceof Error ? err.message : "Invalid email or password.");
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await verify2fa.mutateAsync({ twoFactorToken: twoFactorToken!, code });
      router.push(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid or expired code.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-5">
      <Card className="w-full max-w-sm">
        <div className="mb-6 font-display text-xl font-bold text-text">
          <b>Amader</b> Admin
        </div>

        {!twoFactorToken ? (
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-secondary">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10 rounded-sm border border-border bg-surface px-3 font-ui text-sm text-text outline-none focus:border-brand-500"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-secondary">Password</span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10 rounded-sm border border-border bg-surface px-3 font-ui text-sm text-text outline-none focus:border-brand-500"
              />
            </label>
            {error && <p className="text-xs text-danger">{error}</p>}
            <Button type="submit" variant="primary" disabled={login.isPending} className="mt-1 w-full justify-center">
              {login.isPending ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="flex flex-col gap-4">
            <p className="text-sm text-secondary">Enter the 6-digit code we emailed to your account address.</p>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-secondary">Code</span>
              <input
                inputMode="numeric"
                autoFocus
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="num h-10 rounded-sm border border-border bg-surface px-3 text-center font-ui text-lg tracking-[4px] text-text outline-none focus:border-brand-500"
              />
            </label>
            {error && <p className="text-xs text-danger">{error}</p>}
            <Button type="submit" variant="primary" disabled={verify2fa.isPending} className="mt-1 w-full justify-center">
              {verify2fa.isPending ? "Verifying…" : "Verify"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
