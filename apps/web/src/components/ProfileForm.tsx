"use client";

import { useState } from "react";
import { Button, Input } from "@amader/ui";
import { useMe } from "@/hooks/useAuth";
import { useChangePassword, useUpdateProfile } from "@/hooks/useAccount";
import { BirthdayPopup } from "@/components/BirthdayPopup";

export function ProfileForm() {
  const { data: me } = useMe();
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();

  const [firstName, setFirstName] = useState(me?.firstName ?? "");
  const [lastName, setLastName] = useState(me?.lastName ?? "");
  const [dob, setDob] = useState(me?.dob ? me.dob.slice(0, 10) : "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

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
          <Input value={me.email ?? ""} disabled placeholder="Email" />
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
        {updateProfile.isSuccess && <p className="mb-2 font-body text-xs text-green">Saved!</p>}
        <Button
          variant="green"
          disabled={updateProfile.isPending}
          onClick={() =>
            updateProfile.mutate({ firstName: firstName || undefined, lastName: lastName || undefined, dob: dob || undefined })
          }
        >
          Save Changes
        </Button>
      </div>

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
    </div>
  );
}
