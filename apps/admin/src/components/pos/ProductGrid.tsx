"use client";

import { useState } from "react";
import { Icon } from "@amader/admin-ui";
import { usePosContext } from "./PosContext";
import { EMPTY_STORE_PRODUCT, StoreProductForm } from "./StoreProductForm";
import { StorePriceDialog } from "./StorePriceDialog";
import { taka, type PosProduct } from "@/lib/pos-cart";

export const LOW_STOCK = 10; // same threshold as the backend's POS_LOW_STOCK

// Chip icons by category name; anything unmatched gets a generic tag.
const CATEGORY_ICONS: [RegExp, string][] = [
  [/beverage|drink|juice|water/i, "local_drink"],
  [/snack|chip|biscuit/i, "cookie"],
  [/grocer|rice|atta|flour|oil|dal/i, "shopping_cart"],
  [/personal|care|beauty|soap|shampoo/i, "sanitizer"],
  [/household|clean|home/i, "home"],
  [/electronic|bulb|battery/i, "devices"],
  [/stationer|paper|pen|book/i, "menu_book"],
  [/honey|ghee|dairy|milk/i, "egg"],
];
const iconFor = (name: string) =>
  CATEGORY_ICONS.find(([re]) => re.test(name))?.[1] ?? "sell";

export function CategoryChips({
  categories,
  value,
  onChange,
}: {
  categories: { id: number; name: string }[];
  value?: number;
  onChange: (v?: number) => void;
}) {
  const chip = (active: boolean) =>
    `flex h-12 shrink-0 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-colors ${
      active
        ? "border-[#1d7a46] bg-[#1d7a46] text-white"
        : "border-gray-200 bg-white text-gray-800 hover:border-gray-300"
    }`;
  return (
    <div className="flex shrink-0 gap-2 overflow-x-auto pb-1">
      <button
        className={chip(value === undefined)}
        onClick={() => onChange(undefined)}
      >
        <Icon name="grid_view" size={20} /> All Products
      </button>
      {categories.map((c) => (
        <button
          key={c.id}
          className={chip(value === c.id)}
          onClick={() => onChange(c.id)}
        >
          <Icon name={iconFor(c.name)} size={20} /> {c.name}
        </button>
      ))}
    </div>
  );
}

export function StatCards({
  stats,
  activeCustomer,
}: {
  stats?: { totalProducts: number; lowStock: number; todaySales: string };
  activeCustomer: number;
}) {
  const cards = [
    {
      label: "Total Products",
      value: stats ? String(stats.totalProducts) : "—",
      icon: "deployed_code",
      tone: "bg-emerald-50 text-[#1d7a46]",
    },
    {
      label: "Low Stock Items",
      value: stats ? String(stats.lowStock) : "—",
      icon: "warning",
      tone: "bg-red-50 text-red-500",
    },
    {
      label: "Today's Sales",
      value: stats ? taka(stats.todaySales) : "—",
      icon: "bar_chart",
      tone: "bg-emerald-50 text-[#1d7a46]",
    },
    {
      label: "Active Customer",
      value: String(activeCustomer),
      icon: "person",
      tone: "bg-emerald-50 text-[#1d7a46]",
    },
  ];
  return (
    <div className="grid shrink-0 grid-cols-2 gap-4 xl:grid-cols-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
        >
          <div>
            <div className="text-sm text-gray-600">{c.label}</div>
            <div className="mt-2 text-2xl font-extrabold">{c.value}</div>
          </div>
          <span
            className={`grid h-12 w-12 place-items-center rounded-full ${c.tone}`}
          >
            <Icon name={c.icon} size={24} />
          </span>
        </div>
      ))}
    </div>
  );
}

function StockLine({ stock }: { stock: number }) {
  if (stock <= 0) return <Line dot="bg-red-500" text="Out of Stock" />;
  if (stock >= 9999) return <Line dot="bg-emerald-500" text="In Stock" />;
  if (stock <= LOW_STOCK)
    return <Line dot="bg-orange-500" text={`Low Stock (${stock})`} />;
  return <Line dot="bg-emerald-500" text={`In Stock (${stock})`} />;
}
function Line({ dot, text }: { dot: string; text: string }) {
  return (
    <div className="flex shrink-0 items-center gap-2 whitespace-nowrap text-xs text-gray-600">
      <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} /> {text}
    </div>
  );
}

function Price({ p, end }: { p: PosProduct; end?: boolean }) {
  return (
    <div
      className={`flex items-baseline gap-2 whitespace-nowrap ${end ? "justify-end" : ""}`}
    >
      <span className="text-base font-extrabold">
        {taka(p.salePrice ?? p.price)}
      </span>
      {p.salePrice && (
        <span className="text-xs text-gray-400 line-through">
          {taka(p.price)}
        </span>
      )}
      {p.storePrice && (
        <span
          className="rounded bg-sky-100 px-1 text-[10px] font-bold text-sky-800"
          title="This store's own price"
        >
          Store
        </span>
      )}
    </div>
  );
}

