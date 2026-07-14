"use client";

import { useState } from "react";
import { Button, Card, PageHeader, RangeSlider, SettingsCard, Table, TableEmptyRow, Tabs, ToggleSwitch } from "@amader/admin-ui";
import {
  useAdvancePaymentSettings,
  useAdvancePayments,
  useManualPayments,
  useRejectManualPayment,
  useUpdateAdvancePaymentSettings,
  useVerifyManualPayment,
  useWaiveAdvance,
} from "@/hooks/usePayments";
import {
  usePaymentMethodConfigs,
  useUpsertPaymentMethodConfig,
  type AssignableOrderStatus,
  type PaymentAccountType,
  type PaymentMethodProvider,
} from "@/hooks/usePaymentMethods";

const paymentIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <rect x="2" y="5" width="20" height="14" rx="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M2 10h20" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const METHOD_PROVIDERS: PaymentMethodProvider[] = ["BKASH", "NAGAD", "ROCKET", "UPAY"];
const ACCOUNT_TYPES: PaymentAccountType[] = ["PERSONAL", "AGENT", "MERCHANT"];
const ASSIGNABLE_STATUSES: AssignableOrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "COMPLETED",
  "CANCELED",
  "PARTIALLY_RETURNED",
  "RETURNED",
  "HOLD",
];

