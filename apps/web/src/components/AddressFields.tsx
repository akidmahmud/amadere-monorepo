"use client";

import type { ReactNode } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { Input, Select } from "@amader/ui";
import { BD_DISTRICTS_BY_DIVISION, BD_DIVISIONS } from "@amader/shared";
import type { CheckoutFormValues } from "@/lib/checkout-schema";
import { CheckoutFraudBadge } from "@/components/CheckoutFraudBadge";
import type { FraudPreflightResult } from "@/hooks/useCheckoutFraud";

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
    watch,
    formState: { errors },
  } = useFormContext<CheckoutFormValues>();

  const fieldErrors = errors[prefix];
  const division = watch(`${prefix}.division`);
  const districtOptions = (BD_DISTRICTS_BY_DIVISION[division ?? ""] ?? []).map((d) => ({
    value: d,
    label: d,
  }));

  return (
    <div>
      <div className="mb-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Input placeholder="017*********" {...register(`${prefix}.phone`)} />
          {fieldErrors?.phone && (
            <p className="mt-1 font-body text-xs text-red-600">{fieldErrors.phone.message}</p>
          )}
          {onFraudResult && <CheckoutFraudBadge phone={watch(`${prefix}.phone`) ?? ""} onResult={onFraudResult} />}
        </div>
        <div>
          <Input placeholder="Your Full Name *" {...register(`${prefix}.recipientName`)} />
          {fieldErrors?.recipientName && (
            <p className="mt-1 font-body text-xs text-red-600">{fieldErrors.recipientName.message}</p>
          )}
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
            name={`${prefix}.division`}
            control={control}
            render={({ field }) => (
              <Select
                options={BD_DIVISIONS.map((d) => ({ value: d, label: d }))}
                value={field.value}
                onValueChange={field.onChange}
                placeholder="Select Division"
              />
            )}
          />
          {fieldErrors?.division && (
            <p className="mt-1 font-body text-xs text-red-600">{fieldErrors.division.message}</p>
          )}
        </div>
        <div>
          <Controller
            name={`${prefix}.district`}
            control={control}
            render={({ field }) => (
              <Select
                options={districtOptions}
                value={field.value}
                onValueChange={field.onChange}
                placeholder="Select District"
              />
            )}
          />
          {fieldErrors?.district && (
            <p className="mt-1 font-body text-xs text-red-600">{fieldErrors.district.message}</p>
          )}
        </div>
      </div>

      <div className="mb-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Input placeholder="Thana / Area *" {...register(`${prefix}.area`)} />
          {fieldErrors?.area && <p className="mt-1 font-body text-xs text-red-600">{fieldErrors.area.message}</p>}
        </div>
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
