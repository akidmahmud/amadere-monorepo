"use client";

import { Modal } from "@amader/admin-ui";

const warningIcon = (
  <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 9v4M12 17h.01" />
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
  </svg>
);

// Generic replacement for native confirm() — first use is the product
// delete flow (list row, bulk action, edit-page button all share this one
// component), but it's a plain admin-ui-style primitive so any other
// destructive action can reuse it instead of a native browser dialog (which
// can't be styled and blocks explaining consequences like the 30-day
// restore window).
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Delete",
  pending = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  pending?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="flex gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-danger/10 text-danger">
          {warningIcon}
        </span>
        <p className="pt-1.5 text-sm text-secondary">{description}</p>
      </div>
      <div className="mt-5 flex justify-end gap-2.5">
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="inline-flex h-10 items-center justify-center rounded-sm border border-border bg-transparent px-[18px] font-ui text-sm font-semibold text-text transition-colors duration-150 hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          className="inline-flex h-10 items-center justify-center rounded-sm bg-danger px-[18px] font-ui text-sm font-semibold text-white transition-colors duration-150 hover:bg-danger/85 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Deleting…" : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
