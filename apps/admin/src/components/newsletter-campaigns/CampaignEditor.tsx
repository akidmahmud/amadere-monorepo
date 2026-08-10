"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Icon } from "@amader/admin-ui";
import { ProxyApiError } from "@/lib/api/proxy-client";
import { friendlyErrorMessage } from "@/lib/friendly-error";
import { useToast } from "@/components/ToastProvider";
import { useNewsletterSegments } from "@/hooks/useNewsletterSegments";
import { useCreateTemplate } from "@/hooks/useNewsletterTemplates";
import {
  useCampaignAnalytics,
  useCancelScheduleCampaign,
  useCreateCampaign,
  useNewsletterCampaign,
  useScheduleCampaign,
  useSendCampaign,
  useSendTestCampaign,
  useUpdateCampaign,
  type EmailBlock,
  type EmailContentMode,
} from "@/hooks/useNewsletterCampaigns";
import { EmailContentEditor } from "./EmailContentEditor";
import { PreviewButton } from "./PreviewModal";

function toastMessage(err: unknown, fallback: string): string {
  return err instanceof ProxyApiError ? friendlyErrorMessage(err.message) : fallback;
}

const inputClass = "h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500";

const STATUS_PILL: Record<string, string> = {
  DRAFT: "bg-surface-2 text-secondary",
  SCHEDULED: "bg-[#e6effe] text-[#2a6fee]",
  SENDING: "bg-[#fdf1dc] text-[#e0821c]",
  SENT: "bg-[#e3f7ee] text-[#16a06d]",
  PARTIALLY_SENT: "bg-[#fdf1dc] text-[#e0821c]",
  FAILED: "bg-[#feeaec] text-[#e8465e]",
};

function isContentEmpty(mode: EmailContentMode, blocks: EmailBlock[], html: string): boolean {
  return mode === "html" ? !html.trim() : blocks.length === 0;
}

function AnalyticsRow({ campaignId }: { campaignId: number }) {
  const { data } = useCampaignAnalytics(campaignId);
  if (!data) return null;
  const cards: { label: string; value: string }[] = [
    { label: "Recipients", value: String(data.totalRecipients) },
    { label: "Sent", value: String(data.totalSent) },
    { label: "Failed", value: String(data.totalFailed) },
    { label: "Opened", value: `${data.totalOpened}${data.openRate !== null ? ` (${(data.openRate * 100).toFixed(1)}%)` : ""}` },
    { label: "Clicked", value: `${data.totalClicked}${data.clickRate !== null ? ` (${(data.clickRate * 100).toFixed(1)}%)` : ""}` },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {cards.map((c) => (
        <div key={c.label} className="rounded-inner bg-surface-2 p-3 text-center">
          <div className="text-lg font-bold text-text">{c.value}</div>
          <div className="text-xs text-muted">{c.label}</div>
        </div>
      ))}
    </div>
  );
}

export interface InitialContent {
  blocks: EmailBlock[];
  mode: EmailContentMode;
  html?: string;
}

