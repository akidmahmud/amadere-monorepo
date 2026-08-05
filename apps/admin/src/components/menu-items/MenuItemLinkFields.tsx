"use client";

import { useState } from "react";
import { usePickerCategories, usePickerCollections } from "@/hooks/usePickers";

const inputClass = "h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500";

type LinkType = "CATEGORY" | "COLLECTION" | "CUSTOM";

function linkTypeFor(href: string): LinkType {
  if (href.startsWith("/categories/")) return "CATEGORY";
  if (href.startsWith("/collections/")) return "COLLECTION";
  return "CUSTOM";
}

export function MenuItemLinkFields({
  href,
  onHrefChange,
  onLabelSuggestion,
}: {
  href: string;
  onHrefChange: (href: string) => void;
  /** Fired with the picked category/collection's name — callers typically
   * use this to fill an empty Label field, matching Shopify's "auto-fills
   * but stays editable" behavior. */
  onLabelSuggestion?: (label: string) => void;
}) {
  const { data: categories } = usePickerCategories();
  const { data: collections } = usePickerCollections();
  const [linkType, setLinkType] = useState<LinkType>(() => linkTypeFor(href));

  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-xs font-semibold text-secondary">Links to</span>
      <div className="flex gap-4 text-sm text-text">
        {(["CATEGORY", "COLLECTION", "CUSTOM"] as const).map((type) => (
          <label key={type} className="flex items-center gap-1.5">
            <input type="radio" checked={linkType === type} onChange={() => setLinkType(type)} className="accent-brand-500" />
            {type === "CATEGORY" ? "Category" : type === "COLLECTION" ? "Collection" : "Custom URL"}
          </label>
        ))}
      </div>

      {linkType === "CATEGORY" && (
        <select
          required
          value={href.startsWith("/categories/") ? href.replace("/categories/", "") : ""}
          onChange={(e) => {
            const picked = categories?.find((c) => c.slug === e.target.value);
            if (!picked) return;
            onHrefChange(`/categories/${picked.slug}`);
            onLabelSuggestion?.(picked.label);
          }}
          className={inputClass}
        >
          <option value="">Select a category…</option>
          {categories?.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.label}
            </option>
          ))}
        </select>
      )}

      {linkType === "COLLECTION" && (
        <select
          required
          value={href.startsWith("/collections/") ? href.replace("/collections/", "") : ""}
          onChange={(e) => {
            const picked = collections?.find((c) => c.slug === e.target.value);
            if (!picked) return;
            onHrefChange(`/collections/${picked.slug}`);
            onLabelSuggestion?.(picked.label);
          }}
          className={inputClass}
        >
          <option value="">Select a collection…</option>
          {collections?.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.label}
            </option>
          ))}
        </select>
      )}

      {linkType === "CUSTOM" && (
        <input
          required
          value={href}
          onChange={(e) => onHrefChange(e.target.value)}
          placeholder="/pages/about-us or https://…"
          className={inputClass}
        />
      )}
    </div>
  );
}
