"use client";

import { useState } from "react";
import { Button, Card } from "@amader/admin-ui";
import { useCreateRole, useDeleteRole, usePermissions, useRoles, useUpdateRole, type Role } from "@/hooks/useRbac";

function PermissionCheckboxes({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (keys: string[]) => void;
}) {
  const { data: permissions } = usePermissions();
  const byResource = new Map<string, typeof permissions>();
  for (const p of permissions ?? []) {
    if (!byResource.has(p.resource)) byResource.set(p.resource, []);
    byResource.get(p.resource)!.push(p);
  }

  function toggle(key: string) {
    onChange(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]);
  }

  return (
    <div className="flex flex-col gap-2">
      {Array.from(byResource.entries()).map(([resource, perms]) => (
        <div key={resource}>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">{resource}</span>
          <div className="mt-1 flex flex-wrap gap-2">
            {perms!.map((p) => (
              <label key={p.key} className="flex items-center gap-1.5 rounded-pill border border-border bg-surface px-2.5 py-1 text-xs text-text">
                <input type="checkbox" checked={selected.includes(p.key)} onChange={() => toggle(p.key)} />
                {p.action}
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function NewRoleForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [permissionKeys, setPermissionKeys] = useState<string[]>([]);
  const create = useCreateRole();

  async function handleSave() {
    await create.mutateAsync({ name, description: description || undefined, permissionKeys });
    onDone();
  }

  return (
    <Card className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-secondary">Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-secondary">Description (optional)</span>
        <input value={description} onChange={(e) => setDescription(e.target.value)} className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500" />
      </label>
      <PermissionCheckboxes selected={permissionKeys} onChange={setPermissionKeys} />
      <div className="flex gap-2">
        <Button type="button" variant="primary" disabled={create.isPending || !name} onClick={handleSave}>
          {create.isPending ? "Saving…" : "Create role"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </Card>
  );
}

function RoleRow({ role }: { role: Role }) {
  const [editing, setEditing] = useState(false);
  const [permissionKeys, setPermissionKeys] = useState(role.permissionKeys);
  const update = useUpdateRole(role.id);
  const deleteRole = useDeleteRole();

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-text">
            {role.name} {role.isSystem && <span className="text-xs text-muted">(system)</span>}
          </div>
          {role.description && <div className="text-xs text-muted">{role.description}</div>}
        </div>
        <div className="flex gap-2">
          {!editing && (
            <Button type="button" variant="ghost" onClick={() => setEditing(true)}>
              Edit permissions
            </Button>
          )}
          {!role.isSystem && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                if (confirm(`Delete role "${role.name}"?`)) deleteRole.mutate(role.id);
              }}
            >
              Delete
            </Button>
          )}
        </div>
      </div>
      {editing ? (
        <>
          <PermissionCheckboxes selected={permissionKeys} onChange={setPermissionKeys} />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="primary"
              disabled={update.isPending}
              onClick={() => update.mutate({ permissionKeys }, { onSuccess: () => setEditing(false) })}
            >
              {update.isPending ? "Saving…" : "Save"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => { setEditing(false); setPermissionKeys(role.permissionKeys); }}>
              Cancel
            </Button>
          </div>
        </>
      ) : (
        <p className="text-xs text-muted">{role.permissionKeys.length} permissions</p>
      )}
    </Card>
  );
}

export default function RolesPage() {
  const { data: roles, isLoading } = useRoles();
  const [creating, setCreating] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-secondary">{roles?.length ?? 0} roles</p>
        {!creating && <Button variant="primary" onClick={() => setCreating(true)}>Add role</Button>}
      </div>

      {creating && <NewRoleForm onDone={() => setCreating(false)} />}
      {isLoading && <p className="text-sm text-muted">Loading…</p>}

      <div className="flex flex-col gap-3">
        {roles?.map((role) => <RoleRow key={role.id} role={role} />)}
      </div>
    </>
  );
}
