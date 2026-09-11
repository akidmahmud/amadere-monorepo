"use client";

import { Button, Input } from "@amader/ui";
import { useCheckoutContext } from "./CheckoutContext";

const money = (v: string | number) =>
  `৳${Number(v || 0).toLocaleString("en-BD", { maximumFractionDigits: 0 })}`;

function TicketIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={18}
      height={18}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="flex-none"
    >
      <path d="M3 9V7a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v2a2.5 2.5 0 0 0 0 6v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2a2.5 2.5 0 0 0 0-6Z" />
      <path d="M14 7.5v9" strokeDasharray="2 2.5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="flex-none"
    >
      <path d="m4 12.5 5 5L20 6.5" />
    </svg>
  );
}

/**
 * The coupon entry on checkout.
 *
 * ONE component, rendered by both checkout layouts (DefaultCheckoutLayout and
 * the slot-based one). They previously carried a copy each, which is how the
 * two drift into looking like different shops.
 *
 * Design notes, since they were deliberate:
 *
 * - One heading, not a stack of eyebrow + title + subtitle. On a phone — where
 *   nearly every order is placed — three lines of encouragement push the
 *   actual input below the fold.
 * - The applied state is brand green, not beige. Beige is the neutral surface
 *   used for inert panels; using it for a success made the one genuinely good
 *   piece of news on the page look like a disabled row.
 * - The saving is stated once, here, next to the code that caused it. The
 *   order summary already repeats it as a line item; a third celebratory
 *   restatement is noise, not reassurance.
 */
export function CheckoutCouponField() {
  const { applyCoupon, cart, couponInput, removeCoupon, setCouponInput } =
    useCheckoutContext();

  const applied = cart?.couponCode ?? null;
  // The cart returns every discount it applied; this panel speaks only for the
  // coupon, so promotions and upsells are not counted into "you save".
  // String(): the generated schema types `source` as an opaque enum object
  // rather than a union of literals, so it is compared as text.
  const couponDiscount = cart?.discounts?.find(
    (d) => String(d.source) === "COUPON",
  );
  const savings = couponDiscount?.freeShipping
    ? "free delivery"
    : couponDiscount && Number(couponDiscount.amount) > 0
      ? `you save ${money(couponDiscount.amount)}`
      : null;

  const submit = () => {
    const code = couponInput.trim();
    if (code) applyCoupon.mutate({ code });
  };

  return (
    <div className="mb-5.5 rounded-brand border border-line bg-white p-5">
      <h2 className="mb-3 flex items-center gap-2 font-ui text-[15px] font-semibold text-green">
        <TicketIcon />
        Have a coupon?
      </h2>

      {applied ? (
        <div className="flex items-center gap-3 rounded-lg border border-green/20 bg-green/[0.07] px-3 py-2.5">
          <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-green text-white">
            <CheckIcon />
          </span>
          <p className="min-w-0 flex-1 font-ui text-xs text-ink">
            <span className="font-semibold">{applied}</span> applied
            {savings && <span className="text-green"> — {savings}</span>}
          </p>
          <button
            type="button"
            onClick={() => removeCoupon.mutate(undefined)}
            aria-label={`Remove coupon ${applied}`}
            title="Remove"
            // A 32px target, not a 10px underlined word: this sits under a
            // thumb on a phone, and mis-tapping it removes a discount.
            className="grid h-8 w-8 flex-none place-items-center rounded-full text-muted transition-colors hover:bg-green/10 hover:text-ink"
          >
            <svg
              viewBox="0 0 24 24"
              width={15}
              height={15}
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              strokeLinecap="round"
              aria-hidden
            >
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
      ) : (
        // Plain div, not a nested <form> — the whole checkout page is already
        // one big <form> (react-hook-form's submitForm), and a <form> inside a
        // <form> is invalid HTML. The browser's parser dropped the inner form
        // during the initial SSR parse, which the client then saw as a real
        // hydration mismatch and recovered from by regenerating the whole
        // tree — the actual reason clicking Apply used to silently do nothing.
        <div
          className="flex gap-2"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
        >
          <Input
            placeholder="Enter code"
            value={couponInput}
            onChange={(e) => setCouponInput(e.target.value)}
            // Codes are printed and spoken in upper case; the server matches
            // exactly, so this is display-only and the typed value is sent.
            className="uppercase placeholder:normal-case"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
          />
          <Button
            type="button"
            variant="ghost"
            onClick={submit}
            disabled={applyCoupon.isPending || !couponInput.trim()}
            className="flex-none"
          >
            {applyCoupon.isPending ? "Applying…" : "Apply"}
          </Button>
        </div>
      )}

      {applyCoupon.isError && (
        <p className="mt-2 font-body text-xs text-red-600">
          {applyCoupon.error instanceof Error
            ? applyCoupon.error.message
            : "That code isn't valid"}
        </p>
      )}
    </div>
  );
}
