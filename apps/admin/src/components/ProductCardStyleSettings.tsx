"use client";

import { Card } from "@amader/admin-ui";
import { useSettings, useUpsertSetting } from "@/hooks/useSettings";

const PRODUCT_CARD_STYLE_KEY = "product_card_style";

const STYLES = [
  {
    value: "ONE",
    label: "Style 1 (Default)",
    description: "The site's original card — 2-line title, modal pack picker.",
  },
  {
    value: "TWO",
    label: "Style 2 (Organic India style)",
    description: "Rounded-corner card with a pill-shaped variant dropdown and Add to Cart button, single-line title.",
  },
] as const;

// Self-contained card, same pattern as TwoFactorSettings — its own read/write
// against the generic key/value Setting store (key: product_card_style,
// value: { style: "ONE" | "TWO" }) instead of the raw JSON editor below it,
// since a 2-option toggle deserves a real control. Drives which product card
// component (@amader/ui's ProductCard vs ProductCardTwo) the storefront
// renders everywhere a product card appears — see SiteProductCard.
export function ProductCardStyleSettings() {
  const { data: settings } = useSettings();
  const upsert = useUpsertSetting();

  const current = settings?.find((s) => s.key === PRODUCT_CARD_STYLE_KEY);
  const currentValue =
    current?.value && typeof current.value === "object" && (current.value as { style?: unknown }).style === "TWO"
      ? "TWO"
      : "ONE";

  return (
    <Card>
      <h3 className="font-ui text-sm font-semibold text-text">Product card style</h3>
      <p className="mt-1 text-xs text-muted">
        Applies site-wide — homepage, search, category/collection listings, and product page related/cross-sell rows.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        {STYLES.map((s) => (
          <button
            key={s.value}
            type="button"
            disabled={upsert.isPending}
            onClick={() => upsert.mutate({ key: PRODUCT_CARD_STYLE_KEY, value: { style: s.value } })}
            className={`flex-1 rounded-inner border p-3 text-left transition-colors ${
              currentValue === s.value
                ? "border-brand-500 bg-brand-50"
                : "border-border bg-surface hover:bg-surface-2"
            }`}
          >
            <div className="font-ui text-sm font-semibold text-text">{s.label}</div>
            <p className="mt-1 text-xs text-muted">{s.description}</p>
          </button>
        ))}
      </div>
    </Card>
  );
}
