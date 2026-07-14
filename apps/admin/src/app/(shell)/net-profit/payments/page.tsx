"use client";

import { useState } from "react";
import { Button, Card, Tabs } from "@amader/admin-ui";
import { useAdvancePayments, useManualPayments, useRejectManualPayment, useVerifyManualPayment, useWaiveAdvance } from "@/hooks/usePayments";
import {
  usePaymentMethodConfigs,
  useUpsertPaymentMethodConfig,
  type PaymentAccountType,
  type PaymentMethodProvider,
} from "@/hooks/usePaymentMethods";

const METHOD_PROVIDERS: PaymentMethodProvider[] = ["BKASH", "NAGAD", "ROCKET", "UPAY"];
const ACCOUNT_TYPES: PaymentAccountType[] = ["PERSONAL", "AGENT", "MERCHANT"];

function AdvanceTab() {
  const { data, isLoading } = useAdvancePayments();
  const waive = useWaiveAdvance();

  return (
    <div className="flex flex-col gap-2">
      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      {data && data.items.length === 0 && <p className="text-sm text-muted">No advance payments required yet.</p>}
      {data?.items.map((a) => (
        <Card key={a.id} className="flex items-center gap-3">
          <span className="num text-sm text-text">Order #{a.orderId}</span>
          <span className="text-xs text-secondary">{a.reason}</span>
          <span className="ml-auto text-sm text-text">
            ৳{Number(a.paid).toLocaleString()} / ৳{Number(a.required).toLocaleString()}
          </span>
          <span
            className={`rounded-pill px-2.5 py-1 text-xs font-semibold ${
              a.status === "PAID" ? "bg-success/10 text-success" : a.status === "WAIVED" ? "bg-border text-secondary" : "bg-warning/10 text-warning"
            }`}
          >
            {a.status}
          </span>
          {(a.status === "PENDING" || a.status === "PARTIAL") && (
            <Button type="button" variant="ghost" disabled={waive.isPending} onClick={() => waive.mutate(a.orderId)}>
              Waive
            </Button>
          )}
        </Card>
      ))}
    </div>
  );
}

function ManualQueueTab() {
  const { data, isLoading } = useManualPayments();
  const verify = useVerifyManualPayment();
  const reject = useRejectManualPayment();

  return (
    <div className="flex flex-col gap-2">
      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      {data && data.items.length === 0 && <p className="text-sm text-muted">No manual payment submissions yet.</p>}
      {data?.items.map((m) => (
        <Card key={m.id} className="flex flex-wrap items-center gap-3">
          <span className="num text-sm text-text">Order #{m.orderId}</span>
          <span className="rounded-pill bg-surface-2 px-2.5 py-1 text-xs font-semibold text-secondary">{m.method}</span>
          <span className="text-xs text-secondary">{m.senderMsisdn}</span>
          <span className="num text-xs text-muted">trx: {m.trxId}</span>
          <span className="text-sm font-semibold text-text">৳{Number(m.amount).toLocaleString()}</span>
          <span
            className={`rounded-pill px-2.5 py-1 text-xs font-semibold ${
              m.status === "VERIFIED" ? "bg-success/10 text-success" : m.status === "REJECTED" ? "bg-danger/10 text-danger" : "bg-warning/10 text-warning"
            }`}
          >
            {m.status}
          </span>
          {m.status === "SUBMITTED" && (
            <div className="ml-auto flex gap-2">
              <Button type="button" variant="primary" disabled={verify.isPending} onClick={() => verify.mutate(m.id)}>
                Verify
              </Button>
              <Button type="button" variant="ghost" disabled={reject.isPending} onClick={() => reject.mutate(m.id)}>
                Reject
              </Button>
            </div>
          )}
        </Card>
      ))}
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
              <span className="text-sm font-semibold text-text">{provider}</span>
              {config ? (
                <>
                  <span className="rounded-pill bg-surface-2 px-2.5 py-1 text-xs font-semibold text-secondary">{config.accountType}</span>
                  <span className="num text-sm text-text">{config.number}</span>
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
                  <label className="flex items-center gap-2 self-end pb-2.5">
                    <input type="checkbox" name="isActive" defaultChecked={config?.isActive ?? true} />
                    <span className="text-sm text-text">Active</span>
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
      <Tabs
        options={[
          { value: "manual", label: "Manual Payment Queue" },
          { value: "advance", label: "Advance Payments" },
          { value: "methods", label: "Payment Method Config" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "manual" && <ManualQueueTab />}
      {tab === "advance" && <AdvanceTab />}
      {tab === "methods" && <MethodConfigTab />}
    </div>
  );
}
