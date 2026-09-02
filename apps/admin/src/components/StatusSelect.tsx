import { PUBLISH_STATUSES, type PublishStatus } from "@/hooks/useBrands";

/**
 * `statuses`/`labels` are opt-in so one entity can offer a status the others
 * do not — products add ADMIN_ONLY, which would be meaningless on a brand.
 * Every existing caller keeps the shared list by passing nothing.
 */
export function StatusSelect<T extends string = PublishStatus>({
  value,
  onChange,
  statuses,
  labels,
}: {
  value: T;
  onChange: (status: T) => void;
  statuses?: readonly T[];
  labels?: Record<string, string>;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-secondary">Status</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
      >
        {(
          statuses ?? (PUBLISH_STATUSES as readonly string[] as readonly T[])
        ).map((s) => (
          <option key={s} value={s}>
            {labels?.[s] ?? s}
          </option>
        ))}
      </select>
    </label>
  );
}
