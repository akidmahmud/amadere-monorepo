"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, Icon, Modal } from "@amader/admin-ui";
import { useRoles } from "@/hooks/useRbac";
import { useCreateStaff } from "@/hooks/useStaff";
import { useToast } from "@/components/ToastProvider";
import { ProxyApiError } from "@/lib/api/proxy-client";
import { friendlyErrorMessage } from "@/lib/friendly-error";

const inputClass = "h-10 w-full rounded-sm border border-border bg-surface pl-10 pr-3 text-sm text-text outline-none focus:border-brand-500";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const checkIcon = (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const eyeIcon = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const eyeOffIcon = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a20.3 20.3 0 0 1 5.06-6.06M9.9 4.24A9.96 9.96 0 0 1 12 4c7 0 11 8 11 8a20.4 20.4 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24" />
    <path d="M1 1l22 22" />
  </svg>
);

// Ground truth is CreateAdminUserDto: @MinLength(8) and nothing else — no
// uppercase/number/symbol is actually required server-side. "score" below is
// advisory (encourages a stronger password) but `meetsMinimum` alone is
// the only thing that can legitimately block Create, so the two are tracked
// separately rather than one hard gate pretending to be the real rule.
function passwordStrength(pw: string): { meetsMinimum: boolean; score: number; label: string } {
  if (pw.length < 8) return { meetsMinimum: false, score: 0, label: "Too short — needs at least 8 characters" };
  let variety = 0;
  if (/[a-z]/.test(pw)) variety++;
  if (/[A-Z]/.test(pw)) variety++;
  if (/\d/.test(pw)) variety++;
  if (/[^A-Za-z0-9]/.test(pw)) variety++;
  let score = 1;
  if (variety >= 2) score = 2;
  if (variety >= 3) score = 3;
  if (variety >= 3 && pw.length >= 12) score = 4;
  return { meetsMinimum: true, score, label: ["", "Weak", "Fair", "Good", "Strong"][score] };
}

const STRENGTH_BAR_COLOR = ["bg-danger", "bg-danger", "bg-[#f5a623]", "bg-[#3ea6ff]", "bg-success"];
const STRENGTH_TEXT_COLOR = ["text-danger", "text-danger", "text-[#e0821c]", "text-[#2f7dd6]", "text-success"];

// Circular badge, not admin-ui's IconTile (which is a fixed rounded-square) —
// this page's reference design uses full circles throughout.
function RoundIcon({ name, className }: { name: string; className?: string }) {
  return (
    <div className={`grid h-10 w-10 flex-none place-items-center rounded-full ${className ?? ""}`}>
      <Icon name={name} />
    </div>
  );
}

