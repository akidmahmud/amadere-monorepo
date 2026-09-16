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
  useDeleteParty,
  useParties,
  usePartyStatement,
  useUpdateParty,
  type CourierProvider,
  type Party,
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
  const [editing, setEditing] = useState<Party | "new" | null>(null);
  const [viewing, setViewing] = useState<Party | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const { data } = useParties({ q: search || undefined, pageSize: 200 });
  const create = useCreateParty();
  const update = useUpdateParty();
  const deactivate = useDeleteParty();
  const { data: statement, isLoading: statementLoading } = usePartyStatement(
    viewing?.id ?? null,
  );
  const rows = data?.items ?? [];

  function openEditor(party?: Party) {
    setEditing(party ?? "new");
    setForm(
      party
        ? {
            name: party.name,
            type: party.type,
            roles: party.roles,
            phone: party.phone ?? "",
            bin: party.bin ?? "",
            tin: party.tin ?? "",
            courierProvider: party.courierProvider ?? "",
          }
        : EMPTY,
    );
    setError(null);
  }

  function closeEditor() {
    setEditing(null);
    setError(null);
  }

  function toggleRole(role: PartyRole) {
    setForm((current) => ({
      ...current,
      roles: current.roles.includes(role)
        ? current.roles.filter((item) => item !== role)
        : [...current.roles, role],
    }));
  }

  function save() {
    setError(null);
    const input = {
      name: form.name.trim(),
      type: form.type,
      roles: form.roles,
      phone: form.phone.trim() || undefined,
      bin: form.bin.trim() || undefined,
      tin: form.tin.trim() || undefined,
      courierProvider: form.courierProvider || undefined,
    };
    const options = {
      onSuccess: closeEditor,
      onError: (e: unknown) =>
        setError(e instanceof Error ? e.message : "Could not save the party"),
    };
    if (editing === "new") create.mutate(input, options);
    else if (editing) update.mutate({ id: editing.id, ...input }, options);
  }

  return (
    <>
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
              onClick={() => openEditor()}
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
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <TableEmptyRow colSpan={9}>No parties yet.</TableEmptyRow>
              ) : (
                rows.map((party) => (
                  <tr key={party.id}>
                    <td className="font-semibold">{party.name}</td>
                    <td>{party.type === "COMPANY" ? "Company" : "Person"}</td>
                    <td className="text-xs text-secondary">
                      {party.roles.map(titleCase).join(", ")}
                      {party.courierProvider
                        ? ` · ${party.courierProvider}`
                        : ""}
                    </td>
                    <td>{party.phone ?? "—"}</td>
                    <td>{party.bin ?? party.tin ?? "—"}</td>
                    <td className="text-right">{money(party.receivable)}</td>
                    <td className="text-right">{money(party.payable)}</td>
                    <td className="text-right font-semibold">
                      {money(party.net)}
                    </td>
                    <td>
                      <div className="flex gap-3">
                        <Button
                          type="button"
                          variant="link"
                          onClick={() => setViewing(party)}
                        >
                          Statement
                        </Button>
                        <Button
                          type="button"
                          variant="link"
                          onClick={() => openEditor(party)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="link"
                          disabled={deactivate.isPending}
                          onClick={() => {
                            if (
                              window.confirm(
                                `Deactivate ${party.name}? Existing accounting history will be kept.`,
                              )
                            )
                              deactivate.mutate(party.id);
                          }}
                        >
                          Deactivate
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>
        <p className="mt-4 text-xs text-secondary">
          A courier sits on both sides — they hold your COD cash and they
          invoice you for delivery. One party record keeps the net figure
          visible.
        </p>
      </SectionCard>

      <Modal
        open={editing !== null}
        onClose={closeEditor}
        title={editing === "new" ? "Add a party" : "Edit party"}
      >
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
          <Field label="Courier provider" className="col-span-2">
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
              {PROVIDERS.map((provider) => (
                <option key={provider} value={provider}>
                  {provider}
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
                  {titleCase(role)}
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
            disabled={
              !form.name.trim() ||
              form.roles.length === 0 ||
              create.isPending ||
              update.isPending
            }
            onClick={save}
          >
            {create.isPending || update.isPending ? "Saving…" : "Save party"}
          </Button>
          <Button type="button" variant="ghost" onClick={closeEditor}>
            Cancel
          </Button>
        </div>
      </Modal>

      <Modal
        open={viewing !== null}
        onClose={() => setViewing(null)}
        title={`${viewing?.name ?? "Party"} statement`}
        className="max-w-4xl"
      >
        {statementLoading ? (
          <p className="py-8 text-center text-sm text-secondary">
            Loading statement…
          </p>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-3 gap-3 rounded-sm bg-surface-2 p-3 text-sm">
              <div>
                They owe us
                <br />
                <strong>{money(statement?.position.receivable)}</strong>
              </div>
              <div>
                We owe them
                <br />
                <strong>{money(statement?.position.payable)}</strong>
              </div>
              <div>
                Net position
                <br />
                <strong>{money(statement?.position.net)}</strong>
              </div>
            </div>
            <Table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Source</th>
                  <th>Reference</th>
                  <th>Note</th>
                  <th className="text-right">In</th>
                  <th className="text-right">Out</th>
                </tr>
              </thead>
              <tbody>
                {(statement?.entries.length ?? 0) === 0 ? (
                  <TableEmptyRow colSpan={6}>
                    No ledger entries for this party.
                  </TableEmptyRow>
                ) : (
                  statement?.entries.map((entry) => (
                    <tr key={entry.id}>
                      <td>{entry.entryDate.slice(0, 10)}</td>
                      <td>{entry.source.replaceAll("_", " ")}</td>
                      <td>{entry.reference ?? "—"}</td>
                      <td>{entry.note ?? "—"}</td>
                      <td className="text-right">
                        {entry.direction === "IN" ? money(entry.amount) : "—"}
                      </td>
                      <td className="text-right">
                        {entry.direction === "OUT" ? money(entry.amount) : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </>
        )}
      </Modal>
    </>
  );
}

function titleCase(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}
