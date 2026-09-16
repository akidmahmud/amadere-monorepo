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
  useCashAccountLedger,
  useCashAccounts,
  useCreateCashAccount,
  useTransfer,
  useUpdateCashAccount,
  type CashAccount,
  type CashAccountType,
  type DateRange,
} from "@/hooks/useAccounts";
import { SectionCard, money, today } from "./shared";

const EMPTY_ACCOUNT = {
  name: "",
  type: "CASH" as CashAccountType,
  accountNumber: "",
  openingBalance: "0.00",
  openingDate: today(),
  isActive: true,
  sortOrder: "0",
};

function accountForm(account?: CashAccount | null) {
  return account
    ? {
        name: account.name,
        type: account.type,
        accountNumber: account.accountNumber ?? "",
        openingBalance: account.openingBalance,
        openingDate: account.openingDate.slice(0, 10),
        isActive: account.isActive,
        sortOrder: String(account.sortOrder),
      }
    : { ...EMPTY_ACCOUNT, openingDate: today() };
}

export function CashAccountsPanel({ range }: { range: DateRange }) {
  const { data: accounts } = useCashAccounts(true);
  const create = useCreateCashAccount();
  const update = useUpdateCashAccount();
  const transfer = useTransfer();
  const [editing, setEditing] = useState<CashAccount | "new" | null>(null);
  const [ledgerAccount, setLedgerAccount] = useState<CashAccount | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [form, setForm] = useState(EMPTY_ACCOUNT);
  const [error, setError] = useState<string | null>(null);
  const [transferForm, setTransferForm] = useState({
    fromAccountId: "",
    toAccountId: "",
    amount: "",
    transferDate: today(),
    reference: "",
    note: "",
  });

  const rows = accounts ?? [];
  const active = rows.filter((a) => a.isActive);

  function openAccount(account?: CashAccount) {
    setError(null);
    setForm(accountForm(account));
    setEditing(account ?? "new");
  }

  function closeAccount() {
    setEditing(null);
    setError(null);
  }

  function saveAccount() {
    setError(null);
    const input = {
      name: form.name.trim(),
      type: form.type,
      accountNumber: form.accountNumber.trim() || undefined,
      openingBalance: form.openingBalance,
      openingDate: form.openingDate,
      isActive: form.isActive,
      sortOrder: Number(form.sortOrder) || 0,
    };
    const options = {
      onSuccess: closeAccount,
      onError: (e: unknown) =>
        setError(e instanceof Error ? e.message : "Could not save the account"),
    };
    if (editing === "new") create.mutate(input, options);
    else if (editing) update.mutate({ id: editing.id, ...input }, options);
  }

  return (
    <>
      <SectionCard
        title="Cash & bank accounts"
        subtitle="The real places money sits. Balances are calculated from the ledger."
        actions={
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={active.length < 2}
              onClick={() => setTransferring(true)}
            >
              Transfer
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => openAccount()}
            >
              + Add account
            </Button>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <Table>
            <thead>
              <tr>
                <th>Account</th>
                <th>Type</th>
                <th>Number</th>
                <th>Opening date</th>
                <th className="text-right">Balance</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <TableEmptyRow colSpan={7}>
                  No accounts yet. Use “Add account” to create your first cash,
                  bank, or mobile-wallet account.
                </TableEmptyRow>
              ) : (
                rows.map((account) => (
                  <tr key={account.id}>
                    <td className="font-semibold">{account.name}</td>
                    <td>{account.type.replace("_", " ")}</td>
                    <td>{account.accountNumber ?? "—"}</td>
                    <td>{account.openingDate.slice(0, 10)}</td>
                    <td className="text-right font-semibold">
                      {money(account.balance)}
                    </td>
                    <td>{account.isActive ? "Active" : "Inactive"}</td>
                    <td>
                      <div className="flex gap-3">
                        <Button
                          type="button"
                          variant="link"
                          onClick={() => setLedgerAccount(account)}
                        >
                          Ledger
                        </Button>
                        <Button
                          type="button"
                          variant="link"
                          onClick={() => openAccount(account)}
                        >
                          Edit
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>
      </SectionCard>

      <Modal
        open={editing !== null}
        onClose={closeAccount}
        title={editing === "new" ? "Add account" : "Edit account"}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Account name" required className="sm:col-span-2">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Cash in hand, BRAC Bank, bKash…"
              className={fieldInputClass}
            />
          </Field>
          <Field label="Type" required>
            <select
              value={form.type}
              onChange={(e) =>
                setForm({ ...form, type: e.target.value as CashAccountType })
              }
              className={fieldInputClass}
            >
              <option value="CASH">Cash</option>
              <option value="BANK">Bank</option>
              <option value="MOBILE_WALLET">Mobile wallet</option>
            </select>
          </Field>
          <Field label="Account / wallet number">
            <input
              value={form.accountNumber}
              onChange={(e) =>
                setForm({ ...form, accountNumber: e.target.value })
              }
              className={fieldInputClass}
            />
          </Field>
          <Field label="Opening balance (৳)" required>
            <input
              type="number"
              step="0.01"
              value={form.openingBalance}
              onChange={(e) =>
                setForm({ ...form, openingBalance: e.target.value })
              }
              className={fieldInputClass}
            />
          </Field>
          <Field label="Opening date" required>
            <input
              type="date"
              value={form.openingDate}
              onChange={(e) =>
                setForm({ ...form, openingDate: e.target.value })
              }
              className={fieldInputClass}
            />
          </Field>
          <Field label="Sort order">
            <input
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
              className={fieldInputClass}
            />
          </Field>
          <label className="flex items-center gap-2 self-end py-2 text-sm text-text">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Active and available for payments
          </label>
        </div>
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        <div className="mt-5 flex gap-2">
          <Button
            type="button"
            variant="primary"
            disabled={
              !form.name.trim() ||
              !form.openingDate ||
              create.isPending ||
              update.isPending
            }
            onClick={saveAccount}
          >
            {create.isPending || update.isPending ? "Saving…" : "Save account"}
          </Button>
          <Button type="button" variant="ghost" onClick={closeAccount}>
            Cancel
          </Button>
        </div>
      </Modal>

      <Modal
        open={transferring}
        onClose={() => setTransferring(false)}
        title="Transfer between accounts"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="From" required>
            <select
              value={transferForm.fromAccountId}
              onChange={(e) =>
                setTransferForm({
                  ...transferForm,
                  fromAccountId: e.target.value,
                })
              }
              className={fieldInputClass}
            >
              <option value="">Choose an account…</option>
              {active.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="To" required>
            <select
              value={transferForm.toAccountId}
              onChange={(e) =>
                setTransferForm({
                  ...transferForm,
                  toAccountId: e.target.value,
                })
              }
              className={fieldInputClass}
            >
              <option value="">Choose an account…</option>
              {active.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Amount (৳)" required>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={transferForm.amount}
              onChange={(e) =>
                setTransferForm({ ...transferForm, amount: e.target.value })
              }
              className={fieldInputClass}
            />
          </Field>
          <Field label="Date" required>
            <input
              type="date"
              value={transferForm.transferDate}
              onChange={(e) =>
                setTransferForm({
                  ...transferForm,
                  transferDate: e.target.value,
                })
              }
              className={fieldInputClass}
            />
          </Field>
          <Field label="Reference">
            <input
              value={transferForm.reference}
              onChange={(e) =>
                setTransferForm({ ...transferForm, reference: e.target.value })
              }
              className={fieldInputClass}
            />
          </Field>
          <Field label="Note">
            <input
              value={transferForm.note}
              onChange={(e) =>
                setTransferForm({ ...transferForm, note: e.target.value })
              }
              className={fieldInputClass}
            />
          </Field>
        </div>
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        <div className="mt-5 flex gap-2">
          <Button
            type="button"
            variant="primary"
            disabled={
              !transferForm.fromAccountId ||
              !transferForm.toAccountId ||
              transferForm.fromAccountId === transferForm.toAccountId ||
              Number(transferForm.amount) <= 0 ||
              transfer.isPending
            }
            onClick={() => {
              setError(null);
              transfer.mutate(
                {
                  fromAccountId: Number(transferForm.fromAccountId),
                  toAccountId: Number(transferForm.toAccountId),
                  amount: transferForm.amount,
                  transferDate: transferForm.transferDate,
                  reference: transferForm.reference || undefined,
                  note: transferForm.note || undefined,
                },
                {
                  onSuccess: () => {
                    setTransferring(false);
                    setTransferForm({
                      fromAccountId: "",
                      toAccountId: "",
                      amount: "",
                      transferDate: today(),
                      reference: "",
                      note: "",
                    });
                  },
                  onError: (e: unknown) =>
                    setError(
                      e instanceof Error
                        ? e.message
                        : "Could not transfer funds",
                    ),
                },
              );
            }}
          >
            {transfer.isPending ? "Transferring…" : "Record transfer"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setTransferring(false)}
          >
            Cancel
          </Button>
        </div>
      </Modal>

      <AccountLedgerModal
        account={ledgerAccount}
        range={range}
        onClose={() => setLedgerAccount(null)}
      />
    </>
  );
}

function AccountLedgerModal({
  account,
  range,
  onClose,
}: {
  account: CashAccount | null;
  range: DateRange;
  onClose: () => void;
}) {
  const { data, isLoading } = useCashAccountLedger(account?.id ?? null, range);
  return (
    <Modal
      open={account !== null}
      onClose={onClose}
      title={`${account?.name ?? "Account"} ledger`}
      className="max-w-4xl"
    >
      <div className="mb-3 flex justify-between rounded-sm bg-surface-2 p-3 text-sm">
        <span>
          Opening: <strong>{money(data?.opening)}</strong>
        </span>
        <span>
          Closing: <strong>{money(data?.closing)}</strong>
        </span>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Source</th>
              <th>Reference</th>
              <th>Note</th>
              <th className="text-right">In</th>
              <th className="text-right">Out</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <TableEmptyRow colSpan={6}>Loading ledger…</TableEmptyRow>
            ) : (data?.entries.length ?? 0) === 0 ? (
              <TableEmptyRow colSpan={6}>
                No entries in this date range.
              </TableEmptyRow>
            ) : (
              data?.entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.entryDate.slice(0, 10)}</td>
                  <td>{entry.source.replaceAll("_", " ")}</td>
                  <td>{entry.reference ?? "—"}</td>
                  <td>{entry.note ?? "—"}</td>
                  <td className="text-right">
                    {entry.direction === "IN" ? money(entry.amount) : "—"}
                  </td>
                  <td className="text-right">
                    {entry.direction === "OUT" ? money(entry.amount) : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </div>
    </Modal>
  );
}
