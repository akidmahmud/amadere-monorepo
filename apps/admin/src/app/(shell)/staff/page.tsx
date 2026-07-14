"use client";

import Link from "next/link";
import { Button, Card } from "@amader/admin-ui";
import { useDeleteStaff, useStaffList } from "@/hooks/useStaff";

export default function StaffPage() {
  const { data: staff, isLoading } = useStaffList();
  const deleteStaff = useDeleteStaff();

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-secondary">{staff?.length ?? 0} staff members</p>
        <Link href="/staff/new">
          <Button variant="primary">Add staff</Button>
        </Link>
      </div>

      {isLoading && <p className="text-sm text-muted">Loading…</p>}

      <div className="flex flex-col gap-3">
        {staff?.map((member) => (
          <Card key={member.id} className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-text">
                {member.firstName} {member.lastName} {member.isSuperAdmin && "· Super Admin"}
              </div>
              <div className="text-xs text-muted">
                {member.email} · {member.status} · {member.roles.map((r) => r.name).join(", ") || "no roles"}
              </div>
            </div>
            <Link href={`/staff/${member.id}`}>
              <Button type="button" variant="ghost">Edit</Button>
            </Link>
            {!member.isSuperAdmin && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  if (confirm(`Delete "${member.firstName} ${member.lastName}"?`)) deleteStaff.mutate(member.id);
                }}
              >
                Delete
              </Button>
            )}
          </Card>
        ))}
      </div>
    </>
  );
}
