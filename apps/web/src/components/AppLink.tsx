"use client";

// A Server Component can't pass next-intl's `Link` down as a prop to a
// Client Component directly (Next can't serialize it as a Client Reference
// unless the exporting module itself is explicitly a client boundary).
// Re-exporting it from a "use client" file fixes that.
export { Link as AppLink } from "@/i18n/navigation";
