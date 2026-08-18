"use client";

import { useEffect, useRef } from "react";
import { useFormContext } from "react-hook-form";
import { Button, Input } from "@amader/ui";
import type { CheckoutFormValues } from "@/lib/checkout-schema";
import { useRequestCodOtp } from "@/hooks/useCheckout";
import { useResendCooldown } from "@/hooks/useResendCooldown";

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
  const autoSentRef = useRef(false);
  const resendCooldown = useResendCooldown();

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    if (shippingPhone && !autoSentRef.current) {
      autoSentRef.current = true;
      requestCodOtp.mutate(shippingPhone, { onSuccess: () => resendCooldown.start() });
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
          We&apos;ll text a verification code to {shippingPhone || "your shipping phone number"}.
        </p>

        <div className="mt-4 flex gap-2">
          <Input placeholder="Enter OTP code" {...register("codOtpCode")} />
          <Button
            type="button"
            variant="ghost"
            disabled={!shippingPhone || requestCodOtp.isPending || (requestCodOtp.isSuccess && !resendCooldown.canResend)}
            onClick={() => requestCodOtp.mutate(shippingPhone, { onSuccess: () => resendCooldown.start() })}
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
        {(requestCodOtp.isSuccess || (autoSentRef.current && !requestCodOtp.isError)) && (
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
