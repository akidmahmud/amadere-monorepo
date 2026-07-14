"use client";

import { useState } from "react";
import { Button, Card, Modal, RiskBadge, Tabs } from "@amader/admin-ui";
import type { RiskLevel as RiskBadgeLevel } from "@amader/admin-ui";
import {
  useFraudCheck,
  useFraudChecks,
  useFraudSavings,
  useFraudSettings,
  useRecheckFraud,
  useUpdateFraudSettings,
  type RiskLevel,
} from "@/hooks/useFraud";

const RISK_FILTERS: { value: RiskLevel | "ALL"; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
  { value: "UNKNOWN", label: "Unknown" },
];

function FraudDetailModal({ phone, onClose }: { phone: string; onClose: () => void }) {
  const { data: check, isLoading } = useFraudCheck(phone);
  const recheck = useRecheckFraud();

  return (
    <Modal open onClose={onClose} title={phone}>
      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      {check && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <RiskBadge level={check.riskLevel as RiskBadgeLevel} />
            <span className="text-sm text-secondary">
              {check.successRate !== null ? `${Math.round(check.successRate * 100)}% success rate` : "Not enough data"}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-inner bg-surface-2 p-3 text-center">
              <div className="text-lg font-semibold text-text">{check.totalOrders}</div>
              <div className="text-xs text-muted">Total orders</div>
            </div>
            <div className="rounded-inner bg-surface-2 p-3 text-center">
              <div className="text-lg font-semibold text-success">{check.delivered}</div>
              <div className="text-xs text-muted">Delivered</div>
            </div>
            <div className="rounded-inner bg-surface-2 p-3 text-center">
              <div className="text-lg font-semibold text-danger">{check.cancelled}</div>
              <div className="text-xs text-muted">Cancelled/returned</div>
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold text-secondary">Per-courier breakdown</p>
            <pre className="overflow-x-auto rounded-inner bg-surface-2 p-3 text-xs text-secondary">
              {JSON.stringify(check.breakdown, null, 2)}
            </pre>
          </div>
          <p className="text-xs text-muted">
            Checked {new Date(check.checkedAt).toLocaleString()} · source: {check.source} · expires{" "}
            {new Date(check.expiresAt).toLocaleString()}
          </p>
          <Button
            type="button"
            variant="primary"
            onClick={() => recheck.mutate(phone)}
            disabled={recheck.isPending}
            className="self-start"
          >
            {recheck.isPending ? "Rechecking…" : "Re-check now"}
          </Button>
        </div>
      )}
    </Modal>
  );
}

function BoardTab() {
  const [risk, setRisk] = useState<RiskLevel | "ALL">("ALL");
  const { data, isLoading } = useFraudChecks(risk === "ALL" ? undefined : risk);
  const [lookupPhone, setLookupPhone] = useState("");
  const [drawerPhone, setDrawerPhone] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
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
      {data && data.items.length === 0 && (
        <p className="text-sm text-muted">No fraud checks yet — they appear here as COD checkouts run.</p>
      )}

      <div className="flex flex-col gap-2">
        {data?.items.map((c) => (
          <Card key={c.id} className="flex items-center gap-3">
            <span className="num flex-1 text-sm text-text">{c.phone}</span>
            <span className="text-xs text-secondary">
              {c.delivered}/{c.totalOrders} delivered
            </span>
            <RiskBadge level={c.riskLevel as RiskBadgeLevel} />
            <Button type="button" variant="ghost" onClick={() => setDrawerPhone(c.phone)}>
              Details
            </Button>
          </Card>
        ))}
      </div>

      {drawerPhone && <FraudDetailModal phone={drawerPhone} onClose={() => setDrawerPhone(null)} />}
    </div>
  );
}

function SavingsTab() {
  const { data, isLoading } = useFraudSavings();

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex items-center justify-between">
        <span className="text-sm text-secondary">Total protected</span>
        <span className="text-2xl font-semibold text-success">৳{Number(data?.totalAmount ?? 0).toLocaleString()}</span>
      </Card>

      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      {data && data.items.length === 0 && (
        <p className="text-sm text-muted">No blocked/held orders yet — this fills in once the fraud gate acts.</p>
      )}

      <div className="flex flex-col gap-2">
        {data?.items.map((s) => (
          <Card key={s.id} className="flex items-center gap-3">
            <span className="num flex-1 text-sm text-text">{s.phone}</span>
            <span className="text-xs text-secondary">{s.reason}</span>
            <span className="text-sm font-semibold text-danger">৳{Number(s.amount).toLocaleString()}</span>
            <span className="text-xs text-muted">{new Date(s.createdAt).toLocaleDateString()}</span>
          </Card>
        ))}
      </div>
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
      <Card className="flex flex-col gap-4">
        <label className="flex items-center gap-2.5">
          <input
            type="checkbox"
            checked={current.enabled}
            onChange={(e) => setForm({ ...current, enabled: e.target.checked })}
          />
          <span className="text-sm font-semibold text-text">Enable courier fraud detection</span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Accept threshold — success rate % at/above this passes</span>
          <input
            type="number"
            min={0}
            max={100}
            value={current.acceptPercent}
            onChange={(e) => setForm({ ...current, acceptPercent: Number(e.target.value) })}
            className="h-10 w-32 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          />
        </label>

        <label className="flex items-center gap-2.5">
          <input
            type="checkbox"
            checked={current.allowNoHistory}
            onChange={(e) => setForm({ ...current, allowNoHistory: e.target.checked })}
          />
          <span className="text-sm text-text">Allow checkout when the phone has no delivery history at all</span>
        </label>

        <div className="rounded-inner border border-border p-3">
          <label className="flex items-center gap-2.5">
            <input
              type="checkbox"
              checked={current.advanceEnabled}
              onChange={(e) => setForm({ ...current, advanceEnabled: e.target.checked })}
            />
            <span className="text-sm font-semibold text-text">Require advance payment for medium-risk checkouts</span>
          </label>
          {current.advanceEnabled && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-secondary">Triggers below this success rate %</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={current.advanceScoreThreshold}
                  onChange={(e) => setForm({ ...current, advanceScoreThreshold: Number(e.target.value) })}
                  className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-secondary">Advance required (% of order total)</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={current.advanceRequiredPercent}
                  onChange={(e) => setForm({ ...current, advanceRequiredPercent: Number(e.target.value) })}
                  className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
                />
              </label>
            </div>
          )}
        </div>

        <div className="rounded-inner border border-border p-3">
          <label className="flex items-center gap-2.5">
            <input
              type="checkbox"
              checked={current.blockEnabled}
              onChange={(e) => setForm({ ...current, blockEnabled: e.target.checked })}
            />
            <span className="text-sm font-semibold text-text">
              Block checkouts below the accept threshold (and below the advance threshold, if advance is also on)
            </span>
          </label>
        </div>

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
      </Card>
    </div>
  );
}

export default function FraudPage() {
  const [tab, setTab] = useState("board");

  return (
    <div className="flex flex-col gap-4">
      <Tabs
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
