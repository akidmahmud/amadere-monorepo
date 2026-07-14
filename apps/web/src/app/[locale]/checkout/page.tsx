import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { CheckoutForm } from "@/components/CheckoutForm";
import { getLanguageAlternates } from "@/i18n/alternates";

export function generateMetadata(): Metadata {
  return {
    title: "Checkout",
    robots: { index: false, follow: false },
    alternates: { canonical: "/checkout", languages: getLanguageAlternates("/checkout") },
  };
}

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="flex-1">
      <CheckoutForm />
    </main>
  );
}
