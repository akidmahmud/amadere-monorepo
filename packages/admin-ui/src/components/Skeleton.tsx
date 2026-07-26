import { cn } from "../lib/cn";

// A pulsing placeholder bar/block — swap in for a plain "Loading…" text
// state anywhere content is about to replace it, so the page shows the
// shape of what's coming instead of a blank flash of text.
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-inner bg-surface-2", className)} />;
}

// A handful of pulsing rows shaped like a data table (thumbnail + a few text
// columns) — for list pages (Products/Tags/Categories) while their first
// query is still in flight.
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-4 rounded-card border border-border bg-surface p-[18px]">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-3.5">
          <Skeleton className="h-10 w-10 shrink-0 rounded-inner" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-20 shrink-0" />
          <Skeleton className="h-4 w-16 shrink-0" />
        </div>
      ))}
    </div>
  );
}

// A handful of pulsing blocks shaped like a detail/edit form — for single-
// record edit pages (Product/Category/Blog Post) while the record loads.
export function FormSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-card border border-border bg-surface p-[18px]">
      <Skeleton className="h-9 w-1/3" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-10 w-2/3" />
    </div>
  );
}
