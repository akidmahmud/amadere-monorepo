"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card } from "@amader/admin-ui";
import { useRoles } from "@/hooks/useRbac";
import { useCreateStaff } from "@/hooks/useStaff";

const inputClass = "h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500";

export default function NewStaffPage() {
  const router = useRouter();
  const { data: roles } = useRoles();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [roleIds, setRoleIds] = useState<number[]>([]);
  const create = useCreateStaff();

  function toggleRole(id: number) {
    setRoleIds((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await create.mutateAsync({ email, password, firstName, lastName, roleIds });
    router.push("/staff");
  }

  return (
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
          <span className="text-xs font-semibold text-secondary">Email</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Password</span>
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
        </label>
        <div>
          <span className="mb-2 block text-xs font-semibold text-secondary">Roles</span>
          <div className="flex flex-wrap gap-2">
            {roles?.map((r) => (
              <label key={r.id} className="flex items-center gap-1.5 rounded-pill border border-border bg-surface px-3 py-1.5 text-xs text-text">
                <input type="checkbox" checked={roleIds.includes(r.id)} onChange={() => toggleRole(r.id)} />
                {r.name}
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <Button type="submit" variant="primary" disabled={create.isPending}>
            {create.isPending ? "Saving…" : "Create staff member"}
          </Button>
          <Link href="/staff">
            <Button type="button" variant="ghost">Cancel</Button>
          </Link>
        </div>
      </form>
    </Card>
  );
}
