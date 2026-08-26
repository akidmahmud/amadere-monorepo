import type { Metadata } from "next";
import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { LoginForm } from "@/components/LoginForm";
import { getLanguageAlternates } from "@/i18n/alternates";

export function generateMetadata(): Metadata {
  return {
    title: "Sign In",
    robots: { index: false, follow: false },
    alternates: { canonical: "/login", languages: getLanguageAlternates("/login") },
  };
}

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="flex-1 px-5 py-10">
      {/* LoginForm reads useSearchParams() (the ?redirect= target), which
          Next requires to sit inside a Suspense boundary. It used to be
          satisfied incidentally by [locale]/loading.tsx — a boundary around
          EVERY page under this segment, which also made React stream the
          layout shell (header + footer) ahead of each page's own content.
          Scoped here instead, so only this page pays for it. */}
      {/* A real fallback, not null: an empty boundary gives <main> no
          height while the form streams, so the footer slides up under the
          header and then jumps back down. This reserves the card's space. */}
      <Suspense fallback={<div className="mx-auto h-[620px] max-w-[460px] rounded-[28px] border border-emerald-100/90 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.06)]" />}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
