"use client";

import { useState } from "react";
import {
  Button,
  Field,
  StatCard,
  Table,
  TableEmptyRow,
  fieldInputClass,
} from "@amader/admin-ui";
import {
  accountsExportUrl,
  useAgeing,
  useCreateDue,
  useDues,
  useParties,
  usePendingCod,
  useRecordDuePayment,
  useVoidDue,
  type DateRange,
  type Due,
  type DueKind,
} from "@/hooks/useAccounts";
import { PaymentModal } from "./PaymentModal";
import { BUCKET_LABEL, SectionCard, StatusPill, money, today } from "./shared";

/**
 * Receivables and payables are the same screen with different labels and one
 * different KPI, so they share a component rather than being copy-pasted.
 */
export function DuesPanel({
  kind,
  range,
}: {
  kind: DueKind;
  range: DateRange;
}) {
  const receivable = kind === "RECEIVABLE";
  const [paying, setPaying] = useState<Due | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [form, setForm] = useState({
    partyId: "",
    amount: "",
    issueDate: today(),
    dueDate: "",
    note: "",
  });
  const [formError, setFormError] = useState<string | null>(null);

  const query = { ...range, kind, pageSize: 100 };
  const { data } = useDues(query);
  const { data: ageing } = useAgeing(kind);
  const { data: parties } = useParties({ pageSize: 200 });
  const { data: pendingCod } = usePendingCod();
  const create = useCreateDue();
  const recordPayment = useRecordDuePayment();
  const voidDue = useVoidDue();

  const rows = data?.items ?? [];
  const codTotal = (pendingCod ?? []).reduce(
    (acc, b) => acc + Number(b.codCollected),
    0,
  );
  const fromVouchers = rows
    .filter((d) => d.source === "EXPENSE")
    .reduce((acc, d) => acc + Number(d.remaining), 0);

  const valid = form.partyId !== "" && Number(form.amount) > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          variant={receivable ? "warning" : "dark"}
          label={receivable ? "Total receivable" : "Total payable"}
          value={money(ageing?.total)}
        />
        <StatCard
          variant="danger"
          label="Overdue"
          value={money(ageing?.overdue)}
        />
        {receivable ? (
          <StatCard
            variant="info"
            label="COD with courier"
            value={money(String(codTotal))}
            footer="Collected, not yet remitted"
          />
        ) : (
          <StatCard
            variant="info"
            label="From unpaid vouchers"
            value={money(String(fromVouchers))}
            footer="Auto-linked, not retyped"
          />
        )}
        <StatCard
          variant="primary"
          label="Average age"
          value={`${ageing?.averageAgeDays ?? 0} days`}
          footer="Weighted by amount"
        />
      </div>

      <SectionCard
        title={receivable ? "Add a receivable" : "Add a payable"}
        subtitle={
          receivable
            ? "Manual entry is for opening balances and off-system sales only"
            : "Bills go in through Expenses — use this only for opening balances, loans and statutory dues"
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Party" required>
            <select
              value={form.partyId}
              onChange={(e) => setForm({ ...form, partyId: e.target.value })}
              className={fieldInputClass}
            >
              <option value="">Pick a party…</option>
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
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className={fieldInputClass}
            />
          </Field>
          <Field label="Issue date" required>
            <input
              type="date"
              value={form.issueDate}
              onChange={(e) => setForm({ ...form, issueDate: e.target.value })}
              className={fieldInputClass}
            />
          </Field>
          <Field label="Due date">
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              className={fieldInputClass}
            />
          </Field>
          <Field label="Note">
            <input
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="What is this for?"
              className={fieldInputClass}
            />
          </Field>
        </div>

        {formError ? (
          <p className="mt-3 text-sm text-danger">{formError}</p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="primary"
            disabled={!valid || create.isPending}
            onClick={() => {
              setFormError(null);
              create.mutate(
                {
                  kind,
                  partyId: Number(form.partyId),
                  amount: form.amount,
                  issueDate: form.issueDate,
                  dueDate: form.dueDate || undefined,
                  note: form.note || undefined,
                },
                {
                  onSuccess: () =>
                    setForm({
                      partyId: "",
                      amount: "",
                      issueDate: today(),
                      dueDate: "",
                      note: "",
                    }),
                  onError: (e: unknown) =>
                    setFormError(
                      e instanceof Error ? e.message : "Could not save",
                    ),
                },
              );
            }}
          >
            {create.isPending
              ? "Saving…"
              : receivable
                ? "+ Add receivable"
                : "+ Add payable"}
          </Button>
          <a
            href={accountsExportUrl("dues", query)}
            className="inline-flex items-center text-sm font-semibold text-brand-500"
          >
            Export Excel
          </a>
        </div>
      </SectionCard>

      <SectionCard
        title={receivable ? "Receivables" : "Payables"}
        subtitle={`${rows.length} row${rows.length === 1 ? "" : "s"}`}
      >
        <div className="overflow-x-auto">
          <Table>
            <thead>
              <tr>
                <th>Doc no</th>
                <th>Party</th>
                <th>Source</th>
                <th className="text-right">Amount</th>
                <th className="text-right">
                  {receivable ? "Received" : "Paid"}
                </th>
                <th className="text-right">Remaining</th>
                <th>Due date</th>
                <th>Age</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <TableEmptyRow colSpan={10}>
                  {receivable ? "Nothing outstanding." : "Nothing owed."}
                </TableEmptyRow>
              ) : (
                rows.map((d) => (
                  <tr key={d.id}>
                    <td className="font-mono text-xs">{d.docNo}</td>
                    <td>{d.partyName}</td>
                    <td className="text-xs text-secondary">
                      {d.source.replace(/_/g, " ").toLowerCase()}
                    </td>
                    <td className="text-right">{money(d.amount)}</td>
                    <td className="text-right">{money(d.paidAmount)}</td>
                    <td className="text-right font-semibold">
                      {money(d.remaining)}
                    </td>
                    <td>{d.dueDate ? d.dueDate.slice(0, 10) : "No date"}</td>
                    <td className="text-xs">
                      {d.ageDays > 0
                        ? `${d.ageDays}d · ${BUCKET_LABEL[d.bucket]}`
                        : "—"}
                    </td>
                    <td>
                      <StatusPill status={d.status} />
                    </td>
                    <td className="whitespace-nowrap text-right">
                      {d.status !== "PAID" ? (
                        <button
                          type="button"
                          onClick={() => {
                            setPayError(null);
                            setPaying(d);
                          }}
                          className="mr-3 text-sm font-semibold text-brand-500"
                        >
                          {receivable ? "Receive" : "Pay"}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            confirm(
                              `Void ${d.docNo}? This reverses any payments against it.`,
                            )
                          ) {
                            voidDue.mutate(d.id);
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
          title={
            receivable
              ? `Receive against ${paying.docNo}`
              : `Pay ${paying.docNo}`
          }
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
    </div>
  );
}
