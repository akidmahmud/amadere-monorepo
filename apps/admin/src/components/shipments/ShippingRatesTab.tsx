"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Card, Icon } from "@amader/admin-ui";
import { BD_DISTRICTS_BY_DIVISION, SHIPPING_ZONE_MAX } from "@amader/shared";
import {
  useShippingZones,
  useUpdateShippingZones,
  type ShippingZonesConfig,
} from "@/hooks/useShippingZones";

type Zone = ShippingZonesConfig["zones"][number];
type Translated = Zone["name"];

const inputStyle =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text transition-all focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";

function newZone(): Zone {
  return { name: { en: "New Zone", bn: "নতুন জোন" }, fee: 100, districts: [] };
}

function TranslatedNameField({
  value,
  onChange,
}: {
  value: Translated;
  onChange: (next: Translated) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
          Zone name (বাংলা)
        </span>
        <input
          className={inputStyle}
          value={value.bn}
          onChange={(e) => onChange({ ...value, bn: e.target.value })}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
          Zone name (English)
        </span>
        <input
          className={inputStyle}
          value={value.en}
          onChange={(e) => onChange({ ...value, en: e.target.value })}
        />
      </label>
    </div>
  );
}

export function ShippingRatesTab() {
  const { data, isLoading } = useShippingZones();
  const update = useUpdateShippingZones();
  const [draft, setDraft] = useState<ShippingZonesConfig | null>(null);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (data && !draft) setDraft(structuredClone(data));
  }, [data, draft]);

  // A district can only belong to one zone (the API rejects duplicates), so
  // one already claimed elsewhere is disabled rather than silently allowed
  // and then refused on save.
  const claimedBy = useMemo(() => {
    const map = new Map<string, number>();
    draft?.zones.forEach((zone, zi) =>
      zone.districts.forEach((d) => map.set(d.toLowerCase(), zi)),
    );
    return map;
  }, [draft]);

  if (isLoading || !draft) {
    return (
      <Card className="flex items-center gap-3 p-6 text-muted">
        <Icon name="progress_activity" className="animate-spin" size={22} />
        <span className="text-sm">Loading shipping rates…</span>
      </Card>
    );
  }

  function setZone(index: number, next: Zone) {
    if (!draft) return;
    const zones = draft.zones.slice();
    zones[index] = next;
    setDraft({ ...draft, zones });
  }

  function toggleDistrict(zoneIndex: number, district: string) {
    if (!draft) return;
    const zone = draft.zones[zoneIndex];
    const has = zone.districts.some((d) => d.toLowerCase() === district.toLowerCase());
    setZone(zoneIndex, {
      ...zone,
      districts: has
        ? zone.districts.filter((d) => d.toLowerCase() !== district.toLowerCase())
        : [...zone.districts, district],
    });
  }

  async function handleSave() {
    if (!draft) return;
    setSaveError(null);
    try {
      await update.mutateAsync(draft);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Couldn't save shipping rates");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h3 className="text-base font-bold text-text">Shipping Rates</h3>
          <p className="text-xs text-muted">
            What the customer pays at checkout. Districts you don&apos;t assign use the
            fallback rate, so you never have to list all 64.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-xs font-semibold text-success">✓ Saved</span>}
          {saveError && <span className="text-xs font-semibold text-red-600">{saveError}</span>}
          <Button onClick={handleSave} disabled={update.isPending}>
            {update.isPending ? "Saving…" : "Save Rates"}
          </Button>
        </div>
      </Card>

      {draft.zones.map((zone, zi) => (
        <Card key={zi} className="flex flex-col gap-4 p-5">
          <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <Icon name="local_shipping" className="text-brand-500" size={20} />
              <span className="text-sm font-bold text-text">Zone {zi + 1}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                title="Move up"
                disabled={zi === 0}
                onClick={() => {
                  const zones = draft.zones.slice();
                  [zones[zi - 1], zones[zi]] = [zones[zi], zones[zi - 1]];
                  setDraft({ ...draft, zones });
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-secondary disabled:opacity-30"
              >
                <Icon name="arrow_upward" size={18} />
              </button>
              <button
                type="button"
                title="Move down"
                disabled={zi === draft.zones.length - 1}
                onClick={() => {
                  const zones = draft.zones.slice();
                  [zones[zi + 1], zones[zi]] = [zones[zi], zones[zi + 1]];
                  setDraft({ ...draft, zones });
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-secondary disabled:opacity-30"
              >
                <Icon name="arrow_downward" size={18} />
              </button>
              <button
                type="button"
                title="Delete zone"
                disabled={draft.zones.length === 1}
                onClick={() =>
                  setDraft({ ...draft, zones: draft.zones.filter((_, i) => i !== zi) })
                }
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-200 text-red-600 disabled:opacity-30"
              >
                <Icon name="delete" size={18} />
              </button>
            </div>
          </div>

          <TranslatedNameField value={zone.name} onChange={(name) => setZone(zi, { ...zone, name })} />

          <label className="flex max-w-[220px] flex-col gap-1">
            <span className="text-xs font-semibold text-text">Shipping fee (৳)</span>
            <input
              type="number"
              min={0}
              step="1"
              className={inputStyle}
              value={zone.fee}
              onChange={(e) => setZone(zi, { ...zone, fee: Number(e.target.value) })}
            />
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-text">
              Districts in this zone ({zone.districts.length})
            </span>
            <div className="flex flex-col gap-3 rounded-md border border-border bg-surface-2 p-3">
              {Object.entries(BD_DISTRICTS_BY_DIVISION).map(([division, districts]) => (
                <div key={division} className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                    {division}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {districts.map((district) => {
                      const owner = claimedBy.get(district.toLowerCase());
                      const mine = owner === zi;
                      const takenByOther = owner !== undefined && owner !== zi;
                      return (
                        <button
                          key={district}
                          type="button"
                          disabled={takenByOther}
                          title={
                            takenByOther
                              ? `Already in zone ${(owner ?? 0) + 1}`
                              : undefined
                          }
                          onClick={() => toggleDistrict(zi, district)}
                          className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                            mine
                              ? "border-brand-500 bg-brand-50 font-semibold text-brand-500"
                              : takenByOther
                                ? "cursor-not-allowed border-border bg-surface text-muted/40"
                                : "border-border bg-surface text-text hover:bg-surface-2"
                          }`}
                        >
                          {district}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      ))}

      <div>
        <Button
          variant="ghost"
          disabled={draft.zones.length >= SHIPPING_ZONE_MAX}
          onClick={() => setDraft({ ...draft, zones: [...draft.zones, newZone()] })}
        >
          Add zone ({draft.zones.length}/{SHIPPING_ZONE_MAX})
        </Button>
      </div>

      <Card className="flex flex-col gap-4 p-5">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <Icon name="public" className="text-brand-500" size={20} />
          <div>
            <h3 className="text-sm font-bold text-text">Fallback rate</h3>
            <p className="text-xs text-muted">
              Charged for every district not assigned to a zone above.
            </p>
          </div>
        </div>
        <TranslatedNameField
          value={draft.fallback.name}
          onChange={(name) => setDraft({ ...draft, fallback: { ...draft.fallback, name } })}
        />
        <label className="flex max-w-[220px] flex-col gap-1">
          <span className="text-xs font-semibold text-text">Fallback fee (৳)</span>
          <input
            type="number"
            min={0}
            step="1"
            className={inputStyle}
            value={draft.fallback.fee}
            onChange={(e) =>
              setDraft({ ...draft, fallback: { ...draft.fallback, fee: Number(e.target.value) } })
            }
          />
        </label>
      </Card>
    </div>
  );
}
