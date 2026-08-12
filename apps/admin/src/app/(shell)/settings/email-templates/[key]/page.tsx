"use client";

import { use, useRef, useState } from "react";
import Link from "next/link";
import { Button, Card, Icon, Modal, PageHeader } from "@amader/admin-ui";
import {
  useEmailTemplate,
  usePreviewEmailTemplate,
  useResetEmailTemplate,
  useUpdateEmailTemplate,
} from "@/hooks/useEmailTemplates";

const emailIcon = <Icon name="mail" />;
const gradientStyle = { background: "linear-gradient(135deg, #140A24 0%, #5F03AA 100%)" };
const textareaClass =
  "min-h-[420px] rounded-sm border border-border bg-surface px-3 py-2 font-mono text-xs text-text outline-none focus:border-brand-500";

export default function EmailTemplateEditorPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = use(params);
  const { data, isLoading } = useEmailTemplate(key);
  const update = useUpdateEmailTemplate(key);
  const reset = useResetEmailTemplate(key);
  const preview = usePreviewEmailTemplate(key);

  const [subjectDraft, setSubjectDraft] = useState<string | null>(null);
  const [bodyDraft, setBodyDraft] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader icon={emailIcon} title="Setting for email template" subtitle="Email template using HTML & system variables." style={gradientStyle} />
        <Card><p className="text-sm text-muted">Loading…</p></Card>
      </div>
    );
  }

  const subject = subjectDraft ?? data.subject;
  const body = bodyDraft ?? data.bodyHtml;
  const dirty = subjectDraft !== null || bodyDraft !== null;

  function insertVariable(varKey: string) {
    const el = bodyRef.current;
    const token = `{{ ${varKey} }}`;
    if (!el) {
      setBodyDraft(body + token);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = body.slice(0, start) + token + body.slice(end);
    setBodyDraft(next);
    // Restore focus + caret after the inserted token on the next tick,
    // once React has re-rendered the textarea with the new value.
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + token.length;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader icon={emailIcon} title={data.title} subtitle="Email template using HTML & system variables." style={gradientStyle} />
      <Link href="/settings/email-templates" className="flex items-center gap-1.5 text-sm font-semibold text-brand-500">
        <Icon name="arrow_back" size={16} /> Back to Email Templates
      </Link>

      <Card className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Subject</span>
          <input
            value={subject}
            onChange={(e) => setSubjectDraft(e.target.value)}
            className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Content</span>
          <textarea ref={bodyRef} value={body} onChange={(e) => setBodyDraft(e.target.value)} className={textareaClass} spellCheck={false} />
        </label>

        {data.variables.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-semibold text-secondary">Variables — click to insert</p>
            <div className="flex flex-wrap gap-1.5">
              {data.variables.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => insertVariable(v.key)}
                  title={v.description}
                  className="rounded-sm bg-surface-2 px-1.5 py-0.5 font-mono text-[0.7rem] text-secondary hover:bg-brand-50 hover:text-brand-500"
                >
                  {`{{ ${v.key} }}`}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="primary"
            disabled={!dirty || update.isPending}
            onClick={() =>
              update.mutate(
                { subject: subjectDraft ?? undefined, bodyHtml: bodyDraft ?? undefined },
                { onSuccess: () => { setSubjectDraft(null); setBodyDraft(null); } },
              )
            }
          >
            {update.isPending ? "Saving…" : "Save settings"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={reset.isPending}
            onClick={() => reset.mutate(undefined, { onSuccess: () => { setSubjectDraft(null); setBodyDraft(null); } })}
          >
            Reset to default
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={preview.isPending}
            onClick={() => {
              preview.mutate({ subject, bodyHtml: body }, { onSuccess: () => setPreviewOpen(true) });
            }}
          >
            Preview
          </Button>
        </div>
      </Card>

      {previewOpen && preview.data && (
        <Modal open onClose={() => setPreviewOpen(false)} title={preview.data.subject}>
          <iframe title="Email preview" sandbox="" srcDoc={preview.data.html} className="h-[600px] w-full rounded-sm border border-border bg-white" />
        </Modal>
      )}
    </div>
  );
}
