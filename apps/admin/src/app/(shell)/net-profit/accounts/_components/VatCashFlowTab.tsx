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
  useCashAccounts,
  useCashFlowByAccount,
  useLockPeriod,
  usePendingCod,
  usePeriodLocks,
  usePostingSettings,
  useUnlockPeriod,
  useUpdatePostingSettings,
  useVatAtRisk,
  useVatReturn,
  type DateRange,
  type PendingCodBatch,
} from "@/hooks/useAccounts";
import { CodSettlementModal } from "./CodSettlementModal";
import { EmptyState, SectionCard, money, today } from "./shared";

const RISK_REASON: Record<string, string> = {
  NO_CHALLAN: "No Mushak 6.3 challan number",
  NO_SUPPLIER_BIN: "Supplier has no BIN on file",
};

export function VatCashFlowTab({ range }: { range: DateRange }) {
  const [settling, setSettling] = useState<PendingCodBatch | null>(null);
  const [lockMonth, setLockMonth] = useState(today().slice(0, 7));

  const { data: vat } = useVatReturn(range);
  const { data: atRisk } = useVatAtRisk(range);
  const { data: flow } = useCashFlowByAccount(range);
  const { data: pendingCod } = usePendingCod();
  const { data: accounts } = useCashAccounts();
  const { data: posting } = usePostingSettings();
  const { data: locks } = usePeriodLocks();
  const updatePosting = useUpdatePostingSettings();
  const lockPeriod = useLockPeriod();
  const unlockPeriod = useUnlockPeriod();

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          variant="success"
          label="Output VAT (sales)"
          value={money(vat?.outputVat)}
          footer="Collected from customers"
        />
        <StatCard
          variant="info"
          label="Input VAT claimable"
          value={money(vat?.inputVatClaimable)}
          footer="Challan + supplier BIN present"
        />
        <StatCard
          variant="warning"
          label="Net VAT to NBR"
          value={money(vat?.netPayable)}
          footer="Mushak 9.1, due by the 15th"
        />
        <StatCard
          variant="danger"
          label="Withheld, not deposited"
          value={money(vat?.withheldNotDeposited)}
          footer="AIT + VDS — this is not your money"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="VAT return" subtitle="Mushak 9.1 working">
          <ul className="flex flex-col">
            {(vat?.lines ?? []).map((line) => (
              <li
                key={line.label}
                className="flex justify-between border-b border-border py-2 text-sm last:border-0"
              >
                <span className="text-secondary">{line.label}</span>
                <span className="font-semibold text-text">
                  {money(line.amount)}
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard
          title="Input VAT at risk"
          subtitle="Missing challan or BIN = rebate lost"
        >
          {(atRisk ?? []).length === 0 ? (
            <EmptyState>Every claim is backed. Nothing at risk.</EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <thead>
                  <tr>
                    <th>Voucher</th>
                    <th>Supplier</th>
                    <th>Why</th>
                    <th className="text-right">VAT</th>
                  </tr>
                </thead>
                <tbody>
                  {(atRisk ?? []).map((r) => (
                    <tr key={r.expenseId}>
                      <td className="font-mono text-xs">{r.voucherNo}</td>
                      <td>{r.partyName}</td>
                      <td className="text-xs text-danger">
                        {RISK_REASON[r.reason] ?? r.reason}
                      </td>
                      <td className="text-right">{money(r.vatAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="COD with courier"
        subtitle="No courier reports its payout — enter what actually landed to clear the batch"
      >
        {(pendingCod ?? []).length === 0 ? (
          <EmptyState>Nothing waiting to be settled.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <thead>
                <tr>
                  <th>Courier</th>
                  <th className="text-right">Shipments</th>
                  <th className="text-right">COD collected</th>
                  <th className="text-right">Their charges</th>
                  <th className="text-right">Expected payout</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(pendingCod ?? []).map((b) => (
                  <tr key={b.provider}>
                    <td className="font-semibold">
                      {b.partyName ?? b.provider}
                    </td>
                    <td className="text-right">{b.shipmentCount}</td>
                    <td className="text-right">{money(b.codCollected)}</td>
                    <td className="text-right">−{money(b.courierCharges)}</td>
                    <td className="text-right font-semibold">
                      {money(b.expected)}
                    </td>
                    <td className="text-right">
                      {b.partyId ? (
                        <button
                          type="button"
                          onClick={() => setSettling(b)}
                          className="text-sm font-semibold text-brand-500"
                        >
                          Settle
                        </button>
                      ) : (
                        <span className="text-xs text-danger">
                          No party mapped
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Cash flow by account"
        subtitle="Only recorded payments move these balances"
        actions={
          <a
            href={accountsExportUrl("cashflow", range)}
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
                <th>Account</th>
                <th>Type</th>
                <th className="text-right">Opening</th>
                <th className="text-right">Money in</th>
                <th className="text-right">Money out</th>
                <th className="text-right">Closing</th>
              </tr>
            </thead>
            <tbody>
              {(flow ?? []).length === 0 ? (
                <TableEmptyRow colSpan={6}>No cash accounts yet.</TableEmptyRow>
              ) : (
                (flow ?? []).map((r) => (
                  <tr key={r.accountId}>
                    <td className="font-semibold">{r.name}</td>
                    <td className="text-xs">
                      {r.type.replace(/_/g, " ").toLowerCase()}
                    </td>
                    <td className="text-right">{money(r.opening)}</td>
                    <td className="text-right text-success">
                      {money(r.moneyIn)}
                    </td>
                    <td className="text-right text-danger">
                      {money(r.moneyOut)}
                    </td>
                    <td className="text-right font-semibold">
                      {money(r.closing)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Posting account"
          subtitle="Where prepaid sales and refunds are booked"
        >
          <Field
            label="Default cash account"
            hint="Until this is set, prepaid sales and refunds are not posted to the ledger at all — nothing is guessed."
          >
            <select
              value={posting?.defaultCashAccountId ?? ""}
              onChange={(e) =>
                updatePosting.mutate({
                  defaultCashAccountId: e.target.value
                    ? Number(e.target.value)
                    : null,
                })
              }
              className={fieldInputClass}
            >
              <option value="">Not set — nothing is being posted</option>
              {(accounts ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
        </SectionCard>

        <SectionCard
          title="Locked periods"
          subtitle="A filed month must stop changing — nothing can post into a locked period"
        >
          <div className="flex items-end gap-2">
            <Field label="Month" className="flex-1">
              <input
                type="month"
                value={lockMonth}
                onChange={(e) => setLockMonth(e.target.value)}
                className={fieldInputClass}
              />
            </Field>
            <Button
              type="button"
              variant="ghost"
              disabled={lockPeriod.isPending}
              onClick={() => lockPeriod.mutate({ month: `${lockMonth}-01` })}
            >
              Lock
            </Button>
          </div>

          {(locks ?? []).length === 0 ? (
            <p className="mt-3 text-xs text-secondary">
              No periods are locked.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-1.5">
              {(locks ?? []).map((l) => (
                <li
                  key={l.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-text">{l.month}</span>
                  <button
                    type="button"
                    onClick={() => unlockPeriod.mutate(`${l.month}-01`)}
                    className="text-sm font-semibold text-danger"
                  >
                    Unlock
                  </button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {settling ? (
        <CodSettlementModal
          batch={settling}
          onClose={() => setSettling(null)}
        />
      ) : null}
    </div>
  );
}
