"use client";

import { useEffect, useState } from "react";
import { Button } from "@amader/ui";
import { useUpdateProfile } from "@/hooks/useAccount";

// Same overlay pattern as BlockPopup.tsx/CodOtpPopup.tsx. Non-blocking by
// design: the × just hides it for this visit — there's no dismiss-tracking
// storage anywhere, so it reappears every time the customer opens their
// profile until a birthday is actually saved (per spec: "if not given
// everytime user tries to access profile prompt it, if given no prompt
// anymore"). The gate for whether to render this at all lives in the
// caller (account/page.tsx), keyed on `me.dob == null`.
export function BirthdayPopup({ onClose }: { onClose: () => void }) {
  const [dob, setDob] = useState("");
  const updateProfile = useUpdateProfile();

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm rounded-brand border border-line bg-white p-6 text-center shadow-xl"
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

        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-beige text-green">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
            <path d="M12 14a1.5 1.5 0 0 0 0 3 1.5 1.5 0 0 1 0 3" />
          </svg>
        </div>

        <h3 className="font-ui text-lg font-bold text-ink">When's your birthday?</h3>
        <p className="mt-1 font-body text-sm text-muted">We'll surprise you with something on your special day.</p>

        <input
          type="date"
          value={dob}
          onChange={(e) => setDob(e.target.value)}
          max={new Date().toISOString().slice(0, 10)}
          className="mt-4 w-full rounded-[10px] border border-line bg-white px-3.5 py-2.5 font-body text-sm text-ink outline-none focus:border-green"
        />
        {updateProfile.isError && (
          <p className="mt-2 font-body text-xs text-red-600">Couldn't save that — please try again.</p>
        )}

        <Button
          variant="green"
          block
          className="mt-4"
          disabled={!dob || updateProfile.isPending}
          onClick={() => updateProfile.mutate({ dob }, { onSuccess: onClose })}
        >
          {updateProfile.isPending ? "Saving…" : "Save Birthday"}
        </Button>
      </div>
    </div>
  );
}
