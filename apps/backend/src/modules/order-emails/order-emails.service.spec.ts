import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EmailTemplatesService } from '../email-templates/email-templates.service';
import { EmailSettingsService } from '../email-settings/email-settings.service';
import { SmtpEmailProvider } from '../net-profit/cart-campaigns/providers/smtp-email.provider';
import { OrderEmailsService } from './order-emails.service';

// Scoped to sendDigitalDownload (Task 10). The six pre-existing lifecycle
// methods are exercised end-to-end elsewhere; what is new — and load-bearing
// — is the download link itself: a wrong origin here is a dead link in every
// delivered email, and it is not something a type-check can catch.
describe('OrderEmailsService.sendDigitalDownload', () => {
  let service: OrderEmailsService;
  let prisma: { client: { order: { findUnique: jest.Mock }; orderStatusHistory: { create: jest.Mock } } };
  let templates: { render: jest.Mock; getSettings: jest.Mock };
  let email: { send: jest.Mock };
  let config: { get: jest.Mock };

  const ORDER = {
    id: 42,
    orderNumber: 'AM-1042',
    status: 'COMPLETED',
    currency: 'BDT',
    totalAmount: { toString: () => '0' },
    customerNote: null,
    addresses: [],
    items: [
      { productId: 10, productNameSnapshot: 'Ebook <One>', quantity: 1 },
      { productId: 11, productNameSnapshot: 'Ebook Two', quantity: 1 },
    ],
    payments: [],
    // loadOrder now includes these — they drive `download_links`, the direct
    // per-file buttons the digital order email carries.
    digitalDownloads: [],
    customer: { email: 'buyer@example.com', firstName: 'Ada', lastName: 'L', phone: '8801700000000' },
  };

  beforeEach(async () => {
    prisma = {
      client: {
        order: { findUnique: jest.fn().mockResolvedValue(ORDER) },
        orderStatusHistory: { create: jest.fn().mockResolvedValue({}) },
      },
    };
    templates = {
      render: jest.fn().mockResolvedValue({ subject: 'S', html: '<p>H</p>' }),
      getSettings: jest.fn().mockResolvedValue({ orderNotificationEmail: '', contactEmail: '' }),
    };
    email = { send: jest.fn().mockResolvedValue({ id: 'msg-1' }) };
    config = { get: jest.fn().mockReturnValue('https://api.amadere.com') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderEmailsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmailTemplatesService, useValue: templates },
        { provide: EmailSettingsService, useValue: { getConfig: jest.fn().mockResolvedValue({ senderEmail: '' }) } },
        { provide: SmtpEmailProvider, useValue: email },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    service = module.get(OrderEmailsService);
  });

  it('sends one mail per token, each with its own product name and link', async () => {
    const results = await service.sendDigitalDownload(42, [
      { token: 'aaa', productId: 10 },
      { token: 'bbb', productId: 11 },
    ]);

    expect(results).toEqual([{ sent: true }, { sent: true }]);
    expect(templates.render).toHaveBeenCalledTimes(2);
    const [firstKey, firstVars] = templates.render.mock.calls[0];
    expect(firstKey).toBe('digital_download');
    // Snake_case with inner spaces is what this codebase's templates use;
    // camelCase placeholders would render as literal text in the email.
    expect(firstVars.download_url).toBe('https://api.amadere.com/api/v1/downloads/aaa');
    // Customer-controlled free text going into an HTML email.
    expect(firstVars.product_name).toBe('Ebook &lt;One&gt;');
    expect(firstVars.order_id).toBe('AM-1042');
    expect(templates.render.mock.calls[1][1].download_url).toBe(
      'https://api.amadere.com/api/v1/downloads/bbb',
    );
    expect(email.send).toHaveBeenCalledTimes(2);
    expect(email.send.mock.calls[0][0]).toBe('buyer@example.com');
  });

  it('builds the download link on API_BASE_URL, not the storefront origin', async () => {
    await service.sendDigitalDownload(42, [{ token: 'aaa', productId: 10 }]);
    // The endpoint is GET /api/v1/downloads/:token on the backend; the
    // storefront has no route that serves it.
    //
    // Asserted on the URL itself rather than on "STOREFRONT_BASE_URL was
    // never read", which this always did and which was never true of the
    // whole render: buildOrderVariables legitimately reads that var for
    // `downloads_url`, the My Account link every order email carries. A
    // digital email now deliberately contains BOTH origins — the direct file
    // link on the API, the account link on the storefront.
    expect(config.get).toHaveBeenCalledWith('API_BASE_URL');
    const download = templates.render.mock.calls[0][1].download_url as string;
    expect(download).toBe('https://api.amadere.com/api/v1/downloads/aaa');
    expect(download).not.toContain('amadere.com/account');
  });

  // `download_links` is what puts the direct file buttons in the order email
  // itself, instead of only a My Account link that bounces a signed-out buyer
  // to the login page.
  describe('download_links', () => {
    it('renders one direct button per UNLOCKED file, and none for locked ones', async () => {
      prisma.client.order.findUnique.mockResolvedValue({
        ...ORDER,
        digitalDownloads: [
          { token: 'tok-a', productId: 10, unlockedAt: new Date() },
          { token: 'tok-locked', productId: 11, unlockedAt: null },
        ],
      });

      await service.sendOrderPlaced(42);

      const vars = templates.render.mock.calls[0][1] as Record<string, string>;
      expect(vars.download_links).toContain('https://api.amadere.com/api/v1/downloads/tok-a');
      // A locked token's endpoint refuses it until payment is confirmed, so
      // linking it would hand the buyer a button that fails.
      expect(vars.download_links).not.toContain('tok-locked');
      // Product name comes off the order line the buyer actually purchased.
      expect(vars.download_links).toContain('Ebook &lt;One&gt;');
    });

    it('is empty when nothing is unlocked, so the template renders nothing', async () => {
      prisma.client.order.findUnique.mockResolvedValue({
        ...ORDER,
        digitalDownloads: [{ token: 'tok-locked', productId: 11, unlockedAt: null }],
      });

      await service.sendOrderPlaced(42);

      expect((templates.render.mock.calls[0][1] as Record<string, string>).download_links).toBe('');
    });
  });

  it('tolerates a trailing slash on API_BASE_URL', async () => {
    config.get.mockReturnValue('https://api.amadere.com/');
    await service.sendDigitalDownload(42, [{ token: 'aaa', productId: 10 }]);
    expect(templates.render.mock.calls[0][1].download_url).toBe(
      'https://api.amadere.com/api/v1/downloads/aaa',
    );
  });

  // The unlock has already committed by the time this runs — nothing in here
  // may propagate and undo it.
  it('never throws when the template or the SMTP send blows up', async () => {
    templates.render.mockRejectedValue(new Error('template exploded'));
    await expect(service.sendDigitalDownload(42, [{ token: 'aaa', productId: 10 }])).resolves.toEqual([
      { sent: false, reason: 'template exploded' },
    ]);
  });

  it('reports a failed send instead of throwing', async () => {
    email.send.mockResolvedValue({ failed: true, error: 'SMTP is not configured' });
    await expect(service.sendDigitalDownload(42, [{ token: 'aaa', productId: 10 }])).resolves.toEqual([
      { sent: false, reason: 'SMTP is not configured' },
    ]);
  });

  it('does nothing at all for an empty download list', async () => {
    await expect(service.sendDigitalDownload(42, [])).resolves.toEqual([]);
    expect(prisma.client.order.findUnique).not.toHaveBeenCalled();
  });

  it('never loads the Product row (digitalFileKey must not leave the download endpoint)', async () => {
    await service.sendDigitalDownload(42, [{ token: 'aaa', productId: 10 }]);
    const include = prisma.client.order.findUnique.mock.calls[0][0].include;
    expect(include.items).toBe(true);
    // `items: true` returns OrderItem columns only — no nested product
    // relation, so digitalFileKey is never read here. The R2 bucket is
    // fully public, which is why that matters.
    expect(include.items.include).toBeUndefined();
    expect(include.product).toBeUndefined();
  });
});
