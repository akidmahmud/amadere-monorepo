"use client";

import { useState } from "react";
import {
  Button,
  Field,
  Modal,
  Table,
  TableEmptyRow,
  fieldInputClass,
} from "@amader/admin-ui";
import {
  accountsExportUrl,
  useCostCentres,
  useExpenseCategories,
  useExpenses,
  useRecordExpensePayment,
  useUpdateExpense,
  useVoidExpense,
  type DateRange,
  type Expense,
  type ExpenseFilters,
} from "@/hooks/useAccounts";
import { ExpenseForm } from "./ExpenseForm";
import { PaymentModal } from "./PaymentModal";
import { SectionCard, StatusPill, money } from "./shared";

export function ExpensesTab({ range }: { range: DateRange }) {
  const [filters, setFilters] = useState<ExpenseFilters>({});
  const [paying, setPaying] = useState<Expense | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    categoryId: "",
    costCentreId: "",
    mushakChallanNo: "",
    dueDate: "",
    note: "",
  });

  const { data: categories } = useExpenseCategories();
  const { data: costCentres } = useCostCentres();
  const voidExpense = useVoidExpense();
  const recordPayment = useRecordExpensePayment();
  const updateExpense = useUpdateExpense();

  // One filter object drives the table, the totals and the export, so the
  // downloaded file always matches what is on screen.
  const query: ExpenseFilters = { ...range, ...filters, pageSize: 100 };
  const { data } = useExpenses(query);
  const rows = data?.items ?? [];

  const set = <K extends keyof ExpenseFilters>(
    key: K,
    value: ExpenseFilters[K],
  ) => setFilters((f) => ({ ...f, [key]: value }));

  return (
    <div className="flex flex-col gap-4">
      <SectionCard
        title="Filter"
        subtitle="Drives the table, the totals and every export"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Category">
            <select
              value={filters.categoryId ?? ""}
              onChange={(e) =>
                set(
                  "categoryId",
                  e.target.value ? Number(e.target.value) : undefined,
                )
              }
              className={fieldInputClass}
            >
              <option value="">All categories</option>
              {(categories ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Cost centre">
            <select
              value={filters.costCentreId ?? ""}
              onChange={(e) =>
                set(
                  "costCentreId",
                  e.target.value ? Number(e.target.value) : undefined,
                )
              }
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

          <Field label="Status">
            <select
              value={filters.paymentStatus ?? ""}
              onChange={(e) =>
                set(
                  "paymentStatus",
                  (e.target.value ||
                    undefined) as ExpenseFilters["paymentStatus"],
                )
              }
              className={fieldInputClass}
            >
              <option value="">All statuses</option>
              <option value="PAID">Paid</option>
              <option value="PARTIAL">Partial</option>
              <option value="UNPAID">Unpaid</option>
            </select>
          </Field>

          <Field label="Search">
            <input
              value={filters.q ?? ""}
              onChange={(e) => set("q", e.target.value || undefined)}
              placeholder="Voucher, payee, note…"
              className={fieldInputClass}
            />
          </Field>
        </div>
      </SectionCard>

      <ExpenseForm />

      <SectionCard
        title="Expense register"
        subtitle={`${rows.length} row${rows.length === 1 ? "" : "s"}`}
        actions={
          <a
            href={accountsExportUrl("expenses", query)}
            className="text-sm font-semibold text-brand-500"
          >
            Export Excel
          </a>
        }
      >
        <div className="overflow-x-auto">
          <Table>
            <thead>
              <tr>
                <th>Voucher</th>
                <th>Date</th>
                <th>Category</th>
                <th>Payee</th>
                <th className="text-right">Net</th>
                <th className="text-right">VAT</th>
                <th className="text-right">Payable</th>
                <th className="text-right">Paid</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <TableEmptyRow colSpan={10}>
                  No expenses in this range.
                </TableEmptyRow>
              ) : (
                rows.map((e) => (
                  <tr key={e.id}>
                    <td className="font-mono text-xs">{e.voucherNo}</td>
                    <td>{e.expenseDate.slice(0, 10)}</td>
                    <td>{e.categoryName}</td>
                    <td>{e.partyName}</td>
                    <td className="text-right">{money(e.netAmount)}</td>
                    <td className="text-right">{money(e.vatAmount)}</td>
                    <td className="text-right">{money(e.netPayable)}</td>
                    <td className="text-right">{money(e.paidAmount)}</td>
                    <td>
                      <StatusPill status={e.paymentStatus} />
                    </td>
                    <td className="whitespace-nowrap text-right">
                      {e.paymentStatus !== "PAID" ? (
                        <button
                          type="button"
                          onClick={() => {
                            setPayError(null);
                            setPaying(e);
                          }}
                          className="mr-3 text-sm font-semibold text-brand-500"
                        >
                          Pay
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          setEditError(null);
                          setEditing(e);
                          setEditForm({
                            categoryId: String(e.categoryId),
                            costCentreId: e.costCentreId
                              ? String(e.costCentreId)
                              : "",
                            mushakChallanNo: e.mushakChallanNo ?? "",
                            dueDate: e.dueDate?.slice(0, 10) ?? "",
                            note: e.note ?? "",
                          });
                        }}
                        className="mr-3 text-sm font-semibold text-brand-500"
                      >
                        Edit
                      </button>
                      {/* Void, not delete: the voucher and its reversing
                          entries stay so the books still reconcile. */}
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            confirm(
                              `Void ${e.voucherNo}? This reverses its ledger entries.`,
                            )
                          ) {
                            voidExpense.mutate(e.id);
                          }
                        }}
                        className="text-sm font-semibold text-danger"
                      >
                        Void
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>
      </SectionCard>

      {paying ? (
        <PaymentModal
          open
          onClose={() => setPaying(null)}
          title={`Pay ${paying.voucherNo}`}
          subtitle={paying.partyName}
          outstanding={paying.remaining}
          pending={recordPayment.isPending}
          error={payError}
          onSubmit={(input) =>
            recordPayment.mutate(
              { id: paying.id, ...input },
              {
                onSuccess: () => setPaying(null),
                onError: (err: unknown) =>
                  setPayError(
                    err instanceof Error
                      ? err.message
                      : "Could not record the payment",
                  ),
              },
            )
          }
        />
      ) : null}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={`Edit ${editing?.voucherNo ?? "expense"}`}
      >
        <p className="mb-4 text-xs text-secondary">
          Accounting amounts cannot be edited after posting. Void and re-enter
          the voucher if its amount is wrong.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Category" required>
            <select
              value={editForm.categoryId}
              onChange={(e) =>
                setEditForm({ ...editForm, categoryId: e.target.value })
              }
              className={fieldInputClass}
            >
              <option value="">Pick a category…</option>
              {(categories ?? []).map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Cost centre">
            <select
              value={editForm.costCentreId}
              onChange={(e) =>
                setEditForm({ ...editForm, costCentreId: e.target.value })
              }
              className={fieldInputClass}
            >
              <option value="">No cost centre</option>
              {(costCentres ?? []).map((centre) => (
                <option key={centre.id} value={centre.id}>
                  {centre.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Mushak 6.3 challan no.">
            <input
              value={editForm.mushakChallanNo}
              onChange={(e) =>
                setEditForm({ ...editForm, mushakChallanNo: e.target.value })
              }
              className={fieldInputClass}
            />
          </Field>
          <Field label="Payment due date">
            <input
              type="date"
              value={editForm.dueDate}
              onChange={(e) =>
                setEditForm({ ...editForm, dueDate: e.target.value })
              }
              className={fieldInputClass}
            />
          </Field>
          <Field label="Note" className="sm:col-span-2">
            <textarea
              value={editForm.note}
              onChange={(e) =>
                setEditForm({ ...editForm, note: e.target.value })
              }
              className={fieldInputClass}
              rows={3}
            />
          </Field>
        </div>
        {editError ? (
          <p className="mt-3 text-sm text-danger">{editError}</p>
        ) : null}
        <div className="mt-5 flex gap-2">
          <Button
            type="button"
            variant="primary"
            disabled={
              !editing || !editForm.categoryId || updateExpense.isPending
            }
            onClick={() => {
              if (!editing) return;
              setEditError(null);
              updateExpense.mutate(
                {
                  id: editing.id,
                  categoryId: Number(editForm.categoryId),
                  costCentreId: editForm.costCentreId
                    ? Number(editForm.costCentreId)
                    : undefined,
                  mushakChallanNo: editForm.mushakChallanNo,
                  dueDate: editForm.dueDate || undefined,
                  note: editForm.note,
                },
                {
                  onSuccess: () => setEditing(null),
                  onError: (err: unknown) =>
                    setEditError(
                      err instanceof Error
                        ? err.message
                        : "Could not update the expense",
                    ),
                },
              );
            }}
          >
            {updateExpense.isPending ? "Saving…" : "Save changes"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setEditing(null)}
          >
            Cancel
          </Button>
        </div>
      </Modal>
    </div>
  );
}
