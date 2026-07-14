"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button, Input } from "@amader/ui";
import { useRouter, Link } from "@/i18n/navigation";
import { useResetPassword } from "@/hooks/useAuth";

export function ResetPasswordForm() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState(useSearchParams().get("identifier") ?? "");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const resetPassword = useResetPassword();

  return (
    <div className="mx-auto max-w-md rounded-[18px] bg-white p-9 shadow-brand">
      <h1 className="mb-1 text-center font-serif text-xl font-semibold text-ink">Reset Password</h1>
      <p className="mb-6 text-center font-body text-sm text-muted">
        Enter the code we sent you and choose a new password.
      </p>
      <Input
        className="mb-3.5"
        placeholder="Phone or email"
        value={identifier}
        onChange={(e) => setIdentifier(e.target.value)}
      />
      <Input className="mb-3.5" placeholder="Reset code" value={code} onChange={(e) => setCode(e.target.value)} />
      <Input
        className="mb-1"
        type="password"
        placeholder="New password (min. 8 characters)"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
      />
      {resetPassword.isError && (
        <p className="mb-2 mt-1 font-body text-xs text-red-600">
          {resetPassword.error instanceof Error ? resetPassword.error.message : "Couldn't reset your password"}
        </p>
      )}
      <Button
        variant="green"
        block
        className="mt-4"
        disabled={!identifier || !code || newPassword.length < 8 || resetPassword.isPending}
        onClick={() =>
          resetPassword.mutate({ identifier, code, newPassword }, { onSuccess: () => router.push("/login") })
        }
      >
        Reset Password
      </Button>
      <p className="mt-4 text-center font-body text-sm text-ink">
        <Link href="/login" className="text-green underline">Back to sign in</Link>
      </p>
    </div>
  );
}
