"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card, Icon, PageHeader, ToggleSwitch } from "@amader/admin-ui";
import { MediaPicker } from "@/components/MediaPicker";
import { useInvoiceSettings, useUpdateInvoiceSettings, type InvoiceDateFormat } from "@/hooks/useInvoiceSettings";

const invoiceIcon = <Icon name="receipt_long" />;
const inputClass = "h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500";

const DATE_FORMAT_OPTIONS: { value: InvoiceDateFormat; label: string }[] = [
  { value: "MDY", label: "Jul 31, 2026" },
  { value: "DMY", label: "31/07/2026" },
  { value: "YMD", label: "2026-07-31" },
];

export default function InvoiceSettingsPage() {
  const { data, isLoading } = useInvoiceSettings();
  const update = useUpdateInvoiceSettings();
  const [form, setForm] = useState<Record<string, string> | null>(null);

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader
          icon={invoiceIcon}
          title="Invoice Settings"
          subtitle="Company info and layout used on every generated invoice."
          style={{ background: "linear-gradient(135deg, #140A24 0%, #5F03AA 100%)" }}
        />
        <Card><p className="text-sm text-muted">Loading…</p></Card>
      </div>
    );
  }

  const draft = form ?? {
    companyName: data.companyName,
    companyAddress: data.companyAddress,
    companyEmail: data.companyEmail,
    companyPhone: data.companyPhone,
    companyTaxId: data.companyTaxId,
    invoicePrefix: data.invoicePrefix,
  };
  const dirty = form !== null;

  function setField(key: string, value: string) {
    setForm({ ...draft, [key]: value });
  }

  function save() {
    update.mutate(draft, { onSuccess: () => setForm(null) });
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={invoiceIcon}
        title="Invoice Settings"
        subtitle="Company info and layout used on every generated invoice — single and bulk."
        style={{ background: "linear-gradient(135deg, #140A24 0%, #5F03AA 100%)" }}
      />
      <Link href="/settings" className="flex items-center gap-1.5 text-sm font-semibold text-brand-500">
        <Icon name="arrow_back" size={16} /> Back to Settings
      </Link>

      <Card className="flex flex-col gap-4">
        <h3 className="font-ui text-sm font-bold text-text">Company Info</h3>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Company name</span>
            <input value={draft.companyName} onChange={(e) => setField("companyName", e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Company tax ID</span>
            <input value={draft.companyTaxId} onChange={(e) => setField("companyTaxId", e.target.value)} className={inputClass} />
          </label>
          <label className="col-span-2 flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Company address</span>
            <input value={draft.companyAddress} onChange={(e) => setField("companyAddress", e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Company email</span>
            <input value={draft.companyEmail} onChange={(e) => setField("companyEmail", e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Company phone</span>
            <input value={draft.companyPhone} onChange={(e) => setField("companyPhone", e.target.value)} className={inputClass} />
          </label>
        </div>
        <MediaPicker label="Company logo" value={data.companyLogoUrl ?? undefined} onChange={(url) => update.mutate({ companyLogoUrl: url })} />
        <Button type="button" variant="primary" className="self-start" disabled={!dirty || update.isPending} onClick={save}>
          {update.isPending ? "Saving…" : "Save"}
        </Button>
      </Card>

      <Card className="flex flex-col gap-4">
        <h3 className="font-ui text-sm font-bold text-text">Layout</h3>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Invoice code prefix</span>
            <input
              placeholder="e.g. INV-"
              value={draft.invoicePrefix}
              onChange={(e) => setField("invoicePrefix", e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Date format</span>
            <select
              value={data.dateFormat}
              onChange={(e) => update.mutate({ dateFormat: e.target.value as InvoiceDateFormat })}
              className={inputClass}
            >
              {DATE_FORMAT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
        </div>
        {dirty && (
          <Button type="button" variant="primary" className="self-start" disabled={update.isPending} onClick={save}>
            {update.isPending ? "Saving…" : "Save prefix"}
          </Button>
        )}
        <ToggleSwitch
          checked={data.disableUntilConfirmed}
          onChange={(v) => update.mutate({ disableUntilConfirmed: v })}
          label="Disable order invoice until order confirmed"
        />
      </Card>

      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="font-ui text-sm font-bold text-text">Invoice Stamp</h3>
          <ToggleSwitch checked={data.stampEnabled} onChange={(v) => update.mutate({ stampEnabled: v })} label="Enabled" />
        </div>
        {data.stampEnabled && (
          <MediaPicker label="Stamp image" value={data.stampImageUrl ?? undefined} onChange={(url) => update.mutate({ stampImageUrl: url })} />
        )}
      </Card>
    </div>
  );
}
