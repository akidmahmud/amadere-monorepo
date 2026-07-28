"use client";

import { useEffect, useState } from "react";

const FALLBACK = "http://localhost:3001";

// admin.<domain> -> app.<domain> — the only pattern this env actually uses
// (admin.amadere.com / app.amadere.com). Anything unrecognized (localhost,
// a preview deploy host, etc.) is left alone so this never guesses wrong;
// it just falls through to the configured/localhost default below.
function deriveFromHostname(): string | null {
  if (typeof window === "undefined") return null;
  const { protocol, hostname } = window.location;
  if (!hostname.startsWith("admin.")) return null;
  return `${protocol}//app.${hostname.slice("admin.".length)}`;
}

// NEXT_PUBLIC_STOREFRONT_URL is baked in at build time, so if it's missing
// from a deployment's build env there's no way to fix it short of a
// rebuild. Falling back to a literal "http://localhost:3001" then silently
// pointed the live admin's product/blog previews at whatever the visiting
// developer happened to have running on their own machine, instead of the
// real storefront. Deriving from the current hostname as a fallback fixes
// that without needing the env var configured at all.
//
// Starts from the env-var-or-localhost value (matches what the server
// rendered) and only swaps in the hostname-derived one after mount, so the
// first paint never mismatches between server and client.
export function useStorefrontUrl(): string {
  const configured = process.env.NEXT_PUBLIC_STOREFRONT_URL;
  const [url, setUrl] = useState(configured ?? FALLBACK);

  useEffect(() => {
    if (configured) return;
    const derived = deriveFromHostname();
    if (derived) setUrl(derived);
  }, [configured]);

  return url;
}
