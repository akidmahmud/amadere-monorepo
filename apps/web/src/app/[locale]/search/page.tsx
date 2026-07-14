import type { Metadata } from "next";
import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { SearchResults } from "@/components/SearchResults";

export function generateMetadata(): Metadata {
  return { title: "Search", robots: { index: false, follow: false } };
}

export default async function SearchPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="flex-1">
      <Suspense fallback={<div className="py-16 text-center font-body text-sm text-muted">Loading…</div>}>
        <SearchResults />
      </Suspense>
    </main>
  );
}
