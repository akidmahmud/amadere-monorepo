"use client";

import type { Config } from "@puckeditor/core";
import { config as sharedConfig } from "@amader/page-builder/config";
import { MediaPicker } from "@/components/MediaPicker";
import { ProductSlugPicker } from "@/components/ProductSlugPicker";

/**
 * The shared config with admin-only field editors layered on.
 *
 * Only `fields` are changed here, never `render` — that distinction is what
 * keeps plan §4's guarantee intact. The editor and the storefront still run
 * the same render functions, so a page cannot preview one way and publish
 * another; all this swaps is *how the owner picks a value*, which the
 * storefront never sees.
 *
 * The MediaPicker cannot live in the shared package: it is admin React that
 * talks to the admin's media API, and the package is also imported by the
 * storefront's server render.
 */
export const adminConfig: Config = {
  ...sharedConfig,
  components: {
    ...sharedConfig.components,
    // The landing-page order card: the author picks a real product rather
    // than typing a slug, so the packs and prices it renders come from the
    // database and cannot drift.
    CheckoutProductCard: {
      ...sharedConfig.components.CheckoutProductCard,
      fields: {
        ...sharedConfig.components.CheckoutProductCard.fields,
        productSlug: {
          type: "custom",
          label: "Product",
          render: ({ value, onChange }) => (
            <ProductSlugPicker
              value={typeof value === "string" && value ? value : undefined}
              onChange={(slug) => onChange(slug)}
            />
          ),
        },
      },
    },
    Image: {
      ...sharedConfig.components.Image,
      fields: {
        ...sharedConfig.components.Image.fields,
        url: {
          type: "custom",
          label: "Image",
          render: ({ value, onChange }) => (
            <MediaPicker
              value={typeof value === "string" && value ? value : undefined}
              onChange={(url) => onChange(url ?? "")}
              label="Image"
            />
          ),
        },
      },
    },
  },
};
