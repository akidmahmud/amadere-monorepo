"use client";

import { useState } from "react";
import { useToast } from "@/components/ToastProvider";
import {
  useDeletePosCoupon,
  usePosCoupons,
  usePosStores,
  useSavePosCoupon,
  type PosCoupon,
  type PosCouponInput,
} from "@/hooks/usePos";
import { taka } from "@/lib/pos-cart";
import { card, input, primaryBtn } from "./PosSubPage";

const EMPTY: PosCouponInput = {
  code: "",
  valueType: "PERCENTAGE",
  value: 10,
  minOrderAmount: null,
  storeId: null,
  startsAt: null,
  endsAt: null,
  maxUsesTotal: null,
  maxUsesPerCustomer: null,
  active: true,
};

const randomCode = () =>
  `POS${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
const day = (iso: string | null) => (iso ? iso.slice(0, 10) : null);

function toInput(c: PosCoupon): PosCouponInput {
  return {
    code: c.code,
    valueType: c.valueType,
    value: Number(c.value),
    minOrderAmount: c.minOrderAmount ? Number(c.minOrderAmount) : null,
    storeId: c.storeId,
    startsAt: day(c.startsAt),
    endsAt: day(c.endsAt),
    maxUsesTotal: c.maxUsesTotal,
    maxUsesPerCustomer: c.maxUsesPerCustomer,
    active: c.status === "PUBLISHED",
  };
}

/** POS-only coupons: valid at the tills, refused on amadere.com. */
export function PosCouponsTab() {
  const toast = useToast();
  const { data: coupons = [], isLoading } = usePosCoupons();
  const { data: stores = [] } = usePosStores();
  const save = useSavePosCoupon();
  const del = useDeletePosCoupon();
  const [editing, setEditing] = useState<{
    id?: number;
    form: PosCouponInput;
  } | null>(null);

  const toggle = (c: PosCoupon) =>
    save.mutate(
      { id: c.id, input: { ...toInput(c), active: c.status !== "PUBLISHED" } },
      { onError: (e) => toast.push(e.message) },
    );

  return (
    <div className="space-y-4">
      <div
        className={`${card} flex flex-wrap items-center justify-between gap-3`}
      >
        <p className="text-sm text-gray-600">
          Coupons made here work only at the POS tills — never on amadere.com.
          Limit one to a single store if needed.
        </p>
        <button
          className={primaryBtn}
          onClick={() => setEditing({ form: { ...EMPTY, code: randomCode() } })}
        >
          New coupon
        </button>
      </div>

      <div className={`${card} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="text-left text-gray-500">
            <tr>
              <th className="py-2">Code</th>
              <th>Discount</th>
              <th>Min order</th>
              <th>Store</th>
              <th>Valid</th>
              <th className="text-right">Used</th>
              <th className="text-center">Active</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={8} className="py-6 text-center text-gray-500">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && coupons.length === 0 && (
              <tr>
                <td colSpan={8} className="py-6 text-center text-gray-500">
                  No POS coupons yet.
                </td>
              </tr>
            )}
            {coupons.map((c) => (
              <tr key={c.id} className="border-t border-gray-100">
                <td className="py-2 font-mono font-semibold">{c.code}</td>
                <td>
                  {c.valueType === "PERCENTAGE"
                    ? `${Number(c.value)}%`
                    : taka(c.value)}
                </td>
                <td>{c.minOrderAmount ? taka(c.minOrderAmount) : "—"}</td>
                <td>{c.store?.name ?? "All stores"}</td>
                <td className="text-xs text-gray-600">
                  {day(c.startsAt) ?? "any time"} → {day(c.endsAt) ?? "no end"}
                </td>
                <td className="text-right">
                  {c.usedCount}
                  {c.maxUsesTotal ? ` / ${c.maxUsesTotal}` : ""}
                </td>
                <td className="text-center">
                  <input
                    type="checkbox"
                    checked={c.status === "PUBLISHED"}
                    onChange={() => toggle(c)}
                    aria-label={`${c.code} active`}
                  />
                </td>
                <td className="text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold"
                      onClick={() => setEditing({ id: c.id, form: toInput(c) })}
                    >
                      Edit
                    </button>
                    {c.usedCount === 0 && (
                      <button
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600"
                        onClick={() =>
                          window.confirm(`Delete coupon ${c.code}?`) &&
                          del.mutate(c.id, {
                            onSuccess: () =>
                              toast.push("Coupon deleted", "success"),
                            onError: (e) => toast.push(e.message),
                          })
                        }
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <CouponDialog
          initial={editing.form}
          isNew={!editing.id}
          stores={stores.filter(
            (s) => s.isActive || s.id === editing.form.storeId,
          )}
          saving={save.isPending}
          onClose={() => setEditing(null)}
          onSave={(form) =>
            save.mutate(
              { id: editing.id, input: form },
              {
                onSuccess: () => {
                  toast.push("Coupon saved", "success");
                  setEditing(null);
                },
                onError: (e) => toast.push(e.message),
              },
            )
          }
        />
      )}
    </div>
  );
}

function CouponDialog({
  initial,
  isNew,
  stores,
  saving,
  onClose,
  onSave,
}: {
  initial: PosCouponInput;
  isNew: boolean;
  stores: { id: number; name: string }[];
  saving: boolean;
  onClose: () => void;
  onSave: (f: PosCouponInput) => void;
}) {
  const [f, setF] = useState(initial);
  const set = <K extends keyof PosCouponInput>(k: K, v: PosCouponInput[K]) =>
    setF({ ...f, [k]: v });
  const num = (v: string) => (v.trim() === "" ? null : Number(v));
  const valid =
    /^[A-Za-z0-9-]{3,30}$/.test(f.code.trim()) &&
    f.value > 0 &&
    (f.valueType !== "PERCENTAGE" || f.value <= 100) &&
    !(f.startsAt && f.endsAt && f.endsAt < f.startsAt);
  const field = "block text-sm";
  const label = "mb-1 block font-semibold";

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="mb-4 text-lg font-bold">
          {isNew ? "New POS coupon" : "Edit POS coupon"}
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <label className={`${field} col-span-2`}>
            <span className={label}>Code</span>
            <div className="flex gap-2">
              <input
                value={f.code}
                onChange={(e) => set("code", e.target.value.toUpperCase())}
                className={`${input} flex-1 font-mono`}
                aria-label="Coupon code"
              />
              <button
                type="button"
                className="h-10 rounded-lg border border-gray-200 px-3 text-sm"
                onClick={() => set("code", randomCode())}
              >
                Generate
              </button>
            </div>
          </label>
          <label className={field}>
            <span className={label}>Type</span>
            <select
              value={f.valueType}
              onChange={(e) =>
                set("valueType", e.target.value as PosCouponInput["valueType"])
              }
              className={`${input} w-full`}
              aria-label="Discount type"
            >
              <option value="PERCENTAGE">% off</option>
              <option value="FIXED_AMOUNT">৳ off</option>
            </select>
          </label>
          <label className={field}>
            <span className={label}>
              {f.valueType === "PERCENTAGE" ? "Percent" : "Amount (৳)"}
            </span>
            <input
              type="number"
              min={0}
              value={f.value}
              onChange={(e) => set("value", Number(e.target.value))}
              className={`${input} w-full`}
              aria-label="Discount value"
            />
          </label>
          <label className={field}>
            <span className={label}>Minimum order (৳)</span>
            <input
              type="number"
              min={0}
              value={f.minOrderAmount ?? ""}
              onChange={(e) => set("minOrderAmount", num(e.target.value))}
              placeholder="none"
              className={`${input} w-full`}
            />
          </label>
          <label className={field}>
            <span className={label}>Store</span>
            <select
              value={f.storeId ?? ""}
              onChange={(e) =>
                set("storeId", e.target.value ? Number(e.target.value) : null)
              }
              className={`${input} w-full`}
              aria-label="Coupon store"
            >
              <option value="">All stores</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} only
                </option>
              ))}
            </select>
          </label>
          <label className={field}>
            <span className={label}>Starts</span>
            <input
              type="date"
              value={f.startsAt ?? ""}
              onChange={(e) => set("startsAt", e.target.value || null)}
              className={`${input} w-full`}
            />
          </label>
          <label className={field}>
            <span className={label}>Ends</span>
            <input
              type="date"
              value={f.endsAt ?? ""}
              onChange={(e) => set("endsAt", e.target.value || null)}
              className={`${input} w-full`}
            />
          </label>
          <label className={field}>
            <span className={label}>Total uses</span>
            <input
              type="number"
              min={1}
              value={f.maxUsesTotal ?? ""}
              onChange={(e) => set("maxUsesTotal", num(e.target.value))}
              placeholder="unlimited"
              className={`${input} w-full`}
            />
          </label>
          <label className={field}>
            <span className={label}>Uses per customer</span>
            <input
              type="number"
              min={1}
              value={f.maxUsesPerCustomer ?? ""}
              onChange={(e) => set("maxUsesPerCustomer", num(e.target.value))}
              placeholder="unlimited"
              className={`${input} w-full`}
            />
          </label>
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={f.active}
              onChange={(e) => set("active", e.target.checked)}
            />{" "}
            Active
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            className="h-10 rounded-lg border border-gray-200 px-4 text-sm"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className={primaryBtn}
            disabled={!valid || saving}
            onClick={() => onSave({ ...f, code: f.code.trim() })}
          >
            {saving ? "Saving…" : "Save coupon"}
          </button>
        </div>
      </div>
    </div>
  );
}