function AdvanceTab() {
  const { data, isLoading } = useAdvancePayments();
  const waive = useWaiveAdvance();

  return (
    <div className="flex flex-col gap-2">
      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      <Card className="overflow-hidden p-0">
        <Table>
          <thead>
            <tr>
              <th>Order</th>
              <th>Reason</th>
              <th>Paid / Required</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data && data.items.length === 0 && <TableEmptyRow colSpan={5}>No advance payments required yet.</TableEmptyRow>}
            {data?.items.map((a) => (
              <tr key={a.id}>
                <td className="num text-text">#{a.orderId}</td>
                <td className="text-secondary">{a.reason}</td>
                <td className="text-text">
                  ৳{Number(a.paid).toLocaleString()} / ৳{Number(a.required).toLocaleString()}
                </td>
                <td>
                  <span
                    className={`rounded-pill px-2.5 py-1 text-xs font-semibold ${
                      a.status === "PAID" ? "bg-success/10 text-success" : a.status === "WAIVED" ? "bg-border text-secondary" : "bg-warning/10 text-warning"
                    }`}
                  >
                    {a.status}
                  </span>
                </td>
                <td className="text-right">
                  {(a.status === "PENDING" || a.status === "PARTIAL") && (
                    <Button type="button" variant="ghost" disabled={waive.isPending} onClick={() => waive.mutate(a.orderId)}>
                      Waive
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}

function AdvanceSettingsTab() {
  const { data, isLoading } = useAdvancePaymentSettings();
  const update = useUpdateAdvancePaymentSettings();
  const [form, setForm] = useState<typeof data | null>(null);
  const current = form ?? data;

  if (isLoading || !current) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <SettingsCard icon={paymentIcon} title="Store-wide advance payment">
      <div className="flex flex-col gap-5">
        <ToggleSwitch
          checked={current.alwaysOnEnabled}
          onChange={(v) => setForm({ ...current, alwaysOnEnabled: v })}
          label="Require an advance payment on every Cash on Delivery order, regardless of risk score"
        />
        <p className="text-xs text-muted">
          Independent of the Fraud Checker's risk-triggered advance — if both apply to the same order, whichever amount is higher wins.
        </p>
        {current.alwaysOnEnabled && (
          <>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-secondary">Type</span>
              <select
                value={current.type}
                onChange={(e) => setForm({ ...current, type: e.target.value as "fixed" | "percent" })}
                className="h-10 w-48 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
              >
                <option value="percent">Percent of order total</option>
                <option value="fixed">Fixed amount (৳)</option>
              </select>
            </label>
            {current.type === "percent" ? (
              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-secondary">Advance percent</span>
                <RangeSlider value={current.value} onChange={(v) => setForm({ ...current, value: v })} suffix="%" />
              </label>
            ) : (
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-secondary">Fixed advance amount (৳)</span>
                <input
                  type="number"
                  min={0}
                  value={current.value}
                  onChange={(e) => setForm({ ...current, value: Number(e.target.value) })}
                  className="h-10 w-40 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
                />
              </label>
            )}
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-secondary">Label shown to staff</span>
              <input
                value={current.label}
                onChange={(e) => setForm({ ...current, label: e.target.value })}
                className="h-10 w-64 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
              />
            </label>
          </>
        )}
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
  );
}

function ManualQueueTab() {
  const { data, isLoading } = useManualPayments();
  const verify = useVerifyManualPayment();
  const reject = useRejectManualPayment();

  return (
    <div className="flex flex-col gap-2">
      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      <Card className="overflow-hidden p-0">
        <Table>
          <thead>
            <tr>
              <th>Proof</th>
              <th>Order</th>
              <th>Method</th>
              <th>Sender</th>
              <th>Trx ID</th>
              <th>Amount</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data && data.items.length === 0 && <TableEmptyRow colSpan={8}>No manual payment submissions yet.</TableEmptyRow>}
            {data?.items.map((m) => (
              <tr key={m.id}>
                <td>
                  {m.screenshotUrl && (
                    <a href={m.screenshotUrl} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={m.screenshotUrl} alt="Payment proof" className="h-10 w-10 rounded-inner border border-border object-cover" />
                    </a>
                  )}
                </td>
                <td className="num text-text">#{m.orderId}</td>
                <td>
                  <span className="rounded-pill bg-surface-2 px-2.5 py-1 text-xs font-semibold text-secondary">{m.method}</span>
                </td>
                <td className="text-secondary">{m.senderMsisdn}</td>
                <td className="num text-muted">{m.trxId}</td>
                <td className="font-semibold text-text">৳{Number(m.amount).toLocaleString()}</td>
                <td>
                  <span
                    className={`rounded-pill px-2.5 py-1 text-xs font-semibold ${
                      m.status === "VERIFIED" ? "bg-success/10 text-success" : m.status === "REJECTED" ? "bg-danger/10 text-danger" : "bg-warning/10 text-warning"
                    }`}
                  >
                    {m.status}
                  </span>
                </td>
                <td className="text-right">
                  {m.status === "SUBMITTED" && (
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="primary" disabled={verify.isPending} onClick={() => verify.mutate(m.id)}>
                        Verify
                      </Button>
                      <Button type="button" variant="ghost" disabled={reject.isPending} onClick={() => reject.mutate(m.id)}>
                        Reject
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}

function MethodConfigTab() {
  const { data, isLoading } = usePaymentMethodConfigs();
  const upsert = useUpsertPaymentMethodConfig();
  const [editing, setEditing] = useState<PaymentMethodProvider | null>(null);

  const byProvider = new Map((data ?? []).map((c) => [c.provider, c]));

  return (
    <div className="flex flex-col gap-2">
      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      {METHOD_PROVIDERS.map((provider) => {
        const config = byProvider.get(provider);
        const isEditing = editing === provider;
        return (
          <Card key={provider} className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              {config?.showIcon && config?.iconUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={config.iconUrl} alt={provider} className="h-6 w-6 rounded-inner object-contain" />
              )}
              <span className="text-sm font-semibold text-text">{provider}</span>
              {config ? (
                <>
                  <span className="rounded-pill bg-surface-2 px-2.5 py-1 text-xs font-semibold text-secondary">{config.accountType}</span>
                  <span className="num text-sm text-text">{config.number}</span>
                  <span className="text-xs text-muted">→ {config.orderStatusAfterVerify} after verify</span>
                  {!config.isActive && <span className="text-xs text-muted">(inactive)</span>}
                </>
              ) : (
                <span className="text-xs text-muted">Not configured</span>
              )}
              <Button type="button" variant="ghost" className="ml-auto" onClick={() => setEditing(isEditing ? null : provider)}>
                {isEditing ? "Cancel" : config ? "Edit" : "Configure"}
              </Button>
            </div>
            {isEditing && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  upsert.mutate(
                    {
                      provider,
                      accountType: form.get("accountType") as PaymentAccountType,
                      number: String(form.get("number")),
                      instructionsEn: String(form.get("instructionsEn") ?? ""),
                      instructionsBn: String(form.get("instructionsBn") ?? ""),
                      iconUrl: String(form.get("iconUrl") ?? "") || undefined,
                      showIcon: form.get("showIcon") === "on",
                      orderStatusAfterVerify: form.get("orderStatusAfterVerify") as AssignableOrderStatus,
                      isActive: form.get("isActive") === "on",
                    },
                    { onSuccess: () => setEditing(null) },
                  );
                }}
                className="flex flex-col gap-2"
              >
                <div className="flex flex-wrap gap-3">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold text-secondary">Account type</span>
                    <select
                      name="accountType"
                      defaultValue={config?.accountType ?? "PERSONAL"}
                      className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
                    >
                      {ACCOUNT_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold text-secondary">Number</span>
                    <input
                      name="number"
                      defaultValue={config?.number ?? ""}
                      required
                      className="h-10 w-44 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold text-secondary">Order status after verify</span>
                    <select
                      name="orderStatusAfterVerify"
                      defaultValue={config?.orderStatusAfterVerify ?? "CONFIRMED"}
                      className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
                    >
                      {ASSIGNABLE_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 self-end pb-2.5">
                    <input type="checkbox" name="isActive" defaultChecked={config?.isActive ?? true} />
                    <span className="text-sm text-text">Active</span>
                  </label>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="flex flex-1 flex-col gap-1.5">
                    <span className="text-xs font-semibold text-secondary">Icon URL (shown at checkout)</span>
                    <input
                      name="iconUrl"
                      type="url"
                      defaultValue={config?.iconUrl ?? ""}
                      placeholder="https://…/bkash.png"
                      className="h-10 w-full rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
                    />
                  </label>
                  <label className="flex items-center gap-2 pb-2.5">
                    <input type="checkbox" name="showIcon" defaultChecked={config?.showIcon ?? true} />
                    <span className="text-sm text-text">Show icon on checkout</span>
                  </label>
                </div>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-secondary">Instructions (English)</span>
                  <textarea
                    name="instructionsEn"
                    defaultValue={config?.instructionsEn ?? ""}
                    rows={2}
                    className="rounded-sm border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-brand-500"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-secondary">Instructions (বাংলা)</span>
                  <textarea
                    name="instructionsBn"
                    defaultValue={config?.instructionsBn ?? ""}
                    rows={2}
                    className="rounded-sm border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-brand-500"
                  />
                </label>
                <Button type="submit" variant="primary" className="self-start" disabled={upsert.isPending}>
                  {upsert.isPending ? "Saving…" : "Save"}
                </Button>
              </form>
            )}
          </Card>
        );
      })}
    </div>
  );
}

export default function PaymentsPage() {
  const [tab, setTab] = useState("manual");

  return (
    <div className="flex flex-col gap-4">
      <PageHeader icon={paymentIcon} title="Payments" subtitle="Manual payment verification, advance payments, and method configuration." />
      <Tabs
        variant="pill"
        options={[
          { value: "manual", label: "Manual Payment Queue" },
          { value: "advance", label: "Advance Payments" },
          { value: "advance-settings", label: "Advance Settings" },
          { value: "methods", label: "Payment Method Config" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "manual" && <ManualQueueTab />}
      {tab === "advance" && <AdvanceTab />}
      {tab === "advance-settings" && <AdvanceSettingsTab />}
      {tab === "methods" && <MethodConfigTab />}
    </div>
  );
}
