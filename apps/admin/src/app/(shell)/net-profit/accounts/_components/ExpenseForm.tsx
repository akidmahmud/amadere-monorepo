"use client";

import { useMemo, useState } from "react";
import { computeExpenseAmounts, fromPaisa, toPaisa } from "@amader/shared";
import { Button, Field, fieldInputClass } from "@amader/admin-ui";
import {
  useCashAccounts,
  useCostCentres,
  useCreateExpense,
  useExpenseCategories,
  useParties,
  type ExpenseInput,
} from "@/hooks/useAccounts";
import { SectionCard, money, today } from "./shared";

const VAT_RATES = [
  { value: "0", label: "No VAT (0%)" },
  { value: "5", label: "5%" },
  { value: "7.5", label: "7.5%" },
  { value: "10", label: "10%" },
  { value: "15", label: "15% — standard" },
];

const AIT_RATES = [
  { value: "0", label: "No deduction" },
  { value: "3", label: "3% — goods" },
  { value: "5", label: "5% — rent / services" },
  { value: "7", label: "7%" },
  { value: "10", label: "10% — professional" },
];

const VDS_RATES = [
  { value: "0", label: "No VDS" },
  { value: "33.33", label: "1/3 of VAT" },
  { value: "100", label: "Full VAT" },
];

const EMPTY = {
  expenseDate: today(),
  categoryId: "",
  costCentreId: "",
  partyId: "",
  amount: "",
  amountIncludesVat: false,
  vatRate: "0",
  mushakChallanNo: "",
  aitPercent: "0",
  vdsPercent: "0",
  paymentStatus: "paid" as "paid" | "due" | "partial",
  paidNow: "",
  paidFromAccountId: "",
  dueDate: "",
  note: "",
};

