import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { getGuestToken } from "@/lib/guest-token";
import type { components } from "@/lib/api/schema";

type CheckoutDto = components["schemas"]["CheckoutDto"];

function cartHeaders(): Record<string, string> {
  const token = getGuestToken();
  return token ? { "X-Guest-Token": token } : {};
}

export function useRequestCodOtp() {
  return useMutation({
    mutationFn: async (phone: string) => {
      const { error } = await api.POST("/api/v1/checkout/cod-otp/request", {
        headers: cartHeaders(),
        body: { phone },
      });
      if (error) throw error;
    },
  });
}

export function usePlaceOrder(locale: string) {
  return useMutation({
    mutationFn: async (dto: CheckoutDto) => {
      const { data, error } = await api.POST("/api/v1/checkout", {
        params: { query: { locale: locale as "EN" | "BN" } },
        headers: cartHeaders(),
        body: dto,
      });
      if (error) throw error;
      return data;
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
      const { data, error } = await api.GET("/api/v1/gift-vouchers/{code}/check", {
        params: { path: { code } },
      });
      if (error) throw error;
      return data;
    },
    enabled: code.trim().length > 0,
    retry: false,
  });
}

export function useTrackOrder() {
  return useMutation({
    mutationFn: async (args: { orderNumber: string; phone: string }) => {
      const { data, error } = await api.POST("/api/v1/orders/track", { body: args });
      if (error) throw error;
      return data;
    },
  });
}
