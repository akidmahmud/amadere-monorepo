"use client";

import { useState } from "react";
import { Button, Card, Icon, PageHeader, StatCard, Table, TableEmptyRow, Tabs, ToggleSwitch } from "@amader/admin-ui";
import {
  accountsExportUrl,
  useAccountsOverview,
  useCashFlow,
  useCreateDue,
  useCreateExpense,
  useDeleteDue,
  useDeleteExpense,
  useDues,
  useExpenses,
  useRecordDuePayment,
  useUpdateVatSettings,
  useVatSettings,
  useVatSummary,
  type DateRange,
  type DuePartyType,
} from "@/hooks/useAccounts";

const accountsIcon = <Icon name="account_balance" />;

const COMMON_CATEGORIES = ["Rent", "Salaries", "Utilities", "Packaging", "Courier & Logistics", "Marketing", "Software & Subscriptions", "Office Supplies", "Other"];

function firstOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function DateRangeBar({ range, onChange }: { range: DateRange; onChange: (r: DateRange) => void }) {
  return (
    <Card className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-secondary">From</span>
        <input
          type="date"
          value={range.from ?? ""}
          onChange={(e) => onChange({ ...range, from: e.target.value || undefined })}
          className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-secondary">To</span>
        <input
          type="date"
          value={range.to ?? ""}
          onChange={(e) => onChange({ ...range, to: e.target.value || undefined })}
          className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
        />
      </label>
    </Card>
  );
}

