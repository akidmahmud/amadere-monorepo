"use client";

import { useEffect, useRef, useState } from "react";
import {
  DIGITAL_FILE_MAX_BYTES,
  DIGITAL_PREVIEW_PAGES_DEFAULT,
  DIGITAL_PREVIEW_PAGES_MAX,
  DIGITAL_PREVIEW_START_DEFAULT,
} from "@amader/shared";
import { useDeleteDigitalFile, useSetPreviewRange, useUploadDigitalFile } from "@/hooks/useDigitalProducts";
import { useToast } from "@/components/ToastProvider";
import { ProxyApiError } from "@/lib/api/proxy-client";
import { friendlyErrorMessage } from "@/lib/friendly-error";

const inputClass = "h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500";
const readonlyClass = "h-10 rounded-sm border border-border bg-surface-2 px-3 text-sm text-muted outline-none";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface DigitalFileCardPreviewPage {
  pageNumber: number;
  imageUrl: string;
}

export interface DigitalFileCardProps {
  productId: number;
  digitalFileName: string | null;
  digitalFileSize: number | null;
  digitalPageCount: number | null;
  /** Inclusive page range shown as the free preview, e.g. 5..9. */
  digitalPreviewStartPage: number | null;
  digitalPreviewEndPage: number | null;
  previewPages: DigitalFileCardPreviewPage[];
}

