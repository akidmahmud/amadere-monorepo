"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card, Icon, PageHeader, ToggleSwitch } from "@amader/admin-ui";
import {
  useShippingLabelSettings,
  useUpdateShippingLabelSettings,
} from "@/hooks/useShippingLabelSettings";

const labelIcon = <Icon name="sell" />;
const textareaClass =
  "min-h-[360px] rounded-sm border border-border bg-surface px-3 py-2 font-mono text-xs text-text outline-none focus:border-brand-500";

const MERGE_TAGS = [
  "companyName", "orderNumber", "date", "recipientName", "phone", "addressLine",
  "addressFull", "trackingCode", "provider", "weight", "itemCount", "codAmount", "currency",
];

export default function ShippingLabelSettingsPage() {
  const { data, isLoading } = useShippingLabelSettings();
  const update = useUpdateShippingLabelSettings();
  const [draft, setDraft] = useState<string | null>(null);

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader
          icon={labelIcon}
          title="Shipping Label Template"
          subtitle="Site-wide layout for every printed shipping label."
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
        icon={labelIcon}
        title="Shipping Label Template"
        subtitle="Site-wide layout used by every printed shipping label — single and bulk."
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
              Raw HTML with <code>{"{{merge tags}}"}</code> — off by default (uses the built-in layout). Use
              inline styles only; page-level CSS classes aren&apos;t guaranteed to be available here.
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
          <Button
            type="button"
            variant="ghost"
            onClick={() => setDraft(data.defaultTemplate)}
          >
            Reset to default
          </Button>
        </div>
      </Card>
    </div>
  );
}
