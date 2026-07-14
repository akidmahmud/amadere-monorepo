"use client";

import { useState } from "react";
import { Button, Card, Tabs } from "@amader/admin-ui";
import {
  useIncompleteOrders,
  useRecoveryRate,
  useRecoverySettings,
  useSendRecovery,
  useUpdateRecoverySettings,
} from "@/hooks/useRecovery";
import {
  useCampaignLogs,
  useCampaignQueue,
  useCampaignSettings,
  useCampaignTemplates,
  useCancelCampaignQueueItem,
  useCreateCampaignTemplate,
  useRetryCampaignQueueItem,
  useUpdateCampaignSettings,
  useUpdateCampaignTemplate,
  type CampaignChannel,
  type DelayUnit,
} from "@/hooks/useCartCampaigns";

function FunnelTab() {
  const { data: rate } = useRecoveryRate();
  const { data, isLoading } = useIncompleteOrders();
  const send = useSendRecovery();

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        <Card className="flex flex-col items-center gap-1 py-4">
          <span className="text-2xl font-semibold text-text">{rate?.total ?? 0}</span>
          <span className="text-xs text-muted">Abandoned carts</span>
        </Card>
        <Card className="flex flex-col items-center gap-1 py-4">
          <span className="text-2xl font-semibold text-success">{rate?.ratePercent ?? 0}%</span>
          <span className="text-xs text-muted">Recovery rate</span>
        </Card>
        <Card className="flex flex-col items-center gap-1 py-4">
          <span className="text-2xl font-semibold text-success">৳{Number(rate?.recoveredValue ?? 0).toLocaleString()}</span>
          <span className="text-xs text-muted">Recovered value</span>
        </Card>
      </div>

      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      {data && data.items.length === 0 && <p className="text-sm text-muted">No abandoned carts captured yet.</p>}

      <div className="flex flex-col gap-2">
        {data?.items.map((row) => (
          <Card key={row.id} className="flex items-center gap-3">
            <span className="num text-sm text-text">{row.phone ?? "no phone (guest)"}</span>
            <span className="rounded-pill bg-surface-2 px-2.5 py-1 text-xs font-semibold text-secondary">{row.stage}</span>
            <span className="text-sm font-semibold text-text">৳{Number(row.subtotal).toLocaleString()}</span>
            <span className="text-xs text-muted">{new Date(row.lastSeenAt).toLocaleString()}</span>
            <span className="text-xs text-muted">{row.recoveryAttempts} attempt(s)</span>
            {row.recovered ? (
              <span className="rounded-pill bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
                Recovered (order #{row.recoveredOrderId})
              </span>
            ) : (
              <Button
                type="button"
                variant="ghost"
                disabled={send.isPending || !row.phone}
                onClick={() => send.mutate(row.id)}
              >
                Send recovery SMS
              </Button>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

function SettingsTab() {
  const { data, isLoading } = useRecoverySettings();
  const update = useUpdateRecoverySettings();

  if (isLoading || !data) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <Card className="flex flex-col gap-4">
      <label className="flex items-center gap-2.5">
        <input type="checkbox" checked={data.enabled} onChange={(e) => update.mutate({ enabled: e.target.checked })} />
        <span className="text-sm font-semibold text-text">Enable automatic recovery sweep (hourly)</span>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Delay before sending (hours)</span>
          <input
            type="number"
            min={1}
            defaultValue={data.delayHours}
            onBlur={(e) => update.mutate({ delayHours: Number(e.target.value) })}
            className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Max attempts</span>
          <input
            type="number"
            min={1}
            defaultValue={data.maxAttempts}
            onBlur={(e) => update.mutate({ maxAttempts: Number(e.target.value) })}
            className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Quiet hours start (0-23)</span>
          <input
            type="number"
            min={0}
            max={23}
            defaultValue={data.quietHoursStart}
            onBlur={(e) => update.mutate({ quietHoursStart: Number(e.target.value) })}
            className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Quiet hours end (0-23)</span>
          <input
            type="number"
            min={0}
            max={23}
            defaultValue={data.quietHoursEnd}
            onBlur={(e) => update.mutate({ quietHoursEnd: Number(e.target.value) })}
            className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          />
        </label>
      </div>
    </Card>
  );
}

function CampaignsTab() {
  const { data: templates, isLoading } = useCampaignTemplates();
  const create = useCreateCampaignTemplate();
  const update = useUpdateCampaignTemplate();
  const { data: settings } = useCampaignSettings();
  const updateSettings = useUpdateCampaignSettings();

  const [name, setName] = useState("");
  const [channel, setChannel] = useState<CampaignChannel>("SMS");
  const [bodyEn, setBodyEn] = useState("");
  const [bodyBn, setBodyBn] = useState("");
  const [delayValue, setDelayValue] = useState(60);
  const [delayUnit, setDelayUnit] = useState<DelayUnit>("MINUTE");

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex items-center gap-2.5">
        <input
          type="checkbox"
          checked={settings?.enabled ?? false}
          onChange={(e) => updateSettings.mutate({ enabled: e.target.checked })}
        />
        <span className="text-sm font-semibold text-text">Enable the automated campaign worker (every 5 minutes)</span>
      </Card>

      <Card className="flex flex-col gap-3">
        <p className="text-xs font-semibold text-secondary">New template</p>
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="h-10 w-48 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Channel</span>
            <select value={channel} onChange={(e) => setChannel(e.target.value as CampaignChannel)} className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500">
              <option value="SMS">SMS</option>
              <option value="EMAIL">EMAIL</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Delay</span>
            <div className="flex gap-1.5">
              <input type="number" min={1} value={delayValue} onChange={(e) => setDelayValue(Number(e.target.value))} className="h-10 w-20 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500" />
              <select value={delayUnit} onChange={(e) => setDelayUnit(e.target.value as DelayUnit)} className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500">
                <option value="MINUTE">minutes</option>
                <option value="HOUR">hours</option>
                <option value="DAY">days</option>
              </select>
            </div>
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Body (English) — use {"{{resumeUrl}}"}</span>
          <textarea value={bodyEn} onChange={(e) => setBodyEn(e.target.value)} rows={2} className="rounded-sm border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-brand-500" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Body (বাংলা)</span>
          <textarea value={bodyBn} onChange={(e) => setBodyBn(e.target.value)} rows={2} className="rounded-sm border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-brand-500" />
        </label>
        <Button
          type="button"
          variant="primary"
          className="self-start"
          disabled={create.isPending || !name.trim() || !bodyEn.trim()}
          onClick={() =>
            create.mutate(
              { name, channel, subject: null, bodyEn, bodyBn, delayValue, delayUnit },
              { onSuccess: () => { setName(""); setBodyEn(""); setBodyBn(""); } },
            )
          }
        >
          {create.isPending ? "Adding…" : "Add template"}
        </Button>
      </Card>

      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      <div className="flex flex-col gap-2">
        {templates?.map((t) => (
          <Card key={t.id} className="flex items-center gap-3">
            <span className="rounded-pill bg-surface-2 px-2.5 py-1 text-xs font-semibold text-secondary">{t.channel}</span>
            <span className="text-sm font-semibold text-text">{t.name}</span>
            <span className="text-xs text-muted">
              +{t.delayValue} {t.delayUnit.toLowerCase()}
            </span>
            <label className="ml-auto flex items-center gap-1.5 text-xs text-secondary">
              <input
                type="checkbox"
                checked={t.status === "ACTIVE"}
                onChange={(e) => update.mutate({ id: t.id, status: e.target.checked ? "ACTIVE" : "PAUSED" })}
              />
              Active
            </label>
          </Card>
        ))}
      </div>
    </div>
  );
}

function QueueTab() {
  const { data: queue, isLoading } = useCampaignQueue();
  const { data: logs } = useCampaignLogs();
  const retry = useRetryCampaignQueueItem();
  const cancel = useCancelCampaignQueueItem();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-2 text-xs font-semibold text-secondary">Queue</p>
        {isLoading && <p className="text-sm text-muted">Loading…</p>}
        {queue && queue.length === 0 && <p className="text-sm text-muted">No campaign steps queued yet.</p>}
        <div className="flex flex-col gap-2">
          {queue?.map((q) => (
            <Card key={q.id} className="flex items-center gap-3">
              <span className="rounded-pill bg-surface-2 px-2.5 py-1 text-xs font-semibold text-secondary">{q.channel}</span>
              <span className="num text-sm text-text">{q.recipient ?? "—"}</span>
              <span
                className={`rounded-pill px-2.5 py-1 text-xs font-semibold ${
                  q.status === "SENT" ? "bg-success/10 text-success" : q.status === "FAILED" ? "bg-danger/10 text-danger" : q.status === "SKIPPED" ? "bg-border text-secondary" : "bg-warning/10 text-warning"
                }`}
              >
                {q.status}
              </span>
              <span className="text-xs text-muted">{new Date(q.scheduledAt).toLocaleString()}</span>
              {(q.status === "PENDING" || q.status === "FAILED") && (
                <div className="ml-auto flex gap-2">
                  <Button type="button" variant="ghost" disabled={retry.isPending} onClick={() => retry.mutate(q.id)}>
                    Send now
                  </Button>
                  <Button type="button" variant="ghost" disabled={cancel.isPending} onClick={() => cancel.mutate(q.id)}>
                    Cancel
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-secondary">Log</p>
        <div className="flex flex-col gap-2">
          {logs?.map((l) => (
            <Card key={l.id} className="flex items-center gap-3">
              <span className="num text-sm text-text">{l.recipient ?? "—"}</span>
              <span className="min-w-0 flex-1 truncate text-xs text-secondary">{l.message}</span>
              <span
                className={`rounded-pill px-2.5 py-1 text-xs font-semibold ${l.status === "SENT" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}
              >
                {l.status}
              </span>
              <span className="text-xs text-muted">{new Date(l.sentAt).toLocaleString()}</span>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function RecoveryPage() {
  const [tab, setTab] = useState("funnel");

  return (
    <div className="flex flex-col gap-4">
      <Tabs
        options={[
          { value: "funnel", label: "Funnel" },
          { value: "campaigns", label: "Campaigns" },
          { value: "queue", label: "Queue & Log" },
          { value: "settings", label: "Settings" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "funnel" && <FunnelTab />}
      {tab === "campaigns" && <CampaignsTab />}
      {tab === "queue" && <QueueTab />}
      {tab === "settings" && <SettingsTab />}
    </div>
  );
}
