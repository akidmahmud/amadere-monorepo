"use client";

import { Render } from "@puckeditor/core";
import type { Data } from "@puckeditor/core";
import { config, CheckoutSlotsProvider } from "@amader/page-builder/config";
import { checkoutSlots } from "./slots";
import { CheckoutLayoutBoundary } from "./CheckoutLayoutBoundary";

/**
 * Renders a published checkout layout.
 *
 * The CLIENT `Render`, not the RSC one used for content pages: checkout blocks
 * read the checkout brain from React context, which only exists on the client.
 * A content page keeps its zero-JS server render; checkout was always a client
 * page anyway.
 *
 * `checkoutSlots` is what turns the package's schema-only blocks into the real
 * markup -- see packages/page-builder/src/blocks/checkout for why rendering is
 * supplied by the app rather than living in the package.
 */
export function CheckoutLayoutRenderer({ layout }: { layout: unknown }) {
  return (
    <CheckoutLayoutBoundary>
      <CheckoutSlotsProvider slots={checkoutSlots}>
        <Render config={config} data={layout as Data} />
      </CheckoutSlotsProvider>
    </CheckoutLayoutBoundary>
  );
}
