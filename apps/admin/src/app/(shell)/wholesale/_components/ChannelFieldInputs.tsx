"use client";

import type { ChannelField } from "@/hooks/useWholesale";

const INPUT =
  "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none transition-all duration-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 placeholder:text-muted";

/** Values as the inputs hold them (strings), keyed by field key. */
export type ChannelValues = Record<string, string>;

/** An order's stored values in the shape the inputs hold. */
export function toChannelValues(data: Record<string, string | number> | null | undefined): ChannelValues {
  return Object.fromEntries(Object.entries(data ?? {}).map(([k, v]) => [k, String(v)]));
}

/** The labels of required fields left empty — the same rule the server applies. */
export function missingChannelFields(fields: ChannelField[], values: ChannelValues): string[] {
  return fields.filter((f) => f.required && f.key && !values[f.key]?.trim()).map((f) => f.label);
}

/**
 * The inputs for a channel's custom fields (Channel Settings), rendered on the
 * create-order screen and the order edit modal. Text, number, date or a
 * dropdown, as the admin defined them.
 */
export function ChannelFieldInputs({
  fields,
  values,
  onChange,
}: {
  fields: ChannelField[];
  values: ChannelValues;
  onChange: (next: ChannelValues) => void;
}) {
  if (!fields.length) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {fields.map((f) => {
        if (!f.key) return null;
        const key = f.key;
        const value = values[key] ?? "";
        const set = (v: string) => onChange({ ...values, [key]: v });
        return (
          <label key={key} className="block space-y-1.5">
            <span className="block text-[11px] font-bold uppercase tracking-wide text-secondary">
              {f.label}
              {f.required && <span className="text-danger"> *</span>}
            </span>
            {f.type === "select" ? (
              <select className={INPUT} value={value} onChange={(e) => set(e.target.value)}>
                <option value="">Select…</option>
                {(f.options ?? []).map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            ) : (
              <input
                className={INPUT}
                type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                value={value}
                onChange={(e) => set(e.target.value)}
              />
            )}
          </label>
        );
      })}
    </div>
  );
}
