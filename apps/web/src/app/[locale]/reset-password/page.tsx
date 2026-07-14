import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";

export function generateMetadata(): Metadata {
  return { title: "Reset Password", robots: { index: false, follow: false } };
}

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="flex-1 px-5 py-16">
      <ResetPasswordForm />
    </main>
  );
}
