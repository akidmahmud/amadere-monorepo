"use client";

import { useRef, useState } from "react";
import { Button, Input } from "@amader/ui";
import { useSubmitManualPayment, useUploadPaymentScreenshot } from "@/hooks/useManualPayment";

const METHOD_BY_PROVIDER: Record<string, "bkash" | "nagad" | "rocket" | "upay"> = {
  BKASH: "bkash",
  NAGAD: "nagad",
  ROCKET: "rocket",
  UPAY: "upay",
};

// Shown on the order confirmation page when the order was placed with a
// manual mobile-wallet method (bKash/Nagad/Rocket/Upay) and payment is
// still PENDING — "I paid to your number, here's my transaction ID"
// (Payments module parity — this whole customer-facing flow didn't exist
// before; only the backend endpoint and admin verification queue did).
export function ManualPaymentSubmission({
  orderId,
  provider,
  amount,
}: {
  orderId: number;
  provider: string;
  amount: string;
}) {
  const method = METHOD_BY_PROVIDER[provider];
  const submit = useSubmitManualPayment();
  const upload = useUploadPaymentScreenshot();
  const fileRef = useRef<HTMLInputElement>(null);

  const [senderMsisdn, setSenderMsisdn] = useState("");
  const [trxId, setTrxId] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (!method) return null;

  if (submitted || submit.isSuccess) {
    return (
      <div className="mb-4 rounded-brand border border-line bg-white p-5 text-center">
        <p className="font-ui text-sm font-semibold text-green">Thanks — we&apos;ve received your payment details.</p>
        <p className="mt-1 font-body text-xs text-muted">Our team will verify it shortly.</p>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-brand border border-line bg-white p-5">
      <h3 className="mb-1 font-ui text-sm font-semibold text-ink">Complete your {provider} payment</h3>
      <p className="mb-3 font-body text-xs text-muted">
        After sending the payment, enter the number you paid from and the transaction ID below.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit.mutate(
            {
              orderId,
              method,
              senderMsisdn: senderMsisdn.trim(),
              trxId: trxId.trim(),
              amount: Number(amount),
              screenshotUrl: screenshotUrl ?? undefined,
            },
            { onSuccess: () => setSubmitted(true) },
          );
        }}
        className="flex flex-col gap-3"
      >
        <Input placeholder="Your bKash/Nagad number" value={senderMsisdn} onChange={(e) => setSenderMsisdn(e.target.value)} required />
        <Input placeholder="Transaction ID" value={trxId} onChange={(e) => setTrxId(e.target.value)} required />

        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload.mutate(file, { onSuccess: (r) => setScreenshotUrl(r.url) });
            }}
          />
          <Button type="button" variant="ghost" onClick={() => fileRef.current?.click()} disabled={upload.isPending}>
            {upload.isPending ? "Uploading…" : screenshotUrl ? "Screenshot attached ✓" : "Attach payment screenshot (optional)"}
          </Button>
        </div>

        {submit.isError && (
          <p className="font-body text-xs text-red-600">
            {submit.error instanceof Error ? submit.error.message : "Couldn't submit — please check your details"}
          </p>
        )}

        <Button type="submit" variant="green" disabled={submit.isPending || !senderMsisdn.trim() || !trxId.trim()}>
          {submit.isPending ? "Submitting…" : "Submit payment details"}
        </Button>
      </form>
    </div>
  );
}
