"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Icon } from "@amader/admin-ui";
import { useToast } from "@/components/ToastProvider";
import { proxyFetch } from "@/lib/api/proxy-client";
import { input, primaryBtn } from "./PosSubPage";

type Options = {
  categories: { id: number; name: string }[];
  /** The store's own cash / card / mobile accounts, else every active one. */
  accounts: { id: number; label: string }[];
};

/** Add a store expense (booked in Accounts against this store). */
export function PosExpenseDialog({
  storeId,
  storeName,
  onClose,
}: {
  storeId: number;
  storeName: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const qc = useQueryClient();
  const { data: opt, error } = useQuery({
    queryKey: ["pos-expense-options", storeId],
    queryFn: () =>
      proxyFetch<Options>(`/admin/pos/expenses/options?storeId=${storeId}`),
  });
  const [date, setDate] = useState(() =>
    new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" }),
  );
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [paidTo, setPaidTo] = useState("");
  const [note, setNote] = useState("");
  const amt = Number(amount);
  const valid = !!categoryId && amt > 0 && !!date;

  const save = useMutation({
    mutationFn: () =>
      proxyFetch(`/admin/pos/expenses?storeId=${storeId}`, {
        method: "POST",
        body: JSON.stringify({
          date,
          categoryId: Number(categoryId),
          amount: amt,
          accountId: Number(accountId || opt?.accounts[0]?.id),
          paidTo: paidTo.trim() || undefined,
          note: note.trim() || undefined,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pos-expenses"] });
      qc.invalidateQueries({ queryKey: ["pos-report-profit"] });
      toast.push("Expense added", "success");
      onClose();
    },
    onError: (e) => toast.push(e.message),
  });

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Add expense"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-start gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-amber-50 text-amber-600">
            <Icon name="payments" size={22} />
          </span>
          <div>
            <h2 className="text-lg font-bold">Add expense — {storeName}</h2>
            <p className="text-sm text-gray-600">
              Booked in Accounts against this store, so Store profit counts it.
            </p>
          </div>
        </div>
        {error ? (
          <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {(error as Error).message}
          </p>
        ) : !opt ? (
          <p className="py-6 text-center text-gray-500">Loading…</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-bold">Date</span>
              <input
                type="date"
                className={input}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                aria-label="Expense date"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-bold">Amount (৳) *</span>
              <input
                className={input}
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                aria-label="Expense amount"
                autoFocus
              />
            </label>
            <label className="col-span-2 flex flex-col gap-1">
              <span className="text-xs font-bold">Category *</span>
              <select
                className={input}
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                aria-label="Expense category"
              >
                <option value="">Select…</option>
                {opt.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-bold">Paid from</span>
              <select
                className={input}
                value={accountId || opt.accounts[0]?.id || ""}
                onChange={(e) => setAccountId(e.target.value)}
                aria-label="Paid from"
              >
                {opt.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-bold">Paid to (optional)</span>
              <input
                className={input}
                value={paidTo}
                placeholder="e.g. Landlord, DESCO"
                onChange={(e) => setPaidTo(e.target.value)}
                aria-label="Paid to"
              />
            </label>
            <label className="col-span-2 flex flex-col gap-1">
              <span className="text-xs font-bold">Note (optional)</span>
              <input
                className={input}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                aria-label="Expense note"
              />
            </label>
            {opt.accounts.length === 0 && (
              <p className="col-span-2 text-xs text-red-600">
                No money account to pay from — add one in Accounts first.
              </p>
            )}
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            className="h-10 rounded-lg border border-gray-200 px-4 text-sm font-semibold"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className={primaryBtn}
            disabled={!valid || save.isPending || !opt?.accounts.length}
            onClick={() => save.mutate()}
          >
            {save.isPending ? "Saving…" : "Add expense"}
          </button>
        </div>
      </div>
    </div>
  );
}
