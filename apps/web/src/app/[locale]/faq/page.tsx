import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { getLanguageAlternates } from "@/i18n/alternates";
import { FaqPageContent } from "@/components/FaqPageContent";

// Real dedicated page — Next.js prefers this literal `faq/` folder over the
// generic `[...path]` catch-all that used to render this slug as plain
// admin-authored CMS prose (title + sanitized HTML, no accordion/categories/
// trust stamps). That catch-all's own `/pages/faq` CMS entry (if any) is now
// simply unreachable at `/faq` — this route wins.
export function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Metadata {
  return {
    title: "প্রশ্নোত্তর | Amader™ FAQ",
    description:
      "শিপিং, পেমেন্ট, অর্ডার ও রিটার্ন সম্পর্কিত সব প্রশ্নের উত্তর এক জায়গায় — Amader™ FAQ। Everything about shipping, payment, ordering, and returns with Amader™.",
    alternates: { canonical: "/faq", languages: getLanguageAlternates("/faq") },
  };
}

export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="flex-1">
      <FaqPageContent />
    </main>
  );
}
