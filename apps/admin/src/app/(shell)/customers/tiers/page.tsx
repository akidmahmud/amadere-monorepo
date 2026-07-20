"use client";

import { useEffect, useState } from "react";
import { Button, Icon, PageHeader, SettingsCard } from "@amader/admin-ui";
import { useCustomerTiers, useUpdateCustomerTiers } from "@/hooks/useCustomers";

const tiersIcon = <Icon name="military_tech" />;

interface TierForm {
  label: string;
  minCompletedOrders: number;
  sortOrder: number;
}

export default function CustomerTiersPage() {
  const { data, isLoading } = useCustomerTiers();
  const update = useUpdateCustomerTiers();
  const [form, setForm] = useState<TierForm[] | null>(null);

  useEffect(() => {
    if (data && !form) {
      setForm(data.map((t) => ({ label: t.label, minCompletedOrders: t.minCompletedOrders, sortOrder: t.sortOrder })));
    }
  }, [data, form]);

  if (isLoading || !form) return <p className="text-sm text-muted">Loading…</p>;

  function patchTier(i: number, patch: Partial<TierForm>) {
    setForm((prev) => prev!.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }

  function addTier() {
    setForm((prev) => [...(prev ?? []), { label: "New Tier", minCompletedOrders: 1, sortOrder: (prev?.length ?? 0) + 1 }]);
  }

  function removeTier(i: number) {
    setForm((prev) => prev!.filter((_, idx) => idx !== i));
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader icon={tiersIcon} title="Customer Tiers" subtitle="Order-count thresholds that decide each customer's tier." />

      <SettingsCard icon={tiersIcon} title="Tier thresholds">
        <div className="flex flex-col gap-4">
          {form.map((tier, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-3 rounded-inner border border-border p-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-secondary">Label</span>
                <input
                  value={tier.label}
                  onChange={(e) => patchTier(i, { label: e.target.value })}
                  className="h-9 rounded-sm border border-border bg-surface px-2.5 text-sm text-text outline-none focus:border-brand-500"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-secondary">Min completed orders</span>
                <input
                  type="number"
                  min={1}
                  value={tier.minCompletedOrders}
                  onChange={(e) => patchTier(i, { minCompletedOrders: Number(e.target.value) })}
                  className="h-9 rounded-sm border border-border bg-surface px-2.5 text-sm text-text outline-none focus:border-brand-500"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-secondary">Sort order</span>
                <input
                  type="number"
                  value={tier.sortOrder}
                  onChange={(e) => patchTier(i, { sortOrder: Number(e.target.value) })}
                  className="h-9 rounded-sm border border-border bg-surface px-2.5 text-sm text-text outline-none focus:border-brand-500"
                />
              </label>
              <Button type="button" variant="ghost" onClick={() => removeTier(i)}>
                Remove
              </Button>
            </div>
          ))}
          <Button type="button" variant="ghost" className="self-start" onClick={addTier}>
            Add tier
          </Button>
        </div>
      </SettingsCard>

      <Button
        type="button"
        variant="primary"
        className="self-start"
        disabled={update.isPending}
        onClick={() => update.mutate(form, { onSuccess: (saved) => setForm(saved.map((t) => ({ label: t.label, minCompletedOrders: t.minCompletedOrders, sortOrder: t.sortOrder }))) })}
      >
        {update.isPending ? "Saving…" : "Save tiers"}
      </Button>
    </div>
  );
}
