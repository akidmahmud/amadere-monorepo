import type { ReactNode } from "react";
import {
  FaBowlFood,
  FaBowlRice,
  FaCube,
  FaJar,
  FaJarWheat,
  FaLeaf,
  FaOilCan,
  FaPepperHot,
  FaStar,
  FaTableCells,
  FaWheatAwn,
} from "react-icons/fa6";

// Small guessed icon set for the navbar's collection links, matched by
// slug (stable across EN/BN, unlike the localized name). Best-effort/generic
// glyphs, not literal product art — a collection with no entry here falls
// back to `defaultNavIcon` (leaf). If a collection is renamed or a new one
// is added, this map just needs a new slug key; nothing else changes.

const iconProps = {
  // Full size only kicks in at 1700px+ (matches Nav.tsx's breakpoint) —
  // common laptop/small-desktop resolutions (1280x800 up through 1536/1440)
  // all sit below that, and these were a fixed 32px regardless of how
  // little room the nav row had, which is most of why "Amader Rice"/
  // "Amader Atta" ran off the end of the row.
  className: "h-3.5 w-3.5 shrink-0 min-[1700px]:h-6 min-[1700px]:w-6",
} as const;

export const allProductsIcon = <FaTableCells {...iconProps} />;

export const defaultNavIcon = <FaLeaf {...iconProps} />;

export const NAV_ICONS: Record<string, ReactNode> = {
  "amader-chatu": <FaBowlFood {...iconProps} />,
  "amader-herbs": <FaLeaf {...iconProps} />,
  "amader-oil": <FaOilCan {...iconProps} />,
  "amader-achar": <FaJarWheat {...iconProps} />,
  "amader-modhu": <FaJar {...iconProps} />,
  "super-food": <FaStar {...iconProps} />,
  "amader-spices": <FaPepperHot {...iconProps} />,
  "amader-jaggery": <FaCube {...iconProps} />,
  "amader-rice": <FaBowlRice {...iconProps} />,
  "amader-atta": <FaWheatAwn {...iconProps} />,
};
