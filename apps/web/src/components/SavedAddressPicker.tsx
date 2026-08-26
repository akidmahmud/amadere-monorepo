"use client";

/**
 * The saved-address chooser that sits above the shipping fields at checkout,
 * so a returning customer taps the address they already have on file instead
 * of retyping it.
 *
 * The shape here is written out by hand rather than taken from
 * `components["schemas"]["AddressDto"]`. That generated type is wrong for
 * this endpoint: the OpenAPI document has five DTOs sharing the name
 * `AddressDto`, and the generator resolves it to the checkout-shaped one,
 * which omits `isDefault` and advertises `email`/`alternativePhone` that
 * `GET /customers/me/addresses` never sends. This mirrors the real response
 * (backend `address.mapper.ts`). The same collision is documented in
 * useCheckoutPrefill, which sidesteps it by indexing instead.
 */
export interface SavedAddress {
  id: number;
  label: string | null;
  recipientName: string;
  phone: string;
  division: string;
  district: string;
  area: string | null;
  landmark: string | null;
  addressLine: string;
  postCode: string | null;
  isDefault: boolean;
}

const pinIcon = (
  <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

export function SavedAddressPicker({
  addresses,
  selectedId,
  onSelect,
  onUseNew,
}: {
  addresses: SavedAddress[];
  /** null while the customer is filling in a fresh address. */
  selectedId: number | null;
  onSelect: (address: SavedAddress) => void;
  onUseNew: () => void;
}) {
  if (addresses.length === 0) return null;

  return (
    // radiogroup, not a list of buttons: picking an address is choosing one
    // of a set, and a screen reader should announce it as "2 of 3" rather
    // than as three unrelated controls.
    <div role="radiogroup" aria-label="Saved addresses" className="mb-4 space-y-2.5">
      {addresses.map((address) => {
        const selected = address.id === selectedId;
        // area/landmark/postCode are all nullable — join so a missing one
        // doesn't leave a dangling comma.
        const region = [address.area, address.district, address.division]
          .filter(Boolean)
          .join(", ");

        return (
          <button
            key={address.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onSelect(address)}
            className={`flex w-full gap-3 rounded-[10px] border p-3.5 text-left transition ${
              selected
                ? "border-header-green bg-header-green/[0.04] ring-1 ring-header-green"
                : "border-line bg-white hover:border-header-green/50"
            }`}
          >
            <span className={`mt-0.5 shrink-0 ${selected ? "text-header-green" : "text-muted"}`}>
              {pinIcon}
            </span>

            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-ui text-sm font-semibold text-header-ink">
                  {address.recipientName}
                </span>
                <span className="font-body text-sm text-muted">{address.phone}</span>
              </span>

              <span className="mt-1 block font-body text-[13px] leading-snug text-header-ink/80">
                {address.addressLine}
                {address.landmark ? ` (${address.landmark})` : ""}
              </span>

              {region && (
                <span className="mt-0.5 block font-body text-[13px] text-muted">{region}</span>
              )}

              {(address.label || address.isDefault) && (
                <span className="mt-2 flex flex-wrap gap-2">
                  {address.label && (
                    <span className="rounded border border-line px-1.5 py-0.5 font-ui text-[10px] font-semibold uppercase tracking-wide text-muted">
                      {address.label}
                    </span>
                  )}
                  {address.isDefault && (
                    <span className="rounded border border-header-green/40 px-1.5 py-0.5 font-ui text-[10px] font-semibold text-header-green">
                      Default shipping address
                    </span>
                  )}
                </span>
              )}
            </span>
          </button>
        );
      })}

      {/* The fields below double as the "new address" form, so this clears
          them rather than opening anything — there is nowhere else to go. */}
      <button
        type="button"
        role="radio"
        aria-checked={selectedId === null}
        onClick={onUseNew}
        className={`w-full rounded-[10px] border border-dashed p-3 text-center font-ui text-[13px] font-semibold transition ${
          selectedId === null
            ? "border-header-green bg-header-green/[0.04] text-header-green"
            : "border-line text-muted hover:border-header-green/50 hover:text-header-green"
        }`}
      >
        + Use a new address
      </button>
    </div>
  );
}
