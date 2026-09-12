import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CatalogFeedService } from './catalog-feed.service';
import { toMetaCsv } from './catalog-feed.formatters';
import type { FeedItem } from './catalog-feed.types';

/**
 * The four rules that decide whether Commerce Manager accepts the feed, each
 * of which fails silently — a wrong row is imported, not rejected, and the
 * damage shows up as ads that stop serving.
 */

function productRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    slug: 'ghee-500',
    sku: 'GHEE-500',
    productType: 'PHYSICAL',
    stockStatus: 'IN_STOCK',
    googleProductCategory: null,
    customLabels: [],
    price: 790,
    salePrice: null,
    saleStartsAt: null,
    saleEndsAt: null,
    stock: 0,
    reservedStock: 0,
    translations: [{ locale: 'EN', name: 'Ghee 500g', description: 'Pure ghee.' }],
    brand: { translations: [{ locale: 'EN', name: 'Amader' }] },
    variants: [],
    media: [{ media: { url: 'https://cdn.amadere.com/a.jpg', fullUrl: null } }],
    categories: [],
    ...overrides,
  };
}

async function buildOne(overrides: Record<string, unknown> = {}): Promise<FeedItem> {
  const prisma = {
    client: { product: { findMany: jest.fn().mockResolvedValue([productRow(overrides)]) } },
  } as unknown as PrismaService;
  const config = { get: jest.fn().mockReturnValue(undefined) } as unknown as ConfigService;
  const { items } = await new CatalogFeedService(prisma, config).rebuild();
  return items[0];
}

describe('catalog feed — Meta rules', () => {
  describe('description', () => {
    it('decodes the HTML entities CKEditor leaves behind', async () => {
      const item = await buildOne({
        translations: [
          {
            locale: 'EN',
            description: '<p>Pure&nbsp;ghee &amp; honey from Amader&#39;s farm.</p>',
            name: 'Ghee 500g',
          },
        ],
      });

      // Meta prints whatever it is handed, so a surviving "&nbsp;" is visible
      // to shoppers in the product card.
      expect(item.description).toBe("Pure ghee & honey from Amader's farm.");
      expect(item.description).not.toMatch(/&[a-z#]+\d*;/i);
    });
  });

  describe('sale price window', () => {
    const DAY = 24 * 60 * 60 * 1000;

    it('advertises a sale price that is live now', async () => {
      const item = await buildOne({
        salePrice: 690,
        saleStartsAt: new Date(Date.now() - DAY),
        saleEndsAt: new Date(Date.now() + DAY),
      });
      expect(item.salePrice).toBe(690);
    });

    it('drops an expired sale price rather than disagreeing with the landing page', async () => {
      const item = await buildOne({
        salePrice: 690,
        saleStartsAt: new Date(Date.now() - 2 * DAY),
        saleEndsAt: new Date(Date.now() - DAY),
      });
      expect(item.salePrice).toBeUndefined();
    });

    it('drops a sale price whose window has not opened yet', async () => {
      const item = await buildOne({
        salePrice: 690,
        saleStartsAt: new Date(Date.now() + DAY),
        saleEndsAt: new Date(Date.now() + 2 * DAY),
      });
      expect(item.salePrice).toBeUndefined();
    });
  });

  describe('quantity_to_sell_on_facebook', () => {
    it('does not report a sold-out catalogue when stock is simply untracked', async () => {
      // 66 of 79 live products look exactly like this: flagged in stock,
      // counter never maintained. A literal 0 would stop every dynamic ad.
      const item = await buildOne({ stockStatus: 'IN_STOCK', stock: 0 });
      expect(item.availability).toBe('in stock');
      expect(item.quantity).toBeGreaterThan(0);
    });

    it('passes a maintained count through, less what checkout has reserved', async () => {
      const item = await buildOne({ stock: 50, reservedStock: 8 });
      expect(item.quantity).toBe(42);
    });

    it('is zero when the product is marked out of stock, never guessed', async () => {
      const item = await buildOne({ stockStatus: 'OUT_OF_STOCK', stock: 50 });
      expect(item.availability).toBe('out of stock');
      expect(item.quantity).toBe(0);
    });
  });

  describe('CSV shape', () => {
    const base: FeedItem = {
      id: '1',
      title: 'Ghee 500g',
      description: 'Pure ghee.',
      availability: 'in stock',
      condition: 'new',
      price: 790,
      link: 'https://amadere.com/products/ghee-500',
      imageLink: 'https://cdn.amadere.com/a.jpg',
      additionalImageLinks: [],
      brand: 'Amader',
      itemGroupId: 'ghee-500',
      customLabels: [],
      shippable: true,
      quantity: 100,
    };

    it('carries the two Meta-only columns', () => {
      const [header] = toMetaCsv([base]).split('\r\n');
      expect(header).toContain('quantity_to_sell_on_facebook');
      expect(header).toContain('sale_price_effective_date');
    });

    it('writes the sale window as an ISO range beside the sale price', () => {
      const csv = toMetaCsv([
        {
          ...base,
          salePrice: 690,
          saleStartsAt: new Date('2026-09-01T00:00:00.000Z'),
          saleEndsAt: new Date('2026-09-30T00:00:00.000Z'),
        },
      ]);
      expect(csv).toContain(
        '2026-09-01T00:00:00.000Z/2026-09-30T00:00:00.000Z',
      );
    });

    it('leaves the window empty when there is no sale price to qualify', () => {
      const rows = toMetaCsv([base]).split('\r\n');
      const columns = rows[0].split(',');
      const cells = rows[1].split(',');
      expect(cells[columns.indexOf('sale_price_effective_date')]).toBe('');
      expect(cells[columns.indexOf('quantity_to_sell_on_facebook')]).toBe('100');
    });
  });
});
