"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Icon, RangeSlider, RiskBadge, SettingsCard, ToggleSwitch } from "@amader/admin-ui";
import type { RiskLevel as RiskBadgeLevel } from "@amader/admin-ui";
import { FraudDetailModal } from "@/components/FraudDetailModal";
import { useFraudChecks, useFraudSavings, useFraudSettings, useUpdateFraudSettings, type RiskLevel } from "@/hooks/useFraud";

const GREEN = "#2e7d43";
const GREEN_HEADER = "#2f7d33";
const LINE = "#e5ebe6";
const INK = "#1e2b22";
const MUTED = "#64766b";
const TEXT = "#374840";
const FAINT = "#94a69a";

const RISK_FILTERS: { value: RiskLevel | "ALL"; label: string }[] = [
  { value: "ALL", label: "All Checks" },
  { value: "HIGH", label: "High Risk" },
  { value: "MEDIUM", label: "Medium Risk" },
  { value: "LOW", label: "Low Risk" },
  { value: "UNKNOWN", label: "Unknown" },
];

function HeaderButton({ children, onClick, href, active }: { children: React.ReactNode; onClick?: () => void; href?: string; active?: boolean }) {
  const className =
    "inline-flex h-10 items-center gap-2 rounded-[10px] border px-[15px] text-[0.8rem] font-bold transition-colors duration-150 hover:bg-[#f2f6f3] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2e7d43] focus-visible:ring-offset-1";
  const style = active
    ? { borderColor: GREEN, color: "#fff", background: GREEN }
    : { borderColor: LINE, color: TEXT, background: "#fff" };

  if (href) {
    return (
      <Link href={href} className={className} style={style}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className} style={style}>
      {children}
    </button>
  );
}

const TH = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <th
    className="sticky top-0 z-[5] px-3 py-3 text-left text-[0.72rem] font-bold whitespace-nowrap text-white"
    style={{
      background: GREEN_HEADER,
      borderRight: "1px solid rgba(255,255,255,.13)",
      ...style,
    }}
  >
    {children}
  </th>
);

function StatCard({ label, value, icon, bgColor = "#e8f4ea", color = GREEN, borderColor = "#dff0e2" }: { label: string; value: string; icon: React.ReactNode; bgColor?: string; color?: string; borderColor?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-card border p-[15px_17px] shadow-[0_1px_2px_rgba(20,40,25,.05)]" style={{ background: "#fff", borderColor: LINE }}>
      <div>
        <div className="text-[0.72rem] font-semibold" style={{ color: MUTED }}>
          {label}
        </div>
        <div className="mt-1 text-[1.25rem] font-extrabold tracking-tight" style={{ color: INK }}>
          {value}
        </div>
      </div>
      <div className="grid h-10 w-10 flex-none place-items-center rounded-full border" style={{ background: bgColor, color, borderColor }}>
        {icon}
      </div>
    </div>
  );
}

