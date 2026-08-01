"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card, Icon, PageHeader, ToggleSwitch } from "@amader/admin-ui";
import {
  useInvoiceTemplateSettings,
  useUpdateInvoiceTemplateSettings,
} from "@/hooks/useInvoiceTemplateSettings";

const templateIcon = <Icon name="description" />;
const textareaClass =
  "min-h-[420px] rounded-sm border border-border bg-surface px-3 py-2 font-mono text-xs text-text outline-none focus:border-brand-500";

const MERGE_TAGS = [
  "companyLogoHtml", "companyName", "companyAddress", "companyEmail", "companyPhone", "companyTaxId",
  "invoiceNumber", "invoiceDate", "customerName", "customerPhone", "customerAddress", "itemsTableRows",
  "currency", "subTotal", "discountRow", "taxRow", "codFeeRow", "shippingRow", "totalAmount",
  "paymentMethod", "paymentStatus", "stampImageHtml", "termsBlock",
];

export default function InvoiceTemplateSettingsPage() {
  const { data, isLoading } = useInvoiceTemplateSettings();
  const update = useUpdateInvoiceTemplateSettings();
  const [draft, setDraft] = useState<string | null>(null);

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader
          icon={templateIcon}
          title="Invoice Template"
          subtitle="Custom raw-HTML layout for every generated invoice."
          style={{ background: "linear-gradient(135deg, #140A24 0%, #5F03AA 100%)" }}
        />
        <Card><p className="text-sm text-muted">Loading…</p></Card>
      </div>
    );
  }

  const template = draft ?? (data.template || data.defaultTemplate);
  const dirty = draft !== null;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={templateIcon}
        title="Invoice Template"
        subtitle="Site-wide layout used by every generated invoice — single and bulk print."
        style={{ background: "linear-gradient(135deg, #140A24 0%, #5F03AA 100%)" }}
      />
      <Link href="/settings" className="flex items-center gap-1.5 text-sm font-semibold text-brand-500">
        <Icon name="arrow_back" size={16} /> Back to Settings
      </Link>

      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-ui text-sm font-bold text-text">Custom Template</h3>
            <p className="text-xs text-muted">
              Raw HTML with <code>{"{{merge tags}}"}</code> — off by default (uses the built-in layout from
              Settings &gt; Invoice Settings). Use inline styles only; page-level CSS classes aren&apos;t
              guaranteed to be available here. Line items and conditional totals rows are pre-rendered HTML
              fragments (<code>{"{{itemsTableRows}}"}</code>, <code>{"{{taxRow}}"}</code>, etc) since a plain
              merge tag can&apos;t repeat per item.
            </p>
          </div>
          <ToggleSwitch checked={data.enabled} onChange={(v) => update.mutate({ enabled: v })} label="Enabled" />
        </div>

        <textarea value={template} onChange={(e) => setDraft(e.target.value)} className={textareaClass} spellCheck={false} />

        <div className="flex flex-wrap gap-1.5">
          {MERGE_TAGS.map((tag) => (
            <code key={tag} className="rounded-sm bg-surface-2 px-1.5 py-0.5 text-[0.7rem] text-secondary">{`{{${tag}}}`}</code>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="primary"
            disabled={!dirty || update.isPending}
            onClick={() => update.mutate({ template }, { onSuccess: () => setDraft(null) })}
          >
            {update.isPending ? "Saving…" : "Save"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setDraft(data.defaultTemplate)}>
            Reset to default
          </Button>
        </div>
      </Card>
    </div>
  );
}
