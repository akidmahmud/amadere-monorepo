"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@amader/admin-ui";
import { usePosCatalog } from "@/hooks/usePos";
import { taka, type PosProduct } from "@/lib/pos-cart";
import { usePosContext } from "./PosContext";
import { useScanner } from "./useScanner";

/** Header + permission gate shared by every /pos/* back-office page. */
export function PosSubPage({
  title,
  permission,
  children,
}: {
  title: string;
  permission: string;
  children: React.ReactNode;
}) {
  const { can, allStores, stores, storeId, setStoreId, store } =
    usePosContext();
  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-5 py-3">
        <Link
          href="/pos"
          className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-semibold text-[#1d7a46] hover:bg-emerald-50"
        >
          <Icon name="arrow_back" size={20} /> POS
        </Link>
        <h1 className="text-xl font-extrabold">{title}</h1>
        <span className="text-sm text-gray-500">{store?.name}</span>
        {allStores && (
          <select
            value={storeId ?? ""}
            onChange={(e) => setStoreId(Number(e.target.value))}
            className="ml-auto h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold"
            aria-label="Store"
          >
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
      </header>
      <main className="mx-auto max-w-5xl p-5">
        {can(permission) ? (
          children
        ) : (
          <div className="py-16 text-center text-gray-600">
            You don&apos;t have permission for this page.
          </div>
        )}
      </main>
    </div>
  );
}

export const card = "rounded-2xl border border-gray-100 bg-white p-5 shadow-sm";
export const input =
  "h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#1d7a46]";
export const primaryBtn =
  "h-10 rounded-lg bg-[#1d7a46] px-5 text-sm font-bold text-white hover:bg-[#186a3c] disabled:cursor-not-allowed disabled:opacity-50";

/** Search-or-scan a product at the current store. */
export function ProductPicker({
  onPick,
  placeholder,
}: {
  onPick: (p: PosProduct) => void;
  placeholder?: string;
}) {
  const { storeId } = usePosContext();
  const [q, setQ] = useState("");
  const { data = [], isFetching } = usePosCatalog(
    storeId,
    q.trim(),
    undefined,
    "name",
  );
  const pick = (p: PosProduct) => {
    onPick(p);
    setQ("");
  };
  useScanner((code) => {
    const hit = data.find((p) => p.barcode === code || p.sku === code);
    if (hit) pick(hit);
    else setQ(code);
  });
  return (
    <div className="relative">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder ?? "Scan or search a product…"}
        lang="en"
        className={`${input} w-full`}
      />
      {q.trim().length >= 2 && (
        <div className="absolute inset-x-0 top-11 z-20 max-h-80 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
          {isFetching && data.length === 0 && (
            <div className="px-3 py-2 text-sm text-gray-500">Searching…</div>
          )}
          {!isFetching && data.length === 0 && (
            <div className="px-3 py-2 text-sm text-gray-500">No match</div>
          )}
          {data.slice(0, 20).map((p) => (
            <button
              key={`${p.productId}:${p.variantId ?? 0}`}
              onClick={() => pick(p)}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-gray-50"
            >
              <span>
                <b>{p.name}</b>{" "}
                {p.variantLabel && (
                  <span className="text-gray-500">{p.variantLabel}</span>
                )}
                <span className="ml-2 text-xs text-gray-400">{p.sku}</span>
              </span>
              <span className="shrink-0 text-xs text-gray-500">
                {taka(p.salePrice ?? p.price)} · stock{" "}
                {p.stock >= 9999 ? "∞" : p.stock}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export const productLabel = (p: {
  name: string;
  variantLabel?: string | null;
}) => (p.variantLabel ? `${p.name} (${p.variantLabel})` : p.name);