export function ProductGrid({
  items,
  loading,
  sort,
  onSort,
  view,
  onView,
  onAdd,
}: {
  items: PosProduct[];
  loading: boolean;
  sort: string;
  onSort: (s: string) => void;
  view: "grid" | "list";
  onView: (v: "grid" | "list") => void;
  onAdd: (p: PosProduct) => void;
}) {
  const toggle = (active: boolean) =>
    `grid h-10 w-10 place-items-center rounded-lg ${active ? "bg-[#1d7a46] text-white" : "text-gray-600 hover:bg-gray-100"}`;
  const { can, store } = usePosContext();
  const [adding, setAdding] = useState(false);
  const [pricing, setPricing] = useState<PosProduct | null>(null);
  const canPrice = can("pos.prices");
  const pencil = (p: PosProduct, cls: string) =>
    canPrice && (
      <button
        onClick={() => setPricing(p)}
        className={`grid h-8 w-8 place-items-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-[#1d7a46] ${cls}`}
        aria-label={`Edit price of ${p.name}`}
        title="Edit this store's price"
      >
        <Icon name="edit" size={17} />
      </button>
    );
  return (
    <section>
      {pricing && (
        <StorePriceDialog p={pricing} onClose={() => setPricing(null)} />
      )}
      {adding && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="New store product"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-bold">New product</h2>
            <p className="mb-4 text-xs text-gray-500">
              Sold only at {store?.name}; never shown on the website.
            </p>
            <StoreProductForm
              id={null}
              initial={EMPTY_STORE_PRODUCT}
              onDone={() => setAdding(false)}
              onCancel={() => setAdding(false)}
            />
          </div>
        </div>
      )}
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-2xl font-extrabold">Products</h2>
        <div className="flex items-center gap-2">
          {can("pos.store_products") && (
            <button
              className="flex h-10 items-center gap-1 rounded-lg bg-[#1d7a46] px-3 text-sm font-bold text-white hover:bg-[#186a3c]"
              onClick={() => setAdding(true)}
            >
              <Icon name="add" size={18} /> New product
            </button>
          )}
          <select
            value={sort}
            onChange={(e) => onSort(e.target.value)}
            className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm"
            aria-label="Sort"
          >
            <option value="popular">Sort: Popular</option>
            <option value="name">Sort: Name</option>
            <option value="price">Sort: Price</option>
          </select>
          <button
            className={toggle(view === "grid")}
            onClick={() => onView("grid")}
            aria-label="Grid view"
          >
            <Icon name="grid_view" size={20} />
          </button>
          <button
            className={toggle(view === "list")}
            onClick={() => onView("list")}
            aria-label="List view"
          >
            <Icon name="list" size={20} />
          </button>
        </div>
      </div>

      {loading && (
        <div className="py-10 text-center text-gray-500">Loading products…</div>
      )}
      {!loading && items.length === 0 && (
        <div className="py-10 text-center text-gray-500">No products found</div>
      )}

      {view === "grid" ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-4">
          {items.map((p) => (
            <div
              key={`${p.productId}:${p.variantId ?? 0}`}
              className="flex flex-col rounded-2xl border border-gray-100 bg-white p-3.5 shadow-sm"
            >
              <div className="relative mb-3 grid h-28 place-items-center">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.imageUrl}
                    alt=""
                    className="max-h-28 max-w-full object-contain"
                    loading="lazy"
                  />
                ) : (
                  <Icon name="image" size={40} className="text-gray-300" />
                )}
                {p.storeOnly && (
                  <span className="absolute left-0 top-0 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                    Store item
                  </span>
                )}
                {pencil(p, "absolute right-0 top-0 bg-white/90")}
              </div>
              <div className="line-clamp-2 text-sm font-semibold leading-snug">
                {p.name}
              </div>
              <div className="mb-1 h-4 text-xs text-gray-500">
                {p.variantLabel ?? ""}
              </div>
              <Price p={p} />
              <div className="mb-3 mt-1">
                <StockLine stock={p.stock} />
              </div>
              <button
                disabled={p.stock <= 0}
                onClick={() => onAdd(p)}
                className="mt-auto flex h-9 items-center justify-center gap-1 rounded-lg bg-emerald-50 text-sm font-bold text-[#1d7a46] hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Icon name="add" size={18} /> Add
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="divide-y divide-gray-100 rounded-2xl border border-gray-100 bg-white">
          {items.map((p) => (
            <div
              key={`${p.productId}:${p.variantId ?? 0}`}
              className="flex items-center gap-4 px-4 py-2.5"
            >
              <div className="grid h-12 w-12 shrink-0 place-items-center">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.imageUrl}
                    alt=""
                    className="max-h-12 max-w-full object-contain"
                    loading="lazy"
                  />
                ) : (
                  <Icon name="image" size={24} className="text-gray-300" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">
                  {p.name}{" "}
                  {p.variantLabel && (
                    <span className="text-gray-500">· {p.variantLabel}</span>
                  )}
                </div>
                <div className="text-xs text-gray-500">{p.sku ?? ""}</div>
              </div>
              <StockLine stock={p.stock} />
              <div className="w-36 shrink-0">
                <Price p={p} end />
              </div>
              {pencil(p, "shrink-0")}
              <button
                disabled={p.stock <= 0}
                onClick={() => onAdd(p)}
                className="flex h-9 items-center gap-1 rounded-lg bg-emerald-50 px-4 text-sm font-bold text-[#1d7a46] hover:bg-emerald-100 disabled:opacity-40"
              >
                <Icon name="add" size={18} /> Add
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
