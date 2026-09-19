"use client";

import { useState } from "react";
import { Button, Card } from "@amader/admin-ui";
import { useCreateRole, useDeleteRole, usePermissions, useRoles, useUpdateRole, type Role } from "@/hooks/useRbac";

// Resource keys are internal names (several predate their page's current
// title), so the picker shows what the sidebar calls each area. Anything not
// listed falls back to the key, title-cased.
const RESOURCE_LABELS: Record<string, string> = {
  net_profit_reports: "Sales Report",
  customer: "Customer Management (view = read only, manage = edit)",
  assignment: "Assign staff to customers & orders (manage = can reassign)",
  net_profit_overview: "Net Profit Overview",
  net_profit_orders: "Order Manager",
  net_profit_fraud: "Fraud Check",
  net_profit_courier: "Courier Settings",
  net_profit_sms: "SMS",
  net_profit_advance: "Payments (advance)",
  net_profit_blocker: "Order Blocker",
  net_profit_recovery: "Incomplete Orders / Recovery",
  net_profit_profit: "Product Profit",
  net_profit_payments: "Payment Verification",
  net_profit_settings: "Net Profit Settings",
  net_profit_accounts: "Accounts",
};
const ACTION_LABELS: Record<string, string> = {
  view_own: "view own orders only",
};
const titleCase = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const resourceLabel = (r: string) => RESOURCE_LABELS[r] ?? titleCase(r);

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

  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  // A whole section matches on its label or internal key ("sales", "net_profit");
  // otherwise only the actions that match ("delete") are kept. Filtering hides
  // checkboxes, never unticks them — saving still sends every selected key.
  const groups = Array.from(byResource.entries())
    .map(([resource, perms]) => {
      if (!needle || `${resourceLabel(resource)} ${resource}`.toLowerCase().includes(needle))
        return [resource, perms!] as const;
      return [resource, perms!.filter((p) => p.action.replace(/_/g, " ").includes(needle))] as const;
    })
    .filter(([, perms]) => perms.length > 0);

  return (
    <div className="flex flex-col gap-2">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search permissions… (e.g. customer, sales, delete)"
        aria-label="Search permissions"
        className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
      />
      {needle && groups.length === 0 && (
        <p className="text-sm text-muted">No permission matches “{q.trim()}”.</p>
      )}
      {groups.map(([resource, perms]) => (
        <div key={resource}>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted" title={resource}>
            {resourceLabel(resource)}
          </span>
          <div className="mt-1 flex flex-wrap gap-2">
            {perms.map((p) => (
              <label key={p.key} className="flex items-center gap-1.5 rounded-pill border border-border bg-surface px-2.5 py-1 text-xs text-text">
                <input type="checkbox" checked={selected.includes(p.key)} onChange={() => toggle(p.key)} />
                {ACTION_LABELS[p.action] ?? p.action.replace(/_/g, " ")}
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
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  // Name or description, client-side: the whole role list is already loaded.
  const shown = needle
    ? (roles ?? []).filter((r) => `${r.name} ${r.description ?? ""}`.toLowerCase().includes(needle))
    : (roles ?? []);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-secondary">
          {needle ? `${shown.length} of ${roles?.length ?? 0} roles` : `${roles?.length ?? 0} roles`}
        </p>
        <div className="flex flex-1 items-center justify-end gap-2">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search roles…"
            aria-label="Search roles"
            className="h-10 w-full max-w-xs rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          />
          {!creating && <Button variant="primary" onClick={() => setCreating(true)}>Add role</Button>}
        </div>
      </div>

      {creating && <NewRoleForm onDone={() => setCreating(false)} />}
      {isLoading && <p className="text-sm text-muted">Loading…</p>}

      <div className="flex flex-col gap-3">
        {shown.map((role) => <RoleRow key={role.id} role={role} />)}
        {needle && shown.length === 0 && (
          <p className="text-sm text-muted">No role matches “{q.trim()}”.</p>
        )}
      </div>
    </>
  );
}
