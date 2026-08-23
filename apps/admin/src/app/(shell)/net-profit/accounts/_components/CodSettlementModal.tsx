"use client";

import { useState } from "react";
import { Button, Field, Modal, fieldInputClass } from "@amader/admin-ui";
import {
  useCashAccounts,
  useSettleCod,
  type PendingCodBatch,
} from "@/hooks/useAccounts";
import { money, today } from "./shared";

/**
 * The one step in the money flow that needs a human number: no courier
 * webhook reports what was actually paid out, so the admin enters the figure
 * from the bank statement and the batch clears.
 */
export function CodSettlementModal({
  batch,
  onClose,
}: {
  batch: PendingCodBatch;
  onClose: () => void;
}) {
  const { data: accounts } = useCashAccounts();
  const settle = useSettleCod();
  const [netPayout, setNetPayout] = useState(batch.expected);
  const [settlementDate, setSettlementDate] = useState(today());
  const [accountId, setAccountId] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);

  const difference = Number(netPayout) - Number(batch.expected);
  const valid = Number(netPayout) > 0 && accountId !== "";

  return (
    <Modal open onClose={onClose} title={`Settle ${batch.provider}`}>
      <div className="mb-4 grid grid-cols-2 gap-3 rounded-sm bg-surface-2 p-3 text-sm">
        <div>
          <div className="text-xs text-secondary">Shipments</div>
          <div className="font-semibold text-text">{batch.shipmentCount}</div>
        </div>
        <div>
          <div className="text-xs text-secondary">COD collected</div>
          <div className="font-semibold text-text">
            {money(batch.codCollected)}
          </div>
        </div>
        <div>
          <div className="text-xs text-secondary">Courier charges</div>
          <div className="font-semibold text-text">
            −{money(batch.courierCharges)}
          </div>
        </div>
        <div>
          <div className="text-xs text-secondary">Expected payout</div>
          <div className="font-bold text-text">{money(batch.expected)}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Actual payout (৳)"
          required
          hint="The figure on your bank statement"
        >
          <input
            type="number"
            step="0.01"
            value={netPayout}
            onChange={(e) => setNetPayout(e.target.value)}
            className={fieldInputClass}
          />
        </Field>

        <Field label="Settlement date" required>
          <input
            type="date"
            value={settlementDate}
            onChange={(e) => setSettlementDate(e.target.value)}
            className={fieldInputClass}
          />
        </Field>

        <Field label="Received into" required>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
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

        <Field label="Reference" hint="Bank or bKash reference">
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            className={fieldInputClass}
          />
        </Field>
      </div>

      {/* Shown before saving, not discovered afterwards — this gap is where
          courier disputes live. */}
      {Math.abs(difference) >= 0.005 ? (
        <p
          className={`mt-3 text-sm ${difference < 0 ? "text-danger" : "text-warning"}`}
        >
          {difference < 0 ? "Short by " : "Over by "}
          <strong>{money(String(Math.abs(difference)))}</strong> against the
          expected payout. This is recorded as an adjustment on the settlement
          so your account balance still matches the bank.
        </p>
      ) : null}

      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

      <div className="mt-5 flex gap-2">
        <Button
          type="button"
          variant="primary"
          disabled={!valid || settle.isPending}
          onClick={() => {
            setError(null);
            settle.mutate(
              {
                provider: batch.provider,
                settlementDate,
                netPayout,
                accountId: Number(accountId),
                reference: reference || undefined,
              },
              {
                onSuccess: onClose,
                onError: (e: unknown) =>
                  setError(
                    e instanceof Error
                      ? e.message
                      : "Could not record the settlement",
                  ),
              },
            );
          }}
        >
          {settle.isPending ? "Saving…" : "Record settlement"}
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}
