import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { proxyFetch } from "@/lib/api/proxy-client";
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

function cartKey(locale: string, paymentProvider?: string, district?: string) {
  return ["cart", locale, paymentProvider, district] as const;
}

type CartPaymentProvider = NonNullable<
  components["schemas"]["CheckoutDto"]["paymentProvider"]
>;

async function fetchCart(locale: string, paymentProvider?: string, district?: string): Promise<CartViewDto> {
  const { data, error } = await api.GET("/api/v1/cart", {
    params: { query: { locale: locale as "EN" | "BN", paymentProvider: paymentProvider as CartPaymentProvider | undefined, district } },
    headers: cartHeaders(),
  });
  if (error) throw error;
  persistGuestToken(data);
  return data;
}

// paymentProvider/district are optional — pass the checkout form's
// currently selected method/district so taxAmount/codFee/shippingFee/
// grandTotal reflect what the customer will actually be charged (COD fee
// only applies to COD; shipping fee is cheaper inside Dhaka district). Omit
// them anywhere the customer hasn't gotten that far yet (mini-cart, cart
// drawer) — shipping previews as the cheaper Dhaka rate until a real
// district is known, same as before district-based tiering existed.
export function useCartQuery(locale: string, paymentProvider?: string, district?: string) {
  return useQuery({
    queryKey: cartKey(locale, paymentProvider, district),
    queryFn: () => fetchCart(locale, paymentProvider, district),
  });
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
      // Item/coupon mutations don't know the customer's selected payment
      // method, so their response always computes codFee as if not COD —
      // invalidating every cart query for this locale (prefix match, e.g.
      // the checkout page's cartKey(locale, "COD")) instead of seeding the
      // cache directly means every mounted view refetches with its own
      // correct provider rather than momentarily showing this codFee-less
      // total.
      queryClient.invalidateQueries({ queryKey: ["cart", locale] });
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

// Called once a customer authenticates (see useAuth.ts's useAfterAuthSuccess)
// so items they added as a guest survive into their account cart.
// /cart/merge is CustomerJwtGuard-protected — it has to go through this
// app's own authenticated proxy (which attaches the Bearer token from the
// httpOnly cookie) rather than the raw typed `api` client, which talks to
// the backend directly with no Authorization header and 401s every time.
export async function mergeGuestCartOnLogin(locale: string): Promise<void> {
  const guestToken = getGuestToken();
  if (!guestToken) return;
  await proxyFetch(`/cart/merge?locale=${locale}`, {
    method: "POST",
    body: JSON.stringify({ guestToken }),
  });
}
