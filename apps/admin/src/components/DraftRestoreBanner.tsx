"use client";

export function DraftRestoreBanner({
  savedAt,
  onRestore,
  onDiscard,
}: {
  savedAt: number;
  onRestore: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-inner border border-warning/40 bg-warning/10 px-3.5 py-2.5 text-[0.8rem] font-semibold text-text">
      <span>
        Unsaved changes from {new Date(savedAt).toLocaleString()} were found — probably from a crash or lost connection before your last save.
      </span>
      <div className="flex flex-none gap-2">
        <button type="button" onClick={onDiscard} className="rounded-sm border border-border px-3 py-1.5 text-xs font-semibold text-text hover:bg-surface-2">
          Discard
        </button>
        <button type="button" onClick={onRestore} className="rounded-sm bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600">
          Restore
        </button>
      </div>
    </div>
  );
}
