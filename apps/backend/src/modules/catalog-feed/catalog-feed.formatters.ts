import type { FeedItem } from './catalog-feed.types';

const CURRENCY = 'BDT';
/** Flat courier rate quoted to Google; the real fee is computed at checkout. */
const SHIPPING = { country: 'BD', service: 'Steadfast Courier', price: '60.00 BDT' };

/** "790.00 BDT" — every platform requires the currency code, not a bare number. */
function money(n: number): string {
  return `${n.toFixed(2)} ${CURRENCY}`;
}

/**
 * XML text escaping.
 *
 * Product names here contain `&` routinely and Bangla punctuation
 * occasionally; one unescaped ampersand makes the whole document
 * unparseable, so Google rejects the ENTIRE feed rather than one row.
 */
function xml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * TSV cell escaping.
 *
 * A tab or newline inside a description would shift every later column of
 * that row by one, which TikTok reads as a malformed record rather than an
 * error worth reporting. Collapsed to spaces instead.
 */
function tsv(s: string): string {
  return s.replace(/[\t\r\n]+/g, ' ').trim();
}

/** Meta Commerce Manager — JSON. */
export function toMetaJson(items: FeedItem[]): string {
  return JSON.stringify(
    {
      data: items.map((i) => ({
        id: i.id,
        title: i.title,
        description: i.description,
        availability: i.availability,
        condition: i.condition,
        price: money(i.price),
        ...(i.salePrice ? { sale_price: money(i.salePrice) } : {}),
        link: i.link,
        ...(i.imageLink ? { image_link: i.imageLink } : {}),
        ...(i.additionalImageLinks.length
          ? { additional_image_link: i.additionalImageLinks.join(',') }
          : {}),
        brand: i.brand,
        ...(i.googleProductCategory
          ? { google_product_category: i.googleProductCategory }
          : {}),
        ...(i.productType ? { product_type: i.productType } : {}),
        item_group_id: i.itemGroupId,
        ...Object.fromEntries(
          i.customLabels.slice(0, 5).map((v, n) => [`custom_label_${n}`, v]),
        ),
      })),
    },
    null,
    2,
  );
}

/** Google Merchant Center — RSS 2.0 with the g: namespace. */
export function toGoogleXml(items: FeedItem[], shopUrl: string): string {
  const rows = items
    .map((i) => {
      const parts = [
        `      <g:id>${xml(i.id)}</g:id>`,
        `      <g:title>${xml(i.title)}</g:title>`,
        `      <g:description>${xml(i.description)}</g:description>`,
        `      <g:link>${xml(i.link)}</g:link>`,
        i.imageLink ? `      <g:image_link>${xml(i.imageLink)}</g:image_link>` : '',
        ...i.additionalImageLinks.map(
          (u) => `      <g:additional_image_link>${xml(u)}</g:additional_image_link>`,
        ),
        `      <g:condition>${i.condition}</g:condition>`,
        `      <g:availability>${i.availability}</g:availability>`,
        `      <g:price>${money(i.price)}</g:price>`,
        i.salePrice ? `      <g:sale_price>${money(i.salePrice)}</g:sale_price>` : '',
        `      <g:brand>${xml(i.brand)}</g:brand>`,
        // Bangladeshi products carry no GTIN/barcode. Without this Google
        // demands one and rejects every single row.
        `      <g:identifier_exists>no</g:identifier_exists>`,
        i.mpn ? `      <g:mpn>${xml(i.mpn)}</g:mpn>` : '',
        i.googleProductCategory
          ? `      <g:google_product_category>${xml(i.googleProductCategory)}</g:google_product_category>`
          : '',
        i.productType ? `      <g:product_type>${xml(i.productType)}</g:product_type>` : '',
        i.shippable
          ? [
              '      <g:shipping>',
              `        <g:country>${SHIPPING.country}</g:country>`,
              `        <g:service>${xml(SHIPPING.service)}</g:service>`,
              `        <g:price>${SHIPPING.price}</g:price>`,
              '      </g:shipping>',
            ].join('\n')
          : '',
        `      <g:item_group_id>${xml(i.itemGroupId)}</g:item_group_id>`,
        ...i.customLabels
          .slice(0, 5)
          .map((v, n) => `      <g:custom_label_${n}>${xml(v)}</g:custom_label_${n}>`),
      ].filter(Boolean);
      return `    <item>\n${parts.join('\n')}\n    </item>`;
    })
    .join('\n\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Amader Product Feed</title>
    <link>${xml(shopUrl)}</link>
    <description>Amader eBuy Ltd - Natural Food Products</description>

${rows}

  </channel>
</rss>
`;
}

/** TikTok Catalog — tab-separated, header row first, UTF-8. */
export function toTiktokTsv(items: FeedItem[]): string {
  const columns = [
    'sku_id',
    'title',
    'description',
    'availability',
    'condition',
    'price',
    'sale_price',
    'link',
    'image_link',
    'brand',
    'google_product_category',
    'product_type',
    'item_group_id',
  ];
  const rows = items.map((i) =>
    [
      i.id,
      tsv(i.title),
      tsv(i.description),
      i.availability,
      i.condition,
      money(i.price),
      i.salePrice ? money(i.salePrice) : '',
      i.link,
      i.imageLink ?? '',
      tsv(i.brand),
      i.googleProductCategory ?? '',
      tsv(i.productType ?? ''),
      i.itemGroupId,
    ].join('\t'),
  );
  return [columns.join('\t'), ...rows].join('\n');
}
