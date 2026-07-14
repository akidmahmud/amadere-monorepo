"use client";

import { useState } from "react";
import { Button, Card } from "@amader/admin-ui";
import { useCreateGiftVoucher, useDeactivateGiftVoucher, useGiftVouchers } from "@/hooks/useGiftVouchers";

function NewVoucherForm({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState("");
  const [initialBalance, setInitialBalance] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const create = useCreateGiftVoucher();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await create.mutateAsync({
      code: code || undefined,
      initialBalance: Number(initialBalance),
      expiresAt: expiresAt || undefined,
    });
    onDone();
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Code (optional, auto-generated if blank)</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Initial balance</span>
          <input
            type="number"
            required
            value={initialBalance}
            onChange={(e) => setInitialBalance(e.target.value)}
            className="num h-10 w-32 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Expires (optional)</span>
          <input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          />
        </label>
        <Button type="submit" variant="primary" disabled={create.isPending}>
          {create.isPending ? "Creating…" : "Create voucher"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </form>
    </Card>
  );
}

export default function GiftVouchersPage() {
  const { data: vouchers, isLoading } = useGiftVouchers();
  const deactivate = useDeactivateGiftVoucher();
  const [creating, setCreating] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-secondary">{vouchers?.length ?? 0} gift vouchers</p>
        {!creating && (
          <Button variant="primary" onClick={() => setCreating(true)}>
            Add voucher
          </Button>
        )}
      </div>

      {creating && <NewVoucherForm onDone={() => setCreating(false)} />}
      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      {vouchers && vouchers.length === 0 && !creating && <p className="text-sm text-muted">No gift vouchers yet.</p>}

      <div className="flex flex-col gap-3">
        {vouchers?.map((v) => (
          <Card key={v.id} className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="num text-sm font-semibold text-text">{v.code}</div>
              <div className="text-xs text-muted">
                {v.currency} {v.remainingBalance} / {v.initialBalance} · {String(v.status)}
                {v.expiresAt && ` · expires ${new Date(v.expiresAt).toLocaleDateString()}`}
              </div>
            </div>
            <Button type="button" variant="ghost" disabled={deactivate.isPending} onClick={() => deactivate.mutate(v.id)}>
              Deactivate
            </Button>
          </Card>
        ))}
      </div>
    </>
  );
}
