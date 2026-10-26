"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon, PageHeader } from "@amader/admin-ui";
import { NewOrderForm } from "@/components/orders/NewOrderForm";
import { useLead } from "@/hooks/useLeads";

const newOrderIcon = <Icon name="add_shopping_cart" />;

function NewOrderPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedId = searchParams.get("customerId");
  // From Lead Center: the lead's details fill the address; placing the order
  // turns the lead into a customer (backend LeadsService.onOrderCreated).
  const leadId = Number(searchParams.get("leadId")) || null;
  const { data: lead, isLoading: leadLoading } = useLead(leadId);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={newOrderIcon}
        title="New Order"
        subtitle="Manually create an order for phone, social media, or in-person sales."
        style={{ background: "linear-gradient(135deg, #430477 0%, #1C0531 100%)" }}
      />
      {leadId && leadLoading ? (
        <p className="text-sm text-muted">Loading lead…</p>
      ) : (
      <NewOrderForm
        initialCustomerId={preselectedId ? Number(preselectedId) : null}
        initialAddress={
          lead
            ? {
                recipientName: lead.name ?? "",
                phone: lead.phone.startsWith("880") ? `0${lead.phone.slice(3)}` : lead.phone,
                ...(lead.email ? { email: lead.email } : {}),
                ...(lead.altPhone ? { alternativePhone: lead.altPhone } : {}),
                ...(lead.addressLine ? { addressLine: lead.addressLine } : {}),
                ...(lead.district ? { district: lead.district } : {}),
                ...(lead.area ? { area: lead.area } : {}),
              }
            : undefined
        }
        onCreated={() => router.push("/net-profit/orders")}
        onCancel={() => router.push("/net-profit/orders")}
      />
      )}
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
