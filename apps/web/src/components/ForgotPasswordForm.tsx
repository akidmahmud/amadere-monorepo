"use client";

import { useState } from "react";
import { Button, Input } from "@amader/ui";
import { useRouter, Link } from "@/i18n/navigation";
import { useForgotPassword } from "@/hooks/useAuth";

export function ForgotPasswordForm() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const forgotPassword = useForgotPassword();

  if (forgotPassword.isSuccess) {
    return (
      <div className="mx-auto max-w-md rounded-[18px] bg-white p-9 text-center shadow-brand">
        <h1 className="mb-2 font-serif text-xl font-semibold text-ink">Check your phone/email</h1>
        <p className="mb-6 font-body text-sm text-muted">
          If an account exists for {identifier}, a reset code has been sent.
        </p>
        <Button variant="green" block onClick={() => router.push(`/reset-password?identifier=${encodeURIComponent(identifier)}`)}>
          I have the code
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md rounded-[18px] bg-white p-9 shadow-brand">
      <h1 className="mb-1 text-center font-serif text-xl font-semibold text-ink">Forgot Password</h1>
      <p className="mb-6 text-center font-body text-sm text-muted">
        Enter your phone number or email to receive a reset code.
      </p>
      <Input
        className="mb-1"
        placeholder="Phone or email"
        value={identifier}
        onChange={(e) => setIdentifier(e.target.value)}
      />
      {forgotPassword.isError && (
        <p className="mb-2 mt-1 font-body text-xs text-red-600">
          {forgotPassword.error instanceof Error ? forgotPassword.error.message : "Something went wrong"}
        </p>
      )}
      <Button
        variant="green"
        block
        className="mt-4"
        disabled={!identifier || forgotPassword.isPending}
        onClick={() => forgotPassword.mutate(identifier)}
      >
        Send Reset Code
      </Button>
      <p className="mt-4 text-center font-body text-sm text-ink">
        <Link href="/login" className="text-green underline">Back to sign in</Link>
      </p>
    </div>
  );
}