// The one genuinely new piece of UI for Task 8 — everything else in the
// Digital Products section is the normal product form (General/Media/SEO/
// Analytics) reused as-is. Unlike the rest of the form (which batches edits
// into the form-state object and only persists on Save), this card mutates
// immediately through its own three endpoints — same "no Save button" model
// as ExistingVariantsManager's add/remove variant calls, since there's no
// meaningful "draft" state for an uploaded file.
export function DigitalFileCard({
  productId,
  digitalFileName,
  digitalFileSize,
  digitalPageCount,
  digitalPreviewStartPage,
  digitalPreviewEndPage,
  previewPages,
}: DigitalFileCardProps) {
  const upload = useUploadDigitalFile(productId);
  const removeFile = useDeleteDigitalFile(productId);
  const setPreview = useSetPreviewRange(productId);
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const savedStart = digitalPreviewStartPage ?? DIGITAL_PREVIEW_START_DEFAULT;
  const savedEnd = digitalPreviewEndPage ?? DIGITAL_PREVIEW_PAGES_DEFAULT;
  const [startInput, setStartInput] = useState(String(savedStart));
  const [endInput, setEndInput] = useState(String(savedEnd));

  // Re-sync both inputs whenever the server values change — a fresh upload
  // re-derives the range server-side (the previous range if the new document
  // is long enough for it, otherwise pulled back to fit), and that shouldn't
  // leave these fields showing stale numbers from before the upload.
  useEffect(() => {
    setStartInput(String(savedStart));
    setEndInput(String(savedEnd));
  }, [savedStart, savedEnd]);

  function handleFile(file: File) {
    if (file.type !== "application/pdf") {
      toast.push("Only PDF files are supported.");
      return;
    }
    if (file.size > DIGITAL_FILE_MAX_BYTES) {
      toast.push(`This file is too large — the maximum is ${formatBytes(DIGITAL_FILE_MAX_BYTES)}.`);
      return;
    }
    upload.mutate(file, {
      onError: (err) => toast.push(err instanceof ProxyApiError ? friendlyErrorMessage(err.message) : "Failed to upload file"),
    });
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) handleFile(file);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function handleRemove() {
    if (!confirm(`Remove "${digitalFileName}"? This also deletes its preview pages.`)) return;
    removeFile.mutate(undefined, {
      onError: (err) => toast.push(err instanceof ProxyApiError ? friendlyErrorMessage(err.message) : "Failed to remove file"),
    });
  }

  // Mirrors DigitalProductsService.setPreviewRange's checks so the common
  // mistakes never need a round trip — but the backend enforces every one of
  // them again, because this card is not the only way to call that endpoint.
  function handleSavePreviewRange() {
    const startPage = Number(startInput);
    const endPage = Number(endInput);
    if (!Number.isInteger(startPage) || startPage < 1) {
      toast.push("The start page must be a whole number of at least 1.");
      return;
    }
    if (!Number.isInteger(endPage) || endPage < startPage) {
      toast.push(`The end page (${endInput || "—"}) cannot be before the start page (${startPage}).`);
      return;
    }
    if (digitalPageCount && endPage > digitalPageCount) {
      toast.push(`End page ${endPage} is beyond the document's ${digitalPageCount} pages.`);
      return;
    }
    const length = endPage - startPage + 1;
    if (length > DIGITAL_PREVIEW_PAGES_MAX) {
      toast.push(`A preview can cover at most ${DIGITAL_PREVIEW_PAGES_MAX} pages — pages ${startPage}-${endPage} is ${length}.`);
      return;
    }
    setPreview.mutate(
      { startPage, endPage },
      {
        onError: (err) => toast.push(err instanceof ProxyApiError ? friendlyErrorMessage(err.message) : "Failed to update the preview range"),
      },
    );
  }

  const lastPage = digitalPageCount ?? undefined;
  const unchanged = startInput === String(savedStart) && endInput === String(savedEnd);
  const sortedPreviewPages = [...previewPages].sort((a, b) => a.pageNumber - b.pageNumber);

  return (
    <div className="rounded-card border border-border bg-surface p-[18px]">
      <h3 className="mb-1 text-[0.9rem] font-extrabold text-text">Digital File</h3>
      <p className="mb-3.5 text-xs text-muted">
        Upload the PDF customers will buy. The storefront shows{" "}
        {savedStart === savedEnd ? `page ${savedStart}` : `pages ${savedStart}\u2013${savedEnd}`} as a free preview — pick an
        excerpt worth reading, not the cover and copyright page.
      </p>

      <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleInputChange} />

      {!digitalFileName ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-sm border-2 border-dashed p-8 text-center transition-colors ${
            dragOver ? "border-brand-500 bg-brand-500/5" : "border-border bg-surface-2"
          }`}
        >
          <span className="text-sm font-semibold text-text">
            {upload.isPending ? "Uploading…" : "Click to upload or drag and drop a PDF"}
          </span>
          <span className="text-xs text-muted">Max {formatBytes(DIGITAL_FILE_MAX_BYTES)}</span>
        </div>
      ) : (
        <>
          <div className="mb-3.5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-text">File name</span>
              <input readOnly value={digitalFileName} className={readonlyClass} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-text">File size</span>
              <input readOnly value={digitalFileSize != null ? formatBytes(digitalFileSize) : "—"} className={readonlyClass} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-text">Pages</span>
              <input readOnly value={digitalPageCount ?? "—"} className={readonlyClass} />
            </label>
          </div>

          <div className="mb-3.5 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-text">Preview starts at page</span>
              <input
                type="number"
                min={1}
                max={lastPage}
                value={startInput}
                onChange={(e) => setStartInput(e.target.value)}
                className={`w-32 ${inputClass}`}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-text">…and ends at page</span>
              <input
                type="number"
                min={1}
                max={lastPage}
                value={endInput}
                onChange={(e) => setEndInput(e.target.value)}
                className={`w-32 ${inputClass}`}
              />
            </label>
            <button
              type="button"
              // Compares against the same fallbacks the inputs' own initial
              // values/sync effect use, not "" — attachFile always sets both
              // ends of the range once a file exists, but a "" fallback here
              // would silently disagree with what's actually in the fields if
              // that ever changed.
              disabled={setPreview.isPending || unchanged}
              onClick={handleSavePreviewRange}
              className="inline-flex h-10 items-center justify-center rounded-sm border border-border bg-surface-2 px-4 text-sm font-semibold text-text transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
            >
              {setPreview.isPending ? "Saving…" : "Update"}
            </button>
            {/* The valid bounds, spelled out: the admin is choosing page
                numbers inside a document they can't see from here. */}
            <span className="pb-2.5 text-xs text-muted">
              This document has {digitalPageCount ?? "?"} pages. Any range within 1–{digitalPageCount ?? "?"}, up to{" "}
              {DIGITAL_PREVIEW_PAGES_MAX} pages long.
            </span>
          </div>

          {sortedPreviewPages.length > 0 && (
            <div className="mb-3.5 flex flex-col gap-1.5">
              <span className="text-xs font-bold text-text">Preview — exactly what customers will see</span>
              <div className="flex flex-wrap gap-2.5">
                {sortedPreviewPages.map((p) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={p.pageNumber}
                    src={p.imageUrl}
                    alt={`Preview page ${p.pageNumber}`}
                    title={`Page ${p.pageNumber}`}
                    className="h-40 w-auto rounded-sm border border-border object-contain"
                  />
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              disabled={upload.isPending}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex h-10 items-center justify-center rounded-sm border border-border bg-surface-2 px-4 text-sm font-semibold text-text transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
            >
              {upload.isPending ? "Uploading…" : "Replace"}
            </button>
            <button
              type="button"
              disabled={removeFile.isPending}
              onClick={handleRemove}
              className="inline-flex h-10 items-center justify-center rounded-sm border border-danger/40 bg-transparent px-4 text-sm font-semibold text-danger transition-colors hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {removeFile.isPending ? "Removing…" : "Remove"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