export function ExpenseForm() {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);

  const { data: categories } = useExpenseCategories();
  const { data: costCentres } = useCostCentres();
  const { data: parties } = useParties({ pageSize: 200 });
  const { data: accounts } = useCashAccounts();
  const create = useCreateExpense();

  const set = <K extends keyof typeof EMPTY>(
    key: K,
    value: (typeof EMPTY)[K],
  ) => setForm((f) => ({ ...f, [key]: value }));

  // The same function the API uses to save (spec §5). If this recomputed the
  // split independently the strip could show one figure and store another.
  const amounts = useMemo(() => {
    if (!form.amount) return null;
    try {
      return computeExpenseAmounts({
        amount: toPaisa(form.amount),
        amountIncludesVat: form.amountIncludesVat,
        vatRate: Math.round(Number(form.vatRate) * 100),
        aitPercent: Math.round(Number(form.aitPercent) * 100),
        vdsPercent: Math.round(Number(form.vdsPercent) * 100),
      });
    } catch {
      // Half-typed values are not an error state — the strip just waits.
      return null;
    }
  }, [
    form.amount,
    form.amountIncludesVat,
    form.vatRate,
    form.aitPercent,
    form.vdsPercent,
  ]);

  const movesMoney = form.paymentStatus !== "due";
  const needsDueDate = form.paymentStatus !== "paid";

  const valid =
    form.categoryId !== "" &&
    form.partyId !== "" &&
    Number(form.amount) > 0 &&
    (!movesMoney || form.paidFromAccountId !== "") &&
    (form.paymentStatus !== "partial" ||
      (Number(form.paidNow) > 0 &&
        amounts !== null &&
        Number(form.paidNow) < Number(fromPaisa(amounts.netPayable))));

  function submit() {
    setError(null);
    const input: ExpenseInput = {
      expenseDate: form.expenseDate,
      categoryId: Number(form.categoryId),
      costCentreId: form.costCentreId ? Number(form.costCentreId) : undefined,
      partyId: Number(form.partyId),
      amount: form.amount,
      amountIncludesVat: form.amountIncludesVat,
      vatRate: form.vatRate,
      mushakChallanNo: form.mushakChallanNo || undefined,
      aitPercent: form.aitPercent,
      vdsPercent: form.vdsPercent,
      paymentStatus: form.paymentStatus,
      paidNow: form.paymentStatus === "partial" ? form.paidNow : undefined,
      paidFromAccountId: movesMoney
        ? Number(form.paidFromAccountId)
        : undefined,
      dueDate: needsDueDate && form.dueDate ? form.dueDate : undefined,
      note: form.note || undefined,
    };
    create.mutate(input, {
      onSuccess: () => setForm({ ...EMPTY, expenseDate: form.expenseDate }),
      onError: (e: unknown) =>
        setError(e instanceof Error ? e.message : "Could not save the expense"),
    });
  }

  return (
    <SectionCard
      title="Record an expense"
      subtitle="An unpaid or partly paid bill creates its payable automatically — do not retype it in Dues"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Expense date" required>
          <input
            type="date"
            value={form.expenseDate}
            onChange={(e) => set("expenseDate", e.target.value)}
            className={fieldInputClass}
          />
        </Field>

        <Field label="Category" required>
          <select
            value={form.categoryId}
            onChange={(e) => set("categoryId", e.target.value)}
            className={fieldInputClass}
          >
            <option value="">Pick a category…</option>
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Cost centre">
          <select
            value={form.costCentreId}
            onChange={(e) => set("costCentreId", e.target.value)}
            className={fieldInputClass}
          >
            <option value="">All units</option>
            {(costCentres ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Payee" required hint="From the party list, not free text">
          <select
            value={form.partyId}
            onChange={(e) => set("partyId", e.target.value)}
            className={fieldInputClass}
          >
            <option value="">Pick a payee…</option>
            {(parties?.items ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Amount (৳)" required>
          <input
            type="number"
            step="0.01"
            min={0}
            value={form.amount}
            onChange={(e) => set("amount", e.target.value)}
            className={fieldInputClass}
          />
        </Field>

        <Field label="VAT rate">
          <select
            value={form.vatRate}
            onChange={(e) => set("vatRate", e.target.value)}
            className={fieldInputClass}
          >
            {VAT_RATES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </Field>

        <label className="flex items-end gap-2 pb-2.5 text-sm text-text">
          <input
            type="checkbox"
            checked={form.amountIncludesVat}
            onChange={(e) => set("amountIncludesVat", e.target.checked)}
          />
          Amount already includes VAT
        </label>

        <Field
          label="Mushak 6.3 challan no."
          hint="Needed to claim the input VAT"
        >
          <input
            value={form.mushakChallanNo}
            onChange={(e) => set("mushakChallanNo", e.target.value)}
            className={fieldInputClass}
          />
        </Field>

        <Field label="AIT / source tax">
          <select
            value={form.aitPercent}
            onChange={(e) => set("aitPercent", e.target.value)}
            className={fieldInputClass}
          >
            {AIT_RATES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="VAT deducted at source">
          <select
            value={form.vdsPercent}
            onChange={(e) => set("vdsPercent", e.target.value)}
            className={fieldInputClass}
          >
            {VDS_RATES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Payment status" required>
          <select
            value={form.paymentStatus}
            onChange={(e) =>
              set("paymentStatus", e.target.value as typeof form.paymentStatus)
            }
            className={fieldInputClass}
          >
            <option value="paid">Paid now</option>
            <option value="due">Unpaid — send to Payables</option>
            <option value="partial">Partially paid</option>
          </select>
        </Field>

        {form.paymentStatus === "partial" ? (
          <Field label="Amount paid now (৳)" required>
            <input
              type="number"
              step="0.01"
              min={0}
              value={form.paidNow}
              onChange={(e) => set("paidNow", e.target.value)}
              className={fieldInputClass}
            />
          </Field>
        ) : null}

        {movesMoney ? (
          <Field label="Paid from account" required>
            <select
              value={form.paidFromAccountId}
              onChange={(e) => set("paidFromAccountId", e.target.value)}
              className={fieldInputClass}
            >
              <option value="">Choose an account…</option>
              {(accounts ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        {needsDueDate ? (
          <Field label="Payment due date">
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => set("dueDate", e.target.value)}
              className={fieldInputClass}
            />
          </Field>
        ) : null}

        <Field label="Note" className="sm:col-span-2">
          <input
            value={form.note}
            onChange={(e) => set("note", e.target.value)}
            placeholder="What was this for?"
            className={fieldInputClass}
          />
        </Field>
      </div>

      {amounts ? (
        <div className="mt-4 grid grid-cols-2 gap-3 rounded-sm bg-surface-2 p-3 sm:grid-cols-5">
          {[
            ["Net amount", amounts.netAmount],
            ["VAT", amounts.vatAmount],
            ["Gross bill", amounts.grossAmount],
            ["Withheld at source", amounts.aitAmount + amounts.vdsAmount],
            ["Net payable", amounts.netPayable],
          ].map(([label, value], i) => (
            <div key={label as string}>
              <div className="text-xs text-secondary">{label}</div>
              <div
                className={`text-sm ${i === 4 ? "font-bold text-text" : "font-semibold text-text"}`}
              >
                {money(fromPaisa(value as number))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="primary"
          disabled={!valid || create.isPending}
          onClick={submit}
        >
          {create.isPending ? "Saving…" : "+ Add expense"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setForm(EMPTY)}>
          Clear form
        </Button>
      </div>
    </SectionCard>
  );
}
