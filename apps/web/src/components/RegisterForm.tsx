"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { isValidBdPhone } from "@amader/shared";
import { Button, Input } from "@amader/ui";
import { useRouter, Link } from "@/i18n/navigation";
import { toApiLocale } from "@/lib/api-locale";
import { useRegister, useVerifyOtp, LocalAuthError } from "@/hooks/useAuth";
import { useResendCooldown } from "@/hooks/useResendCooldown";

// Ground truth is RegisterDto: @MinLength(8) and nothing else — no
// uppercase/number/symbol is actually required server-side. "score" below
// is advisory (encourages a stronger password) but `meetsMinimum` alone is
// the only thing that can legitimately block Register, so the two are
// tracked separately rather than one hard gate pretending to be the rule.
function passwordStrength(pw: string): { meetsMinimum: boolean; score: number; label: string } {
  if (pw.length < 8) return { meetsMinimum: false, score: 0, label: "Too short — needs at least 8 characters" };
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

const STRENGTH_BAR_COLOR = ["bg-red-600", "bg-red-600", "bg-amber-500", "bg-blue-500", "bg-green"];
const STRENGTH_TEXT_COLOR = ["text-red-600", "text-red-600", "text-amber-600", "text-blue-600", "text-green"];

// Excludes visually-ambiguous characters (0/O, 1/l/I) — a generated password
// is meant to be readable if someone glances at it before it's saved to a
// password manager, not just cryptographically fine.
function generatePassword(length = 14): string {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*";
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (v) => charset[v % charset.length]).join("");
}

const eyeIcon = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const eyeOffIcon = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a20.3 20.3 0 0 1 5.06-6.06M9.9 4.24A9.96 9.96 0 0 1 12 4c7 0 11 8 11 8a20.4 20.4 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24" />
    <path d="M1 1l22 22" />
  </svg>
);

