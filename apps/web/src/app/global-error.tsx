"use client";

import { useEffect, useState } from "react";
import { isChunkLoadError, tryReloadForChunkError } from "@/lib/chunk-error";

// PERF-BRIEF.md §8 — this app has no app/layout.tsx of its own; [locale]/layout.tsx
// is the effective root layout (fonts, next-intl provider, site-info fetch,
// header/footer). [locale]/error.tsx only catches errors thrown by its own
// children, not by that layout itself — an error thrown there (e.g. the
// settings/site fetch failing in an unexpected way) unmounts the whole tree
// with no boundary to catch it, and the visitor gets a genuinely blank white
// page. global-error.tsx is the one boundary Next.js checks above that.
//
// It replaces the entire root layout when active, so there's no guarantee
// the normal <html>/<body> (fonts, next-intl context, Tailwind-dependent
// components) rendered at all before this fired — kept deliberately minimal
// and self-contained (inline styles, no site-info fetch, no i18n) rather
// than reusing anything from the crashed tree, and bilingual since locale
// context isn't available here to pick one.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Same recovery as [locale]/error.tsx: a chunk error means this visitor is
  // on a build whose JS no longer exists, and reset() re-requests the same
  // dead URL. Only a document reload can fix it. See lib/chunk-error.ts.
  const chunkError = isChunkLoadError(error);
  const [reloading, setReloading] = useState(false);
  useEffect(() => {
    if (!chunkError) return;
    setReloading(tryReloadForChunkError());
  }, [chunkError]);

  return (
    <html lang="en">
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "2rem",
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
          color: "#1e2b22",
          background: "#fff",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0 }}>
          {chunkError
            ? "Updating… / আপডেট হচ্ছে…"
            : "Something went wrong / কিছু একটা সমস্যা হয়েছে"}
        </h1>
        <p style={{ maxWidth: "28rem", color: "#6b7280", margin: 0 }}>
          {chunkError
            ? "The site was just updated. Reloading for the newest version. / সাইটটি এইমাত্র আপডেট হয়েছে, নতুন সংস্করণ লোড হচ্ছে।"
            : error.message || "An unexpected error occurred. Please try again. / একটি অপ্রত্যাশিত সমস্যা হয়েছে, আবার চেষ্টা করুন।"}
        </p>
        <button
          hidden={reloading}
          onClick={() => {
            if (chunkError) window.location.reload();
            else reset();
          }}
          style={{
            borderRadius: "10px",
            background: "#21713d",
            color: "#fff",
            padding: "0.6rem 1.5rem",
            border: "none",
            cursor: "pointer",
            fontSize: "0.9rem",
          }}
        >
          Try again / আবার চেষ্টা করুন
        </button>
      </body>
    </html>
  );
}
