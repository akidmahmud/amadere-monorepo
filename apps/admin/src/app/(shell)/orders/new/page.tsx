"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon, PageHeader } from "@amader/admin-ui";
import { NewOrderForm } from "@/components/orders/NewOrderForm";

const newOrderIcon = <Icon name="add_shopping_cart" />;

function NewOrderPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedId = searchParams.get("customerId");

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={newOrderIcon}
        title="New Order"
        subtitle="Manually create an order for phone, social media, or in-person sales."
        style={{ background: "linear-gradient(135deg, #430477 0%, #1C0531 100%)" }}
      />
      <NewOrderForm
        initialCustomerId={preselectedId ? Number(preselectedId) : null}
        onCreated={() => router.push("/net-profit/orders")}
        onCancel={() => router.push("/net-profit/orders")}
      />
    </div>
  );
}

// useSearchParams() (for the ?customerId= preselect) opts this page out of
// static rendering unless it's wrapped in Suspense — Next.js fails the
// production build otherwise ("useSearchParams() should be wrapped in a
// suspense boundary").
export default function NewOrderPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
      <NewOrderPageInner />
    </Suspense>
  );
}
