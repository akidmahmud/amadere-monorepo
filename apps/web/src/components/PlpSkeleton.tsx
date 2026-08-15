// Shown by each PLP route's own loading.tsx during a filter/sort/page
// navigation — shaped like ProductListing's actual sidebar+toolbar+grid
// layout so the swap doesn't visually look like a full page reload (the
// generic [locale]/loading.tsx is homepage-shaped, which briefly replaced
// this entire page including the header/footer chrome).
export function PlpSkeleton({ containerClassName = "mx-auto max-w-[1180px] px-5" }: { containerClassName?: string }) {
  return (
    <div className={containerClassName}>
      <div className="grid grid-cols-[290px_1fr] gap-6 pb-10 max-lg:grid-cols-1">
        <aside className="max-lg:hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="mb-1.5 h-40 animate-pulse rounded bg-white shadow-[0_1px_1px_rgba(0,0,0,.1)]" />
          ))}
        </aside>
        <div>
          <div className="mb-5 h-8 w-full animate-pulse rounded bg-gray/60" />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded bg-gray/60" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
