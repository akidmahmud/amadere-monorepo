"use client";

import { useEffect, useState } from "react";

const FALLBACK = "https://amadere.com/";

// admin.<domain> -> <domain> (e.g. admin.amadere.com -> amadere.com).
function deriveFromHostname(): string | null {
  if (typeof window === "undefined") return null;
  const { protocol, hostname } = window.location;
  if (!hostname.startsWith("admin.")) return null;
  return `${protocol}//${hostname.slice("admin.".length)}`;
}

export function useStorefrontUrl(): string {
  const configured = process.env.NEXT_PUBLIC_STOREFRONT_URL;
  const [url, setUrl] = useState(() => {
    if (configured && !configured.includes("localhost")) return configured;
    return FALLBACK;
  });

  useEffect(() => {
    if (configured && !configured.includes("localhost")) return;
    const derived = deriveFromHostname();
    if (derived) setUrl(derived);
  }, [configured]);

  return url;
}
