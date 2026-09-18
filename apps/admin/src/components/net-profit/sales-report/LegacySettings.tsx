"use client";

// The old Reports → Settings cards, moved unchanged into Rates and costs
// (Sales report spec 2026-09-18, D1).
import { useState } from "react";
import {
  Button,
  Icon,
  RangeSlider,
  SettingsCard,
  ToggleSwitch,
} from "@amader/admin-ui";
import {
  useFallbackProfitSettings,
  useUpdateFallbackProfitSettings,
  FallbackProfitSettings,
} from "@/hooks/useProfit";
import {
  useMarketingCostSettings,
  useMarketingCosts,
  useSetMarketingCost,
  useUpdateMarketingCostSettings,
} from "@/hooks/useMarketingCost";
import { useFraudSettings, useUpdateFraudSettings } from "@/hooks/useFraud";
import { useHourlySlot, useSetHourlySlot } from "@/hooks/useNetProfitOverview";

function FallbackProfitCard() {
  const { data, isLoading } = useFallbackProfitSettings();
  const update = useUpdateFallbackProfitSettings();
  const [form, setForm] = useState<FallbackProfitSettings | null>(null);
  const current = form ?? data;

  return (
    <SettingsCard icon={<Icon name="attach_money" />} title="Fallback Profit">
      {isLoading || !current ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <div className="flex flex-col gap-4">
          <ToggleSwitch
            checked={current.enabled}
            onChange={(v) => setForm({ ...current, enabled: v })}
            label="Enable Fallback Profit"
          />
          <p className="-mt-2 text-xs text-muted">
            When enabled, if a product has no Owner Buy Price set, this fallback
            will be used to estimate profit instead.
          </p>
          {current.enabled && (
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-secondary">
                  Fallback Type
                </span>
                <select
                  value={current.type}
                  onChange={(e) =>
                    setForm({
                      ...current,
                      type: e.target.value as "percentage" | "fixed",
                    })
                  }
                  className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
                >
                  <option value="percentage">Percentage of Sale Price</option>
                  <option value="fixed">Fixed profit per unit (৳)</option>
                </select>
                <span className="text-xs text-muted">
                  Percentage: e.g. 20% of ৳1000 = ৳200 profit. Fixed: flat
                  amount per unit.
                </span>
              </label>
              {current.type === "percentage" ? (
                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-secondary">
                    Fallback Value
                  </span>
                  <RangeSlider
                    value={current.value}
                    onChange={(v) => setForm({ ...current, value: v })}
                    suffix="%"
                  />
                </label>
              ) : (
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-secondary">
                    Fallback Value (৳)
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={current.value}
                    onChange={(e) =>
                      setForm({ ...current, value: Number(e.target.value) })
                    }
                    className="h-10 w-40 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
                  />
                </label>
              )}
            </div>
          )}
          <Button
            type="button"
            variant="primary"
            className="self-start"
            disabled={update.isPending}
            onClick={() =>
              update.mutate(current, { onSuccess: () => setForm(null) })
            }
          >
            {update.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      )}
    </SettingsCard>
  );
}

const SLOT_OPTIONS = [1, 2, 3, 4, 6, 12];

