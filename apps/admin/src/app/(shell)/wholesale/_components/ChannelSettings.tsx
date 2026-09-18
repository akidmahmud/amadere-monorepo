"use client";

import { useState } from "react";
import { Button, Card, Icon } from "@amader/admin-ui";
import {
  useDeleteWholesaleChannel,
  useSaveWholesaleChannel,
  useWholesaleChannels,
  type ChannelField,
  type ChannelFieldType,
  type ChannelInput,
  type WholesaleChannel,
} from "@/hooks/useWholesale";
import { TONE } from "./OrdersDashboard";

const INPUT =
  "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none transition-all duration-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 placeholder:text-muted";

const FIELD_TYPES: { value: ChannelFieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "select", label: "Dropdown" },
];

// A new channel starts with the one field every marketplace has.
const NEW_CHANNEL: ChannelInput = {
  name: "",
  priceList: "RETAIL",
  hasDelivery: true,
  isActive: true,
  fields: [{ label: "Order ID / Reference", type: "text", required: true, showInTable: true }],
};

/**
 * Wholesale -> Channel Settings. Channels are what Create Order offers next to
 * Wholesale (Cash Sale, Daraz, Cartup...). Each one sets its price list, whether it has a
 * courier leg, and its own extra fields, which appear on the order form and —
 * when "Show in order table" is on — in the Orders Dashboard.
 */
