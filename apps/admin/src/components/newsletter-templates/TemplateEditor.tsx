"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card } from "@amader/admin-ui";
import { ProxyApiError } from "@/lib/api/proxy-client";
import { friendlyErrorMessage } from "@/lib/friendly-error";
import { useToast } from "@/components/ToastProvider";
import {
  useCreateTemplate,
  useNewsletterTemplate,
  useUpdateTemplate,
} from "@/hooks/useNewsletterTemplates";
import type { EmailBlock, EmailContentMode } from "@/hooks/useNewsletterCampaigns";
import { EmailContentEditor } from "@/components/newsletter-campaigns/EmailContentEditor";
import { PreviewButton } from "@/components/newsletter-campaigns/PreviewModal";

function toastMessage(err: unknown, fallback: string): string {
  return err instanceof ProxyApiError ? friendlyErrorMessage(err.message) : fallback;
}

const inputClass = "h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500";

export function TemplateEditor({ templateId }: { templateId: number | null }) {
  const router = useRouter();
  const toast = useToast();
  const { data: template } = useNewsletterTemplate(templateId);
  const create = useCreateTemplate();
  const update = useUpdateTemplate(templateId ?? -1);

  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [blocks, setBlocks] = useState<EmailBlock[]>(template?.contentJson.blocks ?? []);
  const [contentMode, setContentMode] = useState<EmailContentMode>(template?.contentJson.mode ?? "blocks");
  const [html, setHtml] = useState(template?.contentJson.html ?? "");
  const [seededFor, setSeededFor] = useState<number | null>(null);

  if (template && seededFor !== template.id) {
    setName(template.name);
    setDescription(template.description ?? "");
    setBlocks(template.contentJson.blocks);
    setContentMode(template.contentJson.mode ?? "blocks");
    setHtml(template.contentJson.html ?? "");
    setSeededFor(template.id);
  }

  const input = { name, description: description || undefined, blocks, mode: contentMode, html: html || undefined };
  const saving = create.isPending || update.isPending;

  async function handleSave() {
    try {
      if (templateId === null) {
        const created = await create.mutateAsync(input);
        router.push(`/newsletter-templates/${created.id}`);
      } else {
        await update.mutateAsync(input);
        toast.push("Template saved");
      }
    } catch (err) {
      toast.push(toastMessage(err, "Failed to save template"));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4">
        <h2 className="font-ui text-sm font-bold text-text">Template Details</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Template name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Description (optional)</span>
            <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
          </label>
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-ui text-sm font-bold text-text">Email Content</h2>
          <PreviewButton mode={contentMode} blocks={blocks} html={html} />
        </div>
        <EmailContentEditor mode={contentMode} blocks={blocks} html={html} onModeChange={setContentMode} onBlocksChange={setBlocks} onHtmlChange={setHtml} />
      </Card>

      <div className="flex justify-end">
        <Button type="button" variant="primary" disabled={!name || saving} onClick={handleSave}>
          {saving ? "Saving…" : "Save Template"}
        </Button>
      </div>
    </div>
  );
}
