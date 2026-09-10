"use client";

import Link from "next/link";
import { Icon, PageHeader } from "@amader/admin-ui";
import { InvoiceSettingsForm } from "@/components/settings/InvoiceSettingsForm";

const invoiceIcon = <Icon name="receipt_long" />;

export default function InvoiceSettingsPage() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={invoiceIcon}
        title="Invoice Settings"
        subtitle="Company info and layout used on every generated invoice — retail and wholesale, single and bulk."
        style={{
          background: "linear-gradient(135deg, #140A24 0%, #5F03AA 100%)",
        }}
      />
      <Link
        href="/settings"
        className="flex items-center gap-1.5 text-sm font-semibold text-brand-500"
      >
        <Icon name="arrow_back" size={16} /> Back to Settings
      </Link>

      {/* The same form the Wholesale page's Invoice Settings tab renders. */}
      <InvoiceSettingsForm />
    </div>
  );
}