export function ChannelSettings({ onSaved }: { onSaved: (message: string) => void }) {
  const channels = useWholesaleChannels();
  const [editing, setEditing] = useState<(ChannelInput & { id?: number; isSystem?: boolean }) | null>(null);

  if (editing) {
    return (
      <ChannelForm
        key={editing.id ?? "new"}
        initial={editing}
        onCancel={() => setEditing(null)}
        onSaved={(c) => {
          setEditing(null);
          onSaved(`${c.name} saved`);
        }}
      />
    );
  }

  return (
    <Card className="space-y-4 p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-text">Channel Settings</h2>
          <p className="mt-1 text-xs text-secondary">
            The channels you can pick on Create Order besides Wholesale, and the extra fields each one stores.
          </p>
        </div>
        <Button variant="primary" onClick={() => setEditing({ ...NEW_CHANNEL, fields: NEW_CHANNEL.fields.map((f) => ({ ...f })) })}>
          <Icon name="add" size={18} />
          Add Channel
        </Button>
      </div>

      {channels.isLoading ? (
        <p className="py-8 text-center text-sm text-muted">Loading channels…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[760px] border-collapse">
            <thead>
              <tr className="bg-surface-2 text-[9px] uppercase tracking-wide text-muted">
                {["Channel", "Price", "Delivery", "Fields", "Orders", "Status", "Action"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left font-bold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(channels.data ?? []).map((c) => (
                <ChannelRow key={c.id} channel={c} onEdit={() => setEditing(c)} onSaved={onSaved} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function ChannelRow({ channel: c, onEdit, onSaved }: { channel: WholesaleChannel; onEdit: () => void; onSaved: (m: string) => void }) {
  const save = useSaveWholesaleChannel();
  const remove = useDeleteWholesaleChannel();
  const link = "text-[10px] font-bold text-brand-600 hover:underline disabled:opacity-50 dark:text-brand-400";
  return (
    <tr className="border-t border-border align-top text-[11px]">
      <td className="px-3 py-3">
        <strong className="block text-text">{c.name}</strong>
        {c.isSystem && <span className="text-muted">Built in</span>}
      </td>
      <td className="px-3 py-3 text-secondary">{c.priceList === "RETAIL" ? "Retail price" : "Wholesale price"}</td>
      <td className="px-3 py-3 text-secondary">{c.hasDelivery ? "Courier & delivery" : "No delivery"}</td>
      <td className="px-3 py-3 text-secondary">{c.fields.map((f) => f.label).join(", ") || "—"}</td>
      <td className="px-3 py-3 font-bold text-text">{c.orderCount}</td>
      <td className="px-3 py-3">
        <span
          className={`inline-block rounded-full border px-2.5 py-0.5 text-[9px] font-bold tracking-wide ${
            c.isActive ? TONE.green : "border-border bg-surface-2 text-muted"
          }`}
        >
          {c.isActive ? "Active" : "Inactive"}
        </span>
      </td>
      <td className="px-3 py-3">
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          <button type="button" className={link} onClick={onEdit}>Edit</button>
          <button
            type="button"
            className={link}
            disabled={save.isPending}
            onClick={() => save.mutate({ id: c.id, isActive: !c.isActive }, { onSuccess: (r) => onSaved(`${r.name} ${r.isActive ? "activated" : "deactivated"}`) })}
          >
            {c.isActive ? "Deactivate" : "Activate"}
          </button>
          {/* Only a channel nobody has ordered through; the server refuses the rest. */}
          {!c.isSystem && c.orderCount === 0 && (
            <button
              type="button"
              className="text-[10px] font-bold text-rose-600 hover:underline disabled:opacity-50"
              disabled={remove.isPending}
              onClick={() => {
                if (window.confirm(`Delete the ${c.name} channel?`)) remove.mutate(c.id, { onSuccess: () => onSaved(`${c.name} deleted`) });
              }}
            >
              Delete
            </button>
          )}
        </div>
        {(save.error || remove.error) && (
          <p className="mt-1 text-[10px] text-rose-600">{(save.error ?? remove.error)?.message}</p>
        )}
      </td>
    </tr>
  );
}

function ChannelForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial: ChannelInput & { id?: number; isSystem?: boolean };
  onCancel: () => void;
  onSaved: (c: WholesaleChannel) => void;
}) {
  const save = useSaveWholesaleChannel();
  const [form, setForm] = useState<ChannelInput>({
    name: initial.name,
    priceList: initial.priceList,
    hasDelivery: initial.hasDelivery,
    isActive: initial.isActive,
    fields: initial.fields.map((f) => ({ ...f, options: f.options ? [...f.options] : undefined })),
  });
  const [error, setError] = useState<string | null>(null);

  const patchField = (i: number, patch: Partial<ChannelField>) =>
    setForm({ ...form, fields: form.fields.map((f, j) => (j === i ? { ...f, ...patch } : f)) });
  const moveField = (i: number, by: -1 | 1) => {
    const next = [...form.fields];
    const j = i + by;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setForm({ ...form, fields: next });
  };

  function submit() {
    if (!form.name.trim()) return setError("Give the channel a name.");
    if (form.fields.some((f) => !f.label.trim())) return setError("Every field needs a name.");
    if (form.fields.some((f) => f.type === "select" && !(f.options ?? []).some((o) => o.trim()))) {
      return setError("A dropdown field needs at least one option.");
    }
    setError(null);
    save.mutate(
      {
        id: initial.id,
        ...form,
        name: form.name.trim(),
        fields: form.fields.map((f) => ({ ...f, options: f.type === "select" ? f.options : undefined })),
      },
      { onSuccess: onSaved, onError: (e) => setError(e.message) },
    );
  }

  return (
    <Card className="space-y-5 p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold text-text">{initial.id ? `Edit ${initial.name}` : "Add Channel"}</h2>
        <Button variant="ghost" onClick={onCancel}>
          <Icon name="arrow_back" size={18} />
          Back to channels
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block space-y-1.5 lg:col-span-2">
          <span className="block text-[11px] font-bold uppercase tracking-wide text-secondary">Channel name <span className="text-danger">*</span></span>
          <input className={INPUT} placeholder="e.g. Daraz, Cartup" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label className="block space-y-1.5">
          <span className="block text-[11px] font-bold uppercase tracking-wide text-secondary">Product price</span>
          <select className={INPUT} value={form.priceList} onChange={(e) => setForm({ ...form, priceList: e.target.value as ChannelInput["priceList"] })}>
            <option value="RETAIL">Retail price</option>
            <option value="WHOLESALE">Wholesale price</option>
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className="block text-[11px] font-bold uppercase tracking-wide text-secondary">Courier & delivery</span>
          <select className={INPUT} value={form.hasDelivery ? "yes" : "no"} onChange={(e) => setForm({ ...form, hasDelivery: e.target.value === "yes" })}>
            <option value="yes">Yes — courier, tracking ID, delivery charge</option>
            <option value="no">No — handed over on the spot</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs font-semibold text-text">
          <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
          Active (shown on the order form)
        </label>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-text">Channel fields</h3>
          <Button
            variant="ghost"
            onClick={() => setForm({ ...form, fields: [...form.fields, { label: "", type: "text", required: false, showInTable: false }] })}
          >
            <Icon name="add" size={16} />
            Add field
          </Button>
        </div>
        {form.fields.length === 0 && <p className="text-xs text-muted">No extra fields — orders for this channel only need the standard details.</p>}
        {form.fields.map((f, i) => (
          <div key={f.key ?? `new-${i}`} className="space-y-2.5 rounded-xl border border-border p-3">
            <div className="grid gap-2.5 sm:grid-cols-[1fr_160px_auto] sm:items-end">
              <label className="block space-y-1">
                <span className="block text-[10px] font-bold uppercase tracking-wide text-muted">Field name</span>
                <input className={INPUT} placeholder="e.g. Transaction ID" value={f.label} onChange={(e) => patchField(i, { label: e.target.value })} />
              </label>
              <label className="block space-y-1">
                <span className="block text-[10px] font-bold uppercase tracking-wide text-muted">Type</span>
                <select className={INPUT} value={f.type} onChange={(e) => patchField(i, { type: e.target.value as ChannelFieldType })}>
                  {FIELD_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </label>
              <div className="flex gap-1">
                <button type="button" aria-label="Move up" className="grid h-10 w-9 place-items-center rounded-lg border border-border text-secondary disabled:opacity-40" disabled={i === 0} onClick={() => moveField(i, -1)}>↑</button>
                <button type="button" aria-label="Move down" className="grid h-10 w-9 place-items-center rounded-lg border border-border text-secondary disabled:opacity-40" disabled={i === form.fields.length - 1} onClick={() => moveField(i, 1)}>↓</button>
                <button
                  type="button"
                  aria-label="Remove field"
                  className="grid h-10 w-9 place-items-center rounded-lg border border-border text-rose-600"
                  onClick={() => setForm({ ...form, fields: form.fields.filter((_, j) => j !== i) })}
                >
                  ×
                </button>
              </div>
            </div>
            {f.type === "select" && (
              <label className="block space-y-1">
                <span className="block text-[10px] font-bold uppercase tracking-wide text-muted">Dropdown options (one per line)</span>
                <textarea
                  className="w-full rounded-lg border border-border bg-surface p-2.5 text-sm text-text outline-none focus:border-brand-500"
                  rows={3}
                  value={(f.options ?? []).join("\n")}
                  onChange={(e) => patchField(i, { options: e.target.value.split("\n") })}
                />
              </label>
            )}
            <div className="flex flex-wrap gap-4 text-xs font-semibold text-text">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={f.required} onChange={(e) => patchField(i, { required: e.target.checked })} />
                Required
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={f.showInTable} onChange={(e) => patchField(i, { showInTable: e.target.checked })} />
                Show in order table
              </label>
            </div>
          </div>
        ))}
      </div>

      {error && <p className="rounded-lg bg-rose-500/10 p-3 text-xs font-semibold text-rose-600 dark:text-rose-400">{error}</p>}

      <div className="flex justify-end gap-2.5 border-t border-border pt-4">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" disabled={save.isPending} onClick={submit}>
          {save.isPending ? "Saving…" : "Save Channel"}
        </Button>
      </div>
    </Card>
  );
}
