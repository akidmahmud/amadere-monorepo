import { defineRouting } from "next-intl/routing";

// EN stays unprefixed ("/products/x") to preserve the ~1,900 ranked URLs the
// backend carries over from the old site; BN opts in at "/bn/...".
export const routing = defineRouting({
  locales: ["en", "bn"],
  defaultLocale: "en",
  localePrefix: "as-needed",
});