export function CampaignEditor({ campaignId, initialContent }: { campaignId: number | null; initialContent?: InitialContent }) {
  const router = useRouter();
  const toast = useToast();
  const { data: campaign } = useNewsletterCampaign(campaignId);
  const { data: segments } = useNewsletterSegments();
  const create = useCreateCampaign();
  const update = useUpdateCampaign(campaignId ?? -1);
  const sendTest = useSendTestCampaign(campaignId ?? -1);
  const send = useSendCampaign();
  const schedule = useScheduleCampaign();
  const cancelSchedule = useCancelScheduleCampaign();
  const createTemplate = useCreateTemplate();

  const [name, setName] = useState(campaign?.name ?? "");
  const [subject, setSubject] = useState(campaign?.subject ?? "");
  const [previewText, setPreviewText] = useState(campaign?.previewText ?? "");
  const [fromName, setFromName] = useState(campaign?.fromName ?? "");
  const [fromEmail, setFromEmail] = useState(campaign?.fromEmail ?? "");
  const [replyTo, setReplyTo] = useState(campaign?.replyTo ?? "");
  const [blocks, setBlocks] = useState<EmailBlock[]>(campaign?.contentJson.blocks ?? initialContent?.blocks ?? []);
  const [contentMode, setContentMode] = useState<EmailContentMode>(campaign?.contentJson.mode ?? initialContent?.mode ?? "blocks");
  const [html, setHtml] = useState(campaign?.contentJson.html ?? initialContent?.html ?? "");
  const [segmentId, setSegmentId] = useState<number | null>(campaign?.segmentId ?? null);
  // Starts at null (not campaignId) — this tracks "which campaign's data has
  // actually been loaded into the form fields", not "which id are we on".
  // Initializing it to campaignId made the seed check below (`seededFor !==
  // campaign.id`) false on the very first real data arrival, since they'd
  // already match — so the form silently stayed empty on first load of an
  // existing campaign (verified live: name/subject/blocks all blank despite
  // the DB row having real data).
  const [seededFor, setSeededFor] = useState<number | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [scheduleAt, setScheduleAt] = useState("");

  // Seed local form state from the fetched campaign exactly once per id
  // (not a controlled/always-synced form — the admin's own edits shouldn't
  // get clobbered by a background refetch).
  if (campaign && seededFor !== campaign.id) {
    setName(campaign.name);
    setSubject(campaign.subject);
    setPreviewText(campaign.previewText ?? "");
    setFromName(campaign.fromName ?? "");
    setFromEmail(campaign.fromEmail ?? "");
    setReplyTo(campaign.replyTo ?? "");
    setBlocks(campaign.contentJson.blocks);
    setContentMode(campaign.contentJson.mode ?? "blocks");
    setHtml(campaign.contentJson.html ?? "");
    setSegmentId(campaign.segmentId);
    setSeededFor(campaign.id);
  }

  const isDraft = !campaign || campaign.status === "DRAFT";
  const contentEmpty = isContentEmpty(contentMode, blocks, html);
  const input = {
    name,
    subject,
    previewText: previewText || undefined,
    fromName: fromName || undefined,
    fromEmail: fromEmail || undefined,
    replyTo: replyTo || undefined,
    blocks,
    mode: contentMode,
    html: html || undefined,
    segmentId,
  };

  async function handleSaveDraft() {
    try {
      if (campaignId === null) {
        const created = await create.mutateAsync(input);
        router.push(`/newsletter-campaigns/${created.id}`);
      } else {
        await update.mutateAsync(input);
        toast.push("Draft saved");
      }
    } catch (err) {
      toast.push(toastMessage(err, "Failed to save campaign"));
    }
  }

  async function handleSendNow() {
    if (campaignId === null) return;
    if (!confirm("Send this campaign to every subscriber in the selected audience now? This can't be undone.")) return;
    try {
      await send.mutateAsync(campaignId);
      toast.push("Campaign queued for sending");
    } catch (err) {
      toast.push(toastMessage(err, "Failed to send campaign"));
    }
  }

  async function handleSchedule() {
    if (campaignId === null || !scheduleAt) return;
    try {
      await schedule.mutateAsync({ id: campaignId, scheduledAt: new Date(scheduleAt).toISOString() });
      toast.push("Campaign scheduled");
    } catch (err) {
      toast.push(toastMessage(err, "Failed to schedule campaign"));
    }
  }

  async function handleCancelSchedule() {
    if (campaignId === null) return;
    try {
      await cancelSchedule.mutateAsync(campaignId);
      toast.push("Schedule cancelled — back to draft");
    } catch (err) {
      toast.push(toastMessage(err, "Failed to cancel schedule"));
    }
  }

  async function handleSaveAsTemplate() {
    const templateName = prompt("Template name", name || "Untitled template");
    if (!templateName) return;
    try {
      await createTemplate.mutateAsync({ name: templateName, blocks, mode: contentMode, html: html || undefined });
      toast.push("Saved as template");
    } catch (err) {
      toast.push(toastMessage(err, "Failed to save template"));
    }
  }

  async function handleSendTest() {
    try {
      await sendTest.mutateAsync(testEmail);
      toast.push(`Test sent to ${testEmail}`);
    } catch (err) {
      toast.push(toastMessage(err, "Failed to send test email"));
    }
  }

  const saving = create.isPending || update.isPending;

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-ui text-sm font-bold text-text">Campaign Details</h2>
          {campaign && (
            <span className={`rounded-pill px-2.5 py-1 text-xs font-bold ${STATUS_PILL[campaign.status] ?? "bg-surface-2 text-secondary"}`}>
              {campaign.status.replaceAll("_", " ")}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Campaign name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} disabled={!isDraft} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Subject</span>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} disabled={!isDraft} className={inputClass} />
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Preview text (optional)</span>
          <input value={previewText} onChange={(e) => setPreviewText(e.target.value)} disabled={!isDraft} className={inputClass} />
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">From name</span>
            <input placeholder="Uses Settings > Email" value={fromName} onChange={(e) => setFromName(e.target.value)} disabled={!isDraft} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">From email</span>
            <input placeholder="Uses Settings > Email" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} disabled={!isDraft} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Reply-to (optional)</span>
            <input value={replyTo} onChange={(e) => setReplyTo(e.target.value)} disabled={!isDraft} className={inputClass} />
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Audience</span>
          <select
            value={segmentId ?? ""}
            onChange={(e) => setSegmentId(e.target.value ? Number(e.target.value) : null)}
            disabled={!isDraft}
            className={`${inputClass} w-full`}
          >
            <option value="">All subscribed subscribers</option>
            {segments?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </Card>

      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-ui text-sm font-bold text-text">Email Content</h2>
          <div className="flex items-center gap-2">
            {isDraft && !contentEmpty && (
              <Button type="button" variant="ghost" disabled={createTemplate.isPending} onClick={handleSaveAsTemplate}>
                <Icon name="save" size={16} /> Save as Template
              </Button>
            )}
            <PreviewButton mode={contentMode} blocks={blocks} html={html} />
          </div>
        </div>
        {isDraft ? (
          <EmailContentEditor mode={contentMode} blocks={blocks} html={html} onModeChange={setContentMode} onBlocksChange={setBlocks} onHtmlChange={setHtml} />
        ) : (
          <p className="text-sm text-muted">Content is locked once a campaign has been sent or scheduled.</p>
        )}
      </Card>

      {campaign && campaign.status === "SCHEDULED" && (
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-text">
            Scheduled for <span className="font-semibold">{campaign.scheduledAt ? new Date(campaign.scheduledAt).toLocaleString() : "—"}</span>
          </p>
          <Button type="button" variant="ghost" disabled={cancelSchedule.isPending} onClick={handleCancelSchedule}>
            {cancelSchedule.isPending ? "Cancelling…" : "Cancel Schedule"}
          </Button>
        </Card>
      )}

      {campaign && campaign.status !== "DRAFT" && campaign.status !== "SCHEDULED" && (
        <Card className="flex flex-col gap-3">
          <h2 className="font-ui text-sm font-bold text-text">Analytics</h2>
          <AnalyticsRow campaignId={campaign.id} />
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <input
            type="email"
            placeholder="Send a test to…"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            disabled={campaignId === null}
            className={`${inputClass} w-56`}
          />
          <Button
            type="button"
            variant="ghost"
            disabled={campaignId === null || !testEmail || sendTest.isPending}
            onClick={handleSendTest}
          >
            {sendTest.isPending ? "Sending…" : "Send Test"}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isDraft && (
            <Button type="button" variant="ghost" disabled={!name || !subject || saving} onClick={handleSaveDraft}>
              {saving ? "Saving…" : "Save Draft"}
            </Button>
          )}
          {campaign && campaign.status === "DRAFT" && (
            <>
              <input
                type="datetime-local"
                value={scheduleAt}
                onChange={(e) => setScheduleAt(e.target.value)}
                className={inputClass}
              />
              <Button type="button" variant="ghost" disabled={contentEmpty || !scheduleAt || schedule.isPending} onClick={handleSchedule}>
                <Icon name="schedule_send" size={16} /> {schedule.isPending ? "Scheduling…" : "Schedule"}
              </Button>
              <Button type="button" variant="primary" disabled={contentEmpty || send.isPending} onClick={handleSendNow}>
                <Icon name="send" size={16} /> {send.isPending ? "Sending…" : "Send Now"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
