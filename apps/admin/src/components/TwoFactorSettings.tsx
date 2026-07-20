"use client";

import { useState } from "react";
import { Button, Card } from "@amader/admin-ui";
import { useAdminMe, useDisableTwoFactor, useEnableTwoFactor, useSetupTwoFactor } from "@/hooks/useAdminAuth";

const inputClass = "num h-10 w-40 rounded-sm border border-border bg-surface px-3 text-center font-ui text-lg tracking-[4px] text-text outline-none focus:border-brand-500";

// Email-OTP 2FA — self-contained account-security card, same pattern as
// SeoMetaCard/WhatsappSettings elsewhere (own state, own mutations, own
// save/confirm flow, not wired into the generic key-value Settings list
// below it). "Setup" just proves you can receive a code at your own email;
// there's no secret/QR code to manage since this isn't TOTP.
export function TwoFactorSettings() {
  const { data: me } = useAdminMe();
  const setup = useSetupTwoFactor();
  const enable = useEnableTwoFactor();
  const disable = useDisableTwoFactor();
  const [code, setCode] = useState("");

  if (!me) return null;

  if (me.twoFactorEnabled) {
    return (
      <Card className="flex items-center justify-between">
        <div>
          <h3 className="font-ui text-sm font-semibold text-text">Two-factor authentication</h3>
          <p className="mt-1 text-xs text-muted">Enabled — a code is emailed to {me.email} on every login.</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          disabled={disable.isPending}
          onClick={() => disable.mutate(undefined, { onSuccess: () => setup.reset() })}
        >
          {disable.isPending ? "Disabling…" : "Disable"}
        </Button>
      </Card>
    );
  }

  if (setup.isSuccess) {
    return (
      <Card>
        <h3 className="font-ui text-sm font-semibold text-text">Two-factor authentication</h3>
        <p className="mt-1 text-xs text-muted">We emailed a 6-digit code to {me.email}. Enter it below to turn 2FA on.</p>
        <form
          className="mt-3 flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            enable.mutate(code, { onSuccess: () => setCode("") });
          }}
        >
          <input inputMode="numeric" autoFocus value={code} onChange={(e) => setCode(e.target.value)} className={inputClass} />
          <Button type="submit" variant="primary" disabled={enable.isPending || !code}>
            {enable.isPending ? "Confirming…" : "Confirm"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setup.reset()}>
            Cancel
          </Button>
        </form>
        {enable.isError && <p className="mt-2 text-xs text-danger">{enable.error instanceof Error ? enable.error.message : "Invalid or expired code"}</p>}
      </Card>
    );
  }

  return (
    <Card className="flex items-center justify-between">
      <div>
        <h3 className="font-ui text-sm font-semibold text-text">Two-factor authentication</h3>
        <p className="mt-1 text-xs text-muted">Off — logins only need your password. Enable to require an emailed code too.</p>
      </div>
      <Button type="button" variant="primary" disabled={setup.isPending} onClick={() => setup.mutate()}>
        {setup.isPending ? "Sending…" : "Enable"}
      </Button>
    </Card>
  );
}
