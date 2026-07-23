"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useAdminLogin, useAdminVerifyTwoFactor } from "@/hooks/useAdminAuth";

// Reference design's own literal palette (amader-login.html) — a one-off,
// pre-auth page outside the AppShell chrome, so it carries its own green
// brand instead of the admin dashboard's blue tokens (same reasoning as the
// Net Profit module's violet scope).
const green900 = "#1a4025";
const green800 = "#1d5230";
const green700 = "#2e7d43";
const green600 = "#3f9a56";
const greenSoft = "#eaf4ec";
const greenSoftLine = "#d5e8da";
const line = "#e3e7e2";
const ink = "#1f2a22";
const muted = "#6b7a70";
const faint = "#98a69c";

const leafPillIcon = (
  <svg width="22" height="22" viewBox="0 0 48 48" fill="none">
    <path d="M24 42C24 28 30 16 44 12c0 16-6 26-20 30Z" fill="#4caf50" />
    <path d="M22 40C22 30 17 21 6 18c0 12 5 19 16 22Z" fill="#7fc98a" />
  </svg>
);

const leafBrandIcon = (
  <svg width="52" height="52" viewBox="0 0 48 48" fill="none">
    <path d="M24 42C24 28 30 16 44 12c0 16-6 26-20 30Z" fill="#4caf50" />
    <path d="M22 40C22 30 17 21 6 18c0 12 5 19 16 22Z" fill={green700} />
  </svg>
);

const shieldIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

const mailIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);

const lockIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const eyeOpenIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const eyeClosedIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c6.5 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
    <path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
    <line x1="2" y1="2" x2="22" y2="22" />
  </svg>
);

