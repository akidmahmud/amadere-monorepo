"use client";

import { useRef, useState } from "react";
import { Button, Card, Icon, PageHeader, RangeSlider, SettingsCard, StatCard, Table, TableEmptyRow, Tabs, ToggleSwitch } from "@amader/admin-ui";
import {
  RULE_HINTS,
  RULE_KEYS,
  RULE_LABELS,
  blockerExportUrl,
  useBlockRules,
  useBlockerSettings,
  useBlockerStats,
  useBulkUnblock,
  useCreateBlockRule,
  useDeleteBlockRule,
  useImportBlockerCsv,
  useSetBlockRuleActive,
  useUpdateBlockerSettings,
  type BlockRule,
  type BlockRuleStatus,
  type BlockType,
  type BlockerSettings,
  type RuleKey,
} from "@/hooks/useBlocker";

const shieldIcon = <Icon name="block" />;

const TYPES: BlockType[] = ["PHONE", "EMAIL", "IP", "DEVICE", "NAME", "ADDRESS"];
const PLACEHOLDERS: Record<BlockType, string> = {
  PHONE: "01XXXXXXXXX",
  EMAIL: "name@example.com",
  IP: "203.0.113.1",
  DEVICE: "device fingerprint id",
  NAME: "customer full name",
  ADDRESS: "street / area text to match",
};

const STATUS_TONE: Record<BlockRuleStatus, string> = {
  active: "bg-danger/10 text-danger",
  unblocked: "bg-success/10 text-success",
  expired: "bg-surface-2 text-muted",
};

