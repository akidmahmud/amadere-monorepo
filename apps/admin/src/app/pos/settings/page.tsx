"use client";

import { useState } from "react";
import { useToast } from "@/components/ToastProvider";
import {
  useInvoiceSlots,
  useInvoiceTemplate,
  usePosVat,
  useSaveInvoice,
  useSavePosVat,
  type PosVat,
} from "@/hooks/usePos";
import {
  BUILTIN_POS_INVOICE,
  POS_INVOICE_TAGS,
  SAMPLE_POS_INVOICE,
  renderPosInvoice,
} from "@/lib/pos-invoice";
import {
  PosSubPage,
  card,
  input,
  primaryBtn,
} from "@/components/pos/PosSubPage";

export default function PosSettingsPage() {
  const [tab, setTab] = useState<"vat" | "invoices">("vat");
  const tabBtn = (t: typeof tab, label: string) => (
    <button
      onClick={() => setTab(t)}
      className={`h-10 rounded-lg px-4 text-sm font-semibold ${tab === t ? "bg-[#1d7a46] text-white" : "border border-gray-200 bg-white"}`}
    >
      {label}
    </button>
  );
  return (
    <PosSubPage title="POS Settings" permission="pos.settings">
      <div className="mb-4 flex gap-2">
        {tabBtn("vat", "VAT")}
        {tabBtn("invoices", "Invoices")}
      </div>
      {tab === "vat" ? <VatSettings /> : <InvoiceSettings />}
    </PosSubPage>
  );
}

function VatSettings() {
  const { data } = usePosVat();
  // Remount the form once the saved value arrives, so it starts from it.
  return data ? (
    <VatForm key={JSON.stringify(data)} initial={data} />
  ) : (
    <div className={card}>Loading…</div>
  );
}

function VatForm({ initial }: { initial: PosVat }) {
  const toast = useToast();
  const save = useSavePosVat();
  const [v, setV] = useState<PosVat>(initial);
  const rateOk = v.ratePercent >= 0 && v.ratePercent <= 100;
  const example = v.enabled
    ? v.pricesIncludeVat
      ? `A ৳100 item: customer pays ৳100, of which VAT ৳${((100 * v.ratePercent) / (100 + v.ratePercent)).toFixed(2)}.`
      : `A ৳100 item: customer pays ৳${(100 + v.ratePercent).toFixed(2)} (৳100 + ${v.ratePercent}% VAT).`
    : "A ৳100 item: customer pays ৳100, no VAT.";

  return (
    <div className={`${card} max-w-xl space-y-5`}>
      <p className="text-sm text-gray-600">
        One VAT setting for every store. Products marked VAT-exempt in Accounts
        stay exempt.
      </p>
      <label className="flex items-center justify-between gap-4">
        <span className="font-semibold">Apply VAT on POS sales</span>
        <input
          type="checkbox"
          className="h-5 w-5"
          checked={v.enabled}
          onChange={(e) => setV({ ...v, enabled: e.target.checked })}
        />
      </label>
      <label
        className={`flex items-center justify-between gap-4 ${v.enabled ? "" : "opacity-40"}`}
      >
        <span className="font-semibold">VAT rate (%)</span>
        <input
          type="number"
          min={0}
          max={100}
          step={0.5}
          disabled={!v.enabled}
          value={v.ratePercent}
          onChange={(e) => setV({ ...v, ratePercent: Number(e.target.value) })}
          className={`${input} w-28 text-right`}
          aria-label="VAT rate"
        />
      </label>
      <label
        className={`flex items-center justify-between gap-4 ${v.enabled ? "" : "opacity-40"}`}
      >
        <span>
          <span className="font-semibold">
            Shelf prices already include VAT
          </span>
          <span className="block text-xs text-gray-500">
            Off = VAT is added on top at the till. On = VAT is taken out of the
            price.
          </span>
        </span>
        <input
          type="checkbox"
          className="h-5 w-5"
          disabled={!v.enabled}
          checked={v.pricesIncludeVat}
          onChange={(e) => setV({ ...v, pricesIncludeVat: e.target.checked })}
        />
      </label>
      <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        {example}
      </div>
      <button
        className={primaryBtn}
        disabled={!rateOk || save.isPending}
        onClick={() =>
          save.mutate(v, {
            onSuccess: () => toast.push("VAT settings saved", "success"),
            onError: (e) => toast.push(e.message),
          })
        }
      >
        {save.isPending ? "Saving…" : "Save VAT settings"}
      </button>
    </div>
  );
}