const inputClass =
  "h-[52px] w-full rounded-[11px] border px-[46px] text-[0.92rem] font-medium outline-none transition-[border-color,box-shadow]";

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
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
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
    <div className="flex min-h-screen bg-[#2b2b27] max-[980px]:flex-col">
      {/* ================= LEFT HERO ================= */}
      {/* The PNG already has the "Amader Ltd" wordmark, headline, subline
          and all 4 feature rows composited into it — rendering the
          reference's live overlay text for those would just duplicate them.
          Only the bottom trust-badge + Bengali brand pill (not in the
          image) are rendered as live HTML, matching the reference. */}
      <section className="relative min-w-0 flex-1 max-[980px]:hidden">
        {/* object-left, not the default center crop — the image's brand/
            headline/feature text is anchored to its left edge, so a
            center-crop on tall/narrow viewports clips straight through it.
            Cropping surplus width off the right (plain shelf photography)
            is always safe. */}
        <Image src="/login-hero.png" alt="" fill priority sizes="54vw" className="object-cover object-left" />
        <div className="relative z-[1] flex h-full min-h-screen flex-col p-11">
          <div className="mt-auto flex flex-wrap items-end justify-between gap-5 pt-10">
            <div
              className="flex max-w-[250px] items-center gap-2.5 rounded-xl px-4 py-3 text-[0.8rem] font-semibold leading-snug"
              style={{ background: "rgba(255,255,255,.92)", color: "#3d4a41", boxShadow: "0 4px 14px rgba(60,80,50,.10)" }}
            >
              <span style={{ color: green600 }}>{shieldIcon}</span>
              Trusted by thousands of customers across Bangladesh
            </div>
            <div className="rounded-full px-[30px] py-3.5 text-center text-white" style={{ background: green900, boxShadow: "0 8px 22px rgba(20,50,28,.35)" }}>
              <div className="flex items-center justify-center gap-2 text-[1.35rem] font-bold">
                {leafPillIcon}
                আমাদের<sup className="-translate-y-1.5 text-[0.55rem] font-semibold">™</sup>
              </div>
              <div className="mt-[3px] text-[0.78rem] font-medium" style={{ color: "#cfe6cf" }}>
                প্রাকৃতিক খাবার, সুস্থ জীবন
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= RIGHT SIGN IN ================= */}
      <section
        className="relative z-[2] m-3.5 flex w-[min(46%,660px)] flex-shrink-0 flex-col rounded-[22px] bg-white px-24 pt-[30px] pb-[34px] max-[1200px]:px-14 max-[980px]:w-auto max-[980px]:px-6.5"
        style={{ boxShadow: "0 20px 60px rgba(15,25,15,.25)" }}
      >
        <div className="mt-1 text-center">
          <div className="flex justify-center">{leafBrandIcon}</div>
          <div className="mt-2 text-[2.15rem] font-extrabold tracking-tight" style={{ fontFamily: "var(--font-playfair), serif", color: green900 }}>
            Amader Ltd
          </div>
          <div className="mt-1.5 text-[0.95rem] font-semibold" style={{ color: green800 }}>
            প্রাকৃতিক খাবার, সুস্থ জীবন
          </div>
        </div>

        <div className="mt-[26px] border-b pb-[26px] text-center" style={{ borderColor: "#eef1ee" }}>
          <h1 className="text-[1.75rem] font-extrabold tracking-tight" style={{ color: ink }}>
            Welcome Back!
          </h1>
          <p className="mt-2.5 text-[0.95rem] font-medium" style={{ color: muted }}>
            {twoFactorToken ? "Enter the 6-digit code we emailed to your account address." : "Sign in to continue to your admin dashboard"}
          </p>
        </div>

        {!twoFactorToken ? (
          <form onSubmit={handleLogin} className="mt-[26px]">
            <div className="mb-5">
              <label htmlFor="email" className="mb-2.5 block text-[0.88rem] font-semibold" style={{ color: ink }}>
                Email Address
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-[15px] -translate-y-1/2" style={{ color: faint }}>
                  {mailIcon}
                </span>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="admin@amader.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  style={{ borderColor: line, color: ink }}
                  onFocus={(e) => (e.target.style.borderColor = green600)}
                  onBlur={(e) => (e.target.style.borderColor = line)}
                />
              </div>
            </div>

            <div className="mb-5">
              <label htmlFor="password" className="mb-2.5 block text-[0.88rem] font-semibold" style={{ color: ink }}>
                Password
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-[15px] -translate-y-1/2" style={{ color: faint }}>
                  {lockIcon}
                </span>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputClass} pr-[46px] tracking-[3px]`}
                  style={{ borderColor: line, color: ink }}
                  onFocus={(e) => (e.target.style.borderColor = green600)}
                  onBlur={(e) => (e.target.style.borderColor = line)}
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute top-1/2 right-1.5 grid h-[38px] w-[38px] -translate-y-1/2 place-items-center rounded-[9px] hover:bg-[#f4f7f4]"
                  style={{ color: faint }}
                >
                  {showPassword ? eyeClosedIcon : eyeOpenIcon}
                </button>
              </div>
            </div>

            <div className="my-0.5 mb-6 flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2.5 text-[0.88rem] font-semibold select-none" style={{ color: "#3d4a41" }}>
                {/* ponytail: native accent-color instead of a hand-rolled SVG-checkmark
                    checkbox — same visual result (tinted, rounded), a fraction of the CSS. */}
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-5 w-5 cursor-pointer rounded-md"
                  style={{ accentColor: green800 }}
                />
                Remember me
              </label>
            </div>

            {error && (
              <p className="mb-4 text-[0.85rem] font-semibold" style={{ color: "#c0392b" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={login.isPending}
              className="flex h-[54px] w-full items-center justify-center gap-2.5 rounded-xl text-[1rem] font-bold text-white transition-colors disabled:opacity-70"
              style={{ background: green900 }}
              onMouseEnter={(e) => !login.isPending && (e.currentTarget.style.background = "#153520")}
              onMouseLeave={(e) => (e.currentTarget.style.background = green900)}
            >
              {lockIcon}
              {login.isPending ? "Signing in…" : "Sign In"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="mt-[26px]">
            <div className="mb-6">
              <label htmlFor="code" className="mb-2.5 block text-[0.88rem] font-semibold" style={{ color: ink }}>
                Verification Code
              </label>
              <input
                id="code"
                inputMode="numeric"
                autoFocus
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="num h-[52px] w-full rounded-[11px] border px-4 text-center text-lg font-semibold tracking-[6px] outline-none transition-[border-color,box-shadow]"
                style={{ borderColor: line, color: ink }}
                onFocus={(e) => (e.target.style.borderColor = green600)}
                onBlur={(e) => (e.target.style.borderColor = line)}
              />
            </div>

            {error && (
              <p className="mb-4 text-[0.85rem] font-semibold" style={{ color: "#c0392b" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={verify2fa.isPending}
              className="flex h-[54px] w-full items-center justify-center gap-2.5 rounded-xl text-[1rem] font-bold text-white disabled:opacity-70"
              style={{ background: green900 }}
            >
              {verify2fa.isPending ? "Verifying…" : "Verify"}
            </button>
          </form>
        )}

        <div className="my-[26px] h-px" style={{ background: line }} />

        <div className="flex items-start gap-[15px] rounded-[13px] border px-5 py-[18px]" style={{ background: greenSoft, borderColor: greenSoftLine }}>
          <span className="mt-0.5" style={{ color: green800 }}>
            {shieldIcon}
          </span>
          <div>
            <h4 className="text-[0.92rem] font-bold" style={{ color: ink }}>
              Secure Admin Access
            </h4>
            <p className="mt-1.5 text-[0.85rem] leading-relaxed font-medium" style={{ color: muted }}>
              Your data is protected with enterprise-grade security and encryption.
            </p>
          </div>
        </div>

        <div className="mt-auto pt-[30px] text-center text-[0.8rem] font-medium" style={{ color: faint }}>
          © 2026 Amader Ltd. All rights reserved.
        </div>
      </section>
    </div>
  );
}