function OverviewTab({ range }: { range: DateRange }) {
  const { data } = useAccountsOverview(range);
  const money = (v?: string) => `৳${Number(v ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <StatCard variant="success" label="Revenue" value={money(data?.revenue)} />
      <StatCard variant="danger" label="Total Expenses" value={money(data?.totalExpenses)} />
      <StatCard variant="warning" label="VAT Payable" value={money(data?.vatPayable)} />
      <StatCard variant="primary" label="Net Cash Flow" value={money(data?.netCashFlow)} />
      <StatCard variant="recovery" label="Customer Dues Outstanding" value={money(data?.customerDueOutstanding)} />
      <StatCard variant="dark" label="Supplier Dues Outstanding" value={money(data?.supplierDueOutstanding)} />
    </div>
  );
}

function ExpensesTab({ range }: { range: DateRange }) {
  const { data } = useExpenses({ ...range, pageSize: 50 });
  const create = useCreateExpense();
  const del = useDeleteExpense();
  const [form, setForm] = useState({ expenseDate: today(), category: COMMON_CATEGORIES[0], amount: "", isVatInput: false, note: "" });

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Date</span>
          <input type="date" value={form.expenseDate} onChange={(e) => setForm({ ...form, expenseDate: e.target.value })} className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Category</span>
          <input list="expense-categories" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="h-10 w-48 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500" />
          <datalist id="expense-categories">
            {COMMON_CATEGORIES.map((c) => <option key={c} value={c} />)}
          </datalist>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Amount (৳)</span>
          <input type="number" min={0} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="num h-10 w-32 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500" />
        </label>
        <label className="flex items-center gap-2 pb-2.5 text-sm text-text">
          <input type="checkbox" checked={form.isVatInput} onChange={(e) => setForm({ ...form, isVatInput: e.target.checked })} />
          Has input VAT
        </label>
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Note</span>
          <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="h-10 w-full rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500" />
        </label>
        <Button
          type="button"
          variant="primary"
          disabled={create.isPending || !form.amount}
          onClick={() =>
            create.mutate(
              { expenseDate: form.expenseDate, category: form.category, amount: Number(form.amount), isVatInput: form.isVatInput, note: form.note || undefined },
              { onSuccess: () => setForm({ expenseDate: today(), category: COMMON_CATEGORIES[0], amount: "", isVatInput: false, note: "" }) },
            )
          }
        >
          {create.isPending ? "Adding…" : (<><Icon name="add" size={16} /> Add Expense</>)}
        </Button>
        <a href={accountsExportUrl("expenses", range)} download>
          <Button type="button" variant="ghost"><Icon name="description" size={16} /> Export Excel</Button>
        </a>
      </Card>

      <Table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Category</th>
            <th>Amount</th>
            <th>VAT Input</th>
            <th>Note</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {data && data.items.length === 0 && <TableEmptyRow colSpan={6}>No expenses in this range.</TableEmptyRow>}
          {data?.items.map((e) => (
            <tr key={e.id}>
              <td className="num text-text">{new Date(e.expenseDate).toLocaleDateString()}</td>
              <td className="text-text">{e.category}</td>
              <td className="num font-semibold text-danger">৳{Number(e.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td className="text-secondary">{e.isVatInput ? "Yes" : "—"}</td>
              <td className="text-xs text-muted">{e.note ?? "—"}</td>
              <td>
                <Button type="button" variant="ghost" disabled={del.isPending} onClick={() => del.mutate(e.id)}>
                  <Icon name="delete" size={16} />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

function DueRow({ due: d, onDelete }: { due: import("@/hooks/useAccounts").Due; onDelete: (id: number) => void }) {
  const recordPayment = useRecordDuePayment(d.id);
  const [draft, setDraft] = useState("");

  return (
    <tr>
      <td className="text-text">{d.partyName}{d.note ? <div className="text-xs text-muted">{d.note}</div> : null}</td>
      <td className="num text-text">৳{Number(d.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
      <td className="num text-success">৳{Number(d.paidAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
      <td className="num font-semibold text-danger">৳{Number(d.remaining).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
      <td>
        <span className={`rounded-pill px-2.5 py-1 text-xs font-semibold ${d.status === "PAID" ? "bg-success/10 text-success" : d.status === "PARTIALLY_PAID" ? "bg-warning/10 text-warning" : "bg-surface-2 text-secondary"}`}>
          {d.status}
        </span>
      </td>
      <td className="text-xs text-secondary">{d.dueDate ? new Date(d.dueDate).toLocaleDateString() : "—"}</td>
      <td>
        {d.status !== "PAID" && (
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={0}
              placeholder="Amount"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="num h-8 w-20 rounded-sm border border-border bg-surface px-2 text-xs text-text outline-none focus:border-brand-500"
            />
            <Button
              type="button"
              variant="ghost"
              disabled={recordPayment.isPending || !draft}
              onClick={() => recordPayment.mutate(Number(draft), { onSuccess: () => setDraft("") })}
            >
              Record
            </Button>
          </div>
        )}
      </td>
      <td>
        <Button type="button" variant="ghost" onClick={() => onDelete(d.id)}>
          <Icon name="delete" size={16} />
        </Button>
      </td>
    </tr>
  );
}

function DuesTab() {
  const [partyType, setPartyType] = useState<DuePartyType>("CUSTOMER");
  const { data } = useDues({ partyType, pageSize: 50 });
  const create = useCreateDue();
  const del = useDeleteDue();
  const [form, setForm] = useState({ partyName: "", amount: "", dueDate: "", note: "" });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        {(["CUSTOMER", "SUPPLIER"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setPartyType(t)}
            className={`rounded-pill px-3 py-1.5 text-xs font-semibold ${partyType === t ? "bg-brand-500 text-white" : "bg-surface-2 text-secondary"}`}
          >
            {t === "CUSTOMER" ? "Customer Dues (receivable)" : "Supplier Dues (payable)"}
          </button>
        ))}
      </div>

      <Card className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">{partyType === "CUSTOMER" ? "Customer name" : "Supplier name"}</span>
          <input value={form.partyName} onChange={(e) => setForm({ ...form, partyName: e.target.value })} className="h-10 w-52 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Amount (৳)</span>
          <input type="number" min={0} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="num h-10 w-32 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Due date (optional)</span>
          <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500" />
        </label>
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Note</span>
          <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="h-10 w-full rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500" />
        </label>
        <Button
          type="button"
          variant="primary"
          disabled={create.isPending || !form.partyName || !form.amount}
          onClick={() =>
            create.mutate(
              { partyType, partyName: form.partyName, amount: Number(form.amount), dueDate: form.dueDate || undefined, note: form.note || undefined },
              { onSuccess: () => setForm({ partyName: "", amount: "", dueDate: "", note: "" }) },
            )
          }
        >
          {create.isPending ? "Adding…" : (<><Icon name="add" size={16} /> Add Due</>)}
        </Button>
        <a href={accountsExportUrl("dues", {})} download>
          <Button type="button" variant="ghost"><Icon name="description" size={16} /> Export Excel</Button>
        </a>
      </Card>

      <Table>
        <thead>
          <tr>
            <th>{partyType === "CUSTOMER" ? "Customer" : "Supplier"}</th>
            <th>Amount</th>
            <th>Paid</th>
            <th>Remaining</th>
            <th>Status</th>
            <th>Due date</th>
            <th>Record payment</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {data && data.items.length === 0 && <TableEmptyRow colSpan={8}>No dues yet.</TableEmptyRow>}
          {data?.items.map((d) => (
            <DueRow key={d.id} due={d} onDelete={(id) => del.mutate(id)} />
          ))}
        </tbody>
      </Table>
    </div>
  );
}

function VatCashFlowTab({ range }: { range: DateRange }) {
  const { data: settings } = useVatSettings();
  const updateSettings = useUpdateVatSettings();
  const { data: summary } = useVatSummary(range);
  const { data: flow } = useCashFlow(range);
  const [rate, setRate] = useState<string | null>(null);
  const [bin, setBin] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-5">
      <Card className="flex flex-col gap-4">
        <h3 className="font-ui text-sm font-bold text-text">VAT Settings</h3>
        {settings && (
          <div className="flex flex-wrap items-end gap-4">
            <ToggleSwitch
              checked={settings.enabled}
              onChange={(v) => updateSettings.mutate({ enabled: v })}
              label="VAT enabled"
            />
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-secondary">Rate (%)</span>
              <input
                type="number"
                min={0}
                max={100}
                value={rate ?? settings.ratePercent}
                onChange={(e) => setRate(e.target.value)}
                onBlur={() => { if (rate !== null) { updateSettings.mutate({ ratePercent: Number(rate) }); setRate(null); } }}
                className="num h-10 w-24 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-secondary">BIN (Business Identification Number)</span>
              <input
                value={bin ?? settings.binNumber}
                onChange={(e) => setBin(e.target.value)}
                onBlur={() => { if (bin !== null) { updateSettings.mutate({ binNumber: bin }); setBin(null); } }}
                className="h-10 w-52 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
              />
            </label>
          </div>
        )}
      </Card>

      <div>
        <h3 className="mb-3 font-ui text-sm font-bold text-text">VAT Summary (Mushak)</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard variant="success" label="Revenue" value={`৳${Number(summary?.revenue ?? 0).toLocaleString()}`} />
          <StatCard variant="warning" label="Output VAT" value={`৳${Number(summary?.outputVat ?? 0).toLocaleString()}`} />
          <StatCard variant="primary" label="Input VAT" value={`৳${Number(summary?.inputVat ?? 0).toLocaleString()}`} />
          <StatCard variant="danger" label="Net Payable" value={`৳${Number(summary?.netPayable ?? 0).toLocaleString()}`} />
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-ui text-sm font-bold text-text">Cash Flow</h3>
          <a href={accountsExportUrl("cashflow", range)} download>
            <Button type="button" variant="ghost"><Icon name="description" size={16} /> Export Excel</Button>
          </a>
        </div>
        <div className="mb-3 grid grid-cols-3 gap-3">
          <StatCard variant="success" label="Cash In" value={`৳${Number(flow?.cashIn ?? 0).toLocaleString()}`} />
          <StatCard variant="danger" label="Cash Out" value={`৳${Number(flow?.cashOut ?? 0).toLocaleString()}`} />
          <StatCard variant="primary" label="Net" value={`৳${Number(flow?.net ?? 0).toLocaleString()}`} />
        </div>
        <Table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Description</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {flow && flow.entries.length === 0 && <TableEmptyRow colSpan={4}>No cash movement in this range.</TableEmptyRow>}
            {flow?.entries.map((e, i) => (
              <tr key={i}>
                <td className="num text-text">{new Date(e.date).toLocaleDateString()}</td>
                <td className="text-xs text-secondary">{e.type.replace("_", " ")}</td>
                <td className="text-text">{e.description}</td>
                <td className={`num font-semibold ${Number(e.amount) >= 0 ? "text-success" : "text-danger"}`}>
                  {Number(e.amount) >= 0 ? "+" : ""}৳{Number(e.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  );
}

export default function AccountsPage() {
  const [tab, setTab] = useState("overview");
  const [range, setRange] = useState<DateRange>({ from: firstOfMonth(), to: today() });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader icon={accountsIcon} title="Accounts" subtitle="Expenses, dues, VAT (Mushak), and cash flow." />
      <Tabs
        variant="pill"
        options={[
          { value: "overview", label: "Overview" },
          { value: "expenses", label: "Expenses" },
          { value: "dues", label: "Dues" },
          { value: "vat", label: "VAT & Cash Flow" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab !== "dues" && <DateRangeBar range={range} onChange={setRange} />}
      {tab === "overview" && <OverviewTab range={range} />}
      {tab === "expenses" && <ExpensesTab range={range} />}
      {tab === "dues" && <DuesTab />}
      {tab === "vat" && <VatCashFlowTab range={range} />}
    </div>
  );
}
