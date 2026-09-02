
## 2026-09-02 — Checkout district/thana: typeahead autocomplete with Bengali search

**Request:** make checkout's district and thana work like the attached autocomplete
prototype, on mobile too; then "if possible add bangla too".

**What changed**

- New `packages/ui/src/components/Autocomplete.tsx` — a plain `<input>` plus a
  suggestion list, ranked exact → prefix → contains, matching on the value and on
  any number of hidden aliases. Selection commits on `mousedown`/`touchstart`
  (the input's own `blur` fires first and would otherwise close the list out from
  under the tap).
- New `packages/shared/src/bd-bengali.ts` — Bengali names for all 65 districts and
  for the 67 thanas in the two districts that have area lists, plus older
  romanisations and courier shorthand (Comilla→Cumilla, Jessore→Jashore,
  Chittagong/CTG→Chattogram, Bogra→Bogura, Barisal→Barishal, …). Search-only: the
  value written to an order stays the English name, so couriers, shipping zones
  and reports never see a second spelling.
- `apps/web/src/components/AddressFields.tsx` — both fields now use `Autocomplete`.
  District is `allowFreeText={false}` (the 65 are authoritative and `division` is
  derived from that exact string server-side); thana is free text, because 63
  districts have no curated list and for those it is simply a text box with
  nothing to suggest. Changing district clears the area, so a Dhaka thana cannot
  ride along to a Sylhet address.

**Why this also settles the mobile bug properly.** The earlier fix (`Select.tsx`,
commit 94a801d) hid the search box on touch devices, because Radix dismisses an
open Select on the `window.resize` the virtual keyboard causes. These fields no
longer use Radix at all: a text input expects the keyboard rather than being
broken by it.

**Verified in the browser at 390×844 and at 1440×900:** typing `ঢাকা` ranks
Dhaka above Dhaka Sub-Urban; tapping a suggestion commits; `মিরপুর` finds Mirpur;
switching Dhaka→Jashore clears the thana and falls back to free text; `Jessore`
finds Jashore and `ctg` finds Chattogram; junk (`zzzz`) shows "No district
matches" and reverts to the committed district on blur.

**Not done:** Bengali thana names exist only for Dhaka and Dhaka Sub-Urban,
because those are the only districts `bd-thanas.ts` has any area list for.
