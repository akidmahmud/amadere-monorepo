"use client";

import { useEffect, useState } from "react";
import { Button, Card, ToggleSwitch } from "@amader/admin-ui";
import { useUpdateWhatsappSettings, useWhatsappSettings } from "@/hooks/useWhatsappSettings";

const inputClass = "h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500";
const textareaClass = "rounded-sm border border-border bg-surface p-3 text-sm text-text outline-none focus:border-brand-500";

export default function WhatsappPage() {
  const { data, isLoading } = useWhatsappSettings();
  const update = useUpdateWhatsappSettings();

  const [enabled, setEnabled] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [productMessageTemplate, setProductMessageTemplate] = useState("");
  const [floatingMessageTemplate, setFloatingMessageTemplate] = useState("");

  useEffect(() => {
    if (!data) return;
    setEnabled(data.enabled);
    setPhoneNumber(data.phoneNumber);
    setProductMessageTemplate(data.productMessageTemplate);
    setFloatingMessageTemplate(data.floatingMessageTemplate);
  }, [data]);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    update.mutate({ enabled, phoneNumber, productMessageTemplate, floatingMessageTemplate });
  }

  if (isLoading || !data) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div className="flex flex-col gap-4">
      <Card className="max-w-2xl">
        <h1 className="mb-1 font-ui text-lg font-bold text-text">WhatsApp</h1>
        <p className="mb-5 text-sm text-muted">
          Controls the product page&apos;s &quot;Order on WhatsApp&quot; button and the site-wide floating WhatsApp button.
        </p>
        <form onSubmit={handleSave} className="flex flex-col gap-5">
          <ToggleSwitch checked={enabled} onChange={setEnabled} label="Show WhatsApp buttons on the storefront" />

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">WhatsApp number</span>
            <input
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="8801XXXXXXXXX (country code, no + or spaces)"
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">
              Product page message — <code className="rounded-sm bg-surface-2 px-1 py-0.5 text-[11px]">{"{{productName}}"}</code> gets replaced with the product&apos;s name
            </span>
            <textarea
              value={productMessageTemplate}
              onChange={(e) => setProductMessageTemplate(e.target.value)}
              rows={3}
              className={textareaClass}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Floating button message (general inquiries)</span>
            <textarea
              value={floatingMessageTemplate}
              onChange={(e) => setFloatingMessageTemplate(e.target.value)}
              rows={3}
              className={textareaClass}
            />
          </label>

          <div className="flex items-center gap-3">
            <Button type="submit" variant="primary" className="self-start" disabled={update.isPending}>
              {update.isPending ? "Saving…" : "Save"}
            </Button>
            {update.isSuccess && !update.isPending && <span className="text-sm text-success">Saved</span>}
            {update.isError && !update.isPending && <span className="text-sm text-danger">Failed to save</span>}
          </div>
        </form>
      </Card>
    </div>
  );
}
