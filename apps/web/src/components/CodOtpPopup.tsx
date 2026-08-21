"use client";

import { useEffect, useRef, useState } from "react";
import { useFormContext } from "react-hook-form";
import { Button, Input } from "@amader/ui";
import type { CheckoutFormValues } from "@/lib/checkout-schema";
import { useRequestCodOtp } from "@/hooks/useCheckout";
import { useResendCooldown } from "@/hooks/useResendCooldown";
import { useSiteInfo } from "@/hooks/useSiteInfo";

export function CodOtpPopup({
  shippingPhone,
  onConfirm,
  onClose,
  isSubmitting,
  errorMessage,
}: {
  shippingPhone: string;
  onConfirm: () => void;
  onClose: () => void;
  isSubmitting: boolean;
  errorMessage?: string;
}) {
  const { register, watch, formState } = useFormContext<CheckoutFormValues>();
  const requestCodOtp = useRequestCodOtp();
  const codOtpCode = watch("codOtpCode");
  const shippingEmail = watch("shippingAddress.email")?.trim() ?? "";
  const { data: siteInfo } = useSiteInfo();
  // Two conditions, both required: the admin allows email delivery for
  // checkout verification (Settings > Checkout OTP verification), AND this
  // order actually has an email to send to. Defaults to true while the
  // setting loads, matching how codOtpEnabled is treated elsewhere.
  const emailAvailable = shippingEmail.length > 0 && (siteInfo?.codOtpEmailEnabled ?? true);
  // Defaults to SMS — the historical behaviour, and the right default for a
  // BD customer. Only offered at all when an email was actually entered.
  const [channel, setChannel] = useState<"PHONE" | "EMAIL">("PHONE");
  const sendTo = channel === "EMAIL" && emailAvailable ? shippingEmail : shippingPhone;
  const sendArgs = { phone: shippingPhone, channel, email: emailAvailable ? shippingEmail : undefined };
  const autoSentRef = useRef(false);
  const resendCooldown = useResendCooldown();

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Auto-send ONLY when there is nothing to choose — i.e. no email on the
    // order, so SMS is the single possible destination. That keeps the
    // instant-send behaviour for the ordinary Bangladeshi checkout.
    //
    // When a choice IS offered, sending on open would fire the code to the
    // phone (the default) before the customer has picked, which both
    // contradicts the picker sitting right underneath and burns one of the
    // five OTP requests per hour the backend allows. They press Send.
    if (shippingPhone && !emailAvailable && !autoSentRef.current) {
      autoSentRef.current = true;
      requestCodOtp.mutate(sendArgs, { onSuccess: () => resendCooldown.start() });
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, shippingPhone, requestCodOtp]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm rounded-brand border border-line bg-white p-6 shadow-xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-beige"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M13 1 1 13M1 1l12 12" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
          </svg>
        </button>

        <h3 className="font-ui text-lg font-bold text-ink">Verify your phone</h3>
        <p className="mt-1 font-body text-sm text-muted">
          {channel === "EMAIL" && emailAvailable
            ? `We'll email a verification code to ${sendTo}.`
            : `We'll text a verification code to ${shippingPhone || "your shipping phone number"}.`}
        </p>

        {/* Offered only when an email was actually entered — with no email
            there is nothing to choose between, and the notice below asks for
            one instead. */}
        {emailAvailable && (
          <div className="mt-3 rounded-[10px] border border-line bg-cream/40 p-3">
            <p className="mb-2 font-body text-xs font-semibold text-ink">Where should we send the code?</p>
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-2 font-body text-sm text-ink">
                <input
                  type="radio"
                  name="codOtpChannel"
                  checked={channel === "PHONE"}
                  onChange={() => setChannel("PHONE")}
                  className="accent-green"
                />
                SMS to {shippingPhone}
              </label>
              <label className="flex items-center gap-2 font-body text-sm text-ink">
                <input
                  type="radio"
                  name="codOtpChannel"
                  checked={channel === "EMAIL"}
                  onChange={() => setChannel("EMAIL")}
                  className="accent-green"
                />
                Email to {shippingEmail}
              </label>
            </div>
          </div>
        )}

        {/* Shown at the exact moment it's actionable: the customer is on the
            checkout page with the email field a scroll away, and this popup
            is about to text a code they may never receive because we can't
            SMS reliably outside Bangladesh. Hidden once the email field has
            something in it — there's nothing left to ask for. */}
        {!emailAvailable && (
          <p className="mt-3 rounded-[10px] border border-line bg-cream/50 p-3 font-bengali text-sm leading-relaxed text-ink">
            আপনি যদি প্রবাসী হয়ে থাকেন, দয়া করে চেকআউটে আপনার ইমেইল ফিল্ডটি পূরণ করুন।
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <Input placeholder="Enter OTP code" {...register("codOtpCode")} />
          <Button
            type="button"
            variant="ghost"
            disabled={!shippingPhone || requestCodOtp.isPending || (requestCodOtp.isSuccess && !resendCooldown.canResend)}
            onClick={() => requestCodOtp.mutate(sendArgs, { onSuccess: () => resendCooldown.start() })}
          >
            {requestCodOtp.isPending
              ? "Sending…"
              : requestCodOtp.isSuccess
                ? resendCooldown.canResend
                  ? "Resend OTP"
                  : `Resend in ${resendCooldown.secondsLeft}s`
                : "Send OTP"}
          </Button>
        </div>
        {requestCodOtp.isSuccess && (
          <p className="mt-1.5 font-bengali text-xs font-semibold text-green flex items-center gap-1">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            ওটিপি পাঠানো হয়েছে
          </p>
        )}
        {requestCodOtp.isError && (
          <p className="mt-1 font-body text-xs text-red-600">
            {requestCodOtp.error instanceof Error ? requestCodOtp.error.message : "Failed to send OTP"}
          </p>
        )}
        {formState.errors.codOtpCode && (
          <p className="mt-1 font-body text-xs text-red-600">{formState.errors.codOtpCode.message}</p>
        )}
        {errorMessage && <p className="mt-1 font-body text-xs text-red-600">{errorMessage}</p>}

        <Button type="button" variant="green" block disabled={isSubmitting || !codOtpCode} className="mt-4" onClick={onConfirm}>
          {isSubmitting ? "Placing Order…" : "Confirm & Place Order"}
        </Button>
      </div>
    </div>
  );
}
