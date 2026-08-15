import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { proxyFetch } from "@/lib/api/proxy-client";
import { getGuestToken, setGuestToken } from "@/lib/guest-token";
import { pushEcommerceEvent, cartLineToGa4Item } from "@/lib/analytics-events";
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
  onTrack?: (cart: CartViewDto, args: TArgs) => void,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (cart, args) => {
      persistGuestToken(cart);
      // Item/coupon mutations don't know the customer's selected payment
      // method, so their response always computes codFee as if not COD —
      // invalidating every cart query for this locale (prefix match, e.g.
      // the checkout page's cartKey(locale, "COD")) instead of seeding the
      // cache directly means every mounted view refetches with its own
      // correct provider rather than momentarily showing this codFee-less
      // total.
      queryClient.invalidateQueries({ queryKey: ["cart", locale] });
      onTrack?.(cart, args);
    },
  });
}

export function useAddToCart(locale: string) {
  return useCartMutation(
    locale,
    async (args: { productId: number; variantId?: number; quantity?: number }) => {
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
    },
    // Single choke point for add_to_cart — every "Add to Cart" button
    // sitewide (PDP, cards, promo videos, cross-sell) funnels through this
    // one mutation via useCardAddToCart/PdpPurchasePanel, so this one push
    // covers all of them. `quantity` here is what was actually just added
    // (the mutation args), not the line's running total in the cart.
    (cart, args) => {
      const line = cart.items.find(
        (i) => i.productId === args.productId && (i.variantId ?? undefined) === args.variantId,
      );
      if (!line) return;
      const quantity = args.quantity ?? 1;
      const item = { ...cartLineToGa4Item(line), quantity };
      pushEcommerceEvent("add_to_cart", {
        currency: cart.currency,
        value: (item.price ?? 0) * quantity,
        items: [item],
      });
    },
  );
}

export function useUpdateCartItem(locale: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: { itemId: number; quantity: number }) => {
      const { data, error } = await api.PATCH("/api/v1/cart/items/{id}", {
        params: { path: { id: args.itemId }, query: { locale: locale as "EN" | "BN" } },
        headers: cartHeaders(),
        body: { quantity: args.quantity },
      });
      if (error) throw error;
      return data;
    },
    // QtyStepper's own local echo already makes the +/- buttons feel
    // instant before this even fires, but without also patching the cache
    // here, the number would flicker back to the old value the moment
    // QtyStepper re-syncs from this query's (still-stale, pre-response)
    // data, then jump forward again once the real response lands. Patching
    // every cached cart query (there can be several — see cartKey) closes
    // that gap; onSuccess's invalidate below still corrects totals/tax/
    // codFee, which a client-side guess at unitPrice*quantity can't.
    onMutate: async (args) => {
      await queryClient.cancelQueries({ queryKey: ["cart", locale] });
      const previous = queryClient.getQueriesData<CartViewDto>({ queryKey: ["cart", locale] });
      for (const [key, data] of previous) {
        if (!data) continue;
        queryClient.setQueryData<CartViewDto>(key, {
          ...data,
          items: data.items.map((item) =>
            item.id === args.itemId
              ? { ...item, quantity: args.quantity, lineTotal: (Number(item.unitPrice) * args.quantity).toFixed(2) }
              : item,
          ),
        });
      }
      return { previous };
    },
    onError: (_err, _args, context) => {
      if (!context) return;
      for (const [key, data] of context.previous) {
        queryClient.setQueryData(key, data);
      }
    },
    onSuccess: (cart) => {
      persistGuestToken(cart);
      queryClient.invalidateQueries({ queryKey: ["cart", locale] });
    },
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