export function LegacySettings() {
  const { data: costs } = useMarketingCosts();
  const setCost = useSetMarketingCost();
  const today = new Date().toISOString().slice(0, 10);
  const todayCost = costs?.find((c) => c.costDate === today);
  const [adsCost, setAdsCost] = useState("");
  const [otherCost, setOtherCost] = useState("");
  const [note, setNote] = useState("");

  const { data: mcSettings } = useMarketingCostSettings();
  const updateMcSettings = useUpdateMarketingCostSettings();
  const [autoCarry, setAutoCarry] = useState<boolean | null>(null);
  const [defaultCost, setDefaultCost] = useState<string | null>(null);

  const { data: hourlySlot } = useHourlySlot();
  const setHourlySlot = useSetHourlySlot();

  const { data: fraudSettings } = useFraudSettings();
  const updateFraudSettings = useUpdateFraudSettings();
  const [deliveryFallback, setDeliveryFallback] = useState<string | null>(null);

  const [autoReport, setAutoReport] = useState<boolean | null>(null);
  const [reportEmail, setReportEmail] = useState<string | null>(null);

  const reportConfigDirty =
    autoCarry !== null || defaultCost !== null || deliveryFallback !== null;
  const reportConfigSaving =
    updateMcSettings.isPending ||
    updateFraudSettings.isPending ||
    setHourlySlot.isPending;

  function saveReportConfig() {
    if (autoCarry !== null || defaultCost !== null) {
      updateMcSettings.mutate(
        {
          ...(autoCarry !== null ? { autoCarryEnabled: autoCarry } : {}),
          ...(defaultCost !== null
            ? { defaultMarketingCost: Number(defaultCost) }
            : {}),
        },
        {
          onSuccess: () => {
            setAutoCarry(null);
            setDefaultCost(null);
          },
        },
      );
    }
    if (deliveryFallback !== null) {
      updateFraudSettings.mutate(
        { deliveryFallback: Number(deliveryFallback) },
        { onSuccess: () => setDeliveryFallback(null) },
      );
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <SettingsCard
        icon={<Icon name="campaign" />}
        title={`Today's Marketing Cost (${today})`}
      >
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">
              Ads Cost (৳)
            </span>
            <input
              type="number"
              min={0}
              placeholder={todayCost?.adsCost ?? "0"}
              value={adsCost}
              onChange={(e) => setAdsCost(e.target.value)}
              className="h-10 w-32 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">
              Other Cost (৳)
            </span>
            <input
              type="number"
              min={0}
              placeholder={todayCost?.otherCost ?? "0"}
              value={otherCost}
              onChange={(e) => setOtherCost(e.target.value)}
              className="h-10 w-32 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Note</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. FB Ads + Google Ads"
              className="h-10 w-full rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
            />
          </label>
          <Button
            type="button"
            variant="primary"
            disabled={setCost.isPending || (adsCost === "" && otherCost === "")}
            onClick={() =>
              setCost.mutate(
                {
                  date: today,
                  adsCost: Number(adsCost || todayCost?.adsCost || 0),
                  otherCost: Number(otherCost || todayCost?.otherCost || 0),
                  note: note || undefined,
                },
                {
                  onSuccess: () => {
                    setAdsCost("");
                    setOtherCost("");
                    setNote("");
                  },
                },
              )
            }
          >
            {setCost.isPending ? (
              "Saving…"
            ) : (
              <>
                <Icon name="check" size={16} /> Save Today
              </>
            )}
          </Button>
        </div>
        {todayCost?.autoCarried && (
          <p className="mt-2 text-xs text-warning">
            Auto-carried forward from the previous day.
          </p>
        )}
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
          <span className="text-brand-500">ⓘ</span> Auto-carry is{" "}
          {mcSettings?.autoCarryEnabled ? "ON" : "OFF"}.
        </p>
      </SettingsCard>

      <SettingsCard
        icon={<Icon name="grid_view" />}
        title="Report Configuration"
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-4">
            <div className="rounded-inner bg-surface-2 p-3">
              <ToggleSwitch
                checked={autoCarry ?? mcSettings?.autoCarryEnabled ?? false}
                onChange={setAutoCarry}
                label="Auto-carry marketing cost to next day"
              />
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-secondary">
                Fraud Delivery Fallback (৳)
              </span>
              <input
                type="number"
                min={0}
                value={deliveryFallback ?? fraudSettings?.deliveryFallback ?? 0}
                onChange={(e) => setDeliveryFallback(e.target.value)}
                className="h-10 w-40 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
              />
              <span className="text-xs text-muted">
                Default delivery charge for Fraud Amount Saved.
              </span>
            </label>
          </div>
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-secondary">
                Default Marketing Cost (৳)
              </span>
              <input
                type="number"
                min={0}
                value={defaultCost ?? mcSettings?.defaultMarketingCost ?? 0}
                onChange={(e) => setDefaultCost(e.target.value)}
                className="h-10 w-40 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-secondary">
                Performance Time Slots
              </span>
              <select
                value={hourlySlot?.hourlySlotHours ?? 2}
                onChange={(e) => setHourlySlot.mutate(Number(e.target.value))}
                disabled={setHourlySlot.isPending}
                className="h-10 w-40 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
              >
                {SLOT_OPTIONS.map((h) => (
                  <option key={h} value={h}>
                    {h}-hour slots
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <Button
          type="button"
          variant="primary"
          className="mt-4"
          disabled={!reportConfigDirty || reportConfigSaving}
          onClick={saveReportConfig}
        >
          {reportConfigSaving ? "Saving…" : "Save Settings"}
        </Button>
      </SettingsCard>

      <FallbackProfitCard />

      <SettingsCard icon={<Icon name="mail" />} title="Auto Report Delivery">
        <div className="flex flex-col gap-4">
          <div className="rounded-inner bg-surface-2 p-3">
            <ToggleSwitch
              checked={autoReport ?? mcSettings?.autoReportEnabled ?? false}
              onChange={setAutoReport}
              label="Enable Daily Auto Report"
            />
          </div>
          <p className="-mt-2 text-xs text-muted">
            When enabled, a daily sales report (CSV) will be emailed to the
            specified address every day at midnight.
          </p>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">
              Report Email Address
            </span>
            <input
              value={reportEmail ?? mcSettings?.reportEmail ?? ""}
              onChange={(e) => setReportEmail(e.target.value)}
              placeholder="admin@example.com"
              className="h-10 w-full max-w-md rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
            />
            <span className="text-xs text-muted">
              Leave blank to skip sending even when enabled. The report covers
              yesterday&apos;s completed orders.
            </span>
          </label>
          <Button
            type="button"
            variant="ghost"
            className="self-start"
            disabled={
              (autoReport === null && reportEmail === null) ||
              updateMcSettings.isPending
            }
            onClick={() =>
              updateMcSettings.mutate(
                {
                  ...(autoReport !== null
                    ? { autoReportEnabled: autoReport }
                    : {}),
                  ...(reportEmail !== null ? { reportEmail } : {}),
                },
                {
                  onSuccess: () => {
                    setAutoReport(null);
                    setReportEmail(null);
                  },
                },
              )
            }
          >
            {updateMcSettings.isPending ? "Saving…" : "Save Settings"}
          </Button>
        </div>
      </SettingsCard>
    </div>
  );
}