function BoardTab() {
  const [risk, setRisk] = useState<RiskLevel | "ALL">("ALL");
  const { data, isLoading } = useFraudChecks(risk === "ALL" ? undefined : risk);
  const { data: all } = useFraudChecks();
  const [lookupPhone, setLookupPhone] = useState("");
  const [drawerPhone, setDrawerPhone] = useState<string | null>(null);

  const countOf = (level: RiskLevel) => all?.items.filter((c) => c.riskLevel === level).length ?? 0;

  const td = "px-3 py-[11px] text-[0.76rem] font-semibold whitespace-nowrap align-middle border-b";
  const tdStyle = { color: TEXT, borderColor: "#eef3ef", background: "#fff" } as const;

  return (
    <div className="flex flex-col gap-[18px]">
      {/* Stats Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Total Checks"
          value={String(all?.total ?? 0)}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
              <path d="M8 11h6" />
            </svg>
          }
          bgColor="#e6f4ff"
          color="#0c8ce9"
          borderColor="#cce7ff"
        />
        <StatCard
          label="High Risk"
          value={String(countOf("HIGH"))}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          }
          bgColor="#feeef0"
          color="#e5484d"
          borderColor="#fcdde0"
        />
        <StatCard
          label="Medium Risk"
          value={String(countOf("MEDIUM"))}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          }
          bgColor="#fff8e6"
          color="#d97706"
          borderColor="#feeed0"
        />
        <StatCard
          label="Low Risk"
          value={String(countOf("LOW"))}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          }
          bgColor="#e8f4ea"
          color={GREEN}
          borderColor="#dff0e2"
        />
      </div>

      {/* Filter & Lookup Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border p-[14px_16px] shadow-[0_1px_2px_rgba(20,40,25,.05)]" style={{ background: "#fff", borderColor: LINE }}>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (lookupPhone.trim()) setDrawerPhone(lookupPhone.trim());
          }}
        >
          <div className="relative w-60">
            <input
              value={lookupPhone}
              onChange={(e) => setLookupPhone(e.target.value)}
              placeholder="Look up a phone number..."
              className="h-[38px] w-full rounded-[9px] border py-0 pr-[34px] pl-3 text-[0.76rem] outline-none"
              style={{ borderColor: LINE, color: TEXT }}
            />
            <svg className="pointer-events-none absolute top-1/2 right-[11px] -translate-y-1/2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={FAINT} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </div>
          <button
            type="submit"
            className="h-[38px] rounded-[9px] px-4 text-[0.75rem] font-bold text-white shadow-sm"
            style={{ background: GREEN }}
          >
            Check History
          </button>
        </form>

        <div className="flex items-center gap-1.5">
          {RISK_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setRisk(f.value)}
              className="rounded-pill px-3 py-1 text-[0.74rem] font-bold transition-all"
              style={
                risk === f.value
                  ? { background: GREEN, color: "#fff" }
                  : { background: "#f2f6f3", color: MUTED }
              }
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sticky Green Header Fraud Table */}
      <div className="overflow-hidden rounded-card border shadow-[0_1px_2px_rgba(20,40,25,.05)]" style={{ background: "#fff", borderColor: LINE }}>
        <div className="overflow-auto" style={{ maxHeight: "62vh" }}>
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr>
                <TH style={{ minWidth: 160 }}>Phone Number</TH>
                <TH>Delivered / Total Ratio</TH>
                <TH>Risk Level</TH>
                <TH style={{ textAlign: "right" }}>Action</TH>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-sm" style={{ color: FAINT }}>
                    Loading fraud checks…
                  </td>
                </tr>
              )}
              {!isLoading && data && data.items.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-sm" style={{ color: FAINT }}>
                    No fraud checks match the current filter.
                  </td>
                </tr>
              )}
              {!isLoading &&
                data?.items.map((c) => (
                  <tr key={c.id} className="[&:hover>td]:bg-[#f7fbf8]">
                    <td className={td} style={{ ...tdStyle, fontWeight: 700, color: GREEN }}>
                      {c.phone}
                    </td>
                    <td className={td} style={tdStyle}>
                      <span className="font-semibold text-text">{c.delivered}</span> / <span className="text-secondary">{c.totalOrders}</span>
                    </td>
                    <td className={td} style={tdStyle}>
                      <RiskBadge level={c.riskLevel as RiskBadgeLevel} />
                    </td>
                    <td className={td} style={{ ...tdStyle, textAlign: "right" }}>
                      <button
                        type="button"
                        onClick={() => setDrawerPhone(c.phone)}
                        className="inline-flex h-8 items-center rounded-[8px] border px-3 text-[0.72rem] font-bold transition-colors hover:bg-surface-2"
                        style={{ borderColor: LINE, color: TEXT }}
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {drawerPhone && <FraudDetailModal phone={drawerPhone} onClose={() => setDrawerPhone(null)} />}
    </div>
  );
}

function SavingsTab() {
  const { data, isLoading } = useFraudSavings();

  const td = "px-3 py-[11px] text-[0.76rem] font-semibold whitespace-nowrap align-middle border-b";
  const tdStyle = { color: TEXT, borderColor: "#eef3ef", background: "#fff" } as const;

  return (
    <div className="flex flex-col gap-[18px]">
      <StatCard label="Total Fraud Protected" value={`৳${Number(data?.totalAmount ?? 0).toLocaleString()}`} icon={<Icon name="shield" />} bgColor="#e8f4ea" color={GREEN} borderColor="#dff0e2" />

      <div className="overflow-hidden rounded-card border shadow-[0_1px_2px_rgba(20,40,25,.05)]" style={{ background: "#fff", borderColor: LINE }}>
        <div className="overflow-auto" style={{ maxHeight: "62vh" }}>
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr>
                <TH style={{ minWidth: 160 }}>Phone Number</TH>
                <TH style={{ minWidth: 260 }}>Block / Action Reason</TH>
                <TH>Protected Amount</TH>
                <TH>Log Date</TH>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-sm" style={{ color: FAINT }}>
                    Loading savings log…
                  </td>
                </tr>
              )}
              {!isLoading && data && data.items.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-sm" style={{ color: FAINT }}>
                    No blocked/held orders logged yet.
                  </td>
                </tr>
              )}
              {!isLoading &&
                data?.items.map((s) => (
                  <tr key={s.id} className="[&:hover>td]:bg-[#f7fbf8]">
                    <td className={td} style={{ ...tdStyle, fontWeight: 700, color: GREEN }}>
                      {s.phone}
                    </td>
                    <td className={td} style={{ ...tdStyle, color: MUTED }}>
                      {s.reason}
                    </td>
                    <td className={td} style={{ ...tdStyle, fontWeight: 700, color: "#e5484d" }}>
                      ৳{Number(s.amount).toLocaleString()}
                    </td>
                    <td className={td} style={{ ...tdStyle, color: MUTED }}>
                      {new Date(s.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SettingsTab() {
  const { data, isLoading } = useFraudSettings();
  const update = useUpdateFraudSettings();
  const [form, setForm] = useState<typeof data | null>(null);
  const current = form ?? data;
  // Separate from `form`: the key is write-only, so it is never part of the
  // settings object the server sends back, and leaving it blank must mean
  // "don't touch the stored one" rather than "clear it".
  const [apiKey, setApiKey] = useState("");

  if (isLoading || !current) return <p className="text-sm text-muted">Loading fraud settings…</p>;

  function save() {
    const trimmed = apiKey.trim();
    update.mutate(
      { ...current!, ...(trimmed ? { bdCourierApiKey: trimmed } : {}) },
      {
        onSuccess: () => {
          setForm(null);
          setApiKey("");
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <SettingsCard icon={<Icon name="shield" />} title="Fraud Detection Gate">
        <div className="flex flex-col gap-5">
          <ToggleSwitch
            checked={current.enabled}
            onChange={(checked) => setForm({ ...current, enabled: checked })}
            label="Enable courier fraud detection"
          />

          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-secondary">Accept Threshold — success rate % at/above this passes without restriction</span>
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

      <SettingsCard icon={<Icon name="shield" />} title="Advance Payment Gate">
        <div className="flex flex-col gap-4">
          <ToggleSwitch
            checked={current.advanceEnabled}
            onChange={(checked) => setForm({ ...current, advanceEnabled: checked })}
            label="Require advance payment for medium-risk checkouts"
          />
          {current.advanceEnabled && (
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-secondary">Medium-Risk Floor — advance is asked between this and accept threshold</span>
                <RangeSlider
                  value={current.advanceScoreThreshold}
                  onChange={(v) => setForm({ ...current, advanceScoreThreshold: v })}
                  suffix="%"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-secondary">Advance Required (% of order total)</span>
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

      <SettingsCard icon={<Icon name="shield" />} title="OTP for Risky Customers">
        <div className="flex flex-col gap-2">
          <ToggleSwitch
            checked={current.otpOnRiskEnabled}
            onChange={(checked) => setForm({ ...current, otpOnRiskEnabled: checked })}
            label="Require phone OTP at checkout when success rate is below the accept threshold"
          />
          <p className="text-xs text-secondary">
            Trusted customers (at or above {current.acceptPercent}%) place the order without an OTP step.
          </p>
        </div>
      </SettingsCard>

      <SettingsCard icon={<Icon name="shield" />} title="Checkout Blocking">
        <ToggleSwitch
          checked={current.blockEnabled}
          onChange={(checked) => setForm({ ...current, blockEnabled: checked })}
          label="Block high-risk checkouts — success rate below the advance threshold"
        />
      </SettingsCard>

      <SettingsCard icon={<Icon name="shield" />} title="Messaging & Cache Settings">
        <div className="flex flex-col gap-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Cache TTL (hours)</span>
            <input
              type="number"
              min={1}
              value={current.cacheTtlHours}
              onChange={(e) => setForm({ ...current, cacheTtlHours: Number(e.target.value) })}
              className="h-10 w-40 rounded-[9px] border bg-white px-3 text-xs outline-none focus:border-[#2e7d43]"
              style={{ borderColor: LINE, color: TEXT }}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Block Message (English)</span>
            <textarea
              value={current.blockMessageEn}
              onChange={(e) => setForm({ ...current, blockMessageEn: e.target.value })}
              rows={2}
              className="rounded-[9px] border bg-white p-3 text-xs outline-none focus:border-[#2e7d43]"
              style={{ borderColor: LINE, color: TEXT }}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Block Message (বাংলা)</span>
            <textarea
              value={current.blockMessageBn}
              onChange={(e) => setForm({ ...current, blockMessageBn: e.target.value })}
              rows={2}
              className="rounded-[9px] border bg-white p-3 text-xs outline-none focus:border-[#2e7d43]"
              style={{ borderColor: LINE, color: TEXT }}
            />
          </label>

          <button
            type="button"
            disabled={update.isPending}
            onClick={save}
            className="self-start h-9 rounded-[9px] px-5 text-[0.76rem] font-bold text-white shadow-sm disabled:opacity-40"
            style={{ background: GREEN }}
          >
            {update.isPending ? "Saving…" : "Save Settings"}
          </button>
        </div>
      </SettingsCard>

      <SettingsCard icon={<Icon name="key" />} title="bdcourier API Credential">
        <div className="flex flex-col gap-4">
          <p className="text-xs text-secondary">
            Fraud checks call{" "}
            <span className="font-semibold">api.bdcourier.com</span>, which returns
            this phone&apos;s delivery history across Pathao, SteadFast, RedX,
            PaperFly, ParcelDex, CourierFast and CarryBee in one request. Without a
            key every check reports &quot;no history&quot; and the gate falls back
            to your <span className="font-semibold">No-history</span> setting.
          </p>

          <div className="flex items-center gap-2 text-xs font-semibold">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: current.bdCourierApiKeySet ? GREEN : "#d0555f" }}
            />
            <span style={{ color: current.bdCourierApiKeySet ? GREEN : "#d0555f" }}>
              {current.bdCourierApiKeySet ? "API key configured" : "No API key set"}
            </span>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">
              {current.bdCourierApiKeySet ? "Replace API key" : "API key"}
            </span>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoComplete="off"
              placeholder={
                current.bdCourierApiKeySet
                  ? "Leave blank to keep the current key"
                  : "Paste your bdcourier API key"
              }
              className="h-10 w-full max-w-md rounded-[9px] border bg-white px-3 text-xs outline-none focus:border-[#2e7d43]"
              style={{ borderColor: LINE, color: TEXT }}
            />
            {/* Stored encrypted and never sent back, so there is nothing to
                pre-fill and no way to read it here once saved. */}
            <span className="text-[0.68rem] text-muted">
              Stored encrypted. It is never shown again — to rotate it, paste the
              new key and save.
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={update.isPending}
              onClick={save}
              className="h-9 rounded-[9px] px-5 text-[0.76rem] font-bold text-white shadow-sm disabled:opacity-40"
              style={{ background: GREEN }}
            >
              {update.isPending ? "Saving…" : "Save API Key"}
            </button>
            {current.bdCourierApiKeySet && (
              <button
                type="button"
                disabled={update.isPending}
                onClick={() =>
                  update.mutate(
                    { ...current, bdCourierApiKey: "" },
                    { onSuccess: () => { setForm(null); setApiKey(""); } },
                  )
                }
                className="h-9 rounded-[9px] border px-5 text-[0.76rem] font-bold disabled:opacity-40"
                style={{ borderColor: "#f8ccd3", background: "#feeaec", color: "#e5484d" }}
              >
                Remove key
              </button>
            )}
          </div>
        </div>
      </SettingsCard>
    </div>
  );
}

export default function FraudPage() {
  const [section, setSection] = useState<"board" | "savings" | "settings">("board");

  return (
    <div className="flex flex-col gap-[18px]">
      {/* Top Header matching Order Manager */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.45rem] font-extrabold tracking-tight" style={{ color: INK }}>
            Courier Fraud Detection
          </h1>
          <div className="mt-1.5 flex items-center gap-1.5 text-[0.76rem] font-semibold" style={{ color: MUTED }}>
            Dashboard <span style={{ color: "#94a69a" }}>›</span> Net Profit <span style={{ color: "#94a69a" }}>›</span>{" "}
            <span style={{ color: GREEN }}>Fraud Checker</span>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <HeaderButton active={section === "board"} onClick={() => setSection("board")}>
            Board
          </HeaderButton>
          <HeaderButton active={section === "savings"} onClick={() => setSection("savings")}>
            Savings Log
          </HeaderButton>
          <HeaderButton active={section === "settings"} onClick={() => setSection("settings")}>
            Settings
          </HeaderButton>
        </div>
      </div>

      {section === "board" && <BoardTab />}
      {section === "savings" && <SavingsTab />}
      {section === "settings" && <SettingsTab />}
    </div>
  );
}
