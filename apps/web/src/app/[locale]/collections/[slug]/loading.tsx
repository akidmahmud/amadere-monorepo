import { PlpSkeleton } from "@/components/PlpSkeleton";

// Matches the collection page's own wider container (207px side gap at lg,
// vs the standard 1180px/px-5 every other PLP route uses).
const CONTAINER_CLASSNAME = "mx-auto max-w-[1920px] px-5 lg:px-[207px]";

export default function Loading() {
  return (
    <main className="flex-1">
      <PlpSkeleton containerClassName={CONTAINER_CLASSNAME} />
    </main>
  );
}
