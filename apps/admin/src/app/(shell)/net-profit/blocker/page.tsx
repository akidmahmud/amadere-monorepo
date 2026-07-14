"use client";

import { useState } from "react";
import { Button, Card } from "@amader/admin-ui";
import { useBlockRules, useCreateBlockRule, useDeleteBlockRule, useSetBlockRuleActive, type BlockType } from "@/hooks/useBlocker";

const TYPES: BlockType[] = ["PHONE", "EMAIL", "IP", "DEVICE"];

const PLACEHOLDERS: Record<BlockType, string> = {
  PHONE: "01XXXXXXXXX",
  EMAIL: "name@example.com",
  IP: "203.0.113.1",
  DEVICE: "device fingerprint id",
};

export default function BlockerPage() {
  const { data: rules, isLoading } = useBlockRules();
  const create = useCreateBlockRule();
  const setActive = useSetBlockRuleActive();
  const del = useDeleteBlockRule();

  const [type, setType] = useState<BlockType>("PHONE");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    create.mutate(
      {
        type,
        value: value.trim(),
        reason: reason.trim() || undefined,
        customerName: customerName.trim() || undefined,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      },
      { onSuccess: () => { setValue(""); setReason(""); setCustomerName(""); setExpiresAt(""); } },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Type</span>
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
              className="h-10 w-56 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Customer name (optional)</span>
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="h-10 w-40 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Reason (optional)</span>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="h-10 w-48 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Expires (optional — blank = permanent)</span>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
            />
          </label>
          <Button type="submit" variant="primary" disabled={create.isPending}>
            {create.isPending ? "Adding…" : "Block"}
          </Button>
        </form>
      </Card>

      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      {rules && rules.length === 0 && <p className="text-sm text-muted">No block rules yet.</p>}

      <div className="flex flex-col gap-2">
        {rules?.map((r) => {
          const expired = r.expiresAt ? new Date(r.expiresAt) < new Date() : false;
          return (
            <Card key={r.id} className={`flex flex-wrap items-center gap-3 ${!r.isActive || expired ? "opacity-50" : ""}`}>
              <span className="rounded-pill bg-surface-2 px-2.5 py-1 text-xs font-semibold text-secondary">{r.type}</span>
              {r.source === "AUTO" && (
                <span className="rounded-pill bg-warning/10 px-2.5 py-1 text-xs font-semibold text-warning">AUTO</span>
              )}
              <span className="num text-sm text-text">{r.value}</span>
              {r.customerName && <span className="text-xs text-secondary">{r.customerName}</span>}
              {r.category && <span className="text-xs text-muted">{r.category}</span>}
              {r.reason && <span className="text-xs text-muted">{r.reason}</span>}
              {r.expiresAt && (
                <span className={`text-xs ${expired ? "text-danger" : "text-muted"}`}>
                  {expired ? "expired" : "expires"} {new Date(r.expiresAt).toLocaleDateString()}
                </span>
              )}
              <span className="ml-auto text-xs text-muted">{new Date(r.createdAt).toLocaleDateString()}</span>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setActive.mutate({ id: r.id, isActive: !r.isActive })}
              >
                {r.isActive ? "Deactivate" : "Activate"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  if (confirm(`Delete this block rule for ${r.value}?`)) del.mutate(r.id);
                }}
              >
                Delete
              </Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
