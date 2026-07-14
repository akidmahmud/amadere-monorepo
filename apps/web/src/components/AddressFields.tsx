"use client";

import { Controller, useFormContext } from "react-hook-form";
import { Input, Select } from "@amader/ui";
import { BD_DISTRICTS_BY_DIVISION, BD_DIVISIONS } from "@amader/shared";
import type { CheckoutFormValues } from "@/lib/checkout-schema";

export function AddressFields({ prefix }: { prefix: "shippingAddress" | "billingAddress" }) {
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
      <div className="mb-3.5 grid grid-cols-2 gap-3">
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
        </div>
      </div>

      <div className="mb-3.5">
        <Input placeholder="Email (optional)" {...register(`${prefix}.email`)} />
        {fieldErrors?.email && <p className="mt-1 font-body text-xs text-red-600">{fieldErrors.email.message}</p>}
      </div>

      <div className="mb-3.5">
        <Input placeholder="House no. / building / street / area *" {...register(`${prefix}.addressLine`)} />
        {fieldErrors?.addressLine && (
          <p className="mt-1 font-body text-xs text-red-600">{fieldErrors.addressLine.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
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

      <div className="mt-3.5 grid grid-cols-2 gap-3">
        <Input placeholder="Thana / Area (optional)" {...register(`${prefix}.area`)} />
        <Input placeholder="Landmark (optional)" {...register(`${prefix}.landmark`)} />
      </div>
    </div>
  );
}
