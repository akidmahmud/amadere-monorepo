"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/components/ToastProvider";
import { proxyFetch } from "@/lib/api/proxy-client";
import { qs } from "@/hooks/usePos";
import { downloadCsvAsXlsx, reportTitle } from "@/lib/reportExport";
import { taka } from "@/lib/pos-cart";
import { usePosContext } from "@/components/pos/PosContext";
import {
  PosSubPage,
  card,
  input,
  primaryBtn,
} from "@/components/pos/PosSubPage";
import { PosExpenseDialog } from "@/components/pos/PosExpenseDialog";
import { Icon } from "@amader/admin-ui";
import { Pager, toolbarInput, usePaged } from "@/components/pos/PosTableKit";

interface SalesRow {
  storeId: number;
  storeName: string;
  orders: number;
  gross: string;
  vat: string;
  returns: string;
}
interface ProfitRow {
  storeId: number;
  storeName: string;
  gross: string;
  returns: string;
  vat: string;
  netSales: string;
  expenses: string;
  profit: string;
}
interface StockRow {
  productId: number;
  variantId: number | null;
  name: string;
  sku: string | null;
  barcode: string | null;
  opening: number;
  stockIn: number;
  sold: number;
  returned: number;
  adjustment: number;
  transferIn: number;
  transferOut: number;
  closing: number;
  status: "In stock" | "Low stock" | "Out of stock";
}

interface ExpiryRow {
  productId: number;
  variantId: number | null;
  name: string;
  sku: string | null;
  entryDate: string | null;
  expiryDate: string | null;
  qtyLeft: number;
  daysLeft: number | null;
  status: "Expired" | "Expiring soon" | "OK" | "No expiry";
}
const EXPIRY_TONE: Record<ExpiryRow["status"], string> = {
  Expired: "bg-red-50 text-red-700",
  "Expiring soon": "bg-amber-50 text-amber-800",
  OK: "bg-emerald-50 text-[#1d7a46]",
  "No expiry": "bg-gray-100 text-gray-600",
};
const dmy = (d: string | null) =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-GB") : "—";

const STOCK_COLS = [
  ["opening", "Opening stock"],
  ["stockIn", "Stock in"],
  ["sold", "Sold qty"],
  ["returned", "Return qty"],
  ["adjustment", "Adjustment"],
  ["transferIn", "Transfer in"],
  ["transferOut", "Transfer out"],
  ["closing", "Closing stock"],
] as const;

// Dhaka calendar day — the server reports in Dhaka days too.
const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });
const exportBtn =
  "h-10 rounded-lg border border-gray-200 bg-white px-4 text-sm font-semibold hover:bg-gray-50";

