"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Button, Input } from "@amader/ui";
import { useRouter, Link } from "@/i18n/navigation";
import { toApiLocale } from "@/lib/api-locale";
import { useLogin, useRequestOtp, useVerifyOtp } from "@/hooks/useAuth";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

export function LoginForm() {
  const locale = toApiLocale(useLocale());
  const router = useRouter();
  const redirectTo = useSearchParams().get("redirect") || "/account";

  const [identifier, setIdentifier] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const requestOtp = useRequestOtp();
  const verifyOtp = useVerifyOtp(locale);
  const login = useLogin(locale);

  function goToRedirect() {
    router.push(redirectTo);
  }

  return (
    <div className="mx-auto max-w-[920px] rounded-[18px] bg-white p-9 shadow-brand">
      <div className="mb-7 flex items-center justify-center gap-3.5">
        <div className="grid h-[52px] w-[52px] place-items-center rounded-xl bg-gold text-white">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6">
            <circle cx="12" cy="8" r="3.4" />
            <path d="M5 20c0-3.6 3.1-5.5 7-5.5s7 1.9 7 5.5" />
          </svg>
        </div>
        <div>
          <h1 className="font-serif text-xl font-semibold text-ink">Sign in</h1>
          <p className="font-body text-sm text-muted">Access your account securely</p>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_60px_1fr] items-stretch max-md:grid-cols-1 max-md:gap-5">
        <div className="rounded-xl bg-[#F2F2F2] p-6">
          <h4 className="mb-3.5 font-ui text-sm font-semibold text-ink">Login With Mobile Number</h4>
          <Input
            placeholder="017***********"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            disabled={otpSent}
          />
          {otpSent && (
            <Input
              className="mt-3"
              placeholder="Enter OTP code"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
            />
          )}
          {(requestOtp.isError || verifyOtp.isError) && (
            <p className="mt-2 font-body text-xs text-red-600">
              {(requestOtp.error ?? verifyOtp.error) instanceof Error
                ? ((requestOtp.error ?? verifyOtp.error) as Error).message
                : "Something went wrong"}
            </p>
          )}
          <Button
            variant="green"
            block
            className="mt-3.5"
            disabled={!identifier || requestOtp.isPending || verifyOtp.isPending}
            onClick={() => {
              if (!otpSent) {
                requestOtp.mutate({ identifier, purpose: "LOGIN" }, { onSuccess: () => setOtpSent(true) });
              } else {
                verifyOtp.mutate({ identifier, code: otpCode, purpose: "LOGIN" }, { onSuccess: goToRedirect });
              }
            }}
          >
            {otpSent ? "Verify & Sign In" : "Send OTP"}
          </Button>
        </div>

        <div className="flex flex-col items-center justify-center gap-1.5 max-md:hidden">
          <span className="w-px flex-1 bg-line" />
          <span className="grid h-[38px] w-[38px] place-items-center rounded-full border border-line bg-white font-ui text-xs text-muted">
            OR
          </span>
          <span className="w-px flex-1 bg-line" />
        </div>

        <div className="rounded-xl bg-[#F2F2F2] p-6">
          <h4 className="mb-3.5 font-ui text-sm font-semibold text-ink">Login With Credentials</h4>
          <Input
            className="mb-3.5"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="my-3 flex items-center justify-between font-body text-xs text-muted">
            <span />
            <Link href="/forgot-password" className="text-green">
              Forgotten password?
            </Link>
          </div>
          {login.isError && (
            <p className="mb-2 font-body text-xs text-red-600">
              {login.error instanceof Error ? login.error.message : "Invalid credentials"}
            </p>
          )}
          <Button
            variant="green"
            block
            disabled={!email || !password || login.isPending}
            onClick={() => login.mutate({ email, password }, { onSuccess: goToRedirect })}
          >
            Login
          </Button>
        </div>
      </div>

      <div className="mt-6 text-center">
        <GoogleSignInButton locale={locale} onSuccess={goToRedirect} />
        <p className="mt-4 font-body text-sm text-ink">
          Don&apos;t have any account? <Link href="/register" className="text-green underline">Register account</Link>
        </p>
      </div>
    </div>
  );
}
