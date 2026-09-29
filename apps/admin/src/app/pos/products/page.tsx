"use client";

import { fromBase, unitFor, formatWeight } from "@/lib/pos-weight";
import { confirmDialog, promptDialog } from "@/components/PosConfirm";
import { StorePriceDialog } from "@/components/pos/StorePriceDialog";
import { usePosCatalog, usePosLabelSize } from "@/hooks/usePos";
import { barcodeSvg } from "@/lib/pos-barcode";
import {
  DEFAULT_LABEL_SIZE,
  buildLabelSheet,
  printLabelSheet,
} from "@/lib/pos-labels";
import Link from "next/link";
import { useState } from "react";
import { Icon } from "@amader/admin-ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ToastProvider";
import { proxyFetch } from "@/lib/api/proxy-client";
import { taka, lineKey, type PosProduct } from "@/lib/pos-cart";
import { usePosContext } from "@/components/pos/PosContext";
import {
  EMPTY_STORE_PRODUCT,
  StoreProductForm,
  type StoreProductFields,
} from "@/components/pos/StoreProductForm";
import { PosSubPage, primaryBtn } from "@/components/pos/PosSubPage";
import {
  Pager,
  RowMenu,
  Thumb,
  toolbarInput,
  usePaged,
} from "@/components/pos/PosTableKit";

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
  mediaId: number | null;
  imageUrl: string | null;
  weightKg: string | null;
  weightUnit: string | null;
};

const th = "px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500";

const editFields = (r: Row): StoreProductFields => {
  const n = Number(r.weightKg);
  const u = unitFor(n, r.weightUnit);
  return {
    name: r.name,
    price: r.price ?? "",
    salePrice: r.salePrice ?? "",
    costPerItem: r.costPerItem ?? "",
    sku: r.sku ?? "",
    barcode: r.barcode ?? "",
    categoryId: r.categoryId ? String(r.categoryId) : "",
    ...(r.weightKg && n > 0
      ? { weightValue: String(fromBase(n, u)), weightUnit: u }
      : { weightValue: "", weightUnit: "g" as const }),
  };
};

/**
 * Everything sold at this store: shared catalogue products (this store's
 * price/name/weight via the pencil popup) and the store's own products
 * (never on amadere.com). Labels print from here too.
 */
