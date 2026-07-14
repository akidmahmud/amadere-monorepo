"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card } from "@amader/admin-ui";
import { useRoles } from "@/hooks/useRbac";
import { useStaffList, useStaffLoginHistory, useUpdateStaff, type StaffStatus } from "@/hooks/useStaff";

const inputClass = "h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500";

export default function EditStaffPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const staffId = Number(id);
  const router = useRouter();
  const { data: staff, isLoading } = useStaffList();
  const member = staff?.find((s) => s.id === staffId);
  const { data: history } = useStaffLoginHistory(staffId);
  const { data: roles } = useRoles();
  const update = useUpdateStaff(staffId);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<StaffStatus>("ACTIVE");
  const [roleIds, setRoleIds] = useState<number[]>([]);

  useEffect(() => {
    if (!member) return;
    setFirstName(member.firstName);
    setLastName(member.lastName);
    setPhone(member.phone ?? "");
    setStatus(member.status);
    setRoleIds(member.roles.map((r) => r.id));
  }, [member]);

  function toggleRole(rid: number) {
    setRoleIds((prev) => (prev.includes(rid) ? prev.filter((r) => r !== rid) : [...prev, rid]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await update.mutateAsync({ firstName, lastName, phone: phone || undefined, status, roleIds });
    router.push("/staff");
  }

  if (isLoading || !member) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div className="flex flex-col gap-6">
      <Card className="max-w-xl">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex gap-4">
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-xs font-semibold text-secondary">First name</span>
              <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} />
            </label>
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-xs font-semibold text-secondary">Last name</span>
              <input required value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} />
            </label>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Phone (optional)</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as StaffStatus)} className={inputClass} disabled={member.isSuperAdmin}>
              <option value="ACTIVE">Active</option>
              <option value="DISABLED">Disabled</option>
            </select>
          </label>
          <div>
            <span className="mb-2 block text-xs font-semibold text-secondary">Roles</span>
            <div className="flex flex-wrap gap-2">
              {roles?.map((r) => (
                <label key={r.id} className="flex items-center gap-1.5 rounded-pill border border-border bg-surface px-3 py-1.5 text-xs text-text">
                  <input type="checkbox" checked={roleIds.includes(r.id)} onChange={() => toggleRole(r.id)} disabled={member.isSuperAdmin} />
                  {r.name}
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <Button type="submit" variant="primary" disabled={update.isPending}>
              {update.isPending ? "Saving…" : "Save changes"}
            </Button>
            <Link href="/staff">
              <Button type="button" variant="ghost">Cancel</Button>
            </Link>
          </div>
        </form>
      </Card>

      <Card>
        <h3 className="mb-3 font-ui text-base font-semibold text-text">Login history</h3>
        <div className="flex flex-col gap-1.5 text-sm">
          {history?.map((h) => (
            <div key={h.id} className="flex justify-between text-text">
              <span>{h.success ? "✓ Success" : "✗ Failed"} — {h.ipAddress ?? "unknown IP"}</span>
              <span className="text-xs text-muted">{new Date(h.createdAt).toLocaleString()}</span>
            </div>
          ))}
          {history?.length === 0 && <p className="text-xs text-muted">No login history yet.</p>}
        </div>
      </Card>
    </div>
  );
}
