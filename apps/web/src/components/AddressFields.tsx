"use client";

import type { ReactNode } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { Autocomplete, Input } from "@amader/ui";
import {
  BD_DISTRICTS_BY_DIVISION,
  BD_DISTRICT_ALT_SPELLINGS,
  BD_DISTRICT_BN,
  BD_THANAS_BY_DISTRICT,
  BD_THANA_BN,
} from "@amader/shared";
import type { CheckoutFormValues } from "@/lib/checkout-schema";
import { CheckoutFraudBadge } from "@/components/CheckoutFraudBadge";
import type { FraudPreflightResult } from "@/hooks/useCheckoutFraud";

// Flat, alphabetical — division is derived server-side from district (every
// BD district belongs to exactly one), so it's no longer a separate field
// the customer has to pick before district options even show up.
const DISTRICT_OPTIONS = Object.values(BD_DISTRICTS_BY_DIVISION)
  .flat()
  .sort((a, b) => a.localeCompare(b))
  .map((d) => ({
    value: d,
    // Bengali is searchable AND shown, so a customer typing "ঢাকা" finds the
    // row and can see it is the right one before picking. The stored value
    // stays English — see bd-bengali.ts.
    hint: BD_DISTRICT_BN[d],
    aliases: [BD_DISTRICT_BN[d], ...(BD_DISTRICT_ALT_SPELLINGS[d] ?? [])].filter((x): x is string => Boolean(x)),
  }));

export function AddressFields({
  prefix,
  onFraudResult,
  noteField,
}: {
  prefix: "shippingAddress" | "billingAddress";
  onFraudResult?: (result: FraudPreflightResult | null) => void;
  // Order-level note has no per-address equivalent (there's only one
  // customerNote per order) — CheckoutForm renders it into the shipping
  // address's slot only, keeping the note in the customer's requested
  // field order (…thana, note, alternative phone, recipient email) without
  // duplicating a note field on the billing address form.
  noteField?: ReactNode;
}) {
  const {
    register,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useFormContext<CheckoutFormValues>();

  const fieldErrors = errors[prefix];
  // Only districts Steadfast's own area list has been supplied for (see
  // bd-thanas.ts) get a real dropdown here — every other district still
  // falls back to free-text entry below until its list is added the same way.
  const selectedDistrict = watch(`${prefix}.district`);
  const thanaOptions = ((selectedDistrict && BD_THANAS_BY_DISTRICT[selectedDistrict]) || []).map(
    (t) => ({ value: t, hint: BD_THANA_BN[t], aliases: BD_THANA_BN[t] ? [BD_THANA_BN[t]] : [] }),
  );

  return (
    <div>
      <div className="mb-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Name before phone, per explicit request. The grid is source-order,
            so swapping the two blocks moves the field on both the stacked
            phone layout and the two-column desktop one. */}
        <div>
          <Input placeholder="Your Full Name *" {...register(`${prefix}.recipientName`)} />
          {fieldErrors?.recipientName && (
            <p className="mt-1 font-body text-xs text-red-600">{fieldErrors.recipientName.message}</p>
          )}
        </div>
        <div>
          <Input placeholder="017*********" {...register(`${prefix}.phone`)} />
          {fieldErrors?.phone && (
            <p className="mt-1 font-body text-xs text-red-600">{fieldErrors.phone.message}</p>
          )}
          {onFraudResult && <CheckoutFraudBadge phone={watch(`${prefix}.phone`) ?? ""} onResult={onFraudResult} />}
        </div>
      </div>

      <div className="mb-3.5">
        <Input placeholder="House no. / building / street / area *" {...register(`${prefix}.addressLine`)} />
        {fieldErrors?.addressLine && (
          <p className="mt-1 font-body text-xs text-red-600">{fieldErrors.addressLine.message}</p>
        )}
      </div>

      <div className="mb-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Controller
            name={`${prefix}.district`}
            control={control}
            render={({ field }) => (
              <Autocomplete
                options={DISTRICT_OPTIONS}
                value={field.value ?? ""}
                onChange={(next) => {
                  field.onChange(next);
                  // The thana list belongs to the old district. Leaving it set
                  // would ship a Dhaka thana to a Sylhet address.
                  setValue(`${prefix}.area`, "", { shouldValidate: false });
                }}
                // The 65 districts are the complete, authoritative list and
                // `division` is derived from this exact string server-side, so
                // a typo here has to be impossible.
                allowFreeText={false}
                placeholder="District *"
                aria-label="District"
                emptyMessage="No district matches"
              />
            )}
          />
          {fieldErrors?.district && (
            <p className="mt-1 font-body text-xs text-red-600">{fieldErrors.district.message}</p>
          )}
        </div>
        <div>
          <Controller
            name={`${prefix}.area`}
            control={control}
            render={({ field }) => (
              <Autocomplete
                options={thanaOptions}
                value={field.value ?? ""}
                onChange={field.onChange}
                // Free text on purpose: only two districts have a curated area
                // list, so for the other 63 this is simply a text box that
                // happens to have nothing to suggest.
                placeholder="Thana / Area *"
                aria-label="Thana or area"
                emptyMessage="Type your thana / area"
              />
            )}
          />
          {fieldErrors?.area && <p className="mt-1 font-body text-xs text-red-600">{fieldErrors.area.message}</p>}
        </div>
      </div>

      <div className="mb-3.5">
        <Input placeholder="Landmark (optional)" {...register(`${prefix}.landmark`)} />
      </div>

      {noteField}

      <div className="mb-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Input placeholder="Alternative Phone (optional)" {...register(`${prefix}.alternativePhone`)} />
          {fieldErrors?.alternativePhone && (
            <p className="mt-1 font-body text-xs text-red-600">{fieldErrors.alternativePhone.message}</p>
          )}
        </div>
        <div>
          <Input placeholder="Recipient Email (optional)" {...register(`${prefix}.email`)} />
          {fieldErrors?.email && <p className="mt-1 font-body text-xs text-red-600">{fieldErrors.email.message}</p>}
        </div>
      </div>
    </div>
  );
}
