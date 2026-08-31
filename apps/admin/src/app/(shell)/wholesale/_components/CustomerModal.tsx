"use client";

import { useState } from "react";
import { Button, Icon, Modal } from "@amader/admin-ui";
import {
  useSaveWholesaleCustomer,
  type WholesaleCustomer,
} from "@/hooks/useWholesale";

const inputClass =
  "h-11 w-full rounded-xl border border-border bg-surface px-4 py-2 text-sm text-text transition-all duration-200 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 placeholder:text-muted";

function ModalField({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col justify-end space-y-1.5">
      <div className="flex items-center justify-between gap-1 min-h-[20px]">
        <span className="text-xs font-bold tracking-wide text-secondary uppercase truncate">
          {label}
          {required && <span className="text-danger font-bold"> *</span>}
        </span>
        {hint && (
          <span className="flex-none text-[10px] text-muted whitespace-nowrap leading-none">
            {hint}
          </span>
        )}
      </div>
      {children}
    </label>
  );
}

export function CustomerModal({
  open,
  editing,
  onClose,
}: {
  open: boolean;
  editing: WholesaleCustomer | null;
  onClose: () => void;
}) {
  const save = useSaveWholesaleCustomer();

  const [form, setForm] = useState({
    name: editing?.name ?? "",
    phone: editing?.phone ?? "",
    address: editing?.address ?? "",
    creditLimit: editing?.creditLimit ?? "",
    creditDays: editing?.creditDays?.toString() ?? "",
    openingReceivable: "",
    note: editing?.note ?? "",
    isActive: editing?.isActive ?? true,
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await save.mutateAsync({
        id: editing?.id,
        name: form.name.trim(),
        phone: form.phone.trim(),
        address: form.address.trim() || undefined,
        creditLimit: form.creditLimit.trim() || undefined,
        creditDays: form.creditDays.trim()
          ? Number(form.creditDays)
          : undefined,
        openingReceivable: editing
          ? undefined
          : form.openingReceivable.trim() || undefined,
        note: form.note.trim() || undefined,
        isActive: form.isActive,
      });
      onClose();
    } catch {
      // Retain open on error so staff can correct input
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Edit Wholesale Customer" : "Add Wholesale Customer"}
      className="max-w-3xl"
    >
      <form onSubmit={submit} className="flex flex-col gap-6 p-1">
        {/* Banner header */}
        <div className="flex items-center gap-4 rounded-2xl border border-brand-500/20 bg-gradient-to-r from-brand-500/10 via-purple-500/5 to-surface p-5 shadow-sm">
          <div className="flex h-13 w-13 flex-none items-center justify-center rounded-2xl bg-brand-500 text-white shadow-md">
            <Icon name="store" size={26} />
          </div>
          <div>
            <h4 className="text-base font-bold text-text">
              {editing ? editing.name : "New Wholesale Account Registration"}
            </h4>
            <p className="text-xs text-secondary mt-0.5">
              {editing
                ? `Customer Account ID #${editing.id} · ${editing.orderCount} total lifetime orders`
                : "Register a B2B shop, trader, or bulk buyer profile for wholesale invoicing and credit ledger management."}
            </p>
          </div>
        </div>

        {/* Section 1: Basic Info */}
        <div className="space-y-4 rounded-2xl border border-border bg-surface-2 p-5 shadow-sm">
          <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-secondary border-b border-border/60 pb-2.5">
            <Icon name="person" size={18} className="text-brand-500" />
            Shop & Contact Details
          </h4>

          <div className="grid gap-4 sm:grid-cols-2">
            <ModalField label="Shop / Trader Name" required>
              <input
                className={inputClass}
                required
                placeholder="e.g. Al-Madina Store or Royal Traders"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </ModalField>

            <ModalField
              label="Mobile Number"
              required
              hint="Unique identifier for shop identification"
            >
              <input
                className={inputClass}
                required
                placeholder="01XXXXXXXXX"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </ModalField>

            <div className="sm:col-span-2">
              <ModalField label="Store / Delivery Address">
                <input
                  className={inputClass}
                  placeholder="Market name, Shop no., Road, Area, District"
                  value={form.address}
                  onChange={(e) =>
                    setForm({ ...form, address: e.target.value })
                  }
                />
              </ModalField>
            </div>
          </div>
        </div>

        {/* Section 2: Credit Terms */}
        <div className="space-y-4 rounded-2xl border border-border bg-surface-2 p-5 shadow-sm">
          <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-secondary border-b border-border/60 pb-2.5">
            <Icon
              name="account_balance_wallet"
              size={18}
              className="text-brand-500"
            />
            Credit & Financial Setup
          </h4>

          <div className="grid gap-4 sm:grid-cols-2">
            <ModalField
              label="Credit Limit (৳)"
              hint="Max allowed unpaid credit"
            >
              <div className="relative">
                <span className="absolute left-3.5 top-3 text-xs font-bold text-muted">
                  ৳
                </span>
                <input
                  type="number"
                  min={0}
                  className={`${inputClass} pl-8 font-semibold`}
                  placeholder="0.00"
                  value={form.creditLimit}
                  onChange={(e) =>
                    setForm({ ...form, creditLimit: e.target.value })
                  }
                />
              </div>
            </ModalField>

            <ModalField
              label="Payment Terms (Days)"
              hint="Invoice payment window"
            >
              <input
                type="number"
                min={0}
                className={`${inputClass} font-semibold`}
                placeholder="e.g. 15 or 30 days"
                value={form.creditDays}
                onChange={(e) =>
                  setForm({ ...form, creditDays: e.target.value })
                }
              />
            </ModalField>

            {!editing && (
              <div className="sm:col-span-2">
                <ModalField
                  label="Opening Balance Owed (৳)"
                  hint="Pre-existing due balance owed prior to system migration"
                >
                  <div className="relative">
                    <span className="absolute left-3.5 top-3 text-xs font-bold text-muted">
                      ৳
                    </span>
                    <input
                      type="number"
                      min={0}
                      className={`${inputClass} pl-8 font-semibold text-rose-600 dark:text-rose-400`}
                      placeholder="0.00"
                      value={form.openingReceivable}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          openingReceivable: e.target.value,
                        })
                      }
                    />
                  </div>
                </ModalField>
              </div>
            )}
          </div>
        </div>

        {/* Section 3: Notes & Active state */}
        <div className="space-y-4">
          <ModalField label="Internal Administrative Note (Optional)">
            <input
              className={inputClass}
              placeholder="e.g. Special pricing tier agreement, preferred courier, or point of contact"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </ModalField>

          <label className="flex items-center gap-3 cursor-pointer select-none rounded-xl border border-border p-4 hover:bg-surface-2 transition-colors">
            <input
              type="checkbox"
              className="h-5 w-5 rounded-md border-border text-brand-600 focus:ring-brand-500"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            <div>
              <span className="block text-sm font-bold text-text">
                Active Wholesale Buyer Account
              </span>
              <span className="block text-xs text-secondary">
                Active buyers can be selected for new orders. Deactivating hides
                them from order placement dropdowns.
              </span>
            </div>
          </label>
        </div>

        {save.isError && (
          <div className="rounded-xl bg-rose-500/10 p-4 text-xs font-semibold text-rose-600 dark:text-rose-400">
            {save.error instanceof Error
              ? save.error.message
              : "Couldn't save wholesale customer"}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 border-t border-border/60 pt-5">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="px-5"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={save.isPending}
            className="px-6"
          >
            {save.isPending
              ? "Saving Account..."
              : editing
                ? "Update Customer"
                : "Save Customer Account"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
