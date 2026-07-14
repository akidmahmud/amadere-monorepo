"use client";

import { useState } from "react";
import { Button, Input } from "@amader/ui";
import { useMe } from "@/hooks/useAuth";
import { useChangePassword, useUpdateProfile } from "@/hooks/useAccount";

export function ProfileForm() {
  const { data: me } = useMe();
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();

  const [firstName, setFirstName] = useState(me?.firstName ?? "");
  const [lastName, setLastName] = useState(me?.lastName ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  if (!me) return null;

  return (
    <div className="space-y-6">
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
        {updateProfile.isSuccess && <p className="mb-2 font-body text-xs text-green">Saved!</p>}
        <Button
          variant="green"
          disabled={updateProfile.isPending}
          onClick={() => updateProfile.mutate({ firstName: firstName || undefined, lastName: lastName || undefined })}
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
