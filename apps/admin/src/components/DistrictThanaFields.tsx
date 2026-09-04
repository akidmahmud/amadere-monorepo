"use client";

import { Autocomplete } from "@amader/ui";
import {
  BD_DISTRICTS_BY_DIVISION,
  BD_DISTRICT_ALT_SPELLINGS,
  BD_DISTRICT_BN,
  BD_THANAS_BY_DISTRICT,
  BD_THANA_BN,
} from "@amader/shared";

// Admin tokens, not the storefront's — the shared Autocomplete takes these so
// one component can serve both apps without either inheriting the other's look.
const INPUT =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition-all duration-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 placeholder:text-muted";
const MENU =
  "absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border border-border bg-surface shadow-lg";
const OPTION =
  "block w-full cursor-pointer border-b border-border px-3 py-2 text-left text-sm text-text last:border-b-0";
const OPTION_ACTIVE = "bg-surface-2";

export const DISTRICT_OPTIONS = Object.values(BD_DISTRICTS_BY_DIVISION)
  .flat()
  .sort((a, b) => a.localeCompare(b))
  .map((d) => ({
    value: d,
    hint: BD_DISTRICT_BN[d],
    aliases: [BD_DISTRICT_BN[d], ...(BD_DISTRICT_ALT_SPELLINGS[d] ?? [])].filter(
      (x): x is string => Boolean(x),
    ),
  }));

export function thanaOptionsFor(district: string | null | undefined) {
  return ((district && BD_THANAS_BY_DISTRICT[district]) || []).map((t) => ({
    value: t,
    hint: BD_THANA_BN[t],
    aliases: BD_THANA_BN[t] ? [BD_THANA_BN[t]] : [],
  }));
}

/**
 * District picker for admin forms — the same type-to-search the storefront
 * checkout uses, so staff taking an order over the phone search the way the
 * customer would: English, Bengali (ঢাকা), or the older romanisation the caller
 * actually says (Comilla, Jessore, CTG).
 *
 * `allowFreeText={false}` because the 65 districts are the complete list and
 * `division` is derived from this exact string server-side.
 */
export function DistrictAutocomplete({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <Autocomplete
      options={DISTRICT_OPTIONS}
      value={value}
      onChange={onChange}
      allowFreeText={false}
      placeholder="Search district…"
      aria-label="District"
      emptyMessage="No district matches"
      inputClassName={INPUT}
      menuClassName={MENU}
      optionClassName={OPTION}
      optionActiveClassName={OPTION_ACTIVE}
    />
  );
}

/**
 * Thana / area picker. Free text on purpose — only two districts have curated
 * area lists, so for the other 63 this is a text box that happens to have
 * nothing to suggest.
 */
export function ThanaAutocomplete({
  district,
  value,
  onChange,
}: {
  district: string | null | undefined;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <Autocomplete
      options={thanaOptionsFor(district)}
      value={value}
      onChange={onChange}
      placeholder="Thana / area"
      aria-label="Thana or area"
      emptyMessage="Type the thana / area"
      inputClassName={INPUT}
      menuClassName={MENU}
      optionClassName={OPTION}
      optionActiveClassName={OPTION_ACTIVE}
    />
  );
}
