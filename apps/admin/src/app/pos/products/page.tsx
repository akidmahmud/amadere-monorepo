"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import { taka } from "@/lib/pos-cart";
import { usePosContext } from "@/components/pos/PosContext";
import {
  EMPTY_STORE_PRODUCT,
  StoreProductForm,
  type StoreProductFields,
} from "@/components/pos/StoreProductForm";
import { PosSubPage, card, primaryBtn } from "@/components/pos/PosSubPage";

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

/** This store's own products — never on amadere.com, no website form needed. */
export default function PosProductsPage() {
  const { storeId, store } = usePosContext();
  const [editing, setEditing] = useState<{
    id: number | null;
    f: StoreProductFields;
  } | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["pos-products", storeId],
    queryFn: () => proxyFetch<Row[]>(`/admin/pos/products?storeId=${storeId}`),
    enabled: !!storeId,
  });

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
            onClick={() => setEditing({ id: null, f: EMPTY_STORE_PRODUCT })}
          >
            New product
          </button>
        </div>

        {editing && (
          <div className={card}>
            <StoreProductForm
              key={editing.id ?? "new"}
              id={editing.id}
              initial={editing.f}
              onDone={() => setEditing(null)}
              onCancel={() => setEditing(null)}
            />
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