function InvoiceSettings() {
  const { data: slots = [] } = useInvoiceSlots();
  const [slot, setSlot] = useState<number | null>(null);
  const current = slots.find((s) => s.storeId === slot);
  const { data, isSuccess } = useInvoiceTemplate(slot);

  return (
    <div className="space-y-4">
      <div className={`${card} flex flex-wrap items-center gap-3`}>
        <span className="text-sm font-semibold">Template for</span>
        <select
          value={slot ?? "default"}
          onChange={(e) =>
            setSlot(
              e.target.value === "default" ? null : Number(e.target.value),
            )
          }
          className={input}
          aria-label="Invoice template for"
        >
          {slots.map((s) => (
            <option key={s.storeId ?? "default"} value={s.storeId ?? "default"}>
              {s.storeName}
              {s.storeId === null
                ? ""
                : s.hasOwn
                  ? " (own template)"
                  : " (uses Default)"}
            </option>
          ))}
        </select>
        <span className="text-xs text-gray-500">
          A store without its own template prints the Default; with no Default
          saved, the built-in receipt is used.
        </span>
      </div>
      {isSuccess && (
        <TemplateEditor
          key={`${slot}-${data.html ?? ""}`}
          storeId={slot}
          initial={data.html ?? (slot === null ? BUILTIN_POS_INVOICE : "")}
          hasOwn={!!current?.hasOwn}
        />
      )}
    </div>
  );
}

function TemplateEditor({
  storeId,
  initial,
  hasOwn,
}: {
  storeId: number | null;
  initial: string;
  hasOwn: boolean;
}) {
  const toast = useToast();
  const save = useSaveInvoice();
  const [html, setHtml] = useState(initial);
  const preview = renderPosInvoice(
    html || BUILTIN_POS_INVOICE,
    SAMPLE_POS_INVOICE,
  );
  const copy = (tag: string) => {
    navigator.clipboard?.writeText(`{{${tag}}}`).then(
      () => toast.push(`Copied {{${tag}}}`, "success"),
      () => {},
    );
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <div className={card}>
          <h2 className="mb-2 font-bold">Available tags</h2>
          <p className="mb-3 text-xs text-gray-500">
            Write your own HTML and put these tags where the values should
            appear. Click a tag to copy it. Rows marked &lt;tr&gt; belong inside
            a &lt;table&gt;. Scripts and event handlers are removed when you
            save.
          </p>
          <div className="grid max-h-64 grid-cols-1 gap-x-6 overflow-y-auto text-sm md:grid-cols-2">
            {POS_INVOICE_TAGS.map((t) => (
              <button
                key={t.tag}
                onClick={() => copy(t.tag)}
                className="flex gap-2 rounded px-1 py-1 text-left hover:bg-gray-50"
              >
                <code className="shrink-0 font-mono text-[#1d7a46]">{`{{${t.tag}}}`}</code>
                <span className="text-gray-600">{t.desc}</span>
              </button>
            ))}
          </div>
        </div>
        <div className={card}>
          <textarea
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            spellCheck={false}
            placeholder="Paste or write your invoice HTML…"
            aria-label="Invoice HTML"
            className="h-[420px] w-full rounded-lg border border-gray-200 p-3 font-mono text-xs outline-none focus:border-[#1d7a46]"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className={primaryBtn}
              disabled={!html.trim() || save.isPending}
              onClick={() =>
                save.mutate(
                  { storeId, html },
                  {
                    onSuccess: (r) => {
                      const cleaned = (r as { html?: string } | undefined)
                        ?.html;
                      toast.push(
                        cleaned !== undefined && cleaned !== html
                          ? "Saved — unsafe parts were removed"
                          : "Template saved",
                        "success",
                      );
                    },
                    onError: (e) => toast.push(e.message),
                  },
                )
              }
            >
              Save template
            </button>
            <button
              className="h-10 rounded-lg border border-gray-200 px-4 text-sm font-semibold"
              onClick={() => setHtml(BUILTIN_POS_INVOICE)}
            >
              Load built-in template
            </button>
            <button
              className="h-10 rounded-lg border border-red-200 px-4 text-sm font-semibold text-red-600 disabled:opacity-40"
              disabled={!hasOwn || save.isPending}
              onClick={() =>
                window.confirm(
                  storeId === null
                    ? "Delete the Default template? Stores will print the built-in receipt."
                    : "Remove this store's template? It will print the Default.",
                ) &&
                save.mutate(
                  { storeId, html: null },
                  {
                    onSuccess: () => toast.push("Template reset", "success"),
                    onError: (e) => toast.push(e.message),
                  },
                )
              }
            >
              Reset to default
            </button>
          </div>
        </div>
      </div>
      <div className={card}>
        <h2 className="mb-2 font-bold">Preview (sample sale)</h2>
        <iframe
          title="Invoice preview"
          sandbox=""
          srcDoc={preview}
          className="h-[640px] w-full rounded-lg border border-gray-200 bg-white"
        />
      </div>
    </div>
  );
}
