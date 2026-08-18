import { useEffect, useRef, useState } from "react";

const DEFAULT_COOLDOWN_SECONDS = 120;

// Shared by every OTP resend button (login, register, checkout's COD phone
// verification) — a code stays valid for 5 minutes server-side
// (otp.service.ts's OTP_TTL_MS), but verify() always checks the MOST
// RECENTLY requested code for that identifier+purpose. An ungated resend
// silently invalidates whatever code the customer was just sent (and may
// already have typed), well inside that 5-minute window — this is what made
// OTPs feel like they were "expiring" early. Gating resend behind a real
// elapsed-time cooldown (not just "not currently in flight") stops that.
export function useResendCooldown(seconds = DEFAULT_COOLDOWN_SECONDS) {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    return () => clearInterval(intervalRef.current);
  }, []);

  function start() {
    clearInterval(intervalRef.current);
    setSecondsLeft(seconds);
    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  return { secondsLeft, canResend: secondsLeft === 0, start };
}
