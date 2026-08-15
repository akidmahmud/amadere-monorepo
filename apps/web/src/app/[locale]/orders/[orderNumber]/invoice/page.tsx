"use client";

import { use, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@amader/ui";
import { useRouter } from "@/i18n/navigation";
import { useMe } from "@/hooks/useAuth";
import { useOrder } from "@/hooks/useAccount";
import { useSiteInfo } from "@/hooks/useSiteInfo";
import { CustomerInvoiceDocument } from "@/components/CustomerInvoiceDocument";

// Deliberately outside /account (skips AccountShell's sidebar chrome) — same
// "print-friendly, minimal wrapper" reasoning as apps/admin's print/orders
// pages, though the site header/footer from the root [locale] layout still
// render around this (there's no per-route escape from that in this app);
// acceptable for a self-service download, unlike the admin's bulk-print
// workflow where that chrome would actually get printed at real volume.
// Auth: GET /orders/:orderNumber is CustomerJwtGuard-protected and scoped to
// the calling customer server-side (403 on someone else's order) — this
// client-side useMe() redirect is just the friendly "you're not logged in"
// UX on top of that, not the real gate.
export default function CustomerInvoicePage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = use(params);
  const { data: me, isLoading: meLoading } = useMe();
  const { data: order, isLoading: orderLoading, isError } = useOrder(orderNumber);
  const { data: siteInfo } = useSiteInfo();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!meLoading && !me) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [meLoading, me, pathname, router]);

  if (meLoading || orderLoading || !me) {
    return <p className="p-8 text-center font-body text-sm text-muted">Loading…</p>;
  }
  if (isError || !order) {
    return <p className="p-8 text-center font-body text-sm text-muted">Order not found.</p>;
  }

  return (
    <div>
      <div className="mx-auto flex max-w-[900px] justify-end px-10 pt-6 print:hidden">
        <Button variant="green" onClick={() => window.print()}>
          Print / Save as PDF
        </Button>
      </div>
      <CustomerInvoiceDocument order={order} siteName={siteInfo?.siteName ?? "আমাদের"} logoUrl={siteInfo?.logoUrl} />
    </div>
  );
}
