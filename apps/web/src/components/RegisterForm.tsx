"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { isValidBdPhone } from "@amader/shared";
import { Button, Input } from "@amader/ui";
import { useRouter, Link } from "@/i18n/navigation";
import { toApiLocale } from "@/lib/api-locale";
import { useRegister, useVerifyOtp } from "@/hooks/useAuth";

export function RegisterForm() {
  const locale = toApiLocale(useLocale());
  const router = useRouter();
  const register = useRegister();
  const verifyOtp = useVerifyOtp(locale);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");

  const canSubmitDetails = firstName.trim() && lastName.trim() && isValidBdPhone(phone) && password.length >= 8;

  function submitDetails() {
    register.mutate(
      { firstName, lastName, phone, email: email || undefined, password },
      { onSuccess: () => setOtpSent(true) },
    );
  }

  if (otpSent) {
    return (
      <div className="mx-auto max-w-md rounded-[18px] bg-white p-9 shadow-brand">
        <h1 className="mb-1 text-center font-serif text-xl font-semibold text-ink">Verify Your Phone</h1>
        <p className="mb-6 text-center font-body text-sm text-muted">
          We sent a code to {phone}. Enter it below to finish creating your account.
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
              { identifier: phone, code: otpCode, purpose: "REGISTER" },
              { onSuccess: () => router.push("/account") },
            )
          }
        >
          {verifyOtp.isPending ? "Verifying…" : "Verify & Create Account"}
        </Button>
        <button
          type="button"
          disabled={register.isPending}
          onClick={() => register.mutate({ firstName, lastName, phone, email: email || undefined, password })}
          className="mt-3 w-full text-center font-body text-sm text-green underline disabled:opacity-50"
        >
          {register.isPending ? "Sending…" : "Resend code"}
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
      <Input
        className="mb-3.5"
        placeholder="Phone (e.g. 01712345678)"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />
      <Input className="mb-3.5" placeholder="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Input
        className="mb-1"
        type="password"
        placeholder="Password (min. 8 characters)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {register.isError && (
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
