import type { Config } from "@puckeditor/core";
import { contentBlocks } from "./blocks/content";
import { checkoutBlocks } from "./blocks/checkout";
import { CHECKOUT_BLOCK_NAMES } from "./block-names";

/**
 * The one Puck config, shared by the admin editor and the storefront renderer.
 *
 * Shared on purpose (plan §4): two configs would let a page preview one way in
 * the editor and render another way live, which is the single most confusing
 * failure a page builder can have.
 *
 * Checkout blocks are registered under their own category. They render through
 * an app-supplied slot map (see blocks/checkout) rather than importing the
 * checkout brain, which lives in apps/web and cannot move into a package the
 * admin also imports.
 */
export const config: Config = {
  categories: {
    layout: {
      title: "Layout",
      components: ["Section", "Columns", "Spacer"],
    },
    content: {
      title: "Content",
      components: ["Heading", "RichText", "Image", "Button", "HtmlEmbed", "HtmlPage"],
    },
    checkout: {
      title: "Checkout",
      components: [...CHECKOUT_BLOCK_NAMES],
    },
  },
  components: { ...contentBlocks, ...checkoutBlocks },
};

export default config;

export {
  CheckoutSlotsProvider,
  type CheckoutSlotMap,
  type CheckoutSlotComponent,
} from "./blocks/checkout";
