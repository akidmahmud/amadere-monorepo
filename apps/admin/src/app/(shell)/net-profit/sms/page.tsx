"use client";

import { useState } from "react";
import { Button, Card, Tabs } from "@amader/admin-ui";
import {
  useBulkSendSms,
  useSmsBalance,
  useSmsLogs,
  useSmsSettings,
  useSmsTemplates,
  useTestSendSms,
  useUpdateSmsSettings,
  useUpdateSmsTemplate,
} from "@/hooks/useSms";

function TemplatesTab() {
  const { data: templates, isLoading } = useSmsTemplates();
  const update = useUpdateSmsTemplate();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ bodyEn: string; bodyBn: string } | null>(null);

  if (isLoading) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div className="flex flex-col gap-3">
      {templates?.map((t) => (
        <Card key={t.key} className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-text">{t.key}</span>
            <label className="ml-auto flex items-center gap-1.5 text-xs text-secondary">
              <input
                type="checkbox"
                checked={t.enabled}
                onChange={(e) => update.mutate({ key: t.key, enabled: e.target.checked })}
              />
              Enabled
            </label>
          </div>
          {editing === t.key ? (
            <div className="flex flex-col gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-secondary">English</span>
                <textarea
                  value={draft?.bodyEn ?? t.bodyEn}
                  onChange={(e) => setDraft({ bodyEn: e.target.value, bodyBn: draft?.bodyBn ?? t.bodyBn })}
                  rows={2}
                  className="rounded-sm border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-brand-500"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-secondary">বাংলা</span>
                <textarea
                  value={draft?.bodyBn ?? t.bodyBn}
                  onChange={(e) => setDraft({ bodyEn: draft?.bodyEn ?? t.bodyEn, bodyBn: e.target.value })}
                  rows={2}
                  className="rounded-sm border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-brand-500"
                />
              </label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="primary"
                  disabled={update.isPending}
                  onClick={() =>
                    update.mutate(
                      { key: t.key, bodyEn: draft?.bodyEn ?? t.bodyEn, bodyBn: draft?.bodyBn ?? t.bodyBn },
                      { onSuccess: () => { setEditing(null); setDraft(null); } },
                    )
                  }
                >
                  Save
                </Button>
                <Button type="button" variant="ghost" onClick={() => { setEditing(null); setDraft(null); }}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-xs text-secondary">{t.bodyEn}</p>
              <p className="text-xs text-secondary">{t.bodyBn}</p>
              <Button type="button" variant="ghost" className="self-start" onClick={() => setEditing(t.key)}>
                Edit
              </Button>
            </>
          )}
        </Card>
      ))}
    </div>
  );
}

function LogsTab() {
  const { data, isLoading } = useSmsLogs();
  const [to, setTo] = useState("");
  const [body, setBody] = useState("");
  const testSend = useTestSendSms();

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Test send to</span>
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="01XXXXXXXXX"
            className="h-10 w-44 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Message</span>
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          />
        </label>
        <Button
          type="button"
          variant="primary"
          disabled={testSend.isPending || !to.trim() || !body.trim()}
          onClick={() => testSend.mutate({ to: to.trim(), body: body.trim() }, { onSuccess: () => setBody("") })}
        >
          {testSend.isPending ? "Sending…" : "Send test"}
        </Button>
      </Card>

      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      {data && data.items.length === 0 && <p className="text-sm text-muted">No SMS sent yet.</p>}

      <div className="flex flex-col gap-2">
        {data?.items.map((l) => (
          <Card key={l.id} className="flex items-center gap-3">
            <span className="num text-sm text-text">{l.to}</span>
            <span className="min-w-0 flex-1 truncate text-xs text-secondary">{l.body}</span>
            <span
              className={`rounded-pill px-2.5 py-1 text-xs font-semibold ${
                l.status === "SENT" ? "bg-success/10 text-success" : l.status === "FAILED" ? "bg-danger/10 text-danger" : "bg-border text-secondary"
              }`}
            >
              {l.status}
            </span>
            <span className="text-xs text-muted">{new Date(l.createdAt).toLocaleString()}</span>
          </Card>
        ))}
      </div>
    </div>
  );
}

function SettingsTab() {
  const { data, isLoading } = useSmsSettings();
  const update = useUpdateSmsSettings();
  const { data: balance } = useSmsBalance();

  if (isLoading || !data) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex items-center justify-between">
        <span className="text-sm text-secondary">Gateway balance</span>
        <span className="text-2xl font-semibold text-text">
          {balance?.balance === null || balance?.balance === undefined ? "—" : `৳${balance.balance.toLocaleString()}`}
        </span>
      </Card>

      <Card className="flex flex-col gap-3">
        <label className="flex items-center gap-2.5">
          <input type="checkbox" checked={data.enabled} onChange={(e) => update.mutate({ enabled: e.target.checked })} />
          <span className="text-sm font-semibold text-text">Enable SMS sending (Bulk SMS BD)</span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Sender ID</span>
          <input
            defaultValue={data.senderId}
            onBlur={(e) => update.mutate({ senderId: e.target.value })}
            placeholder="e.g. 8809xxxxxxx or a masked brand name"
            className="h-10 w-64 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          />
        </label>

        <label className="flex items-center gap-2.5">
          <input
            type="checkbox"
            checked={data.senderIdMasked}
            onChange={(e) => update.mutate({ senderIdMasked: e.target.checked })}
          />
          <span className="text-sm text-text">This sender ID is masked (custom brand name, not a numeric shortcode)</span>
        </label>

        <p className="text-xs text-muted">Gateway API key is configured via server environment variable (BULK_SMS_BD_API_KEY), not stored here.</p>
      </Card>
    </div>
  );
}

function BulkSendTab() {
  const [body, setBody] = useState("");
  const [segment, setSegment] = useState<"all" | "has_ordered">("has_ordered");
  const bulkSend = useBulkSendSms();

  return (
    <Card className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-secondary">Segment</span>
        <select
          value={segment}
          onChange={(e) => setSegment(e.target.value as "all" | "has_ordered")}
          className="h-10 w-64 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
        >
          <option value="has_ordered">Customers who have ordered before</option>
          <option value="all">All customers with a phone number</option>
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-secondary">Message</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          className="rounded-sm border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-brand-500"
        />
      </label>
      <Button
        type="button"
        variant="primary"
        className="self-start"
        disabled={bulkSend.isPending || !body.trim()}
        onClick={() => {
          if (!confirm(`Send this SMS to the "${segment}" segment? This cannot be undone.`)) return;
          bulkSend.mutate({ body: body.trim(), segment }, { onSuccess: (r) => alert(`Queued ${r.queued} messages.`) });
        }}
      >
        {bulkSend.isPending ? "Sending…" : "Send broadcast"}
      </Button>
    </Card>
  );
}

export default function SmsPage() {
  const [tab, setTab] = useState("templates");

  return (
    <div className="flex flex-col gap-4">
      <Tabs
        options={[
          { value: "templates", label: "Templates" },
          { value: "logs", label: "Send Log" },
          { value: "bulk", label: "Bulk Send" },
          { value: "settings", label: "Settings" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "templates" && <TemplatesTab />}
      {tab === "logs" && <LogsTab />}
      {tab === "bulk" && <BulkSendTab />}
      {tab === "settings" && <SettingsTab />}
    </div>
  );
}
