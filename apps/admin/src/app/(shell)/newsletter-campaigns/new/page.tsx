"use client";

import { useState } from "react";
import { Card, Icon, PageHeader } from "@amader/admin-ui";
import { useNewsletterTemplates } from "@/hooks/useNewsletterTemplates";
import { CampaignEditor, type InitialContent } from "@/components/newsletter-campaigns/CampaignEditor";

const inputClass = "h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500";

export default function NewCampaignPage() {
  const { data: templates } = useNewsletterTemplates();
  // "blank" until a template is picked (or explicitly kept blank) — the key
  // below forces CampaignEditor to remount with fresh initial state each
  // time the selection changes, since it's meant to happen before any real
  // editing starts.
  const [templateId, setTemplateId] = useState<number | "blank">("blank");

  const initialContent: InitialContent | undefined =
    templateId !== "blank"
      ? (() => {
          const t = templates?.find((t) => t.id === templateId);
          return t ? { blocks: t.contentJson.blocks, mode: t.contentJson.mode ?? "blocks", html: t.contentJson.html } : undefined;
        })()
      : undefined;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={<Icon name="campaign" />}
        title="Create Campaign"
        subtitle="Save a draft, then send a test before sending to your subscribers."
        style={{ background: "linear-gradient(135deg, #140A24 0%, #5F03AA 100%)" }}
      />

      {templates && templates.length > 0 && (
        <Card className="flex items-center gap-3">
          <span className="text-xs font-semibold text-secondary">Start from template</span>
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value === "blank" ? "blank" : Number(e.target.value))}
            className={`${inputClass} w-64`}
          >
            <option value="blank">Blank campaign</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Card>
      )}

      <CampaignEditor key={templateId} campaignId={null} initialContent={initialContent} />
    </div>
  );
}
