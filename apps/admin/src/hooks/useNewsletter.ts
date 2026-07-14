import { useQuery } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";

// status is read-only here (no admin mutation endpoint exists for it) and
// its real enum values were erased by the usual swagger gap — displayed as
// a raw string rather than guessing at an unverified literal union.
export type NewsletterSubscriber = Omit<components["schemas"]["NewsletterSubscriberDto"], "status"> & {
  status: string;
};

type Paginated<T> = { items?: T[]; total?: number };

// Read-only — GET only, no admin mutation endpoints exist for subscribers.
export function useNewsletterSubscribers() {
  return useQuery({
    queryKey: ["admin-newsletter"],
    queryFn: async () => {
      const res = await proxyFetch<Paginated<NewsletterSubscriber>>("/admin/newsletter/subscribers?pageSize=100");
      return res.items ?? [];
    },
  });
}
