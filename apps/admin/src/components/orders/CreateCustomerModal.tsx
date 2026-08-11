"use client";

import { useState } from "react";
import { Button, Modal } from "@amader/admin-ui";
import { BD_DISTRICTS_BY_DIVISION, isValidBdPhone } from "@amader/shared";
import { useCreateCustomer, type AdminCustomer } from "@/hooks/useCustomers";
import { ProxyApiError } from "@/lib/api/proxy-client";

const inputClass = "h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500";

// Flat, alphabetical — division isn't a separate field (see
// CreateCustomerModalAddress's own comment); every BD district belongs to
// exactly one, so the backend derives it from whichever district is picked.
const DISTRICT_OPTIONS = Object.values(BD_DISTRICTS_BY_DIVISION)
  .flat()
  .sort((a, b) => a.localeCompare(b));

export interface CreateCustomerModalAddress {
  addressLine: string;
  district: string;
}

export interface CreateCustomerModalProps {
  open: boolean;
  /** Prefills the phone field with whatever the staff already typed into the search box. */
  initialPhone?: string;
  /** Hides the Address/Country/State/City section. Defaults to true. */
  showAddress?: boolean;
  onClose: () => void;
  /** `address` is only populated when the staff filled it in (and showAddress
   * is true) — the address is already saved on the customer by this point
   * (see handleSave), this is handed back purely so callers like NewOrderForm
   * can also prefill the order's own separate Shipping Address section
   * without making the staff retype it. */
  onCreated: (customer: AdminCustomer, address: CreateCustomerModalAddress | null) => void;
}

// Name/Phone/Email/Address all map straight onto /admin/customers POST —
// Address/State(Division)/City(District) upsert the customer's default
// CustomerAddress row server-side (same as the Customer Management table's
// inline address-cell PATCH). "Country" has no field to send since this
// system is Bangladesh-only.
export function CreateCustomerModal({ open, initialPhone, showAddress = true, onClose, onCreated }: CreateCustomerModalProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [email, setEmail] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [district, setDistrict] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const create = useCreateCustomer();

  function reset() {
    setFirstName("");
    setLastName("");
    setPhone(initialPhone ?? "");
    setEmail("");
    setAddressLine("");
    setDistrict("");
    setPhoneError(null);
  }

  async function handleSave() {
    if (!isValidBdPhone(phone)) {
      setPhoneError("Enter a valid Bangladeshi mobile number, e.g. 01712345678");
      return;
    }
    setPhoneError(null);
    const hasAddress = showAddress && addressLine.trim() && district;
    const customer = await create.mutateAsync({
      phone,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      email: email || undefined,
      ...(hasAddress ? { addressLine, district } : {}),
    });
    const address = hasAddress ? { addressLine, district } : null;
    reset();
    onCreated(customer, address);
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Create new customer"
    >
      <div className="flex flex-col gap-3.5">
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-text">
              Name<span className="ml-0.5 text-danger">*</span>
            </span>
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-text">
              Phone<span className="ml-0.5 text-danger">*</span>
            </span>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="01712345678"
              pattern="(?:\+?880|0)?1\d{9}"
              title="Enter a valid Bangladeshi mobile number, e.g. 01712345678"
              className={inputClass}
            />
            {phoneError && <span className="text-xs font-semibold text-danger">{phoneError}</span>}
          </label>
        </div>

        {showAddress ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-text">Address</span>
                <textarea
                  value={addressLine}
                  onChange={(e) => setAddressLine(e.target.value)}
                  placeholder="House / road / area"
                  rows={2}
                  className="rounded-sm border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-brand-500"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-text">Email</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
              </label>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-text">Country</span>
              <select value="BD" disabled className={`${inputClass} disabled:opacity-70`}>
                <option value="BD">Bangladesh</option>
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-text">District</span>
              <select value={district} onChange={(e) => setDistrict(e.target.value)} className={inputClass}>
                <option value="">Select district</option>
                {DISTRICT_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-text">Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          </label>
        )}

        {create.error && (
          <p className="text-xs font-semibold text-danger">
            {create.error instanceof ProxyApiError ? create.error.message : "Failed to create customer"}
          </p>
        )}

        <div className="mt-1 flex justify-end gap-3 border-t border-border pt-3.5">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Cancel
          </Button>
          <Button type="button" variant="primary" disabled={create.isPending || !firstName.trim() || !phone.trim()} onClick={handleSave}>
            {create.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
