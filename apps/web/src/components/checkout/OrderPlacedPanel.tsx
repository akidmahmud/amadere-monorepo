"use client";

import { Button } from "@amader/ui";
import { useRouter } from "@/i18n/navigation";
import { OrderConfirmation } from "@/components/OrderConfirmation";
import type { CheckoutResult } from "@/hooks/useCheckout";

/**
 * The post-order panel, lifted verbatim out of CheckoutForm.
 *
 * It used to be an early `return` in the middle of the component body. That
 * could not survive the brain becoming a hook -- a hook that sometimes
 * returns JSX and sometimes returns state types as
 * `Element | { ... }`, which erased every property on the context.
 *
 * Same markup, same behaviour; the provider now does the short-circuit.
 *
 * PHYSICAL orders only. A digital order never reaches here — the buyer is
 * sent straight to their downloads (or to login, if their email already had
 * an account), because a confirmation screen whose only content is a button
 * to the file is a step between them and the thing they paid for.
 */
export function OrderPlacedPanel({ placedOrder }: { placedOrder: CheckoutResult }) {
  const router = useRouter();

  return (
      <div className="mx-auto max-w-[1180px] px-5 py-12">
        <OrderConfirmation order={placedOrder} />
        <div className="mt-6 flex justify-center gap-3">
          <Button variant="ghost" onClick={() => router.push("/products")}>
            Continue Shopping
          </Button>
          <Button variant="green" onClick={() => router.push("/track")}>
            Track Order
          </Button>
        </div>
      </div>
  );
}