function EntriesTable({ items, onToggle, onDelete }: { items: BlockRule[]; onToggle: (r: BlockRule) => void; onDelete: (r: BlockRule) => void }) {
  return (
    <Table>
      <thead>
        <tr>
          <th>Type</th>
          <th>Value</th>
          <th>Source</th>
          <th>Reason</th>
          <th>Status</th>
          <th>Date</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {items.length === 0 && <TableEmptyRow colSpan={7}>No block entries found.</TableEmptyRow>}
        {items.map((r) => (
          <tr key={r.id}>
            <td>
              <span className="rounded-pill bg-surface-2 px-2.5 py-1 text-xs font-semibold text-secondary">{r.type}</span>
            </td>
            <td className="num text-text">{r.value}</td>
            <td>
              {r.source === "AUTO" ? (
                <span className="rounded-pill bg-warning/10 px-2.5 py-1 text-xs font-semibold text-warning">AUTO</span>
              ) : (
                <span className="text-xs text-secondary">Manual</span>
              )}
            </td>
            <td className="max-w-[260px] truncate text-xs text-muted" title={r.reason ?? undefined}>
              {r.reason ?? "—"}
            </td>
            <td>
              <span className={`rounded-pill px-2.5 py-1 text-xs font-semibold ${STATUS_TONE[r.status]}`}>{r.status}</span>
            </td>
            <td className="text-xs text-muted">{new Date(r.createdAt).toLocaleDateString()}</td>
            <td className="text-right">
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => onToggle(r)}>
                  {r.status === "active" ? "Unblock" : "Reactivate"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => onDelete(r)}>
                  Delete
                </Button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function useToggleAndDelete() {
  const setActive = useSetBlockRuleActive();
  const del = useDeleteBlockRule();
  return {
    onToggle: (r: BlockRule) => setActive.mutate({ id: r.id, isActive: r.status !== "active" }),
    onDelete: (r: BlockRule) => {
      if (confirm(`Delete this block rule for ${r.value}?`)) del.mutate(r.id);
    },
  };
}

function DashboardTab() {
  const { data: stats } = useBlockerStats();
  const { data } = useBlockRules({ pageSize: 12 });
  const { onToggle, onDelete } = useToggleAndDelete();

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard variant="primary" icon={shieldIcon} label="Today auto block" value={String(stats?.todayAuto ?? 0)} />
        <StatCard variant="warning" icon={shieldIcon} label="Yesterday auto block" value={String(stats?.yesterdayAuto ?? 0)} />
        <StatCard variant="info" icon={shieldIcon} label="This month" value={String(stats?.monthTotal ?? 0)} />
        <StatCard variant="dark" icon={shieldIcon} label="All time" value={String(stats?.allTime ?? 0)} />
        <StatCard variant="success" icon={shieldIcon} label="Active blocks" value={String(stats?.active ?? 0)} />
      </div>
      <Card className="overflow-hidden p-0">
        <div className="border-b border-border px-5 py-3.5">
          <h2 className="font-ui text-sm font-bold text-text">Recent blocks</h2>
        </div>
        <EntriesTable items={data?.items ?? []} onToggle={onToggle} onDelete={onDelete} />
      </Card>
    </div>
  );
}

function FiltersBar({
  q,
  setQ,
  status,
  setStatus,
}: {
  q: string;
  setQ: (v: string) => void;
  status: BlockRuleStatus | "";
  setStatus: (v: BlockRuleStatus | "") => void;
}) {
  return (
    <Card className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-secondary">Smart search</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Name, email, phone, IP, reason…"
          className="h-10 w-64 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-secondary">Status</span>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as BlockRuleStatus | "")}
          className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
        >
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="unblocked">Unblocked</option>
          <option value="expired">Expired</option>
        </select>
      </label>
    </Card>
  );
}

function AutoTab() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<BlockRuleStatus | "">("");
  const { data } = useBlockRules({ source: "AUTO", q: q || undefined, status: status || undefined, pageSize: 100 });
  const { onToggle, onDelete } = useToggleAndDelete();
  const bulkUnblock = useBulkUnblock();

  return (
    <div className="flex flex-col gap-4">
      <FiltersBar q={q} setQ={setQ} status={status} setStatus={setStatus} />
      <div className="flex gap-2.5">
        <a href={blockerExportUrl("AUTO")} className="inline-flex">
          <Button type="button" variant="ghost">
            Export auto CSV
          </Button>
        </a>
        <Button type="button" variant="ghost" disabled={bulkUnblock.isPending} onClick={() => bulkUnblock.mutate("AUTO")}>
          {bulkUnblock.isPending ? "Unblocking…" : "Unblock all active"}
        </Button>
      </div>
      <Card className="overflow-hidden p-0">
        <EntriesTable items={data?.items ?? []} onToggle={onToggle} onDelete={onDelete} />
      </Card>
    </div>
  );
}

