const WRAPPER = "mx-auto w-full max-w-[1440px] px-4 md:px-6";

function CardRow({ count = 5 }: { count?: number }) {
  return (
    <div className="flex gap-4 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="aspect-square w-full shrink-0 basis-[calc(20%-13px)] animate-pulse rounded-brand bg-gray/60" />
      ))}
    </div>
  );
}

function SectionSkeleton() {
  return (
    <div className={`${WRAPPER} py-9`}>
      <div className="mb-6 h-6 w-48 animate-pulse rounded bg-gray/60" />
      <CardRow />
    </div>
  );
}

// Shown while a route segment's server data is being fetched — used to be a
// bare centered spinner that replaced the entire page (header included)
// while any page under this layout loaded. Shaped like the homepage's own
// hero+sections rhythm so the swap-in doesn't jump the layout around once
// real content streams in; it's a generic-enough shape to still read fine as
// "loading" on other routes under this locale segment that don't have their
// own more specific loading.tsx.
export default function Loading() {
  return (
    <main className="flex-1">
      <div className="mx-auto w-full max-w-[1920px] px-4 md:px-6">
        <div className="aspect-[16/6] w-full animate-pulse rounded-brand bg-gray/60 max-md:aspect-[16/10]" />
      </div>
      <SectionSkeleton />
      <SectionSkeleton />
      <SectionSkeleton />
    </main>
  );
}
