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
  useCostCentres,
  useCreateCostCentre,
  useCreateExpenseCategory,
  useExpenseCategories,
  useUpdateCostCentre,
  useUpdateExpenseCategory,
  type CostCentre,
  type ExpenseCategory,
} from "@/hooks/useAccounts";
import { SectionCard } from "./shared";

type Editor =
  | { kind: "category"; row?: ExpenseCategory }
  | { kind: "cost-centre"; row?: CostCentre }
  | null;

export function AccountsMastersPanel() {
  const { data: categories } = useExpenseCategories(true);
  const { data: costCentres } = useCostCentres(true);
  const createCategory = useCreateExpenseCategory();
  const updateCategory = useUpdateExpenseCategory();
  const createCostCentre = useCreateCostCentre();
  const updateCostCentre = useUpdateCostCentre();
  const [editor, setEditor] = useState<Editor>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [isVatClaimable, setIsVatClaimable] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [sortOrder, setSortOrder] = useState("0");
  const [error, setError] = useState<string | null>(null);

  function open(next: Exclude<Editor, null>) {
    setEditor(next);
    setName(next.row?.name ?? "");
    setCode(next.kind === "cost-centre" ? (next.row?.code ?? "") : "");
    setIsVatClaimable(
      next.kind === "category" ? (next.row?.isVatClaimable ?? true) : true,
    );
    setIsActive(next.row?.isActive ?? true);
    setSortOrder(String(next.row?.sortOrder ?? 0));
    setError(null);
  }

  function close() {
    setEditor(null);
    setError(null);
  }

  function save() {
    if (!editor) return;
    setError(null);
    const options = {
      onSuccess: close,
      onError: (e: unknown) =>
        setError(e instanceof Error ? e.message : "Could not save this item"),
    };
    if (editor.kind === "category") {
      const input = {
        name: name.trim(),
        isVatClaimable,
        isActive,
        sortOrder: Number(sortOrder) || 0,
      };
      if (editor.row)
        updateCategory.mutate({ id: editor.row.id, ...input }, options);
      else createCategory.mutate(input, options);
    } else {
      const input = {
        name: name.trim(),
        code: code.trim() || undefined,
        isActive,
        sortOrder: Number(sortOrder) || 0,
      };
      if (editor.row)
        updateCostCentre.mutate({ id: editor.row.id, ...input }, options);
      else createCostCentre.mutate(input, options);
    }
  }

  const saving =
    createCategory.isPending ||
    updateCategory.isPending ||
    createCostCentre.isPending ||
    updateCostCentre.isPending;

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Expense categories"
          subtitle="Used to classify expenses and decide whether input VAT is claimable."
          actions={
            <Button
              type="button"
              variant="primary"
              onClick={() => open({ kind: "category" })}
            >
              + Add category
            </Button>
          }
        >
          <Table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Input VAT</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(categories?.length ?? 0) === 0 ? (
                <TableEmptyRow colSpan={4}>No categories yet.</TableEmptyRow>
              ) : (
                categories?.map((row) => (
                  <tr key={row.id}>
                    <td className="font-semibold">{row.name}</td>
                    <td>
                      {row.isVatClaimable ? "Claimable" : "Not claimable"}
                    </td>
                    <td>{row.isActive ? "Active" : "Inactive"}</td>
                    <td className="text-right">
                      <Button
                        type="button"
                        variant="link"
                        onClick={() => open({ kind: "category", row })}
                      >
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </SectionCard>

        <SectionCard
          title="Cost centres"
          subtitle="Business units used to group spending."
          actions={
            <Button
              type="button"
              variant="primary"
              onClick={() => open({ kind: "cost-centre" })}
            >
              + Add cost centre
            </Button>
          }
        >
          <Table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(costCentres?.length ?? 0) === 0 ? (
                <TableEmptyRow colSpan={4}>No cost centres yet.</TableEmptyRow>
              ) : (
                costCentres?.map((row) => (
                  <tr key={row.id}>
                    <td className="font-semibold">{row.name}</td>
                    <td>{row.code ?? "—"}</td>
                    <td>{row.isActive ? "Active" : "Inactive"}</td>
                    <td className="text-right">
                      <Button
                        type="button"
                        variant="link"
                        onClick={() => open({ kind: "cost-centre", row })}
                      >
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </SectionCard>
      </div>

      <Modal
        open={editor !== null}
        onClose={close}
        title={`${editor?.row ? "Edit" : "Add"} ${editor?.kind === "category" ? "expense category" : "cost centre"}`}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" required className="sm:col-span-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={fieldInputClass}
            />
          </Field>
          {editor?.kind === "cost-centre" ? (
            <Field label="Code">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className={fieldInputClass}
              />
            </Field>
          ) : (
            <label className="flex items-center gap-2 py-2 text-sm text-text">
              <input
                type="checkbox"
                checked={isVatClaimable}
                onChange={(e) => setIsVatClaimable(e.target.checked)}
              />
              Input VAT is claimable
            </label>
          )}
          <Field label="Sort order">
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className={fieldInputClass}
            />
          </Field>
          <label className="flex items-center gap-2 py-2 text-sm text-text">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Active and available on new expenses
          </label>
        </div>
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        <div className="mt-5 flex gap-2">
          <Button
            type="button"
            variant="primary"
            disabled={!name.trim() || saving}
            onClick={save}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button type="button" variant="ghost" onClick={close}>
            Cancel
          </Button>
        </div>
      </Modal>
    </>
  );
}
