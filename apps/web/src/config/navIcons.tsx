import type { ReactNode } from "react";

// Small guessed icon set for the navbar's collection links, matched by
// slug (stable across EN/BN, unlike the localized name). Best-effort/generic
// glyphs, not literal product art — a collection with no entry here falls
// back to `defaultNavIcon` (leaf). If a collection is renamed or a new one
// is added, this map just needs a new slug key; nothing else changes.

const svgProps = {
  viewBox: "0 0 24 24",
  // Full size only kicks in at 1700px+ (matches Nav.tsx's breakpoint) —
  // common laptop/small-desktop resolutions (1280x800 up through 1536/1440)
  // all sit below that, and these were a fixed 32px regardless of how
  // little room the nav row had, which is most of why "Amader Rice"/
  // "Amader Atta" ran off the end of the row.
  className: "h-4 w-4 shrink-0 min-[1700px]:h-8 min-[1700px]:w-8",
} as const;

const strokeProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const allProductsIcon = (
  <svg {...svgProps} fill="none">
    <rect x="3" y="3" width="7" height="7" rx="1.2" {...strokeProps} />
    <rect x="14" y="3" width="7" height="7" rx="1.2" {...strokeProps} />
    <rect x="3" y="14" width="7" height="7" rx="1.2" {...strokeProps} />
    <rect x="14" y="14" width="7" height="7" rx="1.2" {...strokeProps} />
  </svg>
);

export const defaultNavIcon = (
  <svg {...svgProps}>
    <path d="M4 20c0-9 6-15 15-15 0 9-6 15-15 15Z" {...strokeProps} />
    <path d="M4 20 14 10" {...strokeProps} />
  </svg>
);

const bowlIcon = (
  <svg {...svgProps}>
    <path d="M4 12h16a8 8 0 0 1-16 0Z" {...strokeProps} />
  </svg>
);

const riceBowlIcon = (
  <svg {...svgProps}>
    <path d="M4 12h16a8 8 0 0 1-16 0Z" {...strokeProps} />
    <path d="M9 9V7M12 8V6M15 9V7" {...strokeProps} />
  </svg>
);

const oilIcon = (
  <svg {...svgProps}>
    <path d="M12 3c4 6 6 9 6 12a6 6 0 1 1-12 0c0-3 2-6 6-12Z" {...strokeProps} />
  </svg>
);

const jarIcon = (
  <svg {...svgProps}>
    <path d="M8 3h8v3l1 1v12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V7l1-1V3Z" {...strokeProps} />
    <path d="M8 10h8" {...strokeProps} />
  </svg>
);

const hexIcon = (
  <svg {...svgProps}>
    <path d="M12 3l7 4.5v9L12 21l-7-4.5v-9Z" {...strokeProps} />
  </svg>
);

const starIcon = (
  <svg {...svgProps}>
    <path d="M12 2l1.5 6.5L20 10l-6.5 1.5L12 18l-1.5-6.5L4 10l6.5-1.5Z" {...strokeProps} strokeLinejoin="round" />
  </svg>
);

const seedsIcon = (
  <svg {...svgProps} fill="currentColor" stroke="none">
    <circle cx="8" cy="16" r="2" />
    <circle cx="15" cy="14" r="1.6" />
    <circle cx="12" cy="8" r="1.3" />
  </svg>
);

const blockIcon = (
  <svg {...svgProps}>
    <rect x="5" y="7" width="14" height="12" rx="2" {...strokeProps} />
    <path d="M5 7l7-4 7 4" {...strokeProps} />
  </svg>
);

const wheatIcon = (
  <svg {...svgProps}>
    <path d="M12 21V9" {...strokeProps} />
    <path d="M12 9 9 6M12 9l3-3M12 13 9 10M12 13l3-3M12 17l-3-3M12 17l3-3" {...strokeProps} />
  </svg>
);

export const NAV_ICONS: Record<string, ReactNode> = {
  "amader-chatu": bowlIcon,
  "amader-herbs": defaultNavIcon,
  "amader-oil": oilIcon,
  "amader-achar": jarIcon,
  "amader-modhu": hexIcon,
  "super-food": starIcon,
  "amader-spices": seedsIcon,
  "amader-jaggery": blockIcon,
  "amader-rice": riceBowlIcon,
  "amader-atta": wheatIcon,
};
