"use client";

import { useState } from "react";
import {
  Button,
  Field,
  Modal,
  Table,
  TableEmptyRow,
  fieldInputClass,
} from "@amader/admin-ui";
import {
  useCreateParty,
  useParties,
  type CourierProvider,
  type PartyRole,
  type PartyType,
} from "@/hooks/useAccounts";
import { SectionCard, money } from "./shared";

const ROLES: PartyRole[] = [
  "SUPPLIER",
  "CUSTOMER",
  "COURIER",
  "STAFF",
  "GOVERNMENT",
  "OTHER",
];
const PROVIDERS: CourierProvider[] = [
  "STEADFAST",
  "PATHAO",
  "REDX",
  "ECOURIER",
];

const EMPTY = {
  name: "",
  type: "COMPANY" as PartyType,
  roles: ["SUPPLIER"] as PartyRole[],
  phone: "",
  bin: "",
  tin: "",
  courierProvider: "" as CourierProvider | "",
};

export function PartiesPanel() {
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);

  const { data } = useParties({ q: search || undefined, pageSize: 200 });
  const create = useCreateParty();
  const rows = data?.items ?? [];

  function toggleRole(role: PartyRole) {
    setForm((f) => ({
      ...f,
      roles: f.roles.includes(role)
        ? f.roles.filter((r) => r !== role)
        : [...f.roles, role],
    }));
  }

  return (
    <SectionCard
      title="Party master"
      subtitle="One record per person or company — used by Expenses, Dues and COD settlement"
      actions={
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or phone…"
            className={`${fieldInputClass} w-56`}
          />
          <Button
            type="button"
            variant="primary"
            onClick={() => setAdding(true)}
          >
            + Add party
          </Button>
        </div>
      }
    >
      <div className="overflow-x-auto">
        <Table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Roles</th>
              <th>Phone</th>
              <th>BIN / TIN</th>
              <th className="text-right">They owe us</th>
              <th className="text-right">We owe them</th>
              <th className="text-right">Net position</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <TableEmptyRow colSpan={8}>No parties yet.</TableEmptyRow>
            ) : (
              rows.map((p) => {
                const net = Number(p.net);
                return (
                  <tr key={p.id}>
                    <td className="font-semibold">{p.name}</td>
                    <td className="text-xs">
                      {p.type === "COMPANY" ? "Company" : "Person"}
                    </td>
                    <td className="text-xs text-secondary">
                      {p.roles
                        .map((r) => r.charAt(0) + r.slice(1).toLowerCase())
                        .join(", ")}
                      {p.courierProvider ? ` · ${p.courierProvider}` : ""}
                    </td>
                    <td>{p.phone ?? "—"}</td>
                    <td className="text-xs">{p.bin ?? p.tin ?? "—"}</td>
                    <td className="text-right">{money(p.receivable)}</td>
                    <td className="text-right">{money(p.payable)}</td>
                    <td
                      className={`text-right font-semibold ${
                        net > 0 ? "text-success" : net < 0 ? "text-danger" : ""
                      }`}
                    >
                      {money(p.net)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </Table>
      </div>

      <p className="mt-4 text-xs text-secondary">
        A courier sits on both sides — they hold your COD cash and they invoice
        you for delivery. With two separate name fields you would never see the
        net figure.
      </p>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add a party">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name" required className="col-span-2">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={fieldInputClass}
            />
          </Field>

          <Field label="Type" required>
            <select
              value={form.type}
              onChange={(e) =>
                setForm({ ...form, type: e.target.value as PartyType })
              }
              className={fieldInputClass}
            >
              <option value="COMPANY">Company</option>
              <option value="PERSON">Person</option>
            </select>
          </Field>

          <Field label="Phone">
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className={fieldInputClass}
            />
          </Field>

          <Field
            label="BIN"
            hint="Required to claim input VAT on this supplier"
          >
            <input
              value={form.bin}
              onChange={(e) => setForm({ ...form, bin: e.target.value })}
              className={fieldInputClass}
            />
          </Field>

          <Field label="TIN">
            <input
              value={form.tin}
              onChange={(e) => setForm({ ...form, tin: e.target.value })}
              className={fieldInputClass}
            />
          </Field>

          <Field
            label="Courier provider"
            className="col-span-2"
            hint="Set this only on the party a courier settles against — one party per provider"
          >
            <select
              value={form.courierProvider}
              onChange={(e) =>
                setForm({
                  ...form,
                  courierProvider: e.target.value as CourierProvider | "",
                })
              }
              className={fieldInputClass}
            >
              <option value="">Not a courier</option>
              {PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>

          <div className="col-span-2">
            <span className="text-xs font-semibold text-secondary">
              Roles *
            </span>
            <div className="mt-1.5 flex flex-wrap gap-3">
              {ROLES.map((role) => (
                <label
                  key={role}
                  className="flex items-center gap-1.5 text-sm text-text"
                >
                  <input
                    type="checkbox"
                    checked={form.roles.includes(role)}
                    onChange={() => toggleRole(role)}
                  />
                  {role.charAt(0) + role.slice(1).toLowerCase()}
                </label>
              ))}
            </div>
          </div>
        </div>

        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

        <div className="mt-5 flex gap-2">
          <Button
            type="button"
            variant="primary"
            disabled={!form.name || form.roles.length === 0 || create.isPending}
            onClick={() => {
              setError(null);
              create.mutate(
                {
                  name: form.name,
                  type: form.type,
                  roles: form.roles,
                  phone: form.phone || undefined,
                  bin: form.bin || undefined,
                  tin: form.tin || undefined,
                  courierProvider: form.courierProvider || undefined,
                },
                {
                  onSuccess: () => {
                    setForm(EMPTY);
                    setAdding(false);
                  },
                  onError: (e: unknown) =>
                    setError(
                      e instanceof Error
                        ? e.message
                        : "Could not save the party",
                    ),
                },
              );
            }}
          >
            {create.isPending ? "Saving…" : "Add party"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setAdding(false)}
          >
            Cancel
          </Button>
        </div>
      </Modal>
    </SectionCard>
  );
}