function LeadingIcon({ name, muted }: { name: string; muted: boolean }) {
  return (
    <span className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${muted ? "text-muted" : "text-text"}`}>
      <Icon name={name} size={17} />
    </span>
  );
}

function FieldCheck() {
  return <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-success">{checkIcon}</span>;
}

function RequiredMark() {
  return <span className="ml-0.5 text-danger">*</span>;
}

export default function NewStaffPage() {
  const router = useRouter();
  const toast = useToast();
  const { data: roles } = useRoles();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [roleIds, setRoleIds] = useState<number[]>([]);
  const [rolePickerOpen, setRolePickerOpen] = useState(false);
  const create = useCreateStaff();

  const emailValid = email.trim() !== "" && EMAIL_RE.test(email.trim());
  const emailInvalid = email.trim() !== "" && !emailValid;
  const strength = passwordStrength(password);
  const selectedRoleNames = (roles ?? []).filter((r) => roleIds.includes(r.id)).map((r) => r.name);

  function toggleRole(id: number) {
    setRoleIds((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await create.mutateAsync({ email, password, firstName, lastName, roleIds });
    } catch (err) {
      toast.push(err instanceof ProxyApiError ? friendlyErrorMessage(err.message) : "Failed to create staff member");
      return;
    }
    router.push("/staff");
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
      <Card className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <RoundIcon name="person" className="bg-brand-50 text-brand-500" />
          <div>
            <h2 className="font-ui text-sm font-bold text-text">Personal Information</h2>
            <p className="text-xs text-muted">Add basic details of the staff member.</p>
          </div>
        </div>

        <div className="flex gap-4">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">
              First name<RequiredMark />
            </span>
            <div className="relative">
              <LeadingIcon name="person" muted={!firstName} />
              <input
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Enter first name"
                className={inputClass}
              />
              {firstName.trim() && <FieldCheck />}
            </div>
          </label>
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Last name</span>
            <div className="relative">
              <LeadingIcon name="person" muted={!lastName} />
              <input
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Enter last name"
                className={inputClass}
              />
              {lastName.trim() && <FieldCheck />}
            </div>
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">
            Email address<RequiredMark />
          </span>
          <div className="relative">
            <LeadingIcon name="mail" muted={!email} />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter email address"
              className={`${inputClass} ${emailInvalid ? "border-danger" : ""}`}
            />
            {emailValid && <FieldCheck />}
          </div>
          {emailValid && (
            <span className="flex items-center gap-1 text-[0.68rem] font-semibold text-success">{checkIcon} Looks good</span>
          )}
          {emailInvalid && <span className="text-[0.68rem] font-semibold text-danger">Enter a valid email address</span>}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">
            Password<RequiredMark />
          </span>
          <div className="relative">
            <LeadingIcon name="lock" muted={!password} />
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className={`${inputClass} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-0 top-0 grid h-10 w-10 place-items-center text-muted hover:text-text"
            >
              {showPassword ? eyeOffIcon : eyeIcon}
            </button>
          </div>

          {password.length > 0 && (
            <div className="flex flex-col gap-1">
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((seg) => (
                  <span
                    key={seg}
                    className={`h-1 flex-1 rounded-full ${seg <= strength.score ? STRENGTH_BAR_COLOR[strength.score] : "bg-border"}`}
                  />
                ))}
              </div>
              <span className={`text-[0.68rem] font-semibold ${STRENGTH_TEXT_COLOR[strength.score]}`}>
                {strength.meetsMinimum ? `${strength.label} password` : strength.label}
              </span>
            </div>
          )}
        </label>

        <hr className="border-border" />

        <div className="flex items-center gap-3">
          <RoundIcon name="shield" className="bg-brand-50 text-brand-500" />
          <div>
            <h2 className="font-ui text-sm font-bold text-text">Roles &amp; Permissions</h2>
            <p className="text-xs text-muted">Assign role(s) to define permissions.</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setRolePickerOpen(true)}
          className="flex items-center gap-3 rounded-inner border border-dashed border-border bg-surface-2 px-4 py-3 text-left hover:border-brand-500"
        >
          <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-brand-50 text-brand-500">
            <Icon name="add" size={18} />
          </span>
          <span>
            <span className="block text-sm font-bold text-text">
              {selectedRoleNames.length > 0 ? `${selectedRoleNames.length} role(s) selected` : "Select role(s)"}
            </span>
            <span className="block text-xs text-muted">
              {selectedRoleNames.length > 0 ? selectedRoleNames.join(", ") : "Choose one or more roles for this staff member."}
            </span>
          </span>
        </button>

        <div className="flex gap-3">
          <Button type="submit" variant="primary" disabled={create.isPending}>
            <Icon name="person_add" size={16} />
            {create.isPending ? "Saving…" : "Create staff member"}
          </Button>
          <Link href="/staff">
            <Button type="button" variant="ghost">Cancel</Button>
          </Link>
        </div>
      </Card>

      <Card className="flex flex-col gap-5 self-start border-none bg-gradient-to-br from-brand-50 to-[#f3e8ff]">
        <div className="relative flex h-[150px] items-center justify-center">
          <div className="flex w-[210px] items-center gap-3 rounded-inner bg-white p-4 shadow-card">
            <div className="grid h-11 w-11 flex-none place-items-center rounded-full bg-brand-500 text-white">
              <Icon name="person" size={22} />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <span className="h-2 w-full rounded-full bg-brand-500/60" />
              <span className="h-1.5 w-4/5 rounded-full bg-brand-500/25" />
              <span className="h-1.5 w-3/5 rounded-full bg-brand-500/25" />
            </div>
          </div>
          <div className="absolute bottom-2 right-[22%] grid h-9 w-9 place-items-center rounded-full bg-brand-500 text-white shadow-card">
            {checkIcon}
          </div>
          <Icon name="add" size={18} className="absolute left-2 top-0 text-brand-400/70" />
          <Icon name="add" size={18} className="absolute right-4 top-4 text-brand-400/70" />
        </div>

        <div>
          <h2 className="font-ui text-base font-bold text-text">Adding a new staff member</h2>
          <p className="mt-1 text-xs text-muted">Fill in the details and assign a role to set the right level of access.</p>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <RoundIcon name="person" className="bg-white/70 text-brand-500" />
            <div>
              <h3 className="text-sm font-bold text-text">Accurate information</h3>
              <p className="text-xs text-muted">Ensure the email is correct for account access and notifications.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <RoundIcon name="lock" className="bg-white/70 text-brand-500" />
            <div>
              <h3 className="text-sm font-bold text-text">Strong password</h3>
              <p className="text-xs text-muted">Use a strong password with at least 8 characters.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <RoundIcon name="shield" className="bg-white/70 text-brand-500" />
            <div>
              <h3 className="text-sm font-bold text-text">Role &amp; permissions</h3>
              <p className="text-xs text-muted">Choose the appropriate role to control what they can access.</p>
            </div>
          </div>
        </div>
      </Card>

      <Modal open={rolePickerOpen} onClose={() => setRolePickerOpen(false)} title="Select role(s)">
        <div className="flex flex-col gap-2">
          {roles?.map((r) => (
            <label
              key={r.id}
              className="flex items-center gap-2.5 rounded-inner border border-border bg-surface px-4 py-3 text-sm font-medium text-text"
            >
              <input type="checkbox" checked={roleIds.includes(r.id)} onChange={() => toggleRole(r.id)} className="accent-brand-500" />
              {r.name}
            </label>
          ))}
          {roles?.length === 0 && <p className="text-sm text-muted">No roles exist yet — create one under Admin &gt; Roles.</p>}
        </div>
        <div className="mt-4 flex justify-end">
          <Button type="button" variant="primary" onClick={() => setRolePickerOpen(false)}>
            Done
          </Button>
        </div>
      </Modal>
    </form>
  );
}