function ManualTab() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<BlockRuleStatus | "">("");
  const { data } = useBlockRules({ source: "MANUAL", q: q || undefined, status: status || undefined, pageSize: 100 });
  const { onToggle, onDelete } = useToggleAndDelete();
  const bulkUnblock = useBulkUnblock();
  const create = useCreateBlockRule();
  const importCsv = useImportBlockerCsv();
  const fileRef = useRef<HTMLInputElement>(null);

  const [type, setType] = useState<BlockType>("PHONE");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState("0");
  const [note, setNote] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    const minutes = Number(duration);
    create.mutate(
      {
        type,
        value: value.trim(),
        reason: reason.trim() || undefined,
        note: note.trim() || undefined,
        customerName: type === "NAME" ? value.trim() : undefined,
        addressText: type === "ADDRESS" ? value.trim() : undefined,
        expiresAt: minutes > 0 ? new Date(Date.now() + minutes * 60_000).toISOString() : undefined,
      },
      { onSuccess: () => { setValue(""); setReason(""); setNote(""); setDuration("0"); } },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-ui text-sm font-bold text-text">Add manual block</h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-secondary">Block type</span>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as BlockType)}
                className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-secondary">Value</span>
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={PLACEHOLDERS[type]}
                className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-secondary">Duration</span>
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
              >
                <option value="0">Permanent</option>
                <option value="60">1 hour</option>
                <option value="1440">1 day</option>
                <option value="10080">7 days</option>
                <option value="43200">30 days</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-secondary">Reason</span>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-secondary">Note</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="rounded-sm border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-brand-500"
              />
            </label>
            <Button type="submit" variant="primary" disabled={create.isPending} className="self-start">
              {create.isPending ? "Adding…" : "Add block"}
            </Button>
          </form>
        </Card>

        <Card className="flex flex-col gap-4">
          <h2 className="font-ui text-sm font-bold text-text">CSV tools</h2>
          <div>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) importCsv.mutate(file, { onSuccess: (r) => alert(`Imported ${r.imported}, skipped ${r.skipped}`) });
              e.target.value = "";
            }} />
            <Button type="button" variant="ghost" onClick={() => fileRef.current?.click()} disabled={importCsv.isPending}>
              {importCsv.isPending ? "Importing…" : "Import CSV"}
            </Button>
            <p className="mt-2 text-xs text-muted">Columns: type,value,reason,duration (minutes; blank = permanent),note</p>
          </div>
          <a href={blockerExportUrl("MANUAL")} className="inline-flex">
            <Button type="button" variant="ghost">
              Export manual CSV
            </Button>
          </a>
        </Card>
      </div>

      <FiltersBar q={q} setQ={setQ} status={status} setStatus={setStatus} />
      <div className="flex gap-2.5">
        <Button type="button" variant="ghost" disabled={bulkUnblock.isPending} onClick={() => bulkUnblock.mutate("MANUAL")}>
          {bulkUnblock.isPending ? "Unblocking…" : "Unblock all active"}
        </Button>
      </div>
      <Card className="overflow-hidden p-0">
        <EntriesTable items={data?.items ?? []} onToggle={onToggle} onDelete={onDelete} />
      </Card>
    </div>
  );
}

