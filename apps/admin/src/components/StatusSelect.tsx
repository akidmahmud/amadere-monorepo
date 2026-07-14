import { PUBLISH_STATUSES, type PublishStatus } from "@/hooks/useBrands";

export function StatusSelect({ value, onChange }: { value: PublishStatus; onChange: (status: PublishStatus) => void }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-secondary">Status</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as PublishStatus)}
        className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
      >
        {PUBLISH_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </label>
  );
}
