"use client";

import { useState } from "react";
import { Button, Field, Modal, fieldInputClass } from "@amader/admin-ui";
import { useCashAccounts, type PaymentInput } from "@/hooks/useAccounts";
import { money, today } from "./shared";

export interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** What is still owed — the payment cannot exceed it. */
  outstanding: string;
  subtitle?: string;
  pending?: boolean;
  error?: string | null;
  onSubmit: (input: PaymentInput) => void;
}

/**
 * One payment dialog, shared by receivables, payables and the expense
 * register. All four fields are required by the API: a payment that does not
 * name its account cannot move a balance, and one without a date cannot land
 * in the right period.
 */
export function PaymentModal({
  open,
  onClose,
  title,
  outstanding,
  subtitle,
  pending,
  error,
  onSubmit,
}: PaymentModalProps) {
  const { data: accounts } = useCashAccounts();
  const [amount, setAmount] = useState(outstanding);
  const [paymentDate, setPaymentDate] = useState(today());
  const [accountId, setAccountId] = useState<string>("");
  const [reference, setReference] = useState("");

  const numericAmount = Number(amount);
  const tooMuch = numericAmount > Number(outstanding);
  const valid = numericAmount > 0 && !tooMuch && accountId !== "";

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="mb-4 text-xs text-secondary">
        {subtitle ? `${subtitle} — ` : ""}
        {money(outstanding)} outstanding
      </p>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Amount (৳)"
          required
          error={
            tooMuch ? `Only ${money(outstanding)} is outstanding` : undefined
          }
        >
          <input
            type="number"
            step="0.01"
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={fieldInputClass}
          />
        </Field>

        <Field label="Date" required>
          <input
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            className={fieldInputClass}
          />
        </Field>

        <Field
          label="Account"
          required
          hint="Which account the money moved through"
        >
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className={fieldInputClass}
          >
            <option value="">Choose an account…</option>
            {(accounts ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} — {money(a.balance)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Reference" hint="bKash TrxID, cheque no., bank ref">
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            className={fieldInputClass}
          />
        </Field>
      </div>

      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

      <div className="mt-5 flex gap-2">
        <Button
          type="button"
          variant="primary"
          disabled={!valid || pending}
          onClick={() =>
            onSubmit({
              amount,
              paymentDate,
              accountId: Number(accountId),
              reference: reference || undefined,
            })
          }
        >
          {pending ? "Saving…" : "Save payment"}
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}
