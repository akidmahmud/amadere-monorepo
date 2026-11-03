"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { promptDialog } from "@/components/PosConfirm";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { WholesaleCourier } from "@/hooks/useWholesale";

const NEW = "__new_courier";
const REMOVE = "__remove_courier";
const CUSTOM = "custom:";

/**
 * Courier dropdown. "Other…" asks for the name of a courier that is not in
 * our list; names typed before come back as options of their own.
 */
export function CourierSelect({
  options,
  courier,
  courierName,
  onChange,
  className,
  placeholder,
}: {
  options: { value: WholesaleCourier; label: string }[];
  courier: string;
  courierName: string | null;
  onChange: (
    courier: WholesaleCourier | "",
    courierName: string | null,
  ) => void;
  className: string;
  /** Shown as an empty first option (create form). */
  placeholder?: string;
}) {
  const qc = useQueryClient();
  const { data: saved = [] } = useQuery({
    queryKey: ["wholesale-custom-couriers"],
    queryFn: () => proxyFetch<string[]>("/admin/wholesale/couriers/custom"),
    staleTime: 0,
  });
  const names =
    courier === "OTHER" && courierName && !saved.includes(courierName)
      ? [courierName, ...saved]
      : saved;
  const value =
    courier === "OTHER"
      ? courierName
        ? CUSTOM + courierName
        : "OTHER"
      : courier;

  return (
    <select
      className={className}
      value={value}
      aria-label="Courier"
      onChange={async (e) => {
        const v = e.target.value;
        if (v === NEW) {
          const name = await promptDialog({
            title: "New courier",
            message: "Type the name of the courier (not in the list).",
            placeholder: "e.g. Janani Courier",
            confirmLabel: "Use this courier",
            icon: "local_shipping",
            required: true,
          });
          if (name?.trim()) onChange("OTHER", name.trim());
          return; // cancelled: keep the previous choice
        }
        if (v === REMOVE) {
          const name = await promptDialog({
            title: "Remove a courier",
            message: `Type the name to take out of this list: ${saved.join(", ")}. Orders that already use it keep it.`,
            placeholder: saved[0],
            confirmLabel: "Remove",
            icon: "delete",
            required: true,
          });
          const match = saved.find(
            (n) => n.toLowerCase() === name?.trim().toLowerCase(),
          );
          if (match) {
            await proxyFetch("/admin/wholesale/couriers/custom/remove", {
              method: "POST",
              body: JSON.stringify({ name: match }),
            });
            await qc.invalidateQueries({ queryKey: ["wholesale-custom-couriers"] });
          }
          return; // keep the current choice
        }
        if (v.startsWith(CUSTOM))
          return onChange("OTHER", v.slice(CUSTOM.length));
        onChange(v as WholesaleCourier | "", null);
      }}
    >
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options
        .filter((c) => c.value !== "OTHER")
        .map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      {names.length > 0 && (
        <optgroup label="Other couriers">
          {names.map((n) => (
            <option key={n} value={CUSTOM + n}>
              {n}
            </option>
          ))}
        </optgroup>
      )}
      {/* An old order saved as plain "Other" (no name) keeps showing it. */}
      {value === "OTHER" && <option value="OTHER">Other</option>}
      <option value={NEW}>Other… (add a new courier)</option>
      {saved.length > 0 && (
        <option value={REMOVE}>Remove an added courier…</option>
      )}
    </select>
  );
}