export default function PosProductsPage() {
  const { storeId, store, can } = usePosContext();
  const labelSize = usePosLabelSize().data ?? DEFAULT_LABEL_SIZE;
  const [pricing, setPricing] = useState<PosProduct | null>(null);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [printing, setPrinting] = useState(false);
  const [kind, setKind] = useState<"all" | "own" | "shared">("all");
  const toast = useToast();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [view, setView] = useState<"products" | "deleted" | "removed">(
    "products",
  );
  const { data: hidden = [] } = useQuery({
    queryKey: ["pos-hidden", storeId],
    queryFn: () =>
      proxyFetch<{ productId: number; name: string; sku: string | null }[]>(
        `/admin/pos/products/hidden?storeId=${storeId}`,
      ),
    enabled: !!storeId,
  });
  const { data: deleted = [] } = useQuery({
    queryKey: ["pos-products-deleted", storeId],
    queryFn: () =>
      proxyFetch<
        { id: number; name: string; sku: string | null; deletedAt: string }[]
      >(`/admin/pos/products/deleted?storeId=${storeId}`),
    enabled: !!storeId,
  });
  const [now] = useState(() => Date.now());
  const restore = useMutation({
    mutationFn: (id: number) =>
      proxyFetch(`/admin/pos/products/${id}/restore?storeId=${storeId}`, {
        method: "POST",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pos-products"] });
      qc.invalidateQueries({ queryKey: ["pos-products-deleted"] });
      qc.invalidateQueries({ queryKey: ["pos-catalog"] });
      toast.push("Product restored — back on the till", "success");
    },
    onError: (e) => toast.push(e.message),
  });
  const unhide = useMutation({
    mutationFn: (id: number) =>
      proxyFetch(`/admin/pos/products/${id}/hide?storeId=${storeId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pos-hidden"] });
      qc.invalidateQueries({ queryKey: ["pos-catalog"] });
      toast.push("Back on this store's till", "success");
    },
    onError: (e) => toast.push(e.message),
  });
  const del = useMutation({
    mutationFn: (p: PosProduct) =>
      p.storeOnly
        ? proxyFetch(`/admin/pos/products/${p.productId}?storeId=${storeId}`, {
            method: "DELETE",
          })
        : proxyFetch(
            `/admin/pos/products/${p.productId}/hide?storeId=${storeId}`,
            { method: "POST" },
          ),
    onSuccess: (_r, p) => {
      qc.invalidateQueries({ queryKey: ["pos-products"] });
      qc.invalidateQueries({ queryKey: ["pos-catalog"] });
      qc.invalidateQueries({ queryKey: ["pos-products-deleted"] });
      qc.invalidateQueries({ queryKey: ["pos-hidden"] });
      toast.push(
        p.storeOnly ? "Product deleted" : `Removed from ${store?.name}`,
        "success",
      );
    },
    onError: (e) => toast.push(e.message),
  });
  const dup = useMutation({
    mutationFn: (id: number) =>
      proxyFetch(`/admin/pos/products/${id}/duplicate?storeId=${storeId}`, {
        method: "POST",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pos-products"] });
      qc.invalidateQueries({ queryKey: ["pos-catalog"] });
      toast.push(
        "Duplicated — edit the copy's name, SKU and barcode",
        "success",
      );
    },
    onError: (e) => toast.push(e.message),
  });
  const [editing, setEditing] = useState<{
    id: number | null;
    f: StoreProductFields;
    image?: { mediaId: number; url: string } | null;
  } | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["pos-products", storeId],
    queryFn: () => proxyFetch<Row[]>(`/admin/pos/products?storeId=${storeId}`),
    enabled: !!storeId,
  });
  const own = new Map(rows.map((r) => [r.id, r]));
  const { data: catalog = [], isLoading: catLoading } = usePosCatalog(
    storeId,
    "",
    undefined,
    "name",
  );
  const term = q.trim().toLowerCase();
  const shown = catalog.filter(
    (p) =>
      (kind === "all" || (kind === "own") === !!p.storeOnly) &&
      (!term ||
        [p.name, p.variantLabel, p.sku, p.barcode].some((v) =>
          v?.toLowerCase().includes(term),
        )),
  );
  const paged = usePaged(shown);
  const pageKeys = paged.items.map(lineKey);
  const allOnPage = pageKeys.length > 0 && pageKeys.every((k) => ticked.has(k));
  const tick = (keys: string[], on: boolean) =>
    setTicked((t) => {
      const n = new Set(t);
      for (const k of keys) {
        if (on) n.add(k);
        else n.delete(k);
      }
      return n;
    });

  const askDelete = async (p: PosProduct) =>
    (await confirmDialog(
      p.storeOnly
        ? {
            title: `Delete "${p.name}"?`,
            message:
              "It leaves the till now. Restore it from Deleted within 30 days; past sales are not affected.",
            confirmLabel: "Delete product",
            tone: "danger",
          }
        : {
            title: `Remove from ${store?.name}?`,
            message: `"${p.normalName ?? p.name}"${p.variantLabel ? " (all sizes)" : ""} — only this store stops selling it. Put it back from "Removed from ${store?.name}".`,
            confirmLabel: "Remove from this store",
            tone: "danger",
            icon: "remove_shopping_cart",
          },
    )) && del.mutate(p);

  /** Asks how many copies, gives barcodes to any product without one, prints. */
  const printLabels = async (list: PosProduct[]) => {
    const copies = await promptDialog({
      title: `Print labels for ${list.length === 1 ? `"${list[0].name}"` : `${list.length} products`}`,
      message: `How many labels of each? (${labelSize.widthMm}×${labelSize.heightMm}mm, barcode only)`,
      defaultValue: "1",
      confirmLabel: "Print",
      icon: "barcode",
      required: true,
    });
    const n = Math.floor(Number(copies));
    if (!copies || !(n > 0) || n > 500) {
      if (copies) toast.push("Enter a number of labels from 1 to 500");
      return;
    }
    setPrinting(true);
    try {
      let items = list;
      const missing = list.filter((p) => !p.barcode);
      if (missing.length) {
        await proxyFetch("/admin/stock/barcodes/generate", {
          method: "POST",
          body: JSON.stringify({
            productIds: [...new Set(missing.map((p) => p.productId))],
          }),
        });
        const fresh = await proxyFetch<PosProduct[]>(
          `/admin/pos/catalog?storeId=${storeId}&sort=name`,
        );
        const byKey = new Map(fresh.map((p) => [lineKey(p), p]));
        items = list.map((p) => byKey.get(lineKey(p)) ?? p);
        qc.invalidateQueries({ queryKey: ["pos-catalog"] });
      }
      printLabelSheet(
        buildLabelSheet(
          items.flatMap((p) =>
            Array.from({ length: n }, () => ({
              barcodeSvg: barcodeSvg(p.barcode),
            })),
          ),
          labelSize,
        ),
      );
    } catch (e) {
      toast.push((e as Error).message);
    } finally {
      setPrinting(false);
    }
  };

  return (
    <PosSubPage title="Store products" permission="pos.store_products" wide>
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
            <div>
              <h2 className="text-lg font-extrabold">Products</h2>
              <p className="text-xs text-gray-500">
                Everything sold at <b>{store?.name}</b>. Store-only products
                never appear on the website. Add quantity with{" "}
                <Link
                  href="/pos/stock-in"
                  className="font-semibold text-[#1d7a46]"
                >
                  Stock in
                </Link>
                .
              </p>
            </div>
            <button
              className={`${primaryBtn} flex items-center gap-1`}
              onClick={() => setEditing({ id: null, f: EMPTY_STORE_PRODUCT })}
            >
              <Icon name="add" size={18} /> Create
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-5 py-3">
            <label
              className={`${toolbarInput} w-full max-w-xs ${view === "products" ? "" : "invisible"}`}
            >
              <Icon name="search" size={18} className="text-gray-400" />
              <input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  paged.setPage(1);
                }}
                placeholder="Search name, SKU or barcode"
                className="flex-1 bg-transparent outline-none"
              />
            </label>
            <select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as typeof kind);
                paged.setPage(1);
              }}
              className={`h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold ${view === "products" ? "" : "invisible"}`}
              aria-label="Product type"
            >
              <option value="all">All products</option>
              <option value="own">Store-only</option>
              <option value="shared">Shared (website)</option>
            </select>
            <div className="ml-auto flex flex-wrap gap-2">
              {(
                [
                  ["products", "Products", "inventory_2", catalog.length],
                  ["deleted", "Deleted", "delete", deleted.length],
                  [
                    "removed",
                    `Removed from ${store?.name ?? "store"}`,
                    "visibility_off",
                    hidden.length,
                  ],
                ] as const
              ).map(([v, label, icon, n]) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-semibold ${view === v ? "border-[#1d7a46] bg-emerald-50 text-[#1d7a46]" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}
                >
                  <Icon name={icon} size={17} />
                  {label}
                  <span
                    className={`rounded-full px-1.5 text-xs ${view === v ? "bg-[#1d7a46] text-white" : "bg-gray-100"}`}
                  >
                    {n}
                  </span>
                </button>
              ))}
            </div>
          </div>
          {view === "products" ? (
            <>
              {ticked.size > 0 && (
                <div className="flex flex-wrap items-center gap-3 border-b border-emerald-100 bg-emerald-50 px-5 py-3 text-sm">
                  <span className="font-bold text-[#1d7a46]">
                    {ticked.size} selected
                  </span>
                  <button
                    className={`${primaryBtn} flex items-center gap-1`}
                    disabled={printing}
                    onClick={() =>
                      void printLabels(
                        catalog.filter((p) => ticked.has(lineKey(p))),
                      )
                    }
                  >
                    <Icon name="barcode" size={18} />
                    {printing ? "Preparing…" : "Print labels"}
                  </button>
                  <button
                    className="font-semibold text-gray-500 hover:text-gray-800"
                    onClick={() => setTicked(new Set())}
                  >
                    Unselect all
                  </button>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left">
                    <tr>
                      <th className="w-10 pl-5">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-[#1d7a46]"
                          checked={allOnPage}
                          onChange={(e) => tick(pageKeys, e.target.checked)}
                          aria-label="Select all on this page"
                        />
                      </th>
                      <th className={`${th} pl-2`}>Product</th>
                      <th className={th}>SKU / Barcode</th>
                      <th className={th}>Weight</th>
                      <th className={th}>Price</th>
                      <th className={th}>Stock</th>
                      <th className={th}>Type</th>
                      <th className="w-12" />
                    </tr>
                  </thead>
                  <tbody>
                    {(catLoading || isLoading || shown.length === 0) && (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-5 py-10 text-center text-gray-500"
                        >
                          {catLoading || isLoading
                            ? "Loading…"
                            : "No products match."}
                        </td>
                      </tr>
                    )}
                    {paged.items.map((p) => {
                      const k = lineKey(p);
                      const r = p.storeOnly ? own.get(p.productId) : undefined;
                      const kg = Number(p.storeWeightKg ?? p.normalWeightKg);
                      const unit = p.storeWeightKg
                        ? p.storeWeightUnit
                        : p.normalWeightUnit;
                      return (
                        <tr
                          key={k}
                          className="border-t border-gray-100 hover:bg-emerald-50/40"
                        >
                          <td className="pl-5">
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-[#1d7a46]"
                              checked={ticked.has(k)}
                              onChange={(e) => tick([k], e.target.checked)}
                              aria-label={`Select ${p.name}`}
                            />
                          </td>
                          <td className="py-2.5 pl-2 pr-4">
                            <span className="flex items-center gap-3">
                              <Thumb url={p.imageUrl} />
                              <span className="min-w-0">
                                <span className="line-clamp-2 font-semibold text-gray-900">
                                  {p.name || "(no name)"}
                                </span>
                                {p.variantLabel && (
                                  <span className="text-xs text-gray-500">
                                    {p.variantLabel}
                                  </span>
                                )}
                              </span>
                            </span>
                          </td>
                          <td className="px-4 font-mono text-xs text-gray-600">
                            <div>{p.sku ?? "—"}</div>
                            <div className="text-gray-400">
                              {p.barcode ?? "no barcode"}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-4 text-gray-600">
                            {kg > 0 ? formatWeight(kg, unit) : "—"}
                          </td>
                          <td className="whitespace-nowrap px-4">
                            {p.salePrice ? (
                              <>
                                <b>{taka(Number(p.salePrice))}</b>{" "}
                                <s className="text-xs text-gray-400">
                                  {taka(Number(p.price))}
                                </s>
                              </>
                            ) : (
                              <b>{taka(Number(p.price))}</b>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 text-gray-700">
                            {p.stock >= 9999 ? "—" : p.stock}
                          </td>
                          <td className="px-4">
                            <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-gray-700">
                              <span
                                className={`h-2 w-2 rounded-sm ${p.storeOnly ? "bg-amber-500" : "bg-[#1d7a46]"}`}
                              />
                              {p.storeOnly ? "Store-only" : "Shared"}
                            </span>
                          </td>
                          <td className="pr-3 text-right">
                            <RowMenu
                              label={p.name}
                              actions={[
                                ...(r && !r.hasVariants
                                  ? [
                                      {
                                        label: "Edit",
                                        icon: "edit",
                                        onClick: () =>
                                          setEditing({
                                            id: r.id,
                                            image:
                                              r.mediaId && r.imageUrl
                                                ? {
                                                    mediaId: r.mediaId,
                                                    url: r.imageUrl,
                                                  }
                                                : null,
                                            f: editFields(r),
                                          }),
                                      },
                                    ]
                                  : can("pos.prices")
                                    ? [
                                        {
                                          label: "Edit at this store",
                                          icon: "edit",
                                          onClick: () => setPricing(p),
                                        },
                                      ]
                                    : []),
                                {
                                  label: "Print label",
                                  icon: "barcode",
                                  disabled: printing,
                                  onClick: () => void printLabels([p]),
                                },
                                {
                                  label: "Duplicate",
                                  icon: "content_copy",
                                  disabled: dup.isPending,
                                  onClick: () => dup.mutate(p.productId),
                                },
                                {
                                  label: p.storeOnly
                                    ? "Delete"
                                    : "Remove from store",
                                  icon: p.storeOnly
                                    ? "delete"
                                    : "remove_shopping_cart",
                                  danger: true,
                                  disabled: del.isPending,
                                  onClick: () => void askDelete(p),
                                },
                              ]}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pager {...paged} noun="products" />
            </>
          ) : view === "deleted" ? (
            <div>
              <div className="border-b border-gray-100 px-5 py-3">
                <h2 className="flex items-center gap-2 font-bold">
                  <Icon name="delete" size={20} className="text-red-600" />
                  Deleted products
                </h2>
                <p className="text-xs text-gray-500">
                  Kept for 30 days, then removed for good. Restore puts a
                  product back on this store&apos;s till (its stock is kept).
                </p>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {deleted.map((d) => {
                    const left = Math.max(
                      0,
                      30 -
                        Math.floor(
                          (now - new Date(d.deletedAt).getTime()) / 86_400_000,
                        ),
                    );
                    return (
                      <tr key={d.id} className="border-t border-gray-100">
                        <td className="px-5 py-3 font-semibold">
                          {d.name || "(no name)"}
                        </td>
                        <td className="px-4 font-mono text-xs">
                          {d.sku ?? "—"}
                        </td>
                        <td className="px-4">
                          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">
                            {left} days left
                          </span>
                        </td>
                        <td className="px-4 text-right">
                          <button
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-semibold text-[#1d7a46] hover:bg-emerald-50 disabled:opacity-50"
                            disabled={restore.isPending}
                            onClick={() => restore.mutate(d.id)}
                          >
                            <Icon name="restore_from_trash" size={16} /> Restore
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {deleted.length === 0 && (
                <p className="px-5 py-10 text-center text-sm text-gray-500">
                  No deleted products.
                </p>
              )}
            </div>
          ) : (
            <div>
              <div className="border-b border-gray-100 px-5 py-3">
                <h2 className="font-bold">Removed from {store?.name}</h2>
                <p className="text-xs text-gray-500">
                  Not sold at this store; still on the website and at other
                  stores.
                </p>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {hidden.map((h) => (
                    <tr key={h.productId} className="border-t border-gray-100">
                      <td className="px-5 py-3 font-semibold">
                        {h.name || "(no name)"}
                      </td>
                      <td className="px-4 font-mono text-xs">{h.sku ?? "—"}</td>
                      <td className="px-4 text-right">
                        <button
                          className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-semibold text-[#1d7a46] disabled:opacity-50"
                          disabled={unhide.isPending}
                          onClick={() => unhide.mutate(h.productId)}
                        >
                          Put back
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {hidden.length === 0 && (
                <p className="px-5 py-10 text-center text-sm text-gray-500">
                  Nothing removed from this store.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {pricing && (
        <StorePriceDialog p={pricing} onClose={() => setPricing(null)} />
      )}
      {editing && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={editing.id ? "Edit product" : "New product"}
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="mb-4 text-lg font-extrabold">
              {editing.id ? "Edit product" : "New product"}
            </h2>
            <StoreProductForm
              key={editing.id ?? "new"}
              id={editing.id}
              initial={editing.f}
              initialImage={editing.image}
              onDone={() => setEditing(null)}
              onCancel={() => setEditing(null)}
            />
          </div>
        </div>
      )}
    </PosSubPage>
  );
}
