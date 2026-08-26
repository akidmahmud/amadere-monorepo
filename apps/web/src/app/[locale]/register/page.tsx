import type { Metadata } from "next";
import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { RegisterForm } from "@/components/RegisterForm";
import { getLanguageAlternates } from "@/i18n/alternates";

export function generateMetadata(): Metadata {
  return {
    title: "Register",
    robots: { index: false, follow: false },
    alternates: { canonical: "/register", languages: getLanguageAlternates("/register") },
  };
}

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="flex-1 px-5 py-10">
      {/* RegisterForm is LoginForm in register mode, so it reads
          useSearchParams() (the ?redirect= target) just like /login does and
          needs the same boundary. Without it `next build` fails this route
          with "useSearchParams() should be wrapped in a suspense boundary". */}
      {/* A real fallback, not null: an empty boundary gives <main> no
          height while the form streams, so the footer slides up under the
          header and then jumps back down. This reserves the card's space. */}
      <Suspense fallback={<div className="mx-auto h-[620px] max-w-[460px] rounded-[28px] border border-emerald-100/90 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.06)]" />}>
        <RegisterForm />
      </Suspense>
    </main>
  );
}
