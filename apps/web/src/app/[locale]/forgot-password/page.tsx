import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";

export function generateMetadata(): Metadata {
  return { title: "Forgot Password", robots: { index: false, follow: false } };
}

export default async function ForgotPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="flex-1 px-5 py-16">
      <ForgotPasswordForm />
    </main>
  );
}
