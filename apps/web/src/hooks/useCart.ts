import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { getGuestToken, setGuestToken } from "@/lib/guest-token";
import type { components } from "@/lib/api/schema";

type CartViewDto = components["schemas"]["CartViewDto"];

function cartHeaders(): Record<string, string> {
  const token = getGuestToken();
  return token ? { "X-Guest-Token": token } : {};
}

// Every cart response carries its own guestToken (issued on first write for
// an anonymous visitor) — persist it so the next request identifies the
// same cart. A logged-in customer's cart has no guestToken (identified by
// their bearer token instead), so there's nothing to persist in that case.
function persistGuestToken(cart: CartViewDto): void {
  if (cart.guestToken) setGuestToken(cart.guestToken);
}

function cartKey(locale: string) {
  return ["cart", locale] as const;
}

async function fetchCart(locale: string): Promise<CartViewDto> {
  const { data, error } = await api.GET("/api/v1/cart", {
    params: { query: { locale: locale as "EN" | "BN" } },
    headers: cartHeaders(),
  });
  if (error) throw error;
  persistGuestToken(data);
  return data;
}

export function useCartQuery(locale: string) {
  return useQuery({ queryKey: cartKey(locale), queryFn: () => fetchCart(locale) });
}

function useCartMutation<TArgs>(
  locale: string,
  mutationFn: (args: TArgs) => Promise<CartViewDto>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (cart) => {
      persistGuestToken(cart);
      queryClient.setQueryData(cartKey(locale), cart);
    },
  });
}

export function useAddToCart(locale: string) {
  return useCartMutation(locale, async (args: { productId: number; variantId?: number; quantity?: number }) => {
    const { data, error } = await api.POST("/api/v1/cart/items", {
      params: { query: { locale: locale as "EN" | "BN" } },
      headers: cartHeaders(),
      // The generated type marks `quantity` required (openapi-typescript
      // treats a swagger `default` as always-present) even though the
      // backend DTO itself makes it optional — default it here to match.
      body: { ...args, quantity: args.quantity ?? 1 },
    });
    if (error) throw error;
    return data;
  });
}

export function useUpdateCartItem(locale: string) {
  return useCartMutation(locale, async (args: { itemId: number; quantity: number }) => {
    const { data, error } = await api.PATCH("/api/v1/cart/items/{id}", {
      params: { path: { id: args.itemId }, query: { locale: locale as "EN" | "BN" } },
      headers: cartHeaders(),
      body: { quantity: args.quantity },
    });
    if (error) throw error;
    return data;
  });
}

export function useRemoveCartItem(locale: string) {
  return useCartMutation(locale, async (args: { itemId: number }) => {
    const { data, error } = await api.DELETE("/api/v1/cart/items/{id}", {
      params: { path: { id: args.itemId }, query: { locale: locale as "EN" | "BN" } },
      headers: cartHeaders(),
    });
    if (error) throw error;
    return data;
  });
}

export function useApplyCoupon(locale: string) {
  return useCartMutation(locale, async (args: { code: string }) => {
    const { data, error } = await api.POST("/api/v1/cart/coupon", {
      params: { query: { locale: locale as "EN" | "BN" } },
      headers: cartHeaders(),
      body: args,
    });
    if (error) throw error;
    return data;
  });
}

export function useRemoveCoupon(locale: string) {
  return useCartMutation(locale, async () => {
    const { data, error } = await api.DELETE("/api/v1/cart/coupon", {
      params: { query: { locale: locale as "EN" | "BN" } },
      headers: cartHeaders(),
    });
    if (error) throw error;
    return data;
  });
}

// Not called anywhere yet — F8 (login) calls this once a customer
// authenticates, so the items they added as a guest survive into their
// account cart. Wired here now so F8 doesn't have to touch the cart layer.
export async function mergeGuestCartOnLogin(locale: string): Promise<void> {
  const guestToken = getGuestToken();
  if (!guestToken) return;
  await api.POST("/api/v1/cart/merge", {
    params: { query: { locale: locale as "EN" | "BN" } },
    body: { guestToken },
  });
}
