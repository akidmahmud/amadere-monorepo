import { keepPreviousData, useIsMutating, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import { getGuestToken, setGuestToken, clearGuestToken } from "@/lib/guest-token";
import { pushEcommerceEvent, cartLineToGa4Item } from "@/lib/analytics-events";
import type { components } from "@/lib/api/schema";

type CartViewDto = components["schemas"]["CartViewDto"];

// Every cart call goes through this app's own authenticated proxy (not the
// raw backend client) — a logged-in customer's cart is keyed by their
// customerId, identified only via the Bearer token the proxy attaches
// server-side from the httpOnly cookie. The raw client has no access to that
// cookie and would silently keep hitting the cart as a guest even while
// logged in. X-Guest-Token still rides along for anonymous visitors (the
// proxy forwards it), so guest carts keep working exactly as before.
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

async function fetchCart(locale: string, paymentProvider?: string, district?: string): Promise<CartViewDto> {
  const params = new URLSearchParams({ locale });
  if (paymentProvider) params.set("paymentProvider", paymentProvider);
  if (district) params.set("district", district);
  const data = await proxyFetch<CartViewDto>(`/cart?${params}`, { headers: cartHeaders() });
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
    // paymentProvider and district are part of the key, so changing either
    // dropdown on the checkout page starts a DIFFERENT query with an empty
    // cache. Without this, `data` goes undefined for the round trip and the
    // entire order summary — line items, totals, the Place Order button —
    // blanks and re-mounts, which reads as the page reloading itself every
    // time you pick a district. Keeping the previous result on screen means
    // the panel stays put and the numbers just update.
    placeholderData: keepPreviousData,
  });
}

function useCartMutation<TArgs>(
  locale: string,
  mutationFn: (args: TArgs) => Promise<CartViewDto>,
  onTrack?: (cart: CartViewDto, args: TArgs) => void,
  mutationKey?: unknown[],
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey,
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
      return proxyFetch<CartViewDto>(`/cart/items?locale=${locale}`, {
        method: "POST",
        headers: cartHeaders(),
        body: JSON.stringify({ ...args, quantity: args.quantity ?? 1 }),
      });
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
    // Named so any component can ask "is an add in flight right now?" via
    // useIsAddingToCart below, without being the one that owns the mutation
    // — the cart drawer is opened by PDP/card buttons that live elsewhere in
    // the tree, and it needs to know not to flash its empty state.
    ADD_TO_CART_MUTATION_KEY,
  );
}

const ADD_TO_CART_MUTATION_KEY = ["cart", "add"];

/** True while any Add to Cart / Buy Now anywhere on the page is in flight. */
export function useIsAddingToCart(): boolean {
  return useIsMutating({ mutationKey: ADD_TO_CART_MUTATION_KEY }) > 0;
}

export function useUpdateCartItem(locale: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: { itemId: number; quantity: number }) => {
      return proxyFetch<CartViewDto>(`/cart/items/${args.itemId}?locale=${locale}`, {
        method: "PATCH",
        headers: cartHeaders(),
        body: JSON.stringify({ quantity: args.quantity }),
      });
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
    return proxyFetch<CartViewDto>(`/cart/items/${args.itemId}?locale=${locale}`, {
      method: "DELETE",
      headers: cartHeaders(),
    });
  });
}

export function useApplyCoupon(locale: string) {
  return useCartMutation(locale, async (args: { code: string }) => {
    return proxyFetch<CartViewDto>(`/cart/coupon?locale=${locale}`, {
      method: "POST",
      headers: cartHeaders(),
      body: JSON.stringify(args),
    });
  });
}

export function useRemoveCoupon(locale: string) {
  return useCartMutation(locale, async () => {
    return proxyFetch<CartViewDto>(`/cart/coupon?locale=${locale}`, {
      method: "DELETE",
      headers: cartHeaders(),
    });
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
  // The merge deletes/reassigns the guest cart row server-side — clearing
  // the cookie stops it from being sent on every cart call afterward, which
  // would otherwise keep resolving to a now-gone guest cart instead of the
  // customer's real (merged) one and made the cart look emptied on login.
  clearGuestToken();
}
