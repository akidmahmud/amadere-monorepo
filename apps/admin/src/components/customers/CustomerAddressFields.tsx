"use client";

import { BD_DISTRICTS_BY_DIVISION, BD_THANAS_BY_DISTRICT } from "@amader/shared";

// Flat, alphabetical — division isn't a separate field (every BD district
// belongs to exactly one, same convention as CreateCustomerModal/NewOrderForm).
const DISTRICT_OPTIONS = Object.values(BD_DISTRICTS_BY_DIVISION)
  .flat()
  .sort((a, b) => a.localeCompare(b));

export interface CustomerAddressValue {
  addressLine: string;
  district: string;
  area: string;
  landmark: string;
  alternativePhone: string;
  postCode: string;
}

export const EMPTY_CUSTOMER_ADDRESS: CustomerAddressValue = {
  addressLine: "",
  district: "",
  area: "",
  landmark: "",
  alternativePhone: "",
  postCode: "",
};

// Shared by every "create/edit customer" entry point (CreateCustomerModal,
// the standalone /customers/new page) so they collect the same fields the
// same way, instead of each reinventing its own subset — see NewOrderForm's
// own shipping-address section (not this component, but the same
// district/thana dropdown pattern) for the order-time equivalent.
export function CustomerAddressFields({
  value,
  onChange,
  inputClassName,
  inputStyle,
}: {
  value: CustomerAddressValue;
  onChange: (next: CustomerAddressValue) => void;
  inputClassName: string;
  /** Some callers (e.g. customers/new/page.tsx) set colors via inline style
   * instead of Tailwind theme tokens — applied to every field here too so
   * this section doesn't visually clash with the rest of that page. */
  inputStyle?: React.CSSProperties;
}) {
  // Only districts Steadfast's own area list covers get a real dropdown
  // (see bd-thanas.ts) — same fallback-to-free-text behavior as the
  // storefront checkout's AddressFields.tsx, so admin and checkout agree.
  const thanaOptions = value.district ? BD_THANAS_BY_DISTRICT[value.district] : undefined;

  function set<K extends keyof CustomerAddressValue>(key: K, v: CustomerAddressValue[K]) {
    onChange({ ...value, [key]: v });
  }

  // Callers pass a fixed-height single-line class (e.g. "h-10 ...") — a
  // multi-line textarea needs that height utility stripped or every address
  // ends up squeezed into one line's worth of visible space.
  const textareaClassName = inputClassName.replace(/\bh-\d+(?:\.\d+)?\b/g, "").trim();

  return (
    <>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-bold text-text">Address</span>
        <textarea
          value={value.addressLine}
          onChange={(e) => set("addressLine", e.target.value)}
          placeholder="House / road / area"
          rows={2}
          className={textareaClassName}
          style={inputStyle}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-text">District</span>
          <select
            value={value.district}
            onChange={(e) => set("district", e.target.value)}
            className={inputClassName}
            style={inputStyle}
          >
            <option value="">Select district</option>
            {DISTRICT_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-text">Thana / Area</span>
          {thanaOptions ? (
            <select value={value.area} onChange={(e) => set("area", e.target.value)} className={inputClassName} style={inputStyle}>
              <option value="">Select thana/area</option>
              {thanaOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={value.area}
              onChange={(e) => set("area", e.target.value)}
              placeholder="Thana / area"
              className={inputClassName}
              style={inputStyle}
            />
          )}
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-text">Landmark (optional)</span>
          <input
            value={value.landmark}
            onChange={(e) => set("landmark", e.target.value)}
            className={inputClassName}
            style={inputStyle}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-text">Alternative phone (optional)</span>
          <input
            type="tel"
            value={value.alternativePhone}
            onChange={(e) => set("alternativePhone", e.target.value)}
            className={inputClassName}
            style={inputStyle}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-bold text-text">Post code (optional)</span>
        <input
          value={value.postCode}
          onChange={(e) => set("postCode", e.target.value)}
          className={inputClassName}
          style={inputStyle}
        />
      </label>
    </>
  );
}
