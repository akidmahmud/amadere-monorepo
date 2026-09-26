"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ToastProvider";
import { proxyFetch } from "@/lib/api/proxy-client";
import { usePosCategories } from "@/hooks/usePos";
import { taka } from "@/lib/pos-cart";
import { usePosContext } from "@/components/pos/PosContext";
import {
  PosSubPage,
  card,
  input,
  primaryBtn,
} from "@/components/pos/PosSubPage";

type Row = {
  id: number;
  name: string;
  sku: string | null;
  barcode: string | null;
  price: string | null;
  salePrice: string | null;
  costPerItem: string | null;
  hasVariants: boolean;
  categoryId: number | null;
};

type Form = {
  name: string;
  price: string;
  salePrice: string;
  costPerItem: string;
  sku: string;
  barcode: string;
  categoryId: string;
};

const empty: Form = {
  name: "",
  price: "",
  salePrice: "",
  costPerItem: "",
  sku: "",
  barcode: "",
  categoryId: "",
};

const num = (s: string) => (s.trim() === "" ? null : Number(s));

/** This store's own products — never on amadere.com, no website form needed. */
export default function PosProductsPage() {
  const { storeId, store } = usePosContext();
  const toast = useToast();
  const qc = useQueryClient();
  const { data: cats = [] } = usePosCategories();
  const [editing, setEditing] = useState<{ id: number | null; f: Form } | null>(
    null,
  );

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["pos-products", storeId],
    queryFn: () => proxyFetch<Row[]>(`/admin/pos/products?storeId=${storeId}`),
    enabled: !!storeId,
  });

  const save = useMutation({
    mutationFn: ({ id, f }: { id: number | null; f: Form }) =>
      proxyFetch(
        `/admin/pos/products${id ? `/${id}` : ""}?storeId=${storeId}`,
        {
          method: id ? "PUT" : "POST",
          body: JSON.stringify({
            name: f.name,
            price: Number(f.price),
            salePrice: num(f.salePrice),
            costPerItem: num(f.costPerItem),
            sku: f.sku,
            barcode: f.barcode,
            categoryId: f.categoryId ? Number(f.categoryId) : null,
          }),
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pos-products"] });
      qc.invalidateQueries({ queryKey: ["pos-catalog"] });
      setEditing(null);
      toast.push("Product saved", "success");
    },
    onError: (e) => toast.push(e.message),
  });

  const f = editing?.f;
  const set = (k: keyof Form, v: string) =>
    setEditing((e) => e && { ...e, f: { ...e.f, [k]: v } });
  const valid =
    !!f && f.name.trim() !== "" && f.price !== "" && Number(f.price) >= 0;

  return (
    <PosSubPage title="Store products" permission="pos.store_products">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-600">
            Products sold only at <b>{store?.name}</b>. They never appear on the
            website. Add quantity with{" "}
            <Link href="/pos/stock-in" className="font-semibold text-[#1d7a46]">
              Stock in
            </Link>
            .
          </p>
          <button
            className={primaryBtn}
            onClick={() => setEditing({ id: null, f: empty })}
          >
            New product
          </button>
        </div>

        {f && (
          <div className={`${card} grid gap-3 sm:grid-cols-2`}>
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-xs font-bold">Name *</span>
              <input
                className={input}
                value={f.name}
                onChange={(e) => set("name", e.target.value)}
                autoFocus
              />
            </label>
            {(
              [
                ["price", "Price (৳) *"],
                ["salePrice", "Sale price (৳)"],
                ["costPerItem", "Cost (৳, for profit)"],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="flex flex-col gap-1">
                <span className="text-xs font-bold">{label}</span>
                <input
                  className={input}
                  inputMode="decimal"
                  value={f[k]}
                  onChange={(e) => set(k, e.target.value)}
                />
              </label>
            ))}
            <label className="flex flex-col gap-1">
              <span className="text-xs font-bold">Category</span>
              <select
                className={input}
                value={f.categoryId}
                onChange={(e) => set("categoryId", e.target.value)}
              >
                <option value="">None</option>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-bold">SKU</span>
              <input
                className={input}
                value={f.sku}
                onChange={(e) => set("sku", e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-bold">
                Barcode (blank = print one from Barcode labels)
              </span>
              <input
                className={input}
                value={f.barcode}
                onChange={(e) => set("barcode", e.target.value)}
              />
            </label>
            <div className="flex gap-2 sm:col-span-2">
              <button
                className={primaryBtn}
                disabled={!valid || save.isPending}
                onClick={() => editing && save.mutate(editing)}
              >
                {save.isPending ? "Saving…" : "Save"}
              </button>
              <button
                className="h-10 rounded-lg border border-gray-200 px-4 text-sm font-semibold"
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4">SKU / Barcode</th>
                <th className="px-4">Price</th>
                <th className="px-4">Cost</th>
                <th className="px-4" />
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-gray-500"
                  >
                    Loading…
                  </td>
                </tr>
              )}
              {!isLoading && rows.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-gray-500"
                  >
                    No store-only products yet.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-semibold">{r.name}</td>
                  <td className="px-4 font-mono text-xs">
                    {r.sku ?? "—"} / {r.barcode ?? "—"}
                  </td>
                  <td className="px-4">
                    {r.salePrice ? (
                      <>
                        {taka(Number(r.salePrice))}{" "}
                        <s className="text-gray-400">{taka(Number(r.price))}</s>
                      </>
                    ) : r.price ? (
                      taka(Number(r.price))
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4">
                    {r.costPerItem ? taka(Number(r.costPerItem)) : "—"}
                  </td>
                  <td className="px-4 text-right">
                    {r.hasVariants ? (
                      <span className="text-xs text-gray-500">
                        Has variants — edit in Products
                      </span>
                    ) : (
                      <button
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold"
                        onClick={() =>
                          setEditing({
                            id: r.id,
                            f: {
                              name: r.name,
                              price: r.price ?? "",
                              salePrice: r.salePrice ?? "",
                              costPerItem: r.costPerItem ?? "",
                              sku: r.sku ?? "",
                              barcode: r.barcode ?? "",
                              categoryId: r.categoryId
                                ? String(r.categoryId)
                                : "",
                            },
                          })
                        }
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PosSubPage>
  );
}
