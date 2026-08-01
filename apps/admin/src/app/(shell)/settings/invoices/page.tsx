"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card, Icon, PageHeader, ToggleSwitch } from "@amader/admin-ui";
import { MediaPicker } from "@/components/MediaPicker";
import {
  useInvoiceSettings,
  useUpdateInvoiceSettings,
  type InvoiceDateFormat,
  type InvoiceLanguageSupport,
  type InvoiceSettings,
} from "@/hooks/useInvoiceSettings";

const invoiceIcon = <Icon name="receipt_long" />;
const inputClass = "h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500";
const textareaClass = "min-h-[80px] rounded-sm border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-brand-500";

const DATE_FORMAT_OPTIONS: { value: InvoiceDateFormat; label: string }[] = [
  { value: "MDY", label: "Jul 31, 2026" },
  { value: "DMY", label: "31/07/2026" },
  { value: "YMD", label: "2026-07-31" },
];

const LANGUAGE_OPTIONS: { value: InvoiceLanguageSupport; label: string }[] = [
  { value: "default", label: "Latin only" },
  { value: "arabic", label: "Arabic" },
  { value: "bengali", label: "Bengali" },
  { value: "chinese", label: "Chinese" },
];

// Editable fields only — logo/stamp URLs and every toggle live in the SAME
// draft as the text fields (not separate immediate mutations) specifically
// so there is only ever one in-flight PUT for this settings blob at a time.
// The previous version mutated companyLogoUrl/stampImageUrl/dateFormat/
// toggles immediately while a separate draft batched the text fields —
// two independent read-modify-write PUTs racing against the same row could
// each read a stale snapshot and overwrite the other's just-saved field
// (reported bug: uploading a logo then hitting Save could wipe either the
// logo or the text fields depending on which PUT landed last).
type Draft = Omit<InvoiceSettings, "companyLogoUrl" | "stampImageUrl"> & {
  companyLogoUrl: string;
  stampImageUrl: string;
};

function toDraft(data: InvoiceSettings): Draft {
  return { ...data, companyLogoUrl: data.companyLogoUrl ?? "", stampImageUrl: data.stampImageUrl ?? "" };
}

export default function InvoiceSettingsPage() {
  const { data, isLoading } = useInvoiceSettings();
  const update = useUpdateInvoiceSettings();
  const [form, setForm] = useState<Draft | null>(null);

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

  const draft = form ?? toDraft(data);
  const dirty = form !== null;

  function setField<K extends keyof Draft>(key: K, value: Draft[K]) {
    setForm({ ...draft, [key]: value });
  }

  function save() {
    update.mutate(
      { ...draft, companyLogoUrl: draft.companyLogoUrl || null, stampImageUrl: draft.stampImageUrl || null } as Partial<InvoiceSettings>,
      { onSuccess: () => setForm(null) },
    );
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
            <span className="text-xs font-semibold text-secondary">Country</span>
            <input value={draft.companyCountry} onChange={(e) => setField("companyCountry", e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">State / Division</span>
            <input value={draft.companyState} onChange={(e) => setField("companyState", e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">City</span>
            <input value={draft.companyCity} onChange={(e) => setField("companyCity", e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Zip / Post code</span>
            <input value={draft.companyZipcode} onChange={(e) => setField("companyZipcode", e.target.value)} className={inputClass} />
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
        <MediaPicker label="Company logo" value={draft.companyLogoUrl || undefined} onChange={(url) => setField("companyLogoUrl", url)} />
      </Card>

      <Card className="flex flex-col gap-4">
        <h3 className="font-ui text-sm font-bold text-text">Typography & Language</h3>
        <ToggleSwitch
          checked={draft.customFontEnabled}
          onChange={(v) => setField("customFontEnabled", v)}
          label="Use a custom font for invoices"
        />
        {draft.customFontEnabled && (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Google Font name</span>
            <input
              placeholder="e.g. Poppins"
              value={draft.customFontFamily}
              onChange={(e) => setField("customFontFamily", e.target.value)}
              className={`${inputClass} max-w-xs`}
            />
          </label>
        )}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Add language support</span>
          <div className="flex flex-wrap gap-4">
            {LANGUAGE_OPTIONS.map((o) => (
              <label key={o.value} className="flex items-center gap-1.5 text-sm text-text">
                <input
                  type="radio"
                  name="languageSupport"
                  checked={draft.languageSupport === o.value}
                  onChange={() => setField("languageSupport", o.value)}
                />
                {o.label}
              </label>
            ))}
          </div>
        </div>
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
              value={draft.dateFormat}
              onChange={(e) => setField("dateFormat", e.target.value as InvoiceDateFormat)}
              className={inputClass}
            >
              {DATE_FORMAT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Terms & conditions</span>
          <textarea
            value={draft.termsAndConditions}
            onChange={(e) => setField("termsAndConditions", e.target.value)}
            className={textareaClass}
            placeholder="Shown in a box at the bottom of every invoice, if set."
          />
        </label>
        <ToggleSwitch
          checked={draft.disableUntilConfirmed}
          onChange={(v) => setField("disableUntilConfirmed", v)}
          label="Disable order invoice until order confirmed"
        />
      </Card>

      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="font-ui text-sm font-bold text-text">Invoice Stamp</h3>
          <ToggleSwitch checked={draft.stampEnabled} onChange={(v) => setField("stampEnabled", v)} label="Enabled" />
        </div>
        {draft.stampEnabled && (
          <MediaPicker label="Stamp image" value={draft.stampImageUrl || undefined} onChange={(url) => setField("stampImageUrl", url)} />
        )}
      </Card>

      <div className="sticky bottom-4 flex justify-end">
        <Button type="button" variant="primary" disabled={!dirty || update.isPending} onClick={save}>
          {update.isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
