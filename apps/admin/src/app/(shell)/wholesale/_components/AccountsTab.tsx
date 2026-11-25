"use client";

import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@amader/admin-ui";
import { proxyFetch } from "@/lib/api/proxy-client";
import { useCan } from "@/hooks/useAdminAuth";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Pager } from "./Pager";

const PAGE_SIZE = 20;
const INPUT =
  "h-10 rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 placeholder:text-muted";

interface Invoice {
  id: number;
  docNo: string;
  issueDate: string;
  amount: string;
  paid: string;
  voidedAt: string | null;
  orderNumber: string | null;
  orderStatus: string | null;
  customer: string | null;
}
interface Receipt {
  id: number;
  date: string;
  amount: string;
  account: string;
  reference: string | null;
  invoiceNo: string | null;
  orderNumber: string | null;
  customer: string | null;
  voidedAt: string | null;
}
interface Page<T> {
  items: T[];
  total: number;
}

const money = (v: string) =>
  `৳${Number(v).toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (v: string) => new Date(v).toLocaleDateString("en-GB");

/**
 * Wholesale › Accounts: every wholesale sale (invoice) and every receipt
 * collected against one, each voidable. Voiding a receipt reverses just that
 * payment; voiding a sale cancels the order, restocks it and voids its
 * invoice with all its receipts. Both write reversals, never deletes.
 */
export function AccountsTab({ onDone }: { onDone: (msg: string) => void }) {
  const [view, setView] = useState<"invoices" | "receipts">("invoices");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState<
    { kind: "invoice"; row: Invoice } | { kind: "receipt"; row: Receipt } | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const canVoid = useCan("net_profit_accounts.manage");
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["admin-wholesale-accounts", view, search, page],
    queryFn: () =>
      proxyFetch<Page<Invoice | Receipt>>(
        `/admin/wholesale/accounts/${view}?${new URLSearchParams({
          page: String(page),
          pageSize: String(PAGE_SIZE),
          ...(search.trim() ? { search: search.trim() } : {}),
        })}`,
      ),
    placeholderData: keepPreviousData,
  });

  const voidIt = useMutation({
    mutationFn: (c: NonNullable<typeof confirm>) =>
      proxyFetch(
        `/admin/wholesale/accounts/${c.kind === "invoice" ? "invoices" : "receipts"}/${c.row.id}/void`,
        { method: "POST" },
      ),
    onSuccess: (_d, c) => {
      void qc.invalidateQueries({ queryKey: ["admin-wholesale-accounts"] });
      void qc.invalidateQueries({ queryKey: ["admin-wholesale-orders"] });
      void qc.invalidateQueries({ queryKey: ["admin-wholesale-customers"] });
      setConfirm(null);
      onDone(c.kind === "invoice" ? "Sale voided" : "Receipt voided");
    },
    onError: (e) => {
      setConfirm(null);
      setError(e instanceof Error ? e.message : "Couldn't void it");
    },
  });

  const rows = list.data?.items ?? [];
  const total = list.data?.total ?? 0;
  const tabBtn = (v: typeof view, label: string) => (
    <button
      type="button"
      onClick={() => {
        setView(v);
        setPage(1);
      }}
      className={`h-10 rounded-lg px-4 text-sm font-bold ${
        view === v ? "bg-brand-500 text-white" : "border border-border text-secondary hover:bg-surface-2"
      }`}
    >
      {label}
    </button>
  );
  const voidBtn = (onClick: () => void) =>
    canVoid ? (
      <button type="button" onClick={onClick} className="text-xs font-bold text-danger hover:underline">
        Void
      </button>
    ) : null;
  const voidedPill = (
    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-bold uppercase text-muted">
      Voided
    </span>
  );
  const th = "px-3 py-2.5 text-left font-bold";
  const td = "px-3 py-2.5 text-sm text-text";

  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-center gap-2">
        {tabBtn("invoices", "Sales (invoices)")}
        {tabBtn("receipts", "Receipts (money received)")}
        <input
          className={`${INPUT} ml-auto w-full sm:w-72`}
          placeholder="Search order, invoice or customer…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>
      <p className="text-xs text-muted">
        {view === "invoices"
          ? "Voiding a sale cancels the order, puts its products back in stock and reverses its invoice and every payment on it."
          : "Voiding a receipt reverses just that payment; the order goes back to Unpaid or Partially paid."}
        {!canVoid && " Only staff with Accounts access can void."}
      </p>
      {error && <p className="text-sm font-semibold text-danger">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[760px] border-collapse">
          <thead>
            <tr className="bg-surface-2 text-[9px] uppercase tracking-wide text-muted">
              {(view === "invoices"
                ? ["Invoice", "Date", "Order", "Customer", "Amount", "Received", ""]
                : ["Date", "Order", "Invoice", "Customer", "Amount", "Into account", ""]
              ).map((h) => (
                <th key={h} className={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-muted">
                  {list.isLoading ? "Loading…" : "Nothing here yet."}
                </td>
              </tr>
            )}
            {view === "invoices"
              ? (rows as Invoice[]).map((r) => (
                  <tr key={r.id} className={`border-t border-border ${r.voidedAt ? "opacity-50" : ""}`}>
                    <td className={td}>{r.docNo}</td>
                    <td className={td}>{day(r.issueDate)}</td>
                    <td className={`${td} font-semibold`}>{r.orderNumber ?? "—"}</td>
                    <td className={td}>{r.customer ?? "—"}</td>
                    <td className={td}>{money(r.amount)}</td>
                    <td className={td}>{money(r.paid)}</td>
                    <td className={`${td} text-right`}>
                      {r.voidedAt ? voidedPill : voidBtn(() => setConfirm({ kind: "invoice", row: r }))}
                    </td>
                  </tr>
                ))
              : (rows as Receipt[]).map((r) => (
                  <tr key={r.id} className={`border-t border-border ${r.voidedAt ? "opacity-50" : ""}`}>
                    <td className={td}>{day(r.date)}</td>
                    <td className={`${td} font-semibold`}>{r.orderNumber ?? "—"}</td>
                    <td className={td}>{r.invoiceNo ?? "—"}</td>
                    <td className={td}>{r.customer ?? "—"}</td>
                    <td className={td}>{money(r.amount)}</td>
                    <td className={td}>
                      {r.account}
                      {r.reference && <span className="block text-[11px] text-muted">{r.reference}</span>}
                    </td>
                    <td className={`${td} text-right`}>
                      {r.voidedAt ? voidedPill : voidBtn(() => setConfirm({ kind: "receipt", row: r }))}
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} noun={view} />

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (!confirm) return;
          setError(null);
          voidIt.mutate(confirm);
        }}
        title={confirm?.kind === "invoice" ? "Void this sale?" : "Void this receipt?"}
        description={
          confirm?.kind === "invoice"
            ? `${confirm.row.orderNumber} (${confirm.row.docNo}, ${money(confirm.row.amount)}) will be cancelled: products go back to stock and the invoice${
                Number(confirm.row.paid) > 0 ? ` and the ${money(confirm.row.paid)} received` : ""
              } will be reversed in Accounts.`
            : confirm
              ? `The ${money(confirm.row.amount)} received on ${confirm.row.orderNumber} will be reversed in Accounts.`
              : ""
        }
        confirmLabel="Void"
        cancelLabel="Keep"
        pendingLabel="Voiding…"
        tone="danger"
        pending={voidIt.isPending}
      />
    </Card>
  );
}
