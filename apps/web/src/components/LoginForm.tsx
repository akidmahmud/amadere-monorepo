"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { isValidBdPhone } from "@amader/shared";
import { useRouter } from "@/i18n/navigation";
import { toApiLocale } from "@/lib/api-locale";
import {
  useLogin,
  useRequestOtp,
  useVerifyOtp,
  useRegister,
  useResetPassword,
  LocalAuthError,
} from "@/hooks/useAuth";
import { useResendCooldown } from "@/hooks/useResendCooldown";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

function passwordStrength(pw: string): { meetsMinimum: boolean; score: number; label: string } {
  if (pw.length < 8) return { meetsMinimum: false, score: 0, label: "Needs at least 8 characters" };
  let variety = 0;
  if (/[a-z]/.test(pw)) variety++;
  if (/[A-Z]/.test(pw)) variety++;
  if (/\d/.test(pw)) variety++;
  if (/[^A-Za-z0-9]/.test(pw)) variety++;
  let score = 1;
  if (variety >= 2) score = 2;
  if (variety >= 3) score = 3;
  if (variety >= 3 && pw.length >= 12) score = 4;
  return { meetsMinimum: true, score, label: ["", "Weak", "Fair", "Good", "Strong"][score] };
}

const STRENGTH_BAR_COLOR = ["bg-red-600", "bg-red-600", "bg-amber-500", "bg-blue-500", "bg-[#197B40]"];
const STRENGTH_TEXT_COLOR = ["text-red-600", "text-red-600", "text-amber-600", "text-blue-600", "text-[#197B40]"];

function generatePassword(length = 14): string {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*";
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (v) => charset[v % charset.length]).join("");
}

