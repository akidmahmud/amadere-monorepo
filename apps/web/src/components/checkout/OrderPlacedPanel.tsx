"use client";

import { Button } from "@amader/ui";
import { useRouter } from "@/i18n/navigation";
import { AppLink } from "@/components/AppLink";
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
 */
export function OrderPlacedPanel({
  placedOrder,
  digitalOnly,
}: {
  placedOrder: CheckoutResult;
  digitalOnly: boolean;
}) {
  const router = useRouter();
  return (
      <div className="mx-auto max-w-[1180px] px-5 py-12">
        {/* The email/phone on this digital order already belongs to an
            account, so no session was issued — deliberately, see the
            account-takeover note on CheckoutAccountService.ensureAccount.
            Typing a stranger's email must never hand you their session, so
            the download goes to the mailbox that owns the account instead. */}
        {placedOrder.existingAccount && (
          <p className="mb-6 rounded-brand border border-line bg-beige p-4 text-center font-body text-sm text-ink">
            This email already has an account. We&apos;ve emailed your download link — {" "}
            <AppLink href="/login" className="text-green underline">
              sign in
            </AppLink>{" "}
            to see all your downloads.
          </p>
        )}
        <OrderConfirmation order={placedOrder} />
        <div className="mt-6 flex justify-center gap-3">
          <Button variant="ghost" onClick={() => router.push("/products")}>
            Continue Shopping
          </Button>
          {digitalOnly && !placedOrder.existingAccount ? (
            <Button variant="green" onClick={() => router.push("/account/downloads")}>
              Go to My Downloads
            </Button>
          ) : (
            <Button variant="green" onClick={() => router.push("/track")}>
              Track Order
            </Button>
          )}
        </div>
      </div>
  );
}
