"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

interface SelectedVariantValue {
  selectedVariantId: string | undefined;
  setSelectedVariantId: (id: string) => void;
}

const SelectedVariantContext = createContext<SelectedVariantValue | null>(null);

// The PDP's variant picker (PdpPurchasePanel) and its gallery (PdpGallery)
// are siblings in a server-rendered grid, so "click a variant → gallery shows
// that variant's image" needs the selection lifted somewhere both can reach.
// This is that shared state, and nothing more — cart/buy-now still read the
// variant through their own existing paths.
//
// Deliberately NOT folded into ProductFloatingBarProvider: that one holds a
// FIXED default variant (defaultVariantId(product)) for its sticky buy bar
// and never tracks live selection, so reusing it would have quietly changed
// what the floating bar adds to the cart.
export function SelectedVariantProvider({
  initialVariantId,
  children,
}: {
  initialVariantId?: string;
  children: ReactNode;
}) {
  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>(initialVariantId);
  const value = useMemo(
    () => ({ selectedVariantId, setSelectedVariantId }),
    [selectedVariantId],
  );
  return <SelectedVariantContext.Provider value={value}>{children}</SelectedVariantContext.Provider>;
}

// Returns null outside a provider rather than throwing — PdpPurchasePanel is
// also rendered on pages that don't wrap it (and shouldn't be forced to),
// where it just keeps using its own local state.
export function useSelectedVariant(): SelectedVariantValue | null {
  return useContext(SelectedVariantContext);
}
