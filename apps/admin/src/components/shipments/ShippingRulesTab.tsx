"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Card, Icon } from "@amader/admin-ui";
import {
  BD_DISTRICTS_BY_DIVISION,
  SHIPPING_RULE_MAX,
  SHIPPING_RULE_TIER_MAX,
  STEADFAST_SHIPPING_RULES,
  quoteShippingRule,
  type ShippingRule,
  type ShippingRulesConfig,
} from "@amader/shared";
import {
  useShippingRules,
  useUpdateShippingRules,
} from "@/hooks/useShippingRules";

const inputStyle =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text transition-all focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";

function newRule(): ShippingRule {
  return {
    id: `rule-${Date.now().toString(36)}`,
    name: "New rule",
    deliveryType: "HOME",
    districts: [],
    tiers: [{ upToKg: 1, fee: 100 }],
    perKgFee: 20,
  };
}

/** Live preview of what the rules would charge, so a rate edit can be
 *  checked against the courier's own sheet without placing an order. */
function RuleCalculator({ config }: { config: ShippingRulesConfig }) {
  const [district, setDistrict] = useState("Dhaka");
  const [weight, setWeight] = useState("1");
  const [type, setType] = useState<"HOME" | "POINT">("HOME");

  const quote = useMemo(
    () =>
      quoteShippingRule(config, {
        district,
        weightKg: Number(weight) || 0,
        deliveryType: type,
      }),
    [config, district, weight, type],
  );

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <Icon name="calculate" className="text-brand-500" size={20} />
        <div>
          <h3 className="text-sm font-bold text-text">Rate calculator</h3>
          <p className="text-xs text-muted">
            Checks the rules below against a parcel. Nothing is saved.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-text">District</span>
          <select
            className={inputStyle}
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
          >
            {Object.values(BD_DISTRICTS_BY_DIVISION)
              .flat()
              .map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
          </select>
        </label>
        <label className="flex w-28 flex-col gap-1">
          <span className="text-xs font-semibold text-text">Weight (kg)</span>
          <input
            type="number"
            min={0}
            step="0.1"
            className={inputStyle}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-text">Delivery</span>
          <select
            className={inputStyle}
            value={type}
            onChange={(e) => setType(e.target.value as "HOME" | "POINT")}
          >
            <option value="HOME">Home delivery</option>
            <option value="POINT">Point (hub pickup)</option>
          </select>
        </label>
        <div className="rounded-md border border-border bg-surface-2 px-4 py-2">
          <p className="text-[11px] uppercase tracking-wide text-muted">Courier charge</p>
          <p className="text-lg font-bold text-text">
            {quote ? `৳${quote.amount}` : "No rule matches"}
          </p>
          {quote && <p className="text-[11px] text-muted">{quote.ruleName}</p>}
        </div>
      </div>
    </Card>
  );
}

