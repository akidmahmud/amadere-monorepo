"use client";

import { useState } from "react";
import { Button, Input } from "@amader/ui";
import { useMe } from "@/hooks/useAuth";
import { useChangePassword, useSetPassword, useUpdateProfile } from "@/hooks/useAccount";
import { BirthdayPopup } from "@/components/BirthdayPopup";

export function ProfileForm() {
  const { data: me } = useMe();
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();
  const setPasswordMutation = useSetPassword();

  const [firstName, setFirstName] = useState(me?.firstName ?? "");
  const [lastName, setLastName] = useState(me?.lastName ?? "");
  const [email, setEmail] = useState(me?.email ?? "");
  const [dob, setDob] = useState(me?.dob ? me.dob.slice(0, 10) : "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [setPasswordValue, setSetPasswordValue] = useState("");

  // Non-blocking birthday nudge: resets to visible on every fresh mount of
  // this page (no dismiss-tracking storage) — closing it only hides it for
  // this visit. Once `me.dob` is actually set, the gate itself goes false
  // and it stops appearing for good.
  const [birthdayPopupClosed, setBirthdayPopupClosed] = useState(false);

  if (!me) return null;

  return (
    <div className="space-y-6">
      {!me.dob && !birthdayPopupClosed && <BirthdayPopup onClose={() => setBirthdayPopupClosed(true)} />}

      <div className="rounded-brand border border-line bg-white p-5">
        <h2 className="mb-4 font-ui text-[15px] font-semibold text-green">Profile</h2>
        <div className="mb-3.5 grid grid-cols-2 gap-3">
          <Input placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          <Input placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
        <div className="mb-3.5 grid grid-cols-2 gap-3">
          {/* Phone stays read-only — it's the account's identity for OTP
              login and order lookup, so changing it isn't a profile edit.
              Email is editable: most migrated accounts carry a synthetic
              `<phone>@temporary.com` address, and it's now also a password
              login identifier. */}
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
          <Input value={me.phone ?? ""} disabled placeholder="Phone" />
        </div>
        <label className="mb-3.5 block">
          <span className="mb-1.5 block font-body text-xs text-muted">Birthday</span>
          <Input
            type="date"
            value={dob}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setDob(e.target.value)}
            className="max-w-[200px]"
          />
        </label>
        {updateProfile.isError && (
          <p className="mb-2 font-body text-xs text-red-600">
            {updateProfile.error instanceof Error ? updateProfile.error.message : "Couldn't save changes"}
          </p>
        )}
        {updateProfile.isSuccess && <p className="mb-2 font-body text-xs text-green">Saved!</p>}
        <Button
          variant="green"
          disabled={updateProfile.isPending}
          onClick={() =>
            // `|| undefined` on each field is the PATCH contract: omitted
            // means "leave unchanged". An empty email box therefore keeps
            // the current address rather than trying (and failing) to clear
            // it.
            updateProfile.mutate({
              firstName: firstName || undefined,
              lastName: lastName || undefined,
              email: email.trim() || undefined,
              dob: dob || undefined,
            })
          }
        >
          Save Changes
        </Button>
      </div>

      {me.hasPassword ? (
        <div className="rounded-brand border border-line bg-white p-5">
          <h2 className="mb-4 font-ui text-[15px] font-semibold text-green">Change Password</h2>
          <div className="mb-3.5 grid grid-cols-2 gap-3">
            <Input
              type="password"
              placeholder="Current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
            <Input
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          {changePassword.isError && (
            <p className="mb-2 font-body text-xs text-red-600">
              {changePassword.error instanceof Error ? changePassword.error.message : "Couldn't change password"}
            </p>
          )}
          {changePassword.isSuccess && <p className="mb-2 font-body text-xs text-green">Password updated!</p>}
          <Button
            variant="ghost"
            disabled={!currentPassword || newPassword.length < 8 || changePassword.isPending}
            onClick={() => {
              changePassword.mutate(
                { currentPassword, newPassword },
                { onSuccess: () => { setCurrentPassword(""); setNewPassword(""); } },
              );
            }}
          >
            Update Password
          </Button>
        </div>
      ) : (
        // Account was created/logged into via OTP only — no current password
        // to confirm, so this is a create rather than a change (POST vs the
        // PATCH above, see useSetPassword).
        <div className="rounded-brand border border-line bg-white p-5">
          <h2 className="mb-1 font-ui text-[15px] font-semibold text-green">Set a Password</h2>
          <p className="mb-3.5 font-body text-xs text-muted">
            You signed in with a phone OTP. Add a password so you can also log in with your phone number and password.
          </p>
          <Input
            type="password"
            placeholder="New password"
            value={setPasswordValue}
            onChange={(e) => setSetPasswordValue(e.target.value)}
            className="mb-3.5 max-w-[280px]"
          />
          {setPasswordMutation.isError && (
            <p className="mb-2 font-body text-xs text-red-600">
              {setPasswordMutation.error instanceof Error ? setPasswordMutation.error.message : "Couldn't set password"}
            </p>
          )}
          {setPasswordMutation.isSuccess && <p className="mb-2 font-body text-xs text-green">Password set!</p>}
          <Button
            variant="ghost"
            disabled={setPasswordValue.length < 8 || setPasswordMutation.isPending}
            onClick={() => {
              setPasswordMutation.mutate(
                { newPassword: setPasswordValue },
                { onSuccess: () => setSetPasswordValue("") },
              );
            }}
          >
            Set Password
          </Button>
        </div>
      )}
    </div>
  );
}
