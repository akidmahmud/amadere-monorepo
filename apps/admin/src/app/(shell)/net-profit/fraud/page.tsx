"use client";

import { useState } from "react";
import { Button, Card, PageHeader, RangeSlider, RiskBadge, SettingsCard, StatCard, Table, TableEmptyRow, Tabs, ToggleSwitch } from "@amader/admin-ui";
import type { RiskLevel as RiskBadgeLevel } from "@amader/admin-ui";
import { FraudDetailModal } from "@/components/FraudDetailModal";
import { useFraudChecks, useFraudSavings, useFraudSettings, useUpdateFraudSettings, type RiskLevel } from "@/hooks/useFraud";

const shieldIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <path d="M12 3 4 6v6c0 4.5 3.4 7.7 8 9 4.6-1.3 8-4.5 8-9V6l-8-3Z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const RISK_FILTERS: { value: RiskLevel | "ALL"; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
  { value: "UNKNOWN", label: "Unknown" },
];

function BoardTab() {
  const [risk, setRisk] = useState<RiskLevel | "ALL">("ALL");
  const { data, isLoading } = useFraudChecks(risk === "ALL" ? undefined : risk);
  const { data: all } = useFraudChecks();
  const [lookupPhone, setLookupPhone] = useState("");
  const [drawerPhone, setDrawerPhone] = useState<string | null>(null);

  const countOf = (level: RiskLevel) => all?.items.filter((c) => c.riskLevel === level).length ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard variant="dark" icon={shieldIcon} label="Total checks" value={String(all?.total ?? 0)} />
        <StatCard variant="warning" icon={shieldIcon} label="High risk" value={String(countOf("HIGH"))} />
        <StatCard variant="info" icon={shieldIcon} label="Medium risk" value={String(countOf("MEDIUM"))} />
        <StatCard variant="success" icon={shieldIcon} label="Low risk" value={String(countOf("LOW"))} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (lookupPhone.trim()) setDrawerPhone(lookupPhone.trim());
          }}
        >
          <input
            value={lookupPhone}
            onChange={(e) => setLookupPhone(e.target.value)}
            placeholder="Look up a phone number…"
            className="h-10 w-56 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          />
          <Button type="submit" variant="ghost">
            Check
          </Button>
        </form>
        <div className="ml-auto flex gap-1.5">
          {RISK_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setRisk(f.value)}
              className={`rounded-pill px-3 py-1.5 text-xs font-semibold ${
                risk === f.value ? "bg-brand-500 text-white" : "bg-surface-2 text-secondary"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted">Loading…</p>}

      <Card className="overflow-hidden p-0">
        <Table>
          <thead>
            <tr>
              <th>Phone</th>
              <th>Delivered</th>
              <th>Risk</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data && data.items.length === 0 && (
              <TableEmptyRow colSpan={4}>No fraud checks yet — they appear here as COD checkouts run.</TableEmptyRow>
            )}
            {data?.items.map((c) => (
              <tr key={c.id}>
                <td className="num text-text">{c.phone}</td>
                <td className="text-secondary">
                  {c.delivered}/{c.totalOrders}
                </td>
                <td>
                  <RiskBadge level={c.riskLevel as RiskBadgeLevel} />
                </td>
                <td className="text-right">
                  <Button type="button" variant="ghost" onClick={() => setDrawerPhone(c.phone)}>
                    Details
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {drawerPhone && <FraudDetailModal phone={drawerPhone} onClose={() => setDrawerPhone(null)} />}
    </div>
  );
}

function SavingsTab() {
  const { data, isLoading } = useFraudSavings();

  return (
    <div className="flex flex-col gap-4">
      <StatCard variant="success" icon={shieldIcon} label="Total protected" value={`৳${Number(data?.totalAmount ?? 0).toLocaleString()}`} />

      {isLoading && <p className="text-sm text-muted">Loading…</p>}

      <Card className="overflow-hidden p-0">
        <Table>
          <thead>
            <tr>
              <th>Phone</th>
              <th>Reason</th>
              <th>Amount</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {data && data.items.length === 0 && (
              <TableEmptyRow colSpan={4}>No blocked/held orders yet — this fills in once the fraud gate acts.</TableEmptyRow>
            )}
            {data?.items.map((s) => (
              <tr key={s.id}>
                <td className="num text-text">{s.phone}</td>
                <td className="text-secondary">{s.reason}</td>
                <td className="font-semibold text-danger">৳{Number(s.amount).toLocaleString()}</td>
                <td className="text-muted">{new Date(s.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}

function SettingsTab() {
  const { data, isLoading } = useFraudSettings();
  const update = useUpdateFraudSettings();
  const [form, setForm] = useState<typeof data | null>(null);
  const current = form ?? data;

  if (isLoading || !current) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div className="flex flex-col gap-5">
      <SettingsCard icon={shieldIcon} title="Fraud detection">
        <div className="flex flex-col gap-5">
          <ToggleSwitch
            checked={current.enabled}
            onChange={(checked) => setForm({ ...current, enabled: checked })}
            label="Enable courier fraud detection"
          />

          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-secondary">Accept threshold — success rate % at/above this passes</span>
            <RangeSlider
              value={current.acceptPercent}
              onChange={(v) => setForm({ ...current, acceptPercent: v })}
              suffix="%"
            />
          </label>

          <ToggleSwitch
            checked={current.allowNoHistory}
            onChange={(checked) => setForm({ ...current, allowNoHistory: checked })}
            label="Allow checkout when the phone has no delivery history at all"
          />
        </div>
      </SettingsCard>

      <SettingsCard icon={shieldIcon} title="Advance payment">
        <div className="flex flex-col gap-4">
          <ToggleSwitch
            checked={current.advanceEnabled}
            onChange={(checked) => setForm({ ...current, advanceEnabled: checked })}
            label="Require advance payment for medium-risk checkouts"
          />
          {current.advanceEnabled && (
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-secondary">Triggers below this success rate %</span>
                <RangeSlider
                  value={current.advanceScoreThreshold}
                  onChange={(v) => setForm({ ...current, advanceScoreThreshold: v })}
                  suffix="%"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-secondary">Advance required (% of order total)</span>
                <RangeSlider
                  value={current.advanceRequiredPercent}
                  onChange={(v) => setForm({ ...current, advanceRequiredPercent: v })}
                  min={1}
                  suffix="%"
                />
              </label>
            </div>
          )}
        </div>
      </SettingsCard>

      <SettingsCard icon={shieldIcon} title="Checkout blocking">
        <ToggleSwitch
          checked={current.blockEnabled}
          onChange={(checked) => setForm({ ...current, blockEnabled: checked })}
          label="Block checkouts below the accept threshold (and below the advance threshold, if advance is also on)"
        />
      </SettingsCard>

      <SettingsCard icon={shieldIcon} title="Messaging & cache">
        <div className="flex flex-col gap-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Cache TTL (hours)</span>
            <input
              type="number"
              min={1}
              value={current.cacheTtlHours}
              onChange={(e) => setForm({ ...current, cacheTtlHours: Number(e.target.value) })}
              className="h-10 w-40 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Block message (English)</span>
            <textarea
              value={current.blockMessageEn}
              onChange={(e) => setForm({ ...current, blockMessageEn: e.target.value })}
              rows={2}
              className="rounded-sm border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-brand-500"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Block message (বাংলা)</span>
            <textarea
              value={current.blockMessageBn}
              onChange={(e) => setForm({ ...current, blockMessageBn: e.target.value })}
              rows={2}
              className="rounded-sm border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-brand-500"
            />
          </label>

          <Button
            type="button"
            variant="primary"
            className="self-start"
            disabled={update.isPending}
            onClick={() => update.mutate(current, { onSuccess: () => setForm(null) })}
          >
            {update.isPending ? "Saving…" : "Save settings"}
          </Button>
        </div>
      </SettingsCard>
    </div>
  );
}

export default function FraudPage() {
  const [tab, setTab] = useState("board");

  return (
    <div className="flex flex-col gap-4">
      <PageHeader icon={shieldIcon} title="Fraud Checker" subtitle="Search courier delivery history for any phone number to detect potential fraud." badge="Live" />
      <Tabs
        variant="pill"
        options={[
          { value: "board", label: "Board" },
          { value: "savings", label: "Savings Log" },
          { value: "settings", label: "Settings" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "board" && <BoardTab />}
      {tab === "savings" && <SavingsTab />}
      {tab === "settings" && <SettingsTab />}
    </div>
  );
}
