"use client";

export const PRODUCT_TABS = ["General", "Media", "Inventory", "Variants", "Shipping", "SEO", "Analytics", "Activity Logs"] as const;
export type ProductTab = (typeof PRODUCT_TABS)[number];

export function ProductTabs({ active, onChange }: { active: ProductTab; onChange: (tab: ProductTab) => void }) {
  return (
    <div className="flex gap-6 overflow-x-auto border-b border-border">
      {PRODUCT_TABS.map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => onChange(tab)}
          className={`whitespace-nowrap border-b-[2.5px] px-0.5 py-2.5 text-[0.8rem] font-bold transition-colors ${
            active === tab ? "border-brand-500 text-brand-500" : "border-transparent text-secondary hover:text-text"
          }`}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
