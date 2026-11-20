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
import { banglaDigits } from "@/lib/bangla-digits";
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

  // Bangla label above each box (not placeholder-only): a placeholder
  // vanishes the moment someone types, and on a phone that leaves a column of
  // unlabelled boxes. Fewer boxes too — landmark and alternative phone went,
  // they were the fields customers stalled on.
  const label = (text: string, required = false) => (
    <span className="mb-1.5 block font-body text-[13px] font-semibold text-ink">
      {text}
      {required && <span className="text-red-600"> *</span>}
    </span>
  );
  const err = (msg?: string) => msg && <p className="mt-1 font-body text-xs text-red-600">{msg}</p>;

  return (
    <div className="space-y-3.5">
      <label className="block">
        {label("আপনার নাম", true)}
        <Input placeholder="আপনার নাম লিখুন..." autoComplete="name" {...register(`${prefix}.recipientName`)} />
        {err(fieldErrors?.recipientName?.message)}
      </label>

      <div>
        <label className="block">
          {label("মোবাইল নাম্বার", true)}
          <Input
            placeholder="01XXXXXXXXX"
            inputMode="tel"
            autoComplete="tel"
            {...banglaDigits(register(`${prefix}.phone`))}
          />
        </label>
        {err(fieldErrors?.phone?.message)}
        {onFraudResult && <CheckoutFraudBadge phone={watch(`${prefix}.phone`) ?? ""} onResult={onFraudResult} />}
      </div>

      <label className="block">
        {label("আপনার ঠিকানা", true)}
        <Input
          placeholder="বাসা নং, রোড, এলাকা লিখুন..."
          autoComplete="street-address"
          {...register(`${prefix}.addressLine`)}
        />
        {err(fieldErrors?.addressLine?.message)}
      </label>

      {/* Steadfast needs both, so they stay — side by side to save a row. */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          {label("জেলা", true)}
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
                placeholder="জেলা টাইপ করুন"
                aria-label="District"
                emptyMessage="No district matches"
              />
            )}
          />
          {err(fieldErrors?.district?.message)}
        </div>
        <div>
          {label("থানা", true)}
          <Controller
            name={`${prefix}.area`}
            control={control}
            render={({ field }) => (
              <Autocomplete
                options={thanaOptions}
                value={field.value ?? ""}
                onChange={field.onChange}
                // Free text on purpose: only some districts have a curated
                // area list; for the rest this is a plain text box.
                placeholder="থানা টাইপ করুন"
                aria-label="Thana or area"
                emptyMessage="Type your thana / area"
              />
            )}
          />
          {err(fieldErrors?.area?.message)}
        </div>
      </div>

      {/* Optional, for customers abroad (probashi) ordering for family. */}
      <label className="block">
        {label("ইমেইল (ঐচ্ছিক — প্রবাসীদের জন্য)")}
        <Input type="email" placeholder="example@email.com" autoComplete="email" {...register(`${prefix}.email`)} />
        {err(fieldErrors?.email?.message)}
      </label>

      {noteField}
    </div>
  );
}
