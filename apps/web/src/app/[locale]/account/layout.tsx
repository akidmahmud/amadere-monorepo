import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { AccountShell } from "@/components/AccountShell";

// Every /account/* page is private (behind the client-side auth guard in
// AccountShell) — noindex applies to all of them; each page's own
// generateMetadata only needs to add a title.
export function generateMetadata(): Metadata {
  return { robots: { index: false, follow: false } };
}

export default async function AccountLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="flex-1">
      <AccountShell>{children}</AccountShell>
    </main>
  );
}
