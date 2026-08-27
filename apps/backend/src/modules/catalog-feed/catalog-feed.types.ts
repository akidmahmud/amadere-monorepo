/**
 * One canonical feed row, built once and rendered into all three platform
 * formats.
 *
 * Meta, Google and TikTok want the same facts in three different shapes, so
 * the database is read once into this neutral structure and the formatters
 * are pure string builders over it. Anything platform-specific (Google's
 * `identifier_exists`, TikTok's `sku_id` header) is decided in the formatter,
 * never here.
 */
export interface FeedItem {
  /**
   * The bare product id as a string.
   *
   * This MUST equal the `item_id` the storefront pushes to the dataLayer
   * (see apps/web/src/lib/analytics-events.ts, which sets
   * `item_id: String(product.id)`). Meta and Google match a viewed product to
   * a catalog entry on exactly this value — ship a different id here and
   * dynamic remarketing silently produces nothing at all, which is the whole
   * reason the catalog exists.
   *
   * It is also effectively permanent: changing an id later makes every
   * platform treat the row as a brand-new product and discard its accumulated
   * history. A primary key is the right thing to hang that on.
   */
  id: string;
  title: string;
  description: string;
  availability: 'in stock' | 'out of stock' | 'preorder';
  condition: 'new';
  /** Numeric, currency appended by the formatters — "790.00 BDT". */
  price: number;
  /** Only when genuinely lower than `price`. */
  salePrice?: number;
  link: string;
  imageLink?: string;
  additionalImageLinks: string[];
  brand: string;
  /** Google's taxonomy id, e.g. "2474". Optional. */
  googleProductCategory?: string;
  /** Breadcrumb of this shop's own categories — Google's `product_type`. */
  productType?: string;
  /** Groups variants of one product. The slug, so it is stable and readable. */
  itemGroupId: string;
  /** The default variant's SKU, offered to Google as `mpn`. */
  mpn?: string;
  customLabels: string[];
  /** Physical goods ship; a digital download does not. */
  shippable: boolean;
}

export interface FeedBuildResult {
  items: FeedItem[];
  generatedAt: Date;
  /** Products skipped, and why — surfaced in the admin panel. */
  skipped: { reason: string; count: number }[];
  /** Rows that will be REJECTED by a platform unless the data is fixed. */
  warnings: { reason: string; count: number; productIds: number[] }[];
}
