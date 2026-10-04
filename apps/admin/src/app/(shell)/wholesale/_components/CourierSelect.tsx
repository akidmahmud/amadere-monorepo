"use client";

import { useQuery } from "@tanstack/react-query";
import { promptDialog } from "@/components/PosConfirm";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { WholesaleCourier } from "@/hooks/useWholesale";

const NEW = "__new_courier";
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
    </select>
  );
}
