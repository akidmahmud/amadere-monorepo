"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "@amader/admin-ui";
import { proxyFetch } from "@/lib/api/proxy-client";
import { taka } from "@/lib/pos-cart";
import { daysAgo } from "@/lib/pos-days";

type Order = {
  id: number;
  orderNumber: string;
  createdAt: string;
  status: string;
  totalAmount: string;
  posRefundedAmount?: string;
  store: { name: string } | null;
  items: { name: string; qty: number; returned: number }[];
};

/** A customer's till purchases: what they bought and when. */
export function CustomerHistoryDialog({
  customer,
  storeId,
  ordersHref,
  onClose,
}: {
  customer: { id: number; name: string; phone: string | null };
  storeId: number | null;
  ordersHref?: string;
  onClose: () => void;
}) {
  const params = new URLSearchParams({
    customerId: String(customer.id),
    pageSize: "100",
    ...(storeId ? { storeId: String(storeId) } : {}),
  });
  const { data, isLoading, error } = useQuery({
    queryKey: ["pos-orders", "customer", customer.id, storeId],
    queryFn: () =>
      proxyFetch<{ items: Order[]; total: number }>(
        `/admin/pos/orders?${params}`,
      ),
  });
  const [now] = useState(() => Date.now());
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${customer.name} order history`}
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-gray-100 p-5">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-emerald-50 text-lg font-bold text-[#1d7a46]">
            {customer.name.slice(0, 1).toUpperCase()}
          </span>
          <div className="flex-1">
            <h2 className="text-lg font-bold">{customer.name}</h2>
            <p className="text-sm text-gray-500">
              {customer.phone} · {data?.total ?? "…"} order
              {data?.total === 1 ? "" : "s"}
            </p>
          </div>
          <button
            className="grid h-9 w-9 place-items-center rounded-lg hover:bg-gray-100"
            onClick={onClose}
            aria-label="Close"
          >
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {isLoading && (
            <p className="py-8 text-center text-gray-500">Loading…</p>
          )}
          {error && (
            <p className="py-8 text-center text-red-600">
              {(error as Error).message}
            </p>
          )}
          {data?.items.length === 0 && (
            <p className="py-8 text-center text-gray-500">No orders.</p>
          )}
          <ol className="space-y-3">
            {data?.items.map((o) => (
              <li key={o.id} className="rounded-xl border border-gray-100 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <a
                      href={`/pos/receipt/${o.id}`}
                      target="_blank"
                      rel="noopener"
                      className="font-bold text-[#1d7a46] hover:underline"
                    >
                      {o.orderNumber}
                    </a>
                    <span className="ml-2 text-sm text-gray-500">
                      {new Date(o.createdAt).toLocaleString("en-GB", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}{" "}
                      · {daysAgo(o.createdAt, now)}
                      {o.store && ` · ${o.store.name}`}
                    </span>
                  </div>
                  <span className="font-extrabold">
                    {taka(Number(o.totalAmount))}
                  </span>
                </div>
                <ul className="mt-2 space-y-0.5 text-sm">
                  {o.items.map((i, n) => (
                    <li key={n} className="flex justify-between gap-3">
                      <span className="text-gray-800">{i.name}</span>
                      <span className="whitespace-nowrap text-gray-500">
                        × {i.qty}
                        {i.returned > 0 && (
                          <span className="ml-1 font-bold text-red-600">
                            ({i.returned} returned)
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
                {o.status !== "COMPLETED" && (
                  <div className="mt-2 text-xs font-bold text-red-600">
                    {o.status === "RETURNED" ? "Returned" : "Part returned"}
                    {Number(o.posRefundedAmount ?? 0) > 0 &&
                      ` · ${taka(Number(o.posRefundedAmount))} refunded`}
                  </div>
                )}
              </li>
            ))}
          </ol>
        </div>
        {ordersHref && (
          <div className="border-t border-gray-100 p-4 text-right">
            <Link
              href={ordersHref}
              className="inline-flex items-center gap-1 text-sm font-bold text-[#1d7a46] hover:underline"
            >
              Open in Order Manager <Icon name="arrow_forward" size={16} />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
