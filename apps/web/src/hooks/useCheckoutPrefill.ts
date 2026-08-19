"use client";

import { useEffect, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { CheckoutFormValues } from "@/lib/checkout-schema";
import { useMe } from "./useAuth";
import { useAddresses } from "./useAccount";

// Fills the checkout shipping fields for a signed-in customer from their
// profile + saved address, so someone who already has an account doesn't
// retype their name, phone, email and full address on every order.
//
// Three rules this has to respect, in order of importance:
//
// 1. NEVER clobber typing. Both queries resolve after the form has already
//    mounted and rendered, so a fast customer can be mid-word when the data
//    lands. Every field is filled only if it is currently empty, and the
//    whole pass runs at most once (`done`).
// 2. Guests are untouched. `useMe()` returns null for them (it swallows the
//    401), and the address query is not even fired.
// 3. Wait for BOTH sources before filling. Running once per source would
//    fill name/phone from the profile, mark the pass done, and then skip the
//    address entirely — or fill twice and fight rule 1.
//
// Deliberately reads the address as `addresses[0]` rather than searching for
// `isDefault`: the backend already orders them `isDefault desc, createdAt
// desc`, and the generated client type for this endpoint resolves to a
// different `AddressDto` than the one the endpoint actually returns (the
// OpenAPI schema has five DTOs sharing that name, and `components["schemas"]
// ["AddressDto"]` picks the checkout-shaped one, which has no `isDefault`
// and advertises `email`/`alternativePhone` that the real response never
// sends). Indexing sidesteps the collision instead of trusting a wrong type.
export function useCheckoutPrefill(form: UseFormReturn<CheckoutFormValues>) {
  const { data: me, isLoading: meLoading } = useMe();
  const { data: addresses, isLoading: addressesLoading } = useAddresses(!!me);
  const done = useRef(false);
  const [prefilledFromAddress, setPrefilledFromAddress] = useState(false);

  useEffect(() => {
    if (done.current) return;
    // Still resolving — a guest is `me === null` (not undefined), so this
    // only waits while the answer is genuinely unknown.
    if (meLoading || !me) return;
    if (addressesLoading) return;

    const address = addresses?.[0];
    const profileName = [me.firstName, me.lastName].filter(Boolean).join(" ").trim();
    const current = form.getValues("shippingAddress");

    // `current.x ||` first, every time — that is rule 1. An empty optional
    // field falls through to the next source; anything already typed wins.
    const next = {
      recipientName: current.recipientName || address?.recipientName || profileName,
      phone: current.phone || address?.phone || me.phone || "",
      // The saved-address rows carry no email column, so this is the
      // profile's only.
      email: current.email || me.email || "",
      district: current.district || address?.district || "",
      area: current.area || address?.area || "",
      landmark: current.landmark || address?.landmark || "",
      addressLine: current.addressLine || address?.addressLine || "",
      postCode: current.postCode || address?.postCode || "",
    };

    for (const [key, value] of Object.entries(next)) {
      if (!value) continue;
      form.setValue(`shippingAddress.${key}` as `shippingAddress.recipientName`, value);
    }

    done.current = true;
    setPrefilledFromAddress(!!address);
  }, [me, meLoading, addresses, addressesLoading, form]);

  // Lets the form tell the customer WHY these boxes came pre-filled — an
  // address appearing on its own reads as a bug (or someone else's data) if
  // nothing accounts for it.
  return { prefilledFromAddress };
}
