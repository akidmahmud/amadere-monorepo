"use client";

import { useEffect, useRef, useState } from "react";
import { useCheckoutFraudPreflight, type FraudPreflightResult } from "@/hooks/useCheckoutFraud";

function normalizePhone(raw: string): string {
  let phone = raw.replace(/\D/g, "");
  const m = phone.match(/^880(\d{10})$/);
  if (m) phone = "0" + m[1];
  if (/^1\d{9}$/.test(phone)) phone = "0" + phone;
  return phone;
}

function isValidBdPhone(phone: string): boolean {
  return /^01[3-9]\d{8}$/.test(phone);
}

// Real-time courier fraud badge shown next to the checkout phone field —
// parity with the reference plugin's checkout fraud widget (debounced
// live-check, success/warning/blocked/no-history states). Reports the
// verdict up to CheckoutForm via onResult so it can gate the submit button;
// the block popup itself is rendered by the parent (same BlockPopup used
// for Blocker Manager) once the customer tries to submit while blocked.
export function CheckoutFraudBadge({ phone, onResult }: { phone: string; onResult: (result: FraudPreflightResult | null) => void }) {
  const preflight = useCheckoutFraudPreflight();
  const [state, setState] = useState<"idle" | "checking" | "invalid" | "result">("idle");
  const lastCheckedRef = useRef("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const raw = phone.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (raw.length < 5) {
      setState("idle");
      onResult(null);
      return;
    }

    const normalized = normalizePhone(raw);
    if (!isValidBdPhone(normalized)) {
      setState("invalid");
      onResult(null);
      return;
    }

    if (normalized === lastCheckedRef.current) return;

    debounceRef.current = setTimeout(() => {
      lastCheckedRef.current = normalized;
      setState("checking");
      preflight.mutate(normalized, {
        onSuccess: (result) => {
          setState("result");
          onResult(result);
        },
        onError: () => {
          setState("idle");
          onResult(null);
        },
      });
    }, 800);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone]);

  if (state === "idle") return null;

  if (state === "invalid") {
    return <p className="mt-1.5 font-body text-xs text-red-600">⚠ Please double-check this phone number.</p>;
  }

  if (state === "checking") {
    return <p className="mt-1.5 font-body text-xs text-muted">Checking delivery history…</p>;
  }

  const result = preflight.data;
  if (!result) return null;

  if (!result.hasHistory) {
    return <p className="mt-1.5 font-body text-xs text-muted">ℹ No delivery history yet — first order from this number.</p>;
  }

  if (result.verdict === "block") {
    return (
      <p className="mt-1.5 font-body text-xs text-red-600">
        ⚠ Courier delivery score: {result.successRatePercent}% — this order may not go through.
      </p>
    );
  }

  if (result.verdict === "needs_advance") {
    return (
      <p className="mt-1.5 font-body text-xs text-amber-600">
        ⚠ Courier delivery score: {result.successRatePercent}% — our team may contact you to confirm this order.
      </p>
    );
  }

  return (
    <p className="mt-1.5 font-body text-xs text-green">
      ✓ Courier delivery score: {result.successRatePercent}%
    </p>
  );
}
