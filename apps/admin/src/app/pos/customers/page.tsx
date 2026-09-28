"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import { taka } from "@/lib/pos-cart";
import { usePosContext } from "@/components/pos/PosContext";
import { PosSubPage, input } from "@/components/pos/PosSubPage";
import { StoreFilter } from "@/components/pos/StoreFilter";

type Row = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  purchases: number;
  spent: string;
  lastPurchase: string;
  stores: string[];
};
type Page = { items: Row[]; total: number; page: number; pageSize: number };
const PAGE_SIZE = 25;

/** Customers who bought at the shops — one store's or all stores'. */
export default function PosCustomersPage() {
  const { allStores } = usePosContext();
  const [storeId, setStoreId] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(PAGE_SIZE),
    ...(allStores && storeId ? { storeId: String(storeId) } : {}),
    ...(q.trim() ? { q: q.trim() } : {}),
  }).toString();
  const { data, isLoading, error } = useQuery({
    queryKey: ["pos-customer-list", params],
    queryFn: () => proxyFetch<Page>(`/admin/pos/customers/summary?${params}`),
    placeholderData: (prev) => prev,
  });
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <PosSubPage
      title="Customers"
      permission="pos.customers"
      wide
      hideStorePicker
    >
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-2 p-3">
          <StoreFilter
            value={storeId}
            onChange={(v) => {
              setStoreId(v);
              setPage(1);
            }}
          />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search name or phone…"
            className={`${input} min-w-[220px] flex-1`}
          />
          <span className="text-sm text-gray-600">
            {data?.total ?? 0} customer{data?.total === 1 ? "" : "s"}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-3">Customer</th>
                <th className="px-3">Phone</th>
                <th className="px-3 text-right">Purchases</th>
                <th className="px-3 text-right">Total spent</th>
                <th className="px-3">Last purchase</th>
                <th className="px-3">Stores</th>
                <th className="px-3" />
              </tr>
            </thead>
            <tbody>
              {(isLoading || error || data?.items.length === 0) && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    {isLoading
                      ? "Loading…"
                      : error
                        ? (error as Error).message
                        : "No customers yet. Customers appear here after a sale with a phone number."}
                  </td>
                </tr>
              )}
              {data?.items.map((c) => (
                <tr key={c.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-semibold">{c.name}</td>
                  <td className="px-3">{c.phone ?? "—"}</td>
                  <td className="px-3 text-right">{c.purchases}</td>
                  <td className="whitespace-nowrap px-3 text-right font-bold">
                    {taka(Number(c.spent))}
                  </td>
                  <td className="whitespace-nowrap px-3 text-gray-600">
                    {new Date(c.lastPurchase).toLocaleDateString("en-GB")}
                  </td>
                  <td className="px-3">
                    <div className="flex flex-wrap gap-1">
                      {c.stores.map((s) => (
                        <span
                          key={s}
                          className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-[#1d7a46]"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 text-right">
                    {c.phone && (
                      <Link
                        href={`/pos/orders?q=${encodeURIComponent(c.phone)}`}
                        className="text-xs font-bold text-[#1d7a46] hover:underline"
                      >
                        Orders
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-4 py-3 text-sm text-gray-600">
          <button
            className="h-9 rounded-lg border border-gray-200 px-3 disabled:opacity-40"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <span>
            Page {page} of {pages}
          </span>
          <button
            className="h-9 rounded-lg border border-gray-200 px-3 disabled:opacity-40"
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </PosSubPage>
  );
}
