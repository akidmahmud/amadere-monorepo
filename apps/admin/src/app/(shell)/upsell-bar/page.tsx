"use client";

import { useEffect, useState } from "react";
import { Button, Card, Icon, PageHeader, SettingsCard, ToggleSwitch } from "@amader/admin-ui";
import {
  useReplaceUpsellStages,
  useUpdateUpsellBarSettings,
  useUpsellBarSettings,
  useUpsellStages,
  type UpsellBarSettings,
  type UpsellStageInput,
  type UpsellTriggerType,
} from "@/hooks/useUpsellBar";

const upsellIcon = <Icon name="rocket_launch" />;

function emptyStage(sortOrder: number): UpsellStageInput {
  return {
    sortOrder,
    triggerType: "ITEM_COUNT",
    triggerValue: 0,
    discountPercent: undefined,
    discountFixedAmount: undefined,
    freeShipping: false,
    label: "",
    enabled: true,
  };
}

export default function UpsellBarPage() {
  const { data: settingsData, isLoading: settingsLoading } = useUpsellBarSettings();
  const { data: stagesData, isLoading: stagesLoading } = useUpsellStages();
  const updateSettings = useUpdateUpsellBarSettings();
  const replaceStages = useReplaceUpsellStages();

  const [settings, setSettings] = useState<UpsellBarSettings | null>(null);
  const [stages, setStages] = useState<UpsellStageInput[] | null>(null);

  useEffect(() => {
    if (settingsData && !settings) setSettings(settingsData);
  }, [settingsData, settings]);
  useEffect(() => {
    if (stagesData && !stages) {
      setStages(
        stagesData.map((s) => ({
          sortOrder: s.sortOrder,
          triggerType: s.triggerType,
          triggerValue: Number(s.triggerValue),
          discountPercent: s.discountPercent ? Number(s.discountPercent) : undefined,
          discountFixedAmount: s.discountFixedAmount ? Number(s.discountFixedAmount) : undefined,
          freeShipping: s.freeShipping,
          label: s.label,
          enabled: s.enabled,
        })),
      );
    }
  }, [stagesData, stages]);

  if (settingsLoading || stagesLoading || !settings || !stages) return <p className="text-sm text-muted">Loading…</p>;

  function updateStage(index: number, patch: Partial<UpsellStageInput>) {
    setStages((prev) => prev!.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function moveStage(index: number, dir: -1 | 1) {
    setStages((prev) => {
      const next = [...prev!];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((s, i) => ({ ...s, sortOrder: i + 1 }));
    });
  }

  function removeStage(index: number) {
    setStages((prev) => prev!.filter((_, i) => i !== index).map((s, i) => ({ ...s, sortOrder: i + 1 })));
  }

  function addStage() {
    setStages((prev) => [...prev!, emptyStage(prev!.length + 1)]);
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader icon={upsellIcon} title="Upsell Bar" subtitle="Configure the gamified progress bar shown in the cart drawer and checkout." />

      <SettingsCard icon={upsellIcon} title="Bar settings">
        <div className="flex flex-col gap-5">
          <ToggleSwitch
            checked={settings.enabled}
            onChange={(v) => setSettings({ ...settings, enabled: v })}
            label="Show the upsell bar in the cart drawer and checkout"
          />
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Count mode</span>
            <select
              value={settings.countMode}
              onChange={(e) => setSettings({ ...settings, countMode: e.target.value as UpsellBarSettings["countMode"] })}
              className="h-10 w-64 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
            >
              <option value="TOTAL_UNITS">Total units in cart</option>
              <option value="DISTINCT_PRODUCTS">Distinct products in cart</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Max discount cap (৳, optional)</span>
            <input
              type="number"
              min={0}
              value={settings.maxDiscountCap ?? ""}
              onChange={(e) => setSettings({ ...settings, maxDiscountCap: e.target.value === "" ? null : Number(e.target.value) })}
              className="h-10 w-40 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
            />
          </label>
          <Button
            type="button"
            variant="primary"
            className="self-start"
            disabled={updateSettings.isPending}
            onClick={() => updateSettings.mutate(settings)}
          >
            {updateSettings.isPending ? "Saving…" : "Save settings"}
          </Button>
        </div>
      </SettingsCard>

      <SettingsCard icon={upsellIcon} title="Stages">
        <div className="flex flex-col gap-3">
          {stages.map((stage, i) => (
            <Card key={i} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-secondary">Trigger</span>
                  <select
                    value={stage.triggerType}
                    onChange={(e) => updateStage(i, { triggerType: e.target.value as UpsellTriggerType })}
                    className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
                  >
                    <option value="ITEM_COUNT">Item count</option>
                    <option value="ORDER_AMOUNT">Order amount (৳)</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-secondary">{stage.triggerType === "ITEM_COUNT" ? "Items" : "Amount (৳)"}</span>
                  <input
                    type="number"
                    min={0}
                    value={stage.triggerValue}
                    onChange={(e) => updateStage(i, { triggerValue: Number(e.target.value) })}
                    className="h-10 w-28 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-secondary">Discount %</span>
                  <input
                    type="number"
                    min={0}
                    value={stage.discountPercent ?? ""}
                    onChange={(e) =>
                      updateStage(i, {
                        discountPercent: e.target.value === "" ? undefined : Number(e.target.value),
                        discountFixedAmount: undefined,
                      })
                    }
                    className="h-10 w-24 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-secondary">Fixed discount (৳)</span>
                  <input
                    type="number"
                    min={0}
                    value={stage.discountFixedAmount ?? ""}
                    onChange={(e) =>
                      updateStage(i, {
                        discountFixedAmount: e.target.value === "" ? undefined : Number(e.target.value),
                        discountPercent: undefined,
                      })
                    }
                    className="h-10 w-28 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
                  />
                </label>
                <label className="flex items-center gap-2 pb-2.5">
                  <input type="checkbox" checked={stage.freeShipping} onChange={(e) => updateStage(i, { freeShipping: e.target.checked })} />
                  <span className="text-sm text-text">Free shipping</span>
                </label>
                <label className="flex items-center gap-2 pb-2.5">
                  <input type="checkbox" checked={stage.enabled} onChange={(e) => updateStage(i, { enabled: e.target.checked })} />
                  <span className="text-sm text-text">Enabled</span>
                </label>
              </div>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-secondary">Label</span>
                <input
                  value={stage.label}
                  onChange={(e) => updateStage(i, { label: e.target.value })}
                  placeholder="e.g. 3% off"
                  className="h-10 w-64 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
                />
              </label>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" disabled={i === 0} onClick={() => moveStage(i, -1)}>
                  Move up
                </Button>
                <Button type="button" variant="ghost" disabled={i === stages.length - 1} onClick={() => moveStage(i, 1)}>
                  Move down
                </Button>
                <Button type="button" variant="ghost" onClick={() => removeStage(i)}>
                  Delete
                </Button>
              </div>
            </Card>
          ))}
          <div className="flex items-center gap-3">
            <Button type="button" variant="ghost" disabled={stages.length >= 6} onClick={addStage}>
              Add stage
            </Button>
            <Button type="button" variant="primary" disabled={replaceStages.isPending} onClick={() => replaceStages.mutate(stages)}>
              {replaceStages.isPending ? "Saving…" : "Save stages"}
            </Button>
          </div>
        </div>
      </SettingsCard>
    </div>
  );
}
