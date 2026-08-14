"use client";

import { useEffect } from "react";
import { CKEDITOR_FONT_FAMILIES, CRITICAL_FONT_NAMES, ckeditorGoogleFontsUrl } from "@amader/shared";

// The ~17 CKEditor picker fonts nobody's base layout needs immediately (only
// admin-authored rich-text content ever references them via inline
// font-family styles) — loaded after first paint instead of blocking it, per
// layout.tsx's critical/deferred font split.
const DEFERRED_NAMES = CKEDITOR_FONT_FAMILIES.map((f) => f.name).filter((n) => !CRITICAL_FONT_NAMES.includes(n));

export function DeferredFontLoader() {
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = ckeditorGoogleFontsUrl(DEFERRED_NAMES);
    document.head.appendChild(link);
  }, []);
  return null;
}
