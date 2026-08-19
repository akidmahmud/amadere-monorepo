"use client";

import { useEffect, useState } from "react";

// No trailing slash — callers append "/blog/...", and a trailing slash here
// produced "https://amadere.com//blog/..." which the storefront 308s and
// then 404s.
const FALLBACK = "https://amadere.com";

function normalize(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

// admin.<domain> -> <domain> (e.g. admin.amadere.com -> amadere.com).
function deriveFromHostname(): string | null {
  if (typeof window === "undefined") return null;
  const { protocol, hostname } = window.location;
  if (!hostname.startsWith("admin.")) return null;
  return `${protocol}//${hostname.slice("admin.".length)}`;
}

export function useStorefrontUrl(): string {
  // NEXT_PUBLIC_STOREFRONT_URL is honoured whatever it points at, localhost
  // included. It used to be discarded when it contained "localhost", which
  // silently sent every dev preview link at the LIVE site — a token minted
  // by the local backend against a local draft, opened on production, is a
  // guaranteed 404 (verified). It's inlined at build time from the env of
  // whichever machine built the bundle, so a prod build simply doesn't have
  // a localhost value to pick up; production leaves it unset and falls
  // through to the admin.<domain> derivation below.
  const configured = process.env.NEXT_PUBLIC_STOREFRONT_URL;
  const [url, setUrl] = useState(() => (configured ? normalize(configured) : FALLBACK));

  useEffect(() => {
    if (configured) return;
    const derived = deriveFromHostname();
    if (derived) setUrl(normalize(derived));
  }, [configured]);

  return url;
}
