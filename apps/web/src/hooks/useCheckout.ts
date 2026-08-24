import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import { getGuestToken } from "@/lib/guest-token";
import type { components } from "@/lib/api/schema";

type CheckoutDto = components["schemas"]["CheckoutDto"];
type OrderDto = components["schemas"]["OrderDto"];

// What POST /checkout actually returns for a digital-only order placed by a
// logged-out buyer (CheckoutResultDto in checkout.service.ts). It is a plain
// OrderDto for every other checkout, which is why both extras are optional.
//
// The backend also returns a `tokens` pair on that path, and it is
// DELIBERATELY absent from this type: the /api/backend proxy moves it into
// httpOnly cookies and strips it from the body before this code ever sees it
// (see the token-stripping rule in app/api/backend/[...path]/route.ts).
// Nothing on the client may read an access token — `existingAccount` is the
// only signal it needs:
//   undefined -> no account was resolved (physical order, or already signed in)
//   false     -> a new passwordless account was created AND the session cookies are now set
//   true      -> the email/phone already belongs to someone, so NO session was
//                issued (account-takeover guard, see CheckoutAccountService.ensureAccount)
export type CheckoutResult = OrderDto & { existingAccount?: boolean };

function cartHeaders(): Record<string, string> {
  const token = getGuestToken();
  return token ? { "X-Guest-Token": token } : {};
}

export function useRequestCodOtp() {
  return useMutation({
    // `phone` stays the identity the code is stored and verified against;
    // `channel`/`email` only choose how it's delivered.
    // `channel` is always supplied by CodOtpPopup (it defaults to PHONE in
    // component state), and the generated request type has it required.
    mutationFn: async (args: { phone: string; channel: "PHONE" | "EMAIL"; email?: string }) => {
      await proxyFetch<unknown>("/checkout/cod-otp/request", {
        method: "POST",
        headers: cartHeaders(),
        body: JSON.stringify({ phone: args.phone, channel: args.channel, email: args.email }),
      });
    },
  });
}

export function usePlaceOrder(locale: string) {
  const queryClient = useQueryClient();
  return useMutation({
    // Must go through this app's own authenticated proxy, exactly like every
    // cart call in useCart.ts — the backend resolves which cart to order from
    // via the same CartIdentityGuard, and a logged-in customer is identified
    // only by the Bearer token the proxy attaches server-side from the
    // httpOnly cookie. The raw `api` client can't read that cookie, so it
    // posted with no identity at all (the guest token is cleared at
    // login-merge): the backend found no cart and checkout failed with
    // "Cart is empty" while the cart panel beside it showed the items.
    mutationFn: async (dto: CheckoutDto) => {
      return proxyFetch<CheckoutResult>(`/checkout?locale=${locale}`, {
        method: "POST",
        headers: cartHeaders(),
        body: JSON.stringify(dto),
      });
    },
    // The backend empties the cart's items as part of placing the order,
    // but nothing told the client — the cart badge/drawer kept showing the
    // pre-order contents (a stale cache, not a stale server) until the next
    // unrelated cart mutation happened to invalidate it. Same invalidation
    // useCartMutation's own onSuccess already does for every other cart-
    // changing action.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart", locale] });
    },
  });
}

// Live-checks a gift voucher code before it's submitted with the order —
// separate from the coupon (cart-level, F6); this is the checkout-level
// concept (see AGENTS.web.md §14, F6 entry, for why they're not the same
// mechanism on the backend).
export function useGiftVoucherCheck(code: string) {
  return useQuery({
    queryKey: ["gift-voucher-check", code],
    queryFn: async () => {
      return proxyFetch<components["schemas"]["GiftVoucherCheckDto"]>(
        `/gift-vouchers/${encodeURIComponent(code)}/check`,
      );
    },
    enabled: code.trim().length > 0,
    retry: false,
  });
}

export function useTrackOrder() {
  return useMutation({
    mutationFn: async (args: { orderNumber: string; phone: string }) => {
      return proxyFetch<components["schemas"]["OrderDto"]>("/orders/track", {
        method: "POST",
        body: JSON.stringify(args),
      });
    },
  });
}