export default function PosReportsPage() {
  const { storeId, allStores, store, can } = usePosContext();
  const [addingExpense, setAddingExpense] = useState(false);
  const toast = useToast();
  const [tab, setTab] = useState<"sales" | "profit" | "stock" | "expiry">(
    "sales",
  );
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [everyStore, setEveryStore] = useState(false);
  const scopeId = allStores && everyStore ? undefined : storeId;
  const storeLabel =
    allStores && everyStore ? "All stores" : (store?.name ?? "");

  const sales = useQuery({
    queryKey: ["pos-report-sales", scopeId, from, to, everyStore],
    queryFn: () =>
      proxyFetch<SalesRow[]>(
        `/admin/pos/reports/sales${qs({ storeId: scopeId, from, to })}`,
      ),
    enabled: tab === "sales",
  });
  const profit = useQuery({
    queryKey: ["pos-report-profit", scopeId, from, to, everyStore],
    queryFn: () =>
      proxyFetch<ProfitRow[]>(
        `/admin/pos/reports/profit${qs({ storeId: scopeId, from, to })}`,
      ),
    enabled: tab === "profit",
  });
  // This store's expenses for the period (under Store profit).
  const storeExpenses = useQuery({
    queryKey: ["pos-expenses", storeId, from, to],
    queryFn: () =>
      proxyFetch<
        {
          id: number;
          voucherNo: string;
          date: string;
          category: string;
          paidTo: string;
          amount: string;
          note: string | null;
        }[]
      >(`/admin/pos/expenses${qs({ storeId, from, to })}`),
    enabled: tab === "profit" && !!storeId,
  });
  const stock = useQuery({
    queryKey: ["pos-report-stock", storeId, from, to],
    queryFn: () =>
      proxyFetch<StockRow[]>(
        `/admin/pos/reports/stock${qs({ storeId, from, to })}`,
      ),
    enabled: tab === "stock",
  });
  const expiry = useQuery({
    queryKey: ["pos-report-expiry", storeId],
    queryFn: () =>
      proxyFetch<ExpiryRow[]>(`/admin/pos/reports/expiry${qs({ storeId })}`),
    enabled: tab === "expiry",
  });
  const [expQ, setExpQ] = useState("");
  const [expStatus, setExpStatus] = useState("alert");
  const expTerm = expQ.trim().toLowerCase();
  const expRows = (expiry.data ?? []).filter(
    (r) =>
      (expStatus === ""
        ? true
        : expStatus === "alert"
          ? r.status === "Expired" || r.status === "Expiring soon"
          : r.status === expStatus) &&
      (!expTerm ||
        [r.name, r.sku].some((v) => v?.toLowerCase().includes(expTerm))),
  );
  const expPage = usePaged(expRows);
  const expCount = (st: ExpiryRow["status"]) =>
    (expiry.data ?? []).filter((r) => r.status === st).length;
  const [stockQ, setStockQ] = useState("");
  const [stockStatus, setStockStatus] = useState("");
  const term = stockQ.trim().toLowerCase();
  const stockRows = (stock.data ?? []).filter(
    (r) =>
      (!stockStatus || r.status === stockStatus) &&
      (!term ||
        [r.name, r.sku, r.barcode].some((v) =>
          v?.toLowerCase().includes(term),
        )),
  );
  const stockPage = usePaged(stockRows);
  const stockSum = (k: (typeof STOCK_COLS)[number][0]) =>
    stockRows.reduce((t, r) => t + r[k], 0);

  const exportFile = (path: string, name: string, title: string) =>
    downloadCsvAsXlsx(`/api/backend${path}`, name, title).catch((e: Error) =>
      toast.push(e.message),
    );
  const range = { from, to };

  const tabBtn = (t: typeof tab, label: string) => (
    <button
      onClick={() => setTab(t)}
      className={`h-10 rounded-lg px-4 text-sm font-semibold ${tab === t ? "bg-[#1d7a46] text-white" : "border border-gray-200 bg-white"}`}
    >
      {label}
    </button>
  );

  const rangeBar = (
    <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
      <input
        type="date"
        value={from}
        onChange={(e) => setFrom(e.target.value)}
        className={input}
        aria-label="From"
      />
      <span>to</span>
      <input
        type="date"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        className={input}
        aria-label="To"
      />
      {allStores && (
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={everyStore}
            onChange={(e) => setEveryStore(e.target.checked)}
          />{" "}
          All stores
        </label>
      )}
    </div>
  );

  return (
    <PosSubPage
      title="Reports"
      permission="pos.reports"
      wide={tab === "stock" || tab === "expiry"}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {tabBtn("sales", "Sales")}
        {tabBtn("profit", "Store profit")}
        {tabBtn("stock", "Stock report")}
        {tabBtn("expiry", "Expiry")}
      </div>

      {/* Per-store Excel sheets — always for the one selected store. */}
      <div className={`${card} mb-4 flex flex-wrap items-center gap-2`}>
        <span className="mr-2 text-sm font-semibold">
          Excel for {store?.name}:
        </span>
        <button
          className={exportBtn}
          onClick={() =>
            exportFile(
              `/admin/pos/reports/sales-lines.csv${qs({ storeId, from, to })}`,
              `sales-${store?.code ?? "store"}-${from}-${to}`,
              reportTitle(`${store?.name ?? ""} Sales`, range),
            )
          }
        >
          Sales sheet
        </button>
        <button
          className={exportBtn}
          onClick={() =>
            exportFile(
              `/admin/pos/reports/customers.csv${qs({ storeId, from, to })}`,
              `customers-${store?.code ?? "store"}-${from}-${to}`,
              reportTitle(`${store?.name ?? ""} Customers`, range),
            )
          }
        >
          Customer sheet
        </button>
        <span className="text-xs text-gray-500">
          Uses the date range below.
        </span>
      </div>

      {tab === "sales" && (
        <div className={card}>
          <div className="flex items-start justify-between gap-3">
            {rangeBar}
            <button
              className={exportBtn}
              onClick={() =>
                exportFile(
                  `/admin/pos/reports/sales.csv${qs({ storeId: scopeId, from, to })}`,
                  `pos-sales-${from}-${to}`,
                  reportTitle(`POS Sales — ${storeLabel}`, range),
                )
              }
            >
              Export
            </button>
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-gray-500">
              <tr>
                <th className="py-2">Store</th>
                <th className="text-right">Sales</th>
                <th className="text-right">Gross</th>
                <th className="text-right">VAT</th>
                <th className="text-right">Returns</th>
              </tr>
            </thead>
            <tbody>
              {sales.data?.map((r) => (
                <tr key={r.storeId} className="border-t border-gray-100">
                  <td className="py-2 font-semibold">{r.storeName}</td>
                  <td className="text-right">{r.orders}</td>
                  <td className="text-right">{taka(r.gross)}</td>
                  <td className="text-right">{taka(r.vat)}</td>
                  <td className="text-right">{taka(r.returns)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {sales.data?.length === 0 && (
            <div className="py-6 text-center text-sm text-gray-500">
              No POS sales in this period.
            </div>
          )}
        </div>
      )}

      {tab === "profit" && (
        <div className={card}>
          <div className="flex items-start justify-between gap-3">
            {rangeBar}
            <div className="flex shrink-0 gap-2">
              {can("pos.expenses") && (
                <button
                  className={`${primaryBtn} flex items-center gap-1`}
                  onClick={() => setAddingExpense(true)}
                >
                  <Icon name="add" size={18} /> Add expense
                </button>
              )}
              <button
                className={exportBtn}
                onClick={() =>
                  exportFile(
                    `/admin/pos/reports/profit.csv${qs({ storeId: scopeId, from, to })}`,
                    `store-profit-${from}-${to}`,
                    reportTitle(`Store Profit — ${storeLabel}`, range),
                  )
                }
              >
                Export
              </button>
            </div>
          </div>
          <p className="mb-3 text-xs text-gray-500">
            Net sales = gross − returns − VAT. Expenses are those booked in
            Accounts to the store&apos;s cost centre (before VAT). Cost of goods
            is not included.
          </p>
          <table className="w-full text-sm">
            <thead className="text-left text-gray-500">
              <tr>
                <th className="py-2">Store</th>
                <th className="text-right">Gross</th>
                <th className="text-right">Returns</th>
                <th className="text-right">VAT</th>
                <th className="text-right">Net sales</th>
                <th className="text-right">Expenses</th>
                <th className="text-right">Profit</th>
              </tr>
            </thead>
            <tbody>
              {profit.data?.map((r) => (
                <tr key={r.storeId} className="border-t border-gray-100">
                  <td className="py-2 font-semibold">{r.storeName}</td>
                  <td className="text-right">{taka(r.gross)}</td>
                  <td className="text-right">{taka(r.returns)}</td>
                  <td className="text-right">{taka(r.vat)}</td>
                  <td className="text-right">{taka(r.netSales)}</td>
                  <td className="text-right">{taka(r.expenses)}</td>
                  <td
                    className={`text-right font-bold ${Number(r.profit) < 0 ? "text-red-600" : "text-emerald-700"}`}
                  >
                    {taka(r.profit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {profit.data?.length === 0 && (
            <div className="py-6 text-center text-sm text-gray-500">
              Nothing in this period.
            </div>
          )}
          <div className="mt-6 border-t border-gray-100 pt-4">
            <h3 className="mb-2 font-bold">
              Expenses — {store?.name}{" "}
              <span className="text-sm font-normal text-gray-500">
                (
                {taka(
                  (storeExpenses.data ?? []).reduce(
                    (t, e) => t + Number(e.amount),
                    0,
                  ),
                )}
                )
              </span>
            </h3>
            {storeExpenses.error ? (
              <p className="text-sm text-amber-700">
                {(storeExpenses.error as Error).message}
              </p>
            ) : (storeExpenses.data ?? []).length === 0 ? (
              <p className="text-sm text-gray-500">
                No expenses in this period.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-gray-500">
                  <tr>
                    <th className="py-2">Date</th>
                    <th>Category</th>
                    <th>Paid to</th>
                    <th>Note</th>
                    <th>Voucher</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {storeExpenses.data?.map((e) => (
                    <tr key={e.id} className="border-t border-gray-100">
                      <td className="py-2">
                        {new Date(`${e.date}T00:00:00`).toLocaleDateString(
                          "en-GB",
                        )}
                      </td>
                      <td className="font-semibold">{e.category}</td>
                      <td>{e.paidTo}</td>
                      <td className="text-gray-600">{e.note ?? ""}</td>
                      <td className="font-mono text-xs text-gray-500">
                        {e.voucherNo}
                      </td>
                      <td className="text-right font-bold">
                        {taka(Number(e.amount))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
      {addingExpense && storeId && (
        <PosExpenseDialog
          storeId={storeId}
          storeName={store?.name ?? ""}
          onClose={() => setAddingExpense(false)}
        />
      )}

      {tab === "stock" && (
        <div className={`${card} mx-auto max-w-7xl`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold">
                Stock report — {store?.name}
              </h2>
              <p className="mb-3 text-xs text-gray-500">
                Per product / SKU for the dates below. Closing = Opening + Stock
                in − Sold + Return ± Adjustment + Transfer in − Transfer out.
                Products without a stock count are not listed.
              </p>
            </div>
            <button
              className={exportBtn}
              onClick={() =>
                exportFile(
                  `/admin/pos/reports/stock.csv${qs({ storeId, from, to })}`,
                  `stock-report-${store?.code ?? "store"}-${from}-${to}`,
                  reportTitle(`Stock Report — ${store?.name ?? ""}`, range),
                )
              }
            >
              Export Excel
            </button>
          </div>
          <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className={input}
              aria-label="From"
            />
            <span>to</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className={input}
              aria-label="To"
            />
            <select
              value={stockStatus}
              onChange={(e) => {
                setStockStatus(e.target.value);
                stockPage.setPage(1);
              }}
              className={input}
              aria-label="Stock status"
            >
              <option value="">All statuses</option>
              <option>In stock</option>
              <option>Low stock</option>
              <option>Out of stock</option>
            </select>
            <label className={`${toolbarInput} min-w-[220px] flex-1`}>
              <Icon name="search" size={18} className="text-gray-400" />
              <input
                value={stockQ}
                onChange={(e) => {
                  setStockQ(e.target.value);
                  stockPage.setPage(1);
                }}
                placeholder="Search product, SKU or barcode"
                className="flex-1 bg-transparent outline-none"
              />
            </label>
          </div>
          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="w-full text-sm">
              <thead className="bg-[#1d7a46] text-left text-white">
                <tr>
                  <th className="px-3 py-3 font-bold">Product</th>
                  <th className="px-3 font-bold">SKU</th>
                  {STOCK_COLS.map(([, label]) => (
                    <th
                      key={label}
                      className="whitespace-nowrap px-3 text-right font-bold"
                    >
                      {label}
                    </th>
                  ))}
                  <th className="px-3 font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {(stock.isLoading || stockRows.length === 0) && (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-3 py-8 text-center text-gray-500"
                    >
                      {stock.isLoading
                        ? "Loading…"
                        : stock.error
                          ? (stock.error as Error).message
                          : "No products match."}
                    </td>
                  </tr>
                )}
                {stockPage.items.map((r) => (
                  <tr
                    key={`${r.productId}:${r.variantId ?? 0}`}
                    className="border-t border-gray-100 hover:bg-emerald-50/40"
                  >
                    <td className="px-3 py-2 font-semibold">{r.name}</td>
                    <td className="px-3 font-mono text-xs text-gray-600">
                      {r.sku ?? "—"}
                    </td>
                    {STOCK_COLS.map(([k]) => (
                      <td
                        key={k}
                        className={`px-3 text-right tabular-nums ${k === "closing" || k === "opening" ? "font-bold" : r[k] === 0 ? "text-gray-300" : ""}`}
                      >
                        {r[k]}
                      </td>
                    ))}
                    <td className="px-3">
                      <span
                        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${r.status === "Out of stock" ? "bg-red-50 text-red-700" : r.status === "Low stock" ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-[#1d7a46]"}`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              {stockRows.length > 0 && (
                <tfoot className="border-t-2 border-gray-200 bg-gray-50 font-bold">
                  <tr>
                    <td className="px-3 py-2" colSpan={2}>
                      Total ({stockRows.length} products)
                    </td>
                    {STOCK_COLS.map(([k]) => (
                      <td key={k} className="px-3 text-right tabular-nums">
                        {stockSum(k)}
                      </td>
                    ))}
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <Pager {...stockPage} noun="products" />
        </div>
      )}
      {tab === "expiry" && (
        <div className={`${card} mx-auto max-w-7xl`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold">Expiry — {store?.name}</h2>
              <p className="mb-3 text-xs text-gray-500">
                What is on the shelf now, per delivery (entry date from Stock
                in). Counted oldest-sold-first: the units left are the newest
                deliveries. Alert = expired or expiring within 15 days.
              </p>
            </div>
            <button
              className={exportBtn}
              onClick={() =>
                exportFile(
                  `/admin/pos/reports/expiry.csv${qs({ storeId })}`,
                  `expiry-${store?.code ?? "store"}-${today()}`,
                  `Expiry — ${store?.name ?? ""} — ${today()}`,
                )
              }
            >
              Export Excel
            </button>
          </div>
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
            {(
              [
                [
                  "alert",
                  "Alerts",
                  expCount("Expired") + expCount("Expiring soon"),
                ],
                ["Expired", "Expired", expCount("Expired")],
                [
                  "Expiring soon",
                  "Expiring ≤15 days",
                  expCount("Expiring soon"),
                ],
                ["OK", "OK", expCount("OK")],
                ["No expiry", "No expiry date", expCount("No expiry")],
                ["", "All", expiry.data?.length ?? 0],
              ] as const
            ).map(([v, label, n]) => (
              <button
                key={v || "all"}
                onClick={() => {
                  setExpStatus(v);
                  expPage.setPage(1);
                }}
                className={`flex h-9 items-center gap-1.5 rounded-lg border px-3 font-semibold ${expStatus === v ? "border-[#1d7a46] bg-emerald-50 text-[#1d7a46]" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}
              >
                {label}
                <span
                  className={`rounded-full px-1.5 text-xs ${expStatus === v ? "bg-[#1d7a46] text-white" : "bg-gray-100"}`}
                >
                  {n}
                </span>
              </button>
            ))}
            <label className={`${toolbarInput} ml-auto min-w-[220px]`}>
              <Icon name="search" size={18} className="text-gray-400" />
              <input
                value={expQ}
                onChange={(e) => {
                  setExpQ(e.target.value);
                  expPage.setPage(1);
                }}
                placeholder="Search product or SKU"
                className="flex-1 bg-transparent outline-none"
              />
            </label>
          </div>
          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="w-full text-sm">
              <thead className="bg-[#1d7a46] text-left text-white">
                <tr>
                  <th className="px-3 py-3 font-bold">Product</th>
                  <th className="px-3 font-bold">SKU</th>
                  <th className="px-3 font-bold">Entry date</th>
                  <th className="px-3 font-bold">Expiry date</th>
                  <th className="px-3 text-right font-bold">Qty left</th>
                  <th className="px-3 text-right font-bold">Days left</th>
                  <th className="px-3 font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {(expiry.isLoading || expRows.length === 0) && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-8 text-center text-gray-500"
                    >
                      {expiry.isLoading
                        ? "Loading…"
                        : expiry.error
                          ? (expiry.error as Error).message
                          : expStatus === "alert"
                            ? "Nothing expired or expiring in the next 15 days."
                            : "Nothing here."}
                    </td>
                  </tr>
                )}
                {expPage.items.map((r, i) => (
                  <tr
                    key={`${r.productId}:${r.variantId ?? 0}:${r.entryDate}:${i}`}
                    className="border-t border-gray-100 hover:bg-emerald-50/40"
                  >
                    <td className="px-3 py-2 font-semibold">{r.name}</td>
                    <td className="px-3 font-mono text-xs text-gray-600">
                      {r.sku ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 text-gray-600">
                      {r.entryDate ? dmy(r.entryDate) : "older stock"}
                    </td>
                    <td className="whitespace-nowrap px-3 font-semibold">
                      {dmy(r.expiryDate)}
                    </td>
                    <td className="px-3 text-right font-bold tabular-nums">
                      {r.qtyLeft}
                    </td>
                    <td className="px-3 text-right tabular-nums">
                      {r.daysLeft == null
                        ? "—"
                        : r.daysLeft < 0
                          ? `${-r.daysLeft} ago`
                          : r.daysLeft}
                    </td>
                    <td className="px-3">
                      <span
                        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${EXPIRY_TONE[r.status]}`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager {...expPage} noun="batches" />
        </div>
      )}
    </PosSubPage>
  );
}
