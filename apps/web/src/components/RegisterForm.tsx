"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { Button, Input } from "@amader/ui";
import { useRouter, Link } from "@/i18n/navigation";
import { toApiLocale } from "@/lib/api-locale";
import { useRegister } from "@/hooks/useAuth";

export function RegisterForm() {
  const locale = toApiLocale(useLocale());
  const router = useRouter();
  const register = useRegister(locale);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  return (
    <div className="mx-auto max-w-md rounded-[18px] bg-white p-9 shadow-brand">
      <h1 className="mb-1 text-center font-serif text-xl font-semibold text-ink">Create an Account</h1>
      <p className="mb-6 text-center font-body text-sm text-muted">Join to track orders and save your details</p>

      <div className="mb-3.5 grid grid-cols-2 gap-3">
        <Input placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        <Input placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
      </div>
      <Input className="mb-3.5" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
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
      <Button
        variant="green"
        block
        className="mt-4"
        disabled={!email || password.length < 8 || register.isPending}
        onClick={() =>
          register.mutate(
            { email, password, firstName: firstName || undefined, lastName: lastName || undefined },
            { onSuccess: () => router.push("/account") },
          )
        }
      >
        Register
      </Button>
      <p className="mt-4 text-center font-body text-sm text-ink">
        Already have an account? <Link href="/login" className="text-green underline">Sign in</Link>
      </p>
    </div>
  );
}
