"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Icon } from "@amader/admin-ui";
import { proxyFetch } from "@/lib/api/proxy-client";
import { confirmDialog } from "@/components/PosConfirm";
import { useToast } from "@/components/ToastProvider";

type Row = {
  id: number;
  name: string;
  store: string | null;
  deletedAt: string;
  sku: string | null;
  barcode: string | null;
  variants: { id: number; sku: string | null; barcode: string | null }[];
};

/**
 * Deleted products still hold their SKU / barcode, so a new product can't
 * reuse them. Freeing clears the codes; the product stays in the Trash.
 */
export function PosDeletedCodesTab() {
  const [q, setQ] = useState("");
  const qc = useQueryClient();
  const toast = useToast();
  const { data = [], isLoading } = useQuery({
    queryKey: ["deleted-codes", q.trim()],
    queryFn: () =>
      proxyFetch<Row[]>(
        `/admin/pos/settings/deleted-codes${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`,
      ),
  });
  const free = useMutation({
    mutationFn: (id: number) =>
      proxyFetch(`/admin/pos/settings/deleted-codes/${id}/free`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deleted-codes"] });
      toast.push("Freed — the SKU / barcode can be used again", "success");
    },
    onError: (e) => toast.push((e as Error).message),
  });
  const ask = async (r: Row) => {
    const codes = [r.sku, r.barcode, ...r.variants.flatMap((v) => [v.sku, v.barcode])]
      .filter(Boolean)
      .join(", ");
    if (
      await confirmDialog({
        title: "Free these codes?",
        message: `${codes} will be removed from the deleted product "${r.name}" so another product can use them. The product stays in the Trash.`,
        confirmLabel: "Free",
      })
    )
      free.mutate(r.id);
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <h2 className="text-lg font-bold">Deleted SKUs &amp; barcodes</h2>
      <p className="mb-4 text-sm text-gray-500">
        SKUs and barcodes still held by deleted products (website and shops).
        Free one to use it on a new product; the deleted product stays in the
        Trash.
      </p>
      <div>
        <label className="mb-3 flex h-10 items-center gap-2 rounded-xl border border-gray-200 px-3">
          <Icon name="search" size={18} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search SKU, barcode or name"
            className="flex-1 bg-transparent text-sm outline-none"
          />
        </label>
        {isLoading ? (
          <p className="py-6 text-center text-sm text-gray-500">Loading…</p>
        ) : data.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">
            No deleted product is holding a SKU or barcode.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                <th className="py-2">Product</th>
                <th>SKU</th>
                <th>Barcode</th>
                <th>Deleted</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id} className="border-b border-gray-100 align-top">
                  <td className="py-2">
                    <div className="font-semibold">{r.name}</div>
                    {r.store && <div className="text-xs text-gray-500">Shop: {r.store}</div>}
                    {r.variants.length > 0 && (
                      <div className="text-xs text-gray-500">
                        Variants:{" "}
                        {r.variants
                          .map((v) => [v.sku, v.barcode].filter(Boolean).join(" / "))
                          .join(", ")}
                      </div>
                    )}
                  </td>
                  <td className="py-2 font-mono">{r.sku ?? "—"}</td>
                  <td className="py-2 font-mono">{r.barcode ?? "—"}</td>
                  <td className="py-2">{new Date(r.deletedAt).toLocaleDateString("en-GB")}</td>
                  <td className="py-2 text-right">
                    <button
                      className="h-9 rounded-lg border border-gray-200 px-3 text-sm font-semibold hover:bg-emerald-50 disabled:opacity-40"
                      disabled={free.isPending}
                      onClick={() => ask(r)}
                    >
                      Free
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
