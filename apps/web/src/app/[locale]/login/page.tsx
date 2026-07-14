import type { Metadata } from "next";
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
      <LoginForm />
    </main>
  );
}
