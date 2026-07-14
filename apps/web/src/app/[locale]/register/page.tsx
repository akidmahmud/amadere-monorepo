import type { Metadata } from "next";
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
      <RegisterForm />
    </main>
  );
}
