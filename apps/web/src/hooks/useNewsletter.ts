import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

// Anonymous, email-only — not tied to a customer account at all (confirmed
// against the backend: `NewsletterSubscriber` is its own model keyed by
// email, no link to `Customer`), so this works the same whether the visitor
// is logged in or not. The footer's subscribe form has had this hook point
// ready since F2; this is what finally wires it.
export function useSubscribeNewsletter() {
  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await api.POST("/api/v1/newsletter/subscribe", { body: { email } });
      if (error) throw error;
    },
  });
}
