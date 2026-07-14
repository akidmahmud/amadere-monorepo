import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { TrackOrderForm } from "@/components/TrackOrderForm";
import { getLanguageAlternates } from "@/i18n/alternates";

export function generateMetadata(): Metadata {
  return {
    title: "Track Your Order",
    alternates: { canonical: "/track", languages: getLanguageAlternates("/track") },
  };
}

export default async function TrackPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="flex-1">
      <TrackOrderForm />
    </main>
  );
}
