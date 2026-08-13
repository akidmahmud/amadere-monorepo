"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Modal } from "@amader/admin-ui";

type ImportResult = {
  created: number;
  updated: number;
  skipped: number;
  errors: { line: number; reason: string }[];
};

export function ProductImportModal({ onClose }: { onClose: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setPending(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/backend/admin/products/import", { method: "POST", body: form });
      const body = await res.json();
      if (!body.success) throw new Error(body.error?.message ?? "Import failed");
      setResult(body.data);
      qc.invalidateQueries({ queryKey: ["admin-products"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Import Products">
      <div className="flex flex-col gap-4">
        <p className="text-[0.8rem] font-medium text-secondary">
          Bulk-create or update products from a CSV file. Columns: Name,Slug,SKU,Category,Stock,Price,Status
          (same order the Export button writes, so a round-trip works). Rows matching an existing Slug are
          updated; new slugs are created. Category must match an existing category name exactly, or the row
          imports without one.
        </p>

        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={pending}
            className="inline-flex h-10 items-center gap-2 rounded-inner bg-brand-500 px-4 text-[0.82rem] font-bold text-white hover:bg-brand-600 disabled:opacity-70"
          >
            {pending ? "Importing…" : "Choose CSV file"}
          </button>
        </div>

        {result && (
          <div className="rounded-[9px] border border-[#c8e8cf] bg-[#e3f4e6] px-3.5 py-2.5 text-[0.8rem] font-semibold text-[#1f7a33]">
            <p>
              Created {result.created}, updated {result.updated}, skipped {result.skipped}.
            </p>
            {result.errors.length > 0 && (
              <ul className="mt-1.5 max-h-[160px] list-disc space-y-0.5 overflow-y-auto pl-4 text-[0.74rem] font-medium text-[#7a6a1f]">
                {result.errors.map((e, i) => (
                  <li key={i}>
                    Line {e.line}: {e.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {error && (
          <p className="rounded-[9px] border border-[#f8ccd3] bg-[#feeaec] px-3.5 py-2.5 text-[0.8rem] font-semibold text-[#e8465e]">
            {error}
          </p>
        )}

        <div className="flex justify-end">
          <button type="button" onClick={onClose} className="inline-flex h-10 items-center rounded-inner border border-border px-4 text-[0.8rem] font-bold text-text hover:bg-surface-2">
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}