export function ShippingRulesTab() {
  const { data, isLoading } = useShippingRules();
  const update = useUpdateShippingRules();
  const [draft, setDraft] = useState<ShippingRulesConfig | null>(null);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (data && !draft) setDraft(structuredClone(data));
  }, [data, draft]);

  if (isLoading || !draft) {
    return (
      <Card className="flex items-center gap-3 p-6 text-muted">
        <Icon name="progress_activity" className="animate-spin" size={22} />
        <span className="text-sm">Loading shipping rules…</span>
      </Card>
    );
  }

  const d = draft;

  function setRule(index: number, next: ShippingRule) {
    const rules = d.rules.slice();
    rules[index] = next;
    setDraft({ ...d, rules });
  }

  async function handleSave() {
    setSaveError(null);
    try {
      await update.mutateAsync(d);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Couldn't save shipping rules");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h3 className="text-base font-bold text-text">Shipping Rules</h3>
          <p className="text-xs text-muted">
            What the COURIER charges us per parcel, by district and weight. Pre-loaded
            with Steadfast&apos;s published rate card.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-xs font-semibold text-success">✓ Saved</span>}
          {saveError && (
            <span className="text-xs font-semibold text-red-600">{saveError}</span>
          )}
          <Button
            variant="ghost"
            onClick={() => setDraft(structuredClone(STEADFAST_SHIPPING_RULES))}
          >
            Reset to Steadfast rates
          </Button>
          <Button onClick={handleSave} disabled={update.isPending}>
            {update.isPending ? "Saving…" : "Save Rules"}
          </Button>
        </div>
      </Card>

      {/* The toggle the whole feature hangs on. Off by default: these rules
          are what the courier bills US, which is not automatically what the
          customer should pay. */}
      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="flex items-start gap-3">
          <Icon
            name={d.applyOnCheckout ? "toggle_on" : "toggle_off"}
            className={d.applyOnCheckout ? "text-brand-500" : "text-muted"}
            size={26}
          />
          <div>
            <p className="text-sm font-bold text-text">
              Charge these rules on the checkout page
            </p>
            <p className="max-w-2xl text-xs text-muted">
              {d.applyOnCheckout
                ? "ON — the storefront quotes the calculated rule amount. Shipping Rates zones are ignored while this is on."
                : "OFF — the storefront keeps quoting the assigned Shipping Rates zones. The rules still show as a suggestion in New Order and Order Manager."}
            </p>
          </div>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4 accent-brand-500"
            checked={d.applyOnCheckout}
            onChange={(e) => setDraft({ ...d, applyOnCheckout: e.target.checked })}
          />
          <span className="text-sm font-semibold text-text">
            {d.applyOnCheckout ? "On" : "Off"}
          </span>
        </label>
      </Card>

      <RuleCalculator config={d} />

      {d.rules.map((rule, ri) => (
        <Card key={rule.id} className="flex flex-col gap-4 p-5">
          <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
            <div className="flex flex-1 flex-wrap items-end gap-3">
              <label className="flex min-w-[240px] flex-1 flex-col gap-1">
                <span className="text-xs font-semibold text-text">Rule name</span>
                <input
                  className={inputStyle}
                  value={rule.name}
                  onChange={(e) => setRule(ri, { ...rule, name: e.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-text">Delivery type</span>
                <select
                  className={inputStyle}
                  value={rule.deliveryType}
                  onChange={(e) =>
                    setRule(ri, {
                      ...rule,
                      deliveryType: e.target.value as "HOME" | "POINT",
                    })
                  }
                >
                  <option value="HOME">Home delivery</option>
                  <option value="POINT">Point (hub pickup)</option>
                </select>
              </label>
              <label className="flex w-32 flex-col gap-1">
                <span className="text-xs font-semibold text-text">Extra ৳/kg</span>
                <input
                  type="number"
                  min={0}
                  step="1"
                  className={inputStyle}
                  value={rule.perKgFee}
                  onChange={(e) =>
                    setRule(ri, { ...rule, perKgFee: Number(e.target.value) })
                  }
                />
              </label>
            </div>
            <div className="flex items-center gap-1">
              {/* Order decides which rule wins when two list the same
                  district, so it has to be editable. */}
              <button
                type="button"
                title="Move up"
                disabled={ri === 0}
                onClick={() => {
                  const rules = d.rules.slice();
                  [rules[ri - 1], rules[ri]] = [rules[ri], rules[ri - 1]];
                  setDraft({ ...d, rules });
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-secondary disabled:opacity-30"
              >
                <Icon name="arrow_upward" size={18} />
              </button>
              <button
                type="button"
                title="Move down"
                disabled={ri === d.rules.length - 1}
                onClick={() => {
                  const rules = d.rules.slice();
                  [rules[ri + 1], rules[ri]] = [rules[ri], rules[ri + 1]];
                  setDraft({ ...d, rules });
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-secondary disabled:opacity-30"
              >
                <Icon name="arrow_downward" size={18} />
              </button>
              <button
                type="button"
                title="Delete rule"
                onClick={() =>
                  setDraft({ ...d, rules: d.rules.filter((_, i) => i !== ri) })
                }
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-200 text-red-600"
              >
                <Icon name="delete" size={18} />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-text">
              Weight bands ({rule.tiers.length})
            </span>
            <div className="flex flex-wrap gap-2">
              {rule.tiers.map((tier, ti) => (
                <div
                  key={ti}
                  className="flex items-end gap-2 rounded-md border border-border bg-surface-2 p-2"
                >
                  <label className="flex w-24 flex-col gap-1">
                    <span className="text-[11px] text-muted">Up to (kg)</span>
                    <input
                      type="number"
                      min={0}
                      step="0.1"
                      className={inputStyle}
                      value={tier.upToKg}
                      onChange={(e) => {
                        const tiers = rule.tiers.slice();
                        tiers[ti] = { ...tier, upToKg: Number(e.target.value) };
                        setRule(ri, { ...rule, tiers });
                      }}
                    />
                  </label>
                  <label className="flex w-24 flex-col gap-1">
                    <span className="text-[11px] text-muted">Charge (৳)</span>
                    <input
                      type="number"
                      min={0}
                      step="1"
                      className={inputStyle}
                      value={tier.fee}
                      onChange={(e) => {
                        const tiers = rule.tiers.slice();
                        tiers[ti] = { ...tier, fee: Number(e.target.value) };
                        setRule(ri, { ...rule, tiers });
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    title="Remove band"
                    disabled={rule.tiers.length === 1}
                    onClick={() =>
                      setRule(ri, {
                        ...rule,
                        tiers: rule.tiers.filter((_, i) => i !== ti),
                      })
                    }
                    className="mb-1 inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-200 text-red-600 disabled:opacity-30"
                  >
                    <Icon name="close" size={16} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                disabled={rule.tiers.length >= SHIPPING_RULE_TIER_MAX}
                onClick={() => {
                  const last = rule.tiers[rule.tiers.length - 1];
                  setRule(ri, {
                    ...rule,
                    tiers: [
                      ...rule.tiers,
                      { upToKg: (last?.upToKg ?? 0) + 1, fee: last?.fee ?? 0 },
                    ],
                  });
                }}
                className="self-center rounded-md border border-dashed border-border px-3 py-2 text-xs font-semibold text-secondary disabled:opacity-30"
              >
                + Add band
              </button>
            </div>
            <p className="text-[11px] text-muted">
              Heavier than the last band: last band&apos;s charge + ৳{rule.perKgFee} per
              extra kg, rounded up to a whole kg.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-text">
              {rule.districts.length === 0
                ? "Districts — none selected, so this is the catch-all for every district no earlier rule claims"
                : `Districts (${rule.districts.length})`}
            </span>
            <div className="flex max-h-64 flex-col gap-3 overflow-y-auto rounded-md border border-border bg-surface-2 p-3">
              {Object.entries(BD_DISTRICTS_BY_DIVISION).map(([division, districts]) => (
                <div key={division} className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                    {division}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {districts.map((district) => {
                      const mine = rule.districts.some(
                        (x) => x.toLowerCase() === district.toLowerCase(),
                      );
                      return (
                        <button
                          key={district}
                          type="button"
                          onClick={() =>
                            setRule(ri, {
                              ...rule,
                              districts: mine
                                ? rule.districts.filter(
                                    (x) => x.toLowerCase() !== district.toLowerCase(),
                                  )
                                : [...rule.districts, district],
                            })
                          }
                          className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                            mine
                              ? "border-brand-500 bg-brand-50 font-semibold text-brand-500"
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
          disabled={d.rules.length >= SHIPPING_RULE_MAX}
          onClick={() => setDraft({ ...d, rules: [...d.rules, newRule()] })}
        >
          Add rule ({d.rules.length}/{SHIPPING_RULE_MAX})
        </Button>
      </div>
    </div>
  );
}