export function RegisterForm() {
  const locale = toApiLocale(useLocale());
  const router = useRouter();
  const register = useRegister();
  const verifyOtp = useVerifyOtp(locale);
  const resendCooldown = useResendCooldown();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  // Which delivery the customer picked. Only surfaced once they've entered an
  // email — with no email there is nothing to choose between.
  const [otpChannel, setOtpChannel] = useState<"PHONE" | "EMAIL">("PHONE");
  // Where the code actually went, as reported by the server. Kept separate
  // from `otpChannel` so the verify step submits the identifier the backend
  // really keyed the code on, not what the form hoped it would be.
  const [sentTo, setSentTo] = useState("");
  const emailEntered = email.trim().length > 0;
  const phoneEntered = phone.trim().length > 0;
  // No phone means email is the only place a code can go, so the server
  // forces EMAIL regardless of this value — mirrored here so the UI agrees.
  const effectiveChannel = !phoneEntered ? "EMAIL" : emailEntered ? otpChannel : "PHONE";

  // Phone OR email — a customer living abroad has no BD mobile, and the
  // store's delivery contact is collected separately at checkout anyway.
  // A phone that IS entered still has to be a valid BD mobile.
  const phoneOk = phoneEntered ? isValidBdPhone(phone) : false;
  const canSubmitDetails =
    Boolean(firstName.trim()) &&
    Boolean(lastName.trim()) &&
    (phoneOk || emailEntered) &&
    (!phoneEntered || phoneOk) &&
    password.length >= 8;
  const strength = passwordStrength(password);

  // register() 409s with details.field = "phone" | "email" for a duplicate
  // (see customer-auth.service.ts) — everything else falls through to the
  // generic form-level banner it always showed.
  const conflictField =
    register.error instanceof LocalAuthError &&
    register.error.details &&
    typeof register.error.details === "object" &&
    "field" in register.error.details
      ? (register.error.details as { field?: string }).field
      : undefined;
  const genericError = register.isError && conflictField !== "phone" && conflictField !== "email";

  function submitDetails() {
    register.mutate(
      { firstName, lastName, phone, email: email || undefined, password, otpChannel: effectiveChannel },
      { onSuccess: (data) => { setSentTo(data.otpIdentifier); setOtpSent(true); resendCooldown.start(); } },
    );
  }

  if (otpSent) {
    return (
      <div className="mx-auto max-w-md rounded-[18px] bg-white p-9 shadow-brand">
        <h1 className="mb-1 text-center font-serif text-xl font-semibold text-ink">
          {sentTo.includes("@") ? "Verify Your Email" : "Verify Your Phone"}
        </h1>
        <p className="mb-6 text-center font-body text-sm text-muted">
          We sent a code to {sentTo || phone}. Enter it below to finish creating your account.
        </p>
        <Input
          className="mb-1"
          placeholder="Enter OTP code"
          value={otpCode}
          onChange={(e) => setOtpCode(e.target.value)}
        />
        {verifyOtp.isError && (
          <p className="mb-2 mt-1 font-body text-xs text-red-600">
            {verifyOtp.error instanceof Error ? verifyOtp.error.message : "Invalid or expired code"}
          </p>
        )}
        <Button
          variant="green"
          block
          className="mt-4"
          disabled={!otpCode || verifyOtp.isPending}
          onClick={() =>
            verifyOtp.mutate(
              { identifier: sentTo || phone, code: otpCode, purpose: "REGISTER" },
              { onSuccess: () => router.push("/account") },
            )
          }
        >
          {verifyOtp.isPending ? "Verifying…" : "Verify & Create Account"}
        </Button>
        <button
          type="button"
          disabled={!resendCooldown.canResend || register.isPending}
          onClick={() =>
            register.mutate(
              { firstName, lastName, phone, email: email || undefined, password, otpChannel: effectiveChannel },
              { onSuccess: (data) => { setSentTo(data.otpIdentifier); resendCooldown.start(); } },
            )
          }
          className="mt-3 w-full text-center font-body text-sm text-green underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline disabled:opacity-50"
        >
          {resendCooldown.canResend
            ? register.isPending ? "Sending…" : "Resend code"
            : `Resend code in ${resendCooldown.secondsLeft}s`}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md rounded-[18px] bg-white p-9 shadow-brand">
      <h1 className="mb-1 text-center font-serif text-xl font-semibold text-ink">Create an Account</h1>
      <p className="mb-6 text-center font-body text-sm text-muted">Join to track orders and save your details</p>

      <div className="mb-3.5 grid grid-cols-2 gap-3">
        <Input placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        <Input placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
      </div>

      <div className="mb-3.5">
        <Input
          placeholder="Phone (e.g. 01712345678)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        {!phoneEntered && (
          <p className="mt-1 font-body text-xs text-muted">
            প্রবাসী হলে মোবাইল নম্বর ছাড়াই ইমেইল দিয়ে অ্যাকাউন্ট খুলতে পারবেন।
          </p>
        )}
        {conflictField === "phone" && (
          <p className="mt-1 font-body text-xs text-red-600">This phone number is already registered.</p>
        )}
      </div>

      <div className="mb-3.5">
        <Input placeholder="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} />
        {emailEntered && (
          // Shown only once an email exists — with no email there's nothing
          // to choose, so the customer goes straight to a phone code and is
          // never asked a question with one possible answer.
          <div className="mt-2.5 rounded-[10px] border border-line bg-cream/40 p-3">
            <p className="mb-2 font-body text-xs font-semibold text-ink">Where should we send your code?</p>
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-2 font-body text-sm text-ink">
                <input
                  type="radio"
                  name="otpChannel"
                  checked={otpChannel === "PHONE"}
                  onChange={() => setOtpChannel("PHONE")}
                  className="accent-green"
                />
                SMS to {phone || "your mobile number"}
              </label>
              <label className="flex items-center gap-2 font-body text-sm text-ink">
                <input
                  type="radio"
                  name="otpChannel"
                  checked={otpChannel === "EMAIL"}
                  onChange={() => setOtpChannel("EMAIL")}
                  className="accent-green"
                />
                Email to {email.trim()}
              </label>
            </div>
          </div>
        )}
        {conflictField === "email" && (
          <p className="mt-1 font-body text-xs text-red-600">This email address is already registered.</p>
        )}
      </div>

      <Input
        className="mb-1"
        type={showPassword ? "text" : "password"}
        placeholder="Password (min. 8 characters)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        trailingIcon={
          <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"}>
            {showPassword ? eyeOffIcon : eyeIcon}
          </button>
        }
      />

      <div className="mb-2 flex items-center justify-between">
        {password.length > 0 ? (
          <div className="flex flex-1 flex-col gap-1">
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((seg) => (
                <span
                  key={seg}
                  className={`h-1 flex-1 rounded-full ${seg <= strength.score ? STRENGTH_BAR_COLOR[strength.score] : "bg-line"}`}
                />
              ))}
            </div>
            <span className={`font-body text-xs font-semibold ${STRENGTH_TEXT_COLOR[strength.score]}`}>
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
            setPassword(generated);
            setShowPassword(true);
          }}
          className="shrink-0 whitespace-nowrap font-body text-xs font-semibold text-green underline"
        >
          Suggest a password
        </button>
      </div>

      {genericError && (
        <p className="mb-2 mt-1 font-body text-xs text-red-600">
          {register.error instanceof Error ? register.error.message : "Couldn't create your account"}
        </p>
      )}
      <Button variant="green" block className="mt-4" disabled={!canSubmitDetails || register.isPending} onClick={submitDetails}>
        {register.isPending ? "Sending code…" : "Register"}
      </Button>
      <p className="mt-4 text-center font-body text-sm text-ink">
        Already have an account? <Link href="/login" className="text-green underline">Sign in</Link>
      </p>
    </div>
  );
}
