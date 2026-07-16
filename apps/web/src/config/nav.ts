// Structure only — labels come from messages/*.json (nav.*). Config-driven so
// swapping in a categories-API-driven mega-menu later is a data change, not a
// rewrite (AGENTS.web.md §5/§11).
export const navConfig = [
  { key: "allProducts", href: "/products" },
] as const;
