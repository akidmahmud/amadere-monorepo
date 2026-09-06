import { useQuery } from '@tanstack/react-query';
import type { ShippingRulesConfig } from '@amader/shared';
import { proxyFetch } from '@/lib/api/proxy-client';

export function useShippingRules() {
  return useQuery({
    queryKey: ['checkout-shipping-rules'],
    queryFn: () => proxyFetch<ShippingRulesConfig>('/shipping-rules'),
    staleTime: 0,
  });
}
