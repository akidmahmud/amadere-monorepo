"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ToastProvider";
import { proxyFetch } from "@/lib/api/proxy-client";
import { usePosStores, type PosStore } from "@/hooks/usePos";
import { useCashAccounts } from "@/hooks/useAccounts";
import { useStaffList } from "@/hooks/useStaff";

const input =
  "h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-emerald-600";

type Form = {
  name: string;
  code: string;
  address: string;
  phone: string;
  isActive: boolean;
  cashAccountId: number | null;
  cardAccountId: number | null;
  mobileAccountId: number | null;
};

const empty: Form = {
  name: "",
  code: "",
  address: "",
  phone: "",
  isActive: true,
  cashAccountId: null,
  cardAccountId: null,
  mobileAccountId: null,
};

export default function StoresPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const { data: stores = [], isLoading } = usePosStores();
  const [editing, setEditing] = useState<{
    id: number | null;
    form: Form;
  } | null>(null);
  const [staffFor, setStaffFor] = useState<PosStore | null>(null);

  const save = useMutation({
    mutationFn: ({ id, form }: { id: number | null; form: Form }) =>
      proxyFetch(id ? `/admin/stores/${id}` : "/admin/stores", {
        method: id ? "PUT" : "POST",
        body: JSON.stringify({
          ...form,
          address: form.address || undefined,
          phone: form.phone || undefined,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stores"] });
      setEditing(null);
      toast.push("Store saved", "success");
    },
    onError: (e) => toast.push(e.message),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Stores</h1>
          <p className="text-sm text-gray-500">
            Outlets for the POS. Each store has its own stock, staff, tills and
            cost centre.
          </p>
        </div>
        <button
          className="h-10 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white"
          onClick={() => setEditing({ id: null, form: empty })}
        >
          New store
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-3">Store</th>
              <th className="px-4">Code</th>
              <th className="px-4">Staff</th>
              <th className="px-4">Accounts</th>
              <th className="px-4">Status</th>
              <th className="px-4" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                  Loading…
                </td>
              </tr>
            )}
            {stores.map((s) => (
              <tr key={s.id} className="border-t border-gray-100">
                <td className="px-4 py-3 font-semibold">
                  {s.name}
                  {s.isOnlineStore && (
                    <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800">
                      Online stock
                    </span>
                  )}
                </td>
                <td className="px-4 font-mono">{s.code}</td>
                <td className="px-4">{s.staffCount}</td>
                <td className="px-4">
                  {s.cashAccountId ? (
                    "Set"
                  ) : (
                    <span className="text-xs font-semibold text-amber-700">
                      No cash account set — cash sales post to the Accounts
                      default
                    </span>
                  )}
                </td>
                <td className="px-4">{s.isActive ? "Active" : "Inactive"}</td>
                <td className="px-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold"
                      onClick={() => setStaffFor(s)}
                    >
                      Staff
                    </button>
                    <button
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold"
                      onClick={() =>
                        setEditing({
                          id: s.id,
                          form: {
                            name: s.name,
                            code: s.code,
                            address: s.address ?? "",
                            phone: s.phone ?? "",
                            isActive: s.isActive,
                            cashAccountId: s.cashAccountId,
                            cardAccountId: s.cardAccountId,
                            mobileAccountId: s.mobileAccountId,
                          },
                        })
                      }
                    >
                      Edit
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <StoreDialog
          initial={editing.form}
          isNew={editing.id === null}
          saving={save.isPending}
          onClose={() => setEditing(null)}
          onSave={(form) => save.mutate({ id: editing.id, form })}
        />
      )}
      {staffFor && (
        <StaffDialog store={staffFor} onClose={() => setStaffFor(null)} />
      )}
    </div>
  );
}

function Modal({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="mb-4 text-lg font-bold">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function StoreDialog({
  initial,
  isNew,
  saving,
  onClose,
  onSave,
}: {
  initial: Form;
  isNew: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: (f: Form) => void;
}) {
  const [f, setF] = useState(initial);
  const { data: accounts = [] } = useCashAccounts();
  const set = <K extends keyof Form>(k: K, v: Form[K]) =>
    setF({ ...f, [k]: v });
  const accountSelect = (
    k: "cashAccountId" | "cardAccountId" | "mobileAccountId",
    label: string,
    types: string[],
  ) => (
    <label className="block text-sm">
      <span className="mb-1 block font-semibold">{label}</span>
      <select
        value={f[k] ?? ""}
        onChange={(e) => set(k, e.target.value ? Number(e.target.value) : null)}
        className={input}
      >
        <option value="">Use the Accounts default</option>
        {accounts
          .filter((a) => a.isActive && types.includes(a.type))
          .map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
      </select>
    </label>
  );
  const valid = f.name.trim() && /^[A-Z0-9]{2,10}$/.test(f.code);
  return (
    <Modal title={isNew ? "New store" : "Edit store"}>
      <div className="space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">Name</span>
          <input
            value={f.name}
            onChange={(e) => set("name", e.target.value)}
            className={input}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">
            Code (2–10 capitals/digits, used in GRN/transfer numbers)
          </span>
          <input
            value={f.code}
            onChange={(e) => set("code", e.target.value.toUpperCase())}
            className={`${input} font-mono`}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">
            Address (printed on receipts)
          </span>
          <input
            value={f.address}
            onChange={(e) => set("address", e.target.value)}
            className={input}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">Phone</span>
          <input
            value={f.phone}
            onChange={(e) => set("phone", e.target.value)}
            className={input}
          />
        </label>
        {accountSelect("cashAccountId", "Cash sales go to", ["CASH"])}
        {accountSelect("cardAccountId", "Card sales go to", ["BANK"])}
        {accountSelect("mobileAccountId", "Mobile banking sales go to", [
          "MOBILE_WALLET",
        ])}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={f.isActive}
            onChange={(e) => set("isActive", e.target.checked)}
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
          className="h-10 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white disabled:opacity-50"
          disabled={!valid || saving}
          onClick={() => onSave(f)}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </Modal>
  );
}

function StaffDialog({
  store,
  onClose,
}: {
  store: PosStore;
  onClose: () => void;
}) {
  const toast = useToast();
  const qc = useQueryClient();
  const { data: staff = [] } = useStaffList();
  const [picked, setPicked] = useState<Set<number>>(
    new Set(store.staff.map((s) => s.id)),
  );
  const save = useMutation({
    mutationFn: () =>
      proxyFetch(`/admin/stores/${store.id}/staff`, {
        method: "PUT",
        body: JSON.stringify({ adminUserIds: [...picked] }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stores"] });
      toast.push("Staff updated", "success");
      onClose();
    },
    onError: (e) => toast.push(e.message),
  });
  return (
    <Modal title={`Staff at ${store.name}`}>
      <p className="mb-3 text-sm text-gray-500">
        Each person belongs to one store. Ticking someone here moves them from
        their current store.
      </p>
      <div className="max-h-80 space-y-1 overflow-y-auto">
        {staff.map((u) => (
          <label
            key={u.id}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-gray-50"
          >
            <input
              type="checkbox"
              checked={picked.has(u.id)}
              onChange={(e) => {
                const next = new Set(picked);
                if (e.target.checked) next.add(u.id);
                else next.delete(u.id);
                setPicked(next);
              }}
            />
            {u.firstName} {u.lastName}{" "}
            <span className="text-gray-400">{u.email}</span>
          </label>
        ))}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button
          className="h-10 rounded-lg border border-gray-200 px-4 text-sm"
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          className="h-10 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white"
          disabled={save.isPending}
          onClick={() => save.mutate()}
        >
          Save
        </button>
      </div>
    </Modal>
  );
}
