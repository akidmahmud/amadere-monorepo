"use client";

import { useEffect, useState } from "react";
import { isChunkLoadError, tryReloadForChunkError } from "@/lib/chunk-error";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const chunkError = isChunkLoadError(error);
  const [reloading, setReloading] = useState(false);

  // A chunk error means this visitor is running an old build whose JS files no
  // longer exist. `reset()` re-requests the same dead URL, so recover by
  // reloading the document -- that is the only thing that fetches HTML
  // pointing at the current build. See lib/chunk-error.ts.
  useEffect(() => {
    if (!chunkError) return;
    setReloading(tryReloadForChunkError());
  }, [chunkError]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-32 text-center">
      <h1 className="font-serif text-2xl text-ink">
        {chunkError ? "Updating to the latest version…" : "Something went wrong"}
      </h1>
      <p className="max-w-md text-muted">
        {chunkError
          ? // Deliberately not error.message: "Failed to load chunk
            // /_next/static/chunks/41hx0ucknzj-z.js from module 46475" means
            // nothing to a customer and looks like the shop is broken.
            "The site was just updated. Reloading to get the newest version — if this page stays, please refresh your browser."
          : error.message || "An unexpected error occurred. Please try again."}
      </p>
      {!reloading && (
        <button
          onClick={() => {
            // Hard reload for a chunk error; reset() cannot help there.
            if (chunkError) window.location.reload();
            else reset();
          }}
          className="rounded-brand bg-green px-5 py-2 font-ui text-white shadow-brand"
        >
          {chunkError ? "Reload" : "Try again"}
        </button>
      )}
    </div>
  );
}