function ruleFields(key: RuleKey, current: BlockerSettings, setThresholds: (patch: Partial<BlockerSettings["thresholds"]>) => void) {
  const t = current.thresholds;
  const num = (label: string, field: keyof BlockerSettings["thresholds"]) => (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-secondary">{label}</span>
      <input
        type="number"
        min={0}
        value={t[field] as number}
        onChange={(e) => setThresholds({ [field]: Number(e.target.value) } as Partial<BlockerSettings["thresholds"]>)}
        className="h-9 w-full rounded-sm border border-border bg-surface px-2.5 text-sm text-text outline-none focus:border-brand-500"
      />
    </label>
  );

  switch (key) {
    case "ipTracker":
      return (
        <div className="grid grid-cols-2 gap-3">
          {num("Max orders / window", "ipTrackerMaxOrders")}
          {num("Window minutes", "ipTrackerWindowMinutes")}
        </div>
      );
    case "processingCooldown":
      return <div className="grid grid-cols-2 gap-3">{num("Cooldown minutes", "processingCooldownMinutes")}</div>;
    case "bulkOrderBlocker":
      return (
        <div className="grid grid-cols-2 gap-3">
          {num("Pending limit", "bulkPendingLimit")}
          {num("On-hold limit", "bulkHoldLimit")}
          {num("Failed limit", "bulkFailedLimit")}
          {num("Window minutes", "bulkWindowMinutes")}
        </div>
      );
    case "courierSuccessRate":
      return <div className="grid grid-cols-2 gap-3">{num("Auto-block threshold %", "courierThresholdPercent")}</div>;
    case "duplicateOrder":
      return <div className="grid grid-cols-2 gap-3">{num("Duplicate window minutes", "duplicateWindowMinutes")}</div>;
    case "blacklistedEmailDomain":
      return (
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Blacklisted domains (one per line)</span>
          <textarea
            value={t.blacklistedDomains.join("\n")}
            onChange={(e) => setThresholds({ blacklistedDomains: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
            rows={3}
            className="rounded-sm border border-border bg-surface px-2.5 py-2 text-sm text-text outline-none focus:border-brand-500"
          />
        </label>
      );
    case "minimumOrderAmount":
      return <div className="grid grid-cols-2 gap-3">{num("Minimum order amount (৳)", "minOrderAmount")}</div>;
    case "dailyOrderLimit":
      return <div className="grid grid-cols-2 gap-3">{num("Orders / day limit", "dailyOrderLimit")}</div>;
    case "newCustomerHighValue":
      return <div className="grid grid-cols-2 gap-3">{num("High-value amount (৳)", "highValueAmount")}</div>;
    case "speedBotDetection":
      return <div className="grid grid-cols-2 gap-3">{num("Minimum seconds", "speedSeconds")}</div>;
    case "proxyTorDetection":
      return null;
    default:
      return null;
  }
}

function SettingsTab() {
  const { data, isLoading } = useBlockerSettings();
  const update = useUpdateBlockerSettings();
  const [form, setForm] = useState<BlockerSettings | null>(null);
  const current = form ?? data;

  if (isLoading || !current) return <p className="text-sm text-muted">Loading…</p>;

  function patch(p: Partial<BlockerSettings>) {
    setForm({ ...current!, ...p });
  }
  function patchRule(key: RuleKey, p: Partial<BlockerSettings["rules"][RuleKey]>) {
    setForm({ ...current!, rules: { ...current!.rules, [key]: { ...current!.rules[key], ...p } } });
  }
  function patchThresholds(p: Partial<BlockerSettings["thresholds"]>) {
    setForm({ ...current!, thresholds: { ...current!.thresholds, ...p } });
  }
  function patchPopup(p: Partial<BlockerSettings["popup"]>) {
    setForm({ ...current!, popup: { ...current!.popup, ...p } });
  }

  return (
    <div className="flex flex-col gap-5">
      <SettingsCard icon={shieldIcon} title="General settings">
        <div className="flex flex-col gap-5">
          <ToggleSwitch checked={current.enabled} onChange={(v) => patch({ enabled: v })} label="Enable Blocker Manager" />
          <ToggleSwitch
            checked={current.showReasonInPopup}
            onChange={(v) => patch({ showReasonInPopup: v })}
            label="Show block reason in checkout pop-up"
          />
          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-secondary">Default auto-unblock minutes</span>
            <RangeSlider value={current.defaultDurationMinutes} onChange={(v) => patch({ defaultDurationMinutes: v })} max={10080} />
          </label>
        </div>
      </SettingsCard>

      <SettingsCard icon={shieldIcon} title="Manual block pop-up message">
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Heading</span>
            <input
              value={current.manual.heading}
              onChange={(e) => patch({ manual: { ...current.manual, heading: e.target.value } })}
              className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Sub-heading</span>
            <input
              value={current.manual.sub}
              onChange={(e) => patch({ manual: { ...current.manual, sub: e.target.value } })}
              className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
            />
          </label>
          <label className="col-span-2 flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Custom reason text (optional)</span>
            <input
              value={current.manual.message}
              onChange={(e) => patch({ manual: { ...current.manual, message: e.target.value } })}
              className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
            />
          </label>
        </div>
      </SettingsCard>

      <SettingsCard icon={shieldIcon} title="Auto block rules">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {RULE_KEYS.map((key) => {
            const rule = current.rules[key];
            return (
              <div key={key} className="rounded-inner border border-border p-4">
                <ToggleSwitch checked={rule.enabled} onChange={(v) => patchRule(key, { enabled: v })} label={RULE_LABELS[key]} />
                <p className="mt-1.5 text-xs text-muted">{RULE_HINTS[key]}</p>
                <div className="mt-3 flex flex-col gap-3">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold text-secondary">Auto-unblock minutes (0 = use default)</span>
                    <input
                      type="number"
                      min={0}
                      value={rule.durationMinutes}
                      onChange={(e) => patchRule(key, { durationMinutes: Number(e.target.value) })}
                      className="h-9 w-full rounded-sm border border-border bg-surface px-2.5 text-sm text-text outline-none focus:border-brand-500"
                    />
                  </label>
                  {ruleFields(key, current, patchThresholds)}
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs font-semibold text-secondary">Heading</span>
                      <input
                        value={rule.heading}
                        onChange={(e) => patchRule(key, { heading: e.target.value })}
                        className="h-9 rounded-sm border border-border bg-surface px-2.5 text-sm text-text outline-none focus:border-brand-500"
                      />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs font-semibold text-secondary">Sub-heading</span>
                      <input
                        value={rule.sub}
                        onChange={(e) => patchRule(key, { sub: e.target.value })}
                        className="h-9 rounded-sm border border-border bg-surface px-2.5 text-sm text-text outline-none focus:border-brand-500"
                      />
                    </label>
                  </div>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold text-secondary">Custom reason text (optional)</span>
                    <input
                      value={rule.message}
                      onChange={(e) => patchRule(key, { message: e.target.value })}
                      className="h-9 rounded-sm border border-border bg-surface px-2.5 text-sm text-text outline-none focus:border-brand-500"
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </SettingsCard>

      <SettingsCard icon={shieldIcon} title="Pop-up contact options">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-2">
            <ToggleSwitch checked={current.popup.callEnabled} onChange={(v) => patchPopup({ callEnabled: v })} label="Show call button" />
            <input
              value={current.popup.callNumber}
              onChange={(e) => patchPopup({ callNumber: e.target.value })}
              placeholder="+8801XXXXXXXXX"
              className="h-9 rounded-sm border border-border bg-surface px-2.5 text-sm text-text outline-none focus:border-brand-500"
            />
          </div>
          <div className="flex flex-col gap-2">
            <ToggleSwitch checked={current.popup.whatsappEnabled} onChange={(v) => patchPopup({ whatsappEnabled: v })} label="Show WhatsApp button" />
            <input
              value={current.popup.whatsappNumber}
              onChange={(e) => patchPopup({ whatsappNumber: e.target.value })}
              placeholder="8801XXXXXXXXX"
              className="h-9 rounded-sm border border-border bg-surface px-2.5 text-sm text-text outline-none focus:border-brand-500"
            />
          </div>
          <div className="flex flex-col gap-2">
            <ToggleSwitch checked={current.popup.emailEnabled} onChange={(v) => patchPopup({ emailEnabled: v })} label="Show email button" />
            <input
              value={current.popup.emailAddress}
              onChange={(e) => patchPopup({ emailAddress: e.target.value })}
              placeholder="support@example.com"
              className="h-9 rounded-sm border border-border bg-surface px-2.5 text-sm text-text outline-none focus:border-brand-500"
            />
          </div>
        </div>
      </SettingsCard>

      <Button type="button" variant="primary" className="self-start" disabled={update.isPending} onClick={() => update.mutate(current, { onSuccess: () => setForm(null) })}>
        {update.isPending ? "Saving…" : "Save blocker settings"}
      </Button>
    </div>
  );
}

export default function BlockerPage() {
  const [tab, setTab] = useState("dashboard");

  return (
    <div className="flex flex-col gap-4">
      <PageHeader icon={shieldIcon} title="Blocker Manager" subtitle="Auto and manual protection for risky checkout attempts." />
      <Tabs
        variant="pill"
        options={[
          { value: "dashboard", label: "Dashboard" },
          { value: "auto", label: "Auto Blocks" },
          { value: "manual", label: "Manual Blocks" },
          { value: "settings", label: "Settings" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "dashboard" && <DashboardTab />}
      {tab === "auto" && <AutoTab />}
      {tab === "manual" && <ManualTab />}
      {tab === "settings" && <SettingsTab />}
    </div>
  );
}