const loginTabIcon = (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const registerTabIcon = (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="8.5" cy="7" r="4" />
    <line x1="20" y1="8" x2="20" y2="14" />
    <line x1="17" y1="11" x2="23" y2="11" />
  </svg>
);

const phoneEmailIcon = (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="2" width="14" height="20" rx="3" ry="3" />
    <line x1="12" y1="18" x2="12.01" y2="18" />
  </svg>
);

const phoneIcon = (
  <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="2" width="14" height="20" rx="3" ry="3" />
    <line x1="12" y1="18" x2="12.01" y2="18" />
  </svg>
);

const lockIcon = (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const eyeIcon = (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const eyeOffIcon = (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a20.3 20.3 0 0 1 5.06-6.06M9.9 4.24A9.96 9.96 0 0 1 12 4c7 0 11 8 11 8a20.4 20.4 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24" />
    <path d="M1 1l22 22" />
  </svg>
);

const arrowRightIcon = (
  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
    <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
  </svg>
);

const mobileOtpBadgeIcon = (
  <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="2" width="14" height="20" rx="3" ry="3" />
    <path d="M9 9h6M9 12h4" />
  </svg>
);

const sendIcon = (
  <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

export function LoginForm({ defaultMode = "login" }: { defaultMode?: "login" | "register" }) {
  const locale = toApiLocale(useLocale());
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/account";
  // Set by the digital checkout when the buyer's email already had an
  // account. No session was issued for it on purpose (see the
  // account-takeover note on CheckoutAccountService.ensureAccount), so they
  // land here instead of on their downloads and need to be told why.
  const noticeDigitalExisting = searchParams.get("notice") === "digital-existing";

  const [mode, setMode] = useState<"login" | "register">(defaultMode);

  // "Forgot password" is a view inside login mode, not its own route: the
  // Login/Register tabs stay visible and usable, and there is no extra URL to
  // keep in sync with the ?redirect= target.
  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [fpIdentifier, setFpIdentifier] = useState("");
  const [fpCode, setFpCode] = useState("");
  const [fpPassword, setFpPassword] = useState("");
  const [fpShowPassword, setFpShowPassword] = useState(false);
  const [fpSent, setFpSent] = useState(false);

  // Credentials Login state
  const [credential, setCredential] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // OTP Login state
  const [identifier, setIdentifier] = useState("");
  const [loginOtpCode, setLoginOtpCode] = useState("");
  const [loginOtpSent, setLoginOtpSent] = useState(false);

  // Register state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regShowPassword, setRegShowPassword] = useState(false);
  const [regOtpSent, setRegOtpSent] = useState(false);
  const [regOtpCode, setRegOtpCode] = useState("");
  const [regOtpChannel, setRegOtpChannel] = useState<"PHONE" | "EMAIL">("PHONE");
  const [regSentTo, setRegSentTo] = useState("");

  // Auth mutations
  const login = useLogin(locale);
  const requestOtp = useRequestOtp();
  const verifyOtp = useVerifyOtp(locale);
  const register = useRegister();
  const resetPassword = useResetPassword();

  // Cooldown timers
  const loginResendCooldown = useResendCooldown();
  const regResendCooldown = useResendCooldown();
  const fpResendCooldown = useResendCooldown();

  function goToRedirect() {
    router.push(redirectTo);
  }

  function handleModeChange(newMode: "login" | "register") {
    setMode(newMode);
    setForgotOpen(false);
    // Carry ?redirect= across the switch. Without it someone sent here from
    // /checkout who taps "Register" lands on a bare /register and is dropped
    // at /account after signing up, having lost the cart they came to pay for.
    const qs = redirectTo === "/account" ? "" : `?redirect=${encodeURIComponent(redirectTo)}`;
    router.push(`${newMode === "register" ? "/register" : "/login"}${qs}`, { scroll: false });
  }

  // Registration Validation
  const emailEntered = regEmail.trim().length > 0;
  const phoneEntered = regPhone.trim().length > 0;
  const effectiveChannel = !phoneEntered ? "EMAIL" : emailEntered ? regOtpChannel : "PHONE";
  const phoneOk = phoneEntered ? isValidBdPhone(regPhone) : false;
  const canSubmitRegister =
    Boolean(firstName.trim()) &&
    Boolean(lastName.trim()) &&
    (phoneOk || emailEntered) &&
    (!phoneEntered || phoneOk) &&
    regPassword.length >= 8;
  const strength = passwordStrength(regPassword);

  const conflictField =
    register.error instanceof LocalAuthError &&
    register.error.details &&
    typeof register.error.details === "object" &&
    "field" in register.error.details
      ? (register.error.details as { field?: string }).field
      : undefined;
  const genericRegError = register.isError && conflictField !== "phone" && conflictField !== "email";

  function submitRegisterDetails() {
    register.mutate(
      {
        firstName,
        lastName,
        phone: regPhone,
        email: regEmail || undefined,
        password: regPassword,
        otpChannel: effectiveChannel,
      },
      {
        onSuccess: (data) => {
          setRegSentTo(data.otpIdentifier);
          setRegOtpSent(true);
          regResendCooldown.start();
        },
      },
    );
  }

  const fpStrength = passwordStrength(fpPassword);
  const fpError = resetPassword.error ?? requestOtp.error;

  function closeForgot() {
    setForgotOpen(false);
    setFpSent(false);
    setFpCode("");
    setFpPassword("");
    requestOtp.reset();
    resetPassword.reset();
  }

  const forgotPanel = (
    <div>
      <div className="mb-6 text-center">
        <h1 className="font-ui text-2xl font-bold tracking-tight text-slate-800">Reset Password</h1>
        <p className="mt-1 font-body text-xs text-slate-500">
          {fpSent
            ? "Enter the code we sent, then choose a new password."
            : "We'll send a 6-digit code to your mobile number or email."}
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!fpSent) {
            if (!fpIdentifier || requestOtp.isPending) return;
            requestOtp.mutate(
              { identifier: fpIdentifier, purpose: "RESET_PASSWORD" },
              { onSuccess: () => { setFpSent(true); fpResendCooldown.start(); } },
            );
            return;
          }
          if (!fpCode || fpPassword.length < 8 || resetPassword.isPending) return;
          resetPassword.mutate(
            { identifier: fpIdentifier, code: fpCode, newPassword: fpPassword },
            {
              onSuccess: () => {
                // A reset code deliberately does not sign anyone in, so send
                // them back to the login form with the identifier prefilled.
                setCredential(fpIdentifier);
                setPassword("");
                setResetDone(true);
                closeForgot();
              },
            },
          );
        }}
        className="space-y-3"
      >
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            {phoneEmailIcon}
          </span>
          <input
            type="text"
            aria-label="Mobile number or email"
            placeholder="Mobile Number or Email"
            autoComplete="username"
            value={fpIdentifier}
            onChange={(e) => setFpIdentifier(e.target.value)}
            disabled={fpSent}
            className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3.5 font-body text-sm text-slate-800 outline-none transition-colors focus:border-[#197B40] disabled:bg-slate-100"
          />
        </div>

        {fpSent && (
          <>
            <input
              type="text"
              aria-label="Reset code"
              placeholder="Enter 6-digit code"
              inputMode="numeric"
              maxLength={6}
              autoComplete="one-time-code"
              value={fpCode}
              onChange={(e) => setFpCode(e.target.value.replace(/\D/g, ""))}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-center font-mono text-sm tracking-widest text-slate-800 outline-none focus:border-[#197B40]"
            />

            <div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                  {lockIcon}
                </span>
                <input
                  type={fpShowPassword ? "text" : "password"}
                  aria-label="New password"
                  placeholder="New password (min. 8 characters)"
                  autoComplete="new-password"
                  value={fpPassword}
                  onChange={(e) => setFpPassword(e.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-10 font-body text-sm text-slate-800 outline-none transition-colors focus:border-[#197B40]"
                />
                <button
                  type="button"
                  aria-label={fpShowPassword ? "Hide password" : "Show password"}
                  onClick={() => setFpShowPassword((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {fpShowPassword ? eyeOffIcon : eyeIcon}
                </button>
              </div>
              {fpPassword.length > 0 && (
                <div className="mt-2 flex flex-col gap-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((seg) => (
                      <span
                        key={seg}
                        className={`h-1 flex-1 rounded-full ${
                          seg <= fpStrength.score ? STRENGTH_BAR_COLOR[fpStrength.score] : "bg-slate-200"
                        }`}
                      />
                    ))}
                  </div>
                  <span className={`font-body text-[11px] font-semibold ${STRENGTH_TEXT_COLOR[fpStrength.score]}`}>
                    {fpStrength.meetsMinimum ? `${fpStrength.label} password` : fpStrength.label}
                  </span>
                </div>
              )}
            </div>
          </>
        )}

        {fpError && (
          <p className="font-body text-xs text-red-600">
            {fpError instanceof Error ? fpError.message : "Something went wrong"}
          </p>
        )}

        <button
          type="submit"
          disabled={
            fpSent
              ? !fpCode || fpPassword.length < 8 || resetPassword.isPending
              : !fpIdentifier || requestOtp.isPending
          }
          className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#197B40] font-ui text-sm font-bold text-white shadow-sm transition-all hover:bg-[#156635] active:scale-[0.99] disabled:opacity-60"
        >
          <span>
            {fpSent
              ? resetPassword.isPending ? "Updating…" : "Set New Password"
              : requestOtp.isPending ? "Sending…" : "Send Code"}
          </span>
          {arrowRightIcon}
        </button>

        {fpSent && (
          <button
            type="button"
            disabled={!fpResendCooldown.canResend || requestOtp.isPending}
            onClick={() =>
              requestOtp.mutate(
                { identifier: fpIdentifier, purpose: "RESET_PASSWORD" },
                { onSuccess: () => fpResendCooldown.start() },
              )
            }
            className="w-full text-center font-body text-xs font-semibold text-[#197B40] hover:underline disabled:opacity-50"
          >
            {fpResendCooldown.canResend
              ? requestOtp.isPending ? "Sending…" : "Resend code"
              : `Resend code in ${fpResendCooldown.secondsLeft}s`}
          </button>
        )}
      </form>

      <div className="mt-6 flex items-center justify-between rounded-full border border-emerald-100 bg-[#F4FAF6] px-5 py-3 text-xs">
        <span className="font-medium text-slate-600">Remembered it?</span>
        <button
          type="button"
          onClick={closeForgot}
          className="flex items-center gap-1 font-bold text-[#197B40] hover:underline"
        >
          <span>Back to sign in</span>
          {arrowRightIcon}
        </button>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-[460px] rounded-[28px] border border-emerald-100/90 bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.06)] sm:p-8">
      {/* Top Segmented Switcher (Login / Register) */}
      <div className="mb-6 flex items-center rounded-full bg-[#F2F8F4] p-1.5 gap-1.5">
        <button
          type="button"
          onClick={() => handleModeChange("login")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-full py-2.5 font-ui text-sm font-bold transition-all ${
            mode === "login"
              ? "bg-[#197B40] text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 bg-transparent"
          }`}
        >
          {loginTabIcon}
          <span>Login</span>
        </button>
        <button
          type="button"
          onClick={() => handleModeChange("register")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-full py-2.5 font-ui text-sm font-bold transition-all ${
            mode === "register"
              ? "bg-[#197B40] text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 bg-transparent"
          }`}
        >
          {registerTabIcon}
          <span>Register</span>
        </button>
      </div>

      {mode === "login" ? (
        forgotOpen ? (
          forgotPanel
        ) : (
        /* --- LOGIN MODE --- */
        <div>
          {/* Header */}
          <div className="mb-6 text-center">
            <h1 className="font-ui text-2xl font-bold tracking-tight text-slate-800">Welcome Back</h1>
            <p className="mt-1 font-body text-xs text-slate-500">Sign in to your account</p>
          </div>

          {noticeDigitalExisting && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-[#F4FAF6] px-4 py-3 text-center font-body text-xs text-[#197B40]">
              <p className="font-semibold">Your order is complete.</p>
              <p className="mt-1">
                This email already has an account, so sign in to read or download your
                PDF. We&apos;ve also emailed you the download link.
              </p>
            </div>
          )}

          {resetDone && (
            <p className="mb-4 rounded-xl border border-emerald-200 bg-[#F4FAF6] px-4 py-3 text-center font-body text-xs font-semibold text-[#197B40]">
              Password updated. Sign in with your new password.
            </p>
          )}

          {/* Credentials Login Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (credential && password && !login.isPending) {
                login.mutate({ identifier: credential, password }, { onSuccess: goToRedirect });
              }
            }}
            className="space-y-3"
          >
            {/* Input: Mobile Number or Email */}
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                {phoneEmailIcon}
              </span>
              <input
                type="text"
                aria-label="Mobile number or email"
                placeholder="Mobile Number or Email"
                autoComplete="username"
                value={credential}
                onChange={(e) => setCredential(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3.5 font-body text-sm text-slate-800 outline-none transition-colors focus:border-[#197B40]"
              />
            </div>

            {/* Input: Password */}
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                {lockIcon}
              </span>
              <input
                type={showPassword ? "text" : "password"}
                aria-label="Password"
                placeholder="Password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-10 font-body text-sm text-slate-800 outline-none transition-colors focus:border-[#197B40]"
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? eyeOffIcon : eyeIcon}
              </button>
            </div>

            {/* Forgot Password Link */}
            <div className="text-right">
              <button
                type="button"
                onClick={() => {
                  // Was: scrollIntoView("#otp-login-card"). Signing in by OTP
                  // gets you INTO the account but leaves the forgotten
                  // password in place -- and neither /customers/password
                  // endpoint can replace it (one needs the old password, the
                  // other refuses when one exists). So this now runs a real
                  // RESET_PASSWORD flow.
                  setFpIdentifier(credential);
                  setForgotOpen(true);
                }}
                className="font-ui text-xs font-bold text-[#197B40] hover:underline"
              >
                Forgot Password?
              </button>
            </div>

            {login.isError && (
              <p className="font-body text-xs text-red-600">
                {login.error instanceof Error ? login.error.message : "Invalid credentials"}
              </p>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!credential || !password || login.isPending}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#197B40] font-ui text-sm font-bold text-white shadow-sm transition-all hover:bg-[#156635] active:scale-[0.99] disabled:opacity-60"
            >
              <span>{login.isPending ? "Signing in…" : "Login"}</span>
              {arrowRightIcon}
            </button>
          </form>

          {/* Divider */}
          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-slate-200" />
            <span className="font-ui text-xs font-medium text-slate-400">or</span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          {/* Login with OTP Box */}
          <div id="otp-login-card" className="rounded-2xl border border-emerald-200/90 bg-[#F4FAF6] p-4">
            <div className="mb-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#197B40] shadow-sm">
                  {mobileOtpBadgeIcon}
                </div>
                <div>
                  <h3 className="font-ui text-xs font-bold text-slate-800">Login with OTP</h3>
                  <p className="font-body text-[11px] text-slate-500">Get a 6-digit code on your mobile number</p>
                </div>
              </div>
            </div>

            {/* Input & Send OTP Button Row */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                  {phoneIcon}
                </span>
                <input
                  type="text"
                  aria-label="Mobile number for OTP login"
                  placeholder="Mobile Number"
                  inputMode="tel"
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  disabled={loginOtpSent}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-2.5 font-body text-xs text-slate-800 outline-none focus:border-[#197B40] disabled:bg-slate-100"
                />
              </div>
              <button
                type="button"
                disabled={!identifier || requestOtp.isPending}
                onClick={() => {
                  // Once sent, this becomes "Change" instead of a button that
                  // silently does nothing: the number input is disabled from
                  // that point on, so mistyping the number used to be a
                  // dead end only a page reload could escape.
                  if (loginOtpSent) {
                    setLoginOtpSent(false);
                    setLoginOtpCode("");
                    requestOtp.reset();
                    verifyOtp.reset();
                    return;
                  }
                  requestOtp.mutate(
                    { identifier, purpose: "LOGIN" },
                    { onSuccess: () => { setLoginOtpSent(true); loginResendCooldown.start(); } }
                  );
                }}
                className="flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#197B40] px-3.5 font-ui text-xs font-bold text-white shadow-sm transition-all hover:bg-[#156635] disabled:opacity-60"
              >
                {!loginOtpSent && sendIcon}
                <span>{loginOtpSent ? "Change" : requestOtp.isPending ? "Sending…" : "Send OTP"}</span>
              </button>
            </div>

            {/* OTP Code Input if Sent */}
            {loginOtpSent && (
              <div className="mt-3 space-y-2">
                <input
                  type="text"
                  aria-label="OTP code"
                  placeholder="Enter OTP code"
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="one-time-code"
                  autoFocus
                  value={loginOtpCode}
                  onChange={(e) => setLoginOtpCode(e.target.value.replace(/\D/g, ""))}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-center font-mono text-xs tracking-widest text-slate-800 outline-none focus:border-[#197B40]"
                />
                <button
                  type="button"
                  disabled={!loginResendCooldown.canResend || requestOtp.isPending}
                  onClick={() =>
                    requestOtp.mutate({ identifier, purpose: "LOGIN" }, { onSuccess: () => loginResendCooldown.start() })
                  }
                  className="w-full text-center font-body text-xs font-semibold text-[#197B40] hover:underline disabled:opacity-50"
                >
                  {loginResendCooldown.canResend
                    ? requestOtp.isPending ? "Sending…" : "Resend code"
                    : `Resend code in ${loginResendCooldown.secondsLeft}s`}
                </button>
              </div>
            )}

            {(requestOtp.isError || verifyOtp.isError) && (
              <p className="mt-2 text-center font-body text-xs text-red-600">
                {(requestOtp.error ?? verifyOtp.error) instanceof Error
                  ? ((requestOtp.error ?? verifyOtp.error) as Error).message
                  : "Something went wrong"}
              </p>
            )}

            {/* Verify OTP Button */}
            <button
              type="button"
              disabled={!loginOtpSent || !loginOtpCode || verifyOtp.isPending}
              onClick={() => verifyOtp.mutate({ identifier, code: loginOtpCode, purpose: "LOGIN" }, { onSuccess: goToRedirect })}
              className={`mt-3 flex h-10 w-full items-center justify-center rounded-xl font-ui text-xs font-bold transition-all ${
                loginOtpSent && loginOtpCode
                  ? "bg-[#197B40] text-white hover:bg-[#156635] shadow-sm"
                  : "bg-[#E5F2EB] text-[#197B40]/70 cursor-not-allowed"
              }`}
            >
              {verifyOtp.isPending ? "Verifying…" : "Verify OTP"}
            </button>
          </div>

          <GoogleSignInButton locale={locale} onSuccess={goToRedirect} />

          {/* Bottom Footer Pill */}
          <div className="mt-6 flex items-center justify-between rounded-full border border-emerald-100 bg-[#F4FAF6] px-5 py-3 text-xs">
            <span className="font-medium text-slate-600">New to our platform?</span>
            <button
              type="button"
              onClick={() => handleModeChange("register")}
              className="flex items-center gap-1 font-bold text-[#197B40] hover:underline"
            >
              <span>Create an Account</span>
              {arrowRightIcon}
            </button>
          </div>
        </div>
        )
      ) : (
        /* --- REGISTER MODE --- */
        <div>
          <div className="mb-6 text-center">
            <h1 className="font-ui text-2xl font-bold tracking-tight text-slate-800">Create an Account</h1>
            <p className="mt-1 font-body text-xs text-slate-500">Join to track orders and save your details</p>
          </div>

          {regOtpSent ? (
            /* OTP Verification for Register */
            <div className="space-y-4">
              <div className="rounded-2xl border border-emerald-200/80 bg-[#F4FAF6] p-4 text-center">
                <h3 className="font-serif text-base font-bold text-slate-800">
                  {regSentTo.includes("@") ? "Verify Your Email" : "Verify Your Phone"}
                </h3>
                <p className="mt-1 font-body text-xs text-slate-500">
                  We sent a code to <span className="font-bold text-slate-800">{regSentTo || regPhone}</span>. Enter it below to finish creating your account.
                </p>
              </div>

              <input
                type="text"
                aria-label="OTP code"
                placeholder="Enter 6-digit OTP code"
                inputMode="numeric"
                maxLength={6}
                autoComplete="one-time-code"
                autoFocus
                value={regOtpCode}
                onChange={(e) => setRegOtpCode(e.target.value.replace(/\D/g, ""))}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-center font-mono text-sm tracking-widest text-slate-800 outline-none focus:border-[#197B40]"
              />

              {verifyOtp.isError && (
                <p className="text-center font-body text-xs text-red-600">
                  {verifyOtp.error instanceof Error ? verifyOtp.error.message : "Invalid or expired code"}
                </p>
              )}

              <button
                type="button"
                disabled={!regOtpCode || verifyOtp.isPending}
                onClick={() =>
                  verifyOtp.mutate(
                    { identifier: regSentTo || regPhone, code: regOtpCode, purpose: "REGISTER" },
                    // goToRedirect, not a hardcoded /account: someone who
                    // started at /checkout and registered mid-purchase must
                    // land back on checkout, not on their profile.
                    { onSuccess: goToRedirect },
                  )
                }
                className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#197B40] font-ui text-sm font-bold text-white shadow-sm transition-all hover:bg-[#156635] disabled:opacity-60"
              >
                <span>{verifyOtp.isPending ? "Verifying…" : "Verify & Create Account"}</span>
                {arrowRightIcon}
              </button>

              <button
                type="button"
                disabled={!regResendCooldown.canResend || register.isPending}
                onClick={() =>
                  register.mutate(
                    { firstName, lastName, phone: regPhone, email: regEmail || undefined, password: regPassword, otpChannel: effectiveChannel },
                    { onSuccess: (data) => { setRegSentTo(data.otpIdentifier); regResendCooldown.start(); } },
                  )
                }
                className="w-full text-center font-body text-xs font-semibold text-[#197B40] hover:underline disabled:opacity-50"
              >
                {regResendCooldown.canResend
                  ? register.isPending ? "Sending…" : "Resend code"
                  : `Resend code in ${regResendCooldown.secondsLeft}s`}
              </button>
            </div>
          ) : (
            /* Register Input Form */
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (canSubmitRegister && !register.isPending) {
                  submitRegisterDetails();
                }
              }}
              className="space-y-3"
            >
              {/* First Name & Last Name */}
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  aria-label="First name"
                  placeholder="First name"
                  autoComplete="given-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 font-body text-sm text-slate-800 outline-none transition-colors focus:border-[#197B40]"
                />
                <input
                  type="text"
                  aria-label="Last name"
                  placeholder="Last name"
                  autoComplete="family-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 font-body text-sm text-slate-800 outline-none transition-colors focus:border-[#197B40]"
                />
              </div>

              {/* Phone */}
              <div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    {phoneIcon}
                  </span>
                  <input
                    type="text"
                    aria-label="Phone number"
                    placeholder="Phone (e.g. 01712345678)"
                    inputMode="tel"
                    autoComplete="tel"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3.5 font-body text-sm text-slate-800 outline-none transition-colors focus:border-[#197B40]"
                  />
                </div>
                {!phoneEntered && (
                  <p className="mt-1 font-body text-[11px] text-slate-500">
                    প্রবাসী হলে মোবাইল নম্বর ছাড়াই ইমেইল দিয়ে অ্যাকাউন্ট খুলতে পারবেন।
                  </p>
                )}
                {conflictField === "phone" && (
                  <p className="mt-1 font-body text-xs text-red-600">This phone number is already registered.</p>
                )}
              </div>

              {/* Email */}
              <div>
                <input
                  type="email"
                  aria-label="Email (optional)"
                  placeholder="Email (optional)"
                  autoComplete="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 font-body text-sm text-slate-800 outline-none transition-colors focus:border-[#197B40]"
                />
                {emailEntered && (
                  <div className="mt-2.5 rounded-xl border border-slate-200 bg-[#F4FAF6] p-3">
                    <p className="mb-2 font-body text-xs font-semibold text-slate-800">Where should we send your code?</p>
                    <div className="flex flex-col gap-1.5">
                      <label className="flex items-center gap-2 font-body text-xs text-slate-700">
                        <input
                          type="radio"
                          name="otpChannel"
                          checked={regOtpChannel === "PHONE"}
                          onChange={() => setRegOtpChannel("PHONE")}
                          className="accent-[#197B40]"
                        />
                        SMS to {regPhone || "your mobile number"}
                      </label>
                      <label className="flex items-center gap-2 font-body text-xs text-slate-700">
                        <input
                          type="radio"
                          name="otpChannel"
                          checked={regOtpChannel === "EMAIL"}
                          onChange={() => setRegOtpChannel("EMAIL")}
                          className="accent-[#197B40]"
                        />
                        Email to {regEmail.trim()}
                      </label>
                    </div>
                  </div>
                )}
                {conflictField === "email" && (
                  <p className="mt-1 font-body text-xs text-red-600">This email address is already registered.</p>
                )}
              </div>

              {/* Password */}
              <div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    {lockIcon}
                  </span>
                  <input
                    type={regShowPassword ? "text" : "password"}
                    aria-label="Password"
                    placeholder="Password (min. 8 characters)"
                    autoComplete="new-password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-10 font-body text-sm text-slate-800 outline-none transition-colors focus:border-[#197B40]"
                  />
                  <button
                    type="button"
                    aria-label={regShowPassword ? "Hide password" : "Show password"}
                    onClick={() => setRegShowPassword((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {regShowPassword ? eyeOffIcon : eyeIcon}
                  </button>
                </div>

                <div className="mt-2 flex items-center justify-between">
                  {regPassword.length > 0 ? (
                    <div className="flex flex-1 flex-col gap-1">
                      <div className="flex gap-1 pr-3">
                        {[1, 2, 3, 4].map((seg) => (
                          <span
                            key={seg}
                            className={`h-1 flex-1 rounded-full ${
                              seg <= strength.score ? STRENGTH_BAR_COLOR[strength.score] : "bg-slate-200"
                            }`}
                          />
                        ))}
                      </div>
                      <span className={`font-body text-[11px] font-semibold ${STRENGTH_TEXT_COLOR[strength.score]}`}>
                        {strength.meetsMinimum ? `${strength.label} password` : strength.label}
                      </span>
                    </div>
                  ) : (
                    <span />
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const generated = generatePassword();
                      setRegPassword(generated);
                      setRegShowPassword(true);
                    }}
                    className="shrink-0 whitespace-nowrap font-body text-xs font-semibold text-[#197B40] hover:underline"
                  >
                    Suggest password
                  </button>
                </div>
              </div>

              {genericRegError && (
                <p className="font-body text-xs text-red-600">
                  {register.error instanceof Error ? register.error.message : "Couldn't create your account"}
                </p>
              )}

              {/* Submit Register Button */}
              <button
                type="submit"
                disabled={!canSubmitRegister || register.isPending}
                className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#197B40] font-ui text-sm font-bold text-white shadow-sm transition-all hover:bg-[#156635] active:scale-[0.99] disabled:opacity-60"
              >
                <span>{register.isPending ? "Sending code…" : "Register"}</span>
                {arrowRightIcon}
              </button>
            </form>
          )}

          {/* Bottom Footer Pill */}
          <div className="mt-6 flex items-center justify-between rounded-full border border-emerald-100 bg-[#F4FAF6] px-5 py-3 text-xs">
            <span className="font-medium text-slate-600">Already have an account?</span>
            <button
              type="button"
              onClick={() => handleModeChange("login")}
              className="flex items-center gap-1 font-bold text-[#197B40] hover:underline"
            >
              <span>Sign in</span>
              {arrowRightIcon}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
