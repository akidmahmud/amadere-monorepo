import { Test, TestingModule } from '@nestjs/testing';
import { FooterService } from './footer.service';
import { FOOTER_DEFAULTS } from './footer.defaults';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RevalidationService } from '../../common/revalidation/revalidation.service';

function createMockPrismaService() {
  return {
    client: {
      setting: { findUnique: jest.fn(), upsert: jest.fn() },
      media: { findMany: jest.fn().mockResolvedValue([]) },
    },
  };
}

type MockPrisma = ReturnType<typeof createMockPrismaService>;

describe('FooterService', () => {
  let service: FooterService;
  let prisma: MockPrisma;
  let revalidate: jest.Mock;

  beforeEach(async () => {
    prisma = createMockPrismaService();
    revalidate = jest.fn();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FooterService,
        { provide: PrismaService, useValue: prisma },
        { provide: RevalidationService, useValue: { revalidate } },
      ],
    }).compile();
    service = module.get(FooterService);
  });

  it('falls back to defaults when no footer_config row exists', async () => {
    prisma.client.setting.findUnique.mockResolvedValue(null);

    const footer = await service.getPublic('EN');

    expect(footer.columns).toHaveLength(FOOTER_DEFAULTS.columns.length);
    expect(footer.brandMark).toBe(FOOTER_DEFAULTS.brandMark.en);
  });

  it('flattens translated fields to the requested locale only', async () => {
    prisma.client.setting.findUnique.mockResolvedValue({
      key: 'footer_config',
      value: { ...FOOTER_DEFAULTS, brandMark: { en: 'Amader', bn: 'আমাদের' } },
    });

    const en = await service.getPublic('EN');
    const bn = await service.getPublic('BN');

    expect(en.brandMark).toBe('Amader');
    expect(bn.brandMark).toBe('আমাদের');
  });

  it('merges a partial document over defaults instead of blanking the footer', async () => {
    prisma.client.setting.findUnique.mockResolvedValue({
      key: 'footer_config',
      value: { copyright: { en: 'Only this', bn: 'Only this' } },
    });

    const footer = await service.getPublic('EN');

    expect(footer.copyright).toBe('Only this');
    expect(footer.columns).toHaveLength(FOOTER_DEFAULTS.columns.length);
    expect(footer.contact.phone.value).toBe(FOOTER_DEFAULTS.contact.phone.value);
  });

  it('keeps an app button whose url is empty', async () => {
    prisma.client.setting.findUnique.mockResolvedValue({
      key: 'footer_config',
      value: {
        ...FOOTER_DEFAULTS,
        apps: {
          downloadLabel: { en: 'Get the app', bn: 'অ্যাপ নিন' },
          buttons: [
            {
              style: 'googlePlay',
              mediaId: null,
              url: '',
              lineOne: { en: 'GET IT ON', bn: 'GET IT ON' },
              lineTwo: { en: 'Google Play', bn: 'Google Play' },
            },
          ],
        },
      },
    });

    const footer = await service.getPublic('EN');

    expect(footer.apps.buttons).toHaveLength(1);
    expect(footer.apps.buttons[0].url).toBe('');
  });

  it('resolves custom icon and payment media ids to urls', async () => {
    prisma.client.media.findMany.mockResolvedValue([
      { id: 7, url: 'https://cdn.example/tiktok.png' },
      { id: 9, url: 'https://cdn.example/pay.png' },
    ]);
    prisma.client.setting.findUnique.mockResolvedValue({
      key: 'footer_config',
      value: {
        ...FOOTER_DEFAULTS,
        social: [
          {
            icon: 'custom',
            mediaId: 7,
            url: 'https://tiktok.com/@amader',
            label: { en: 'TikTok', bn: 'টিকটক' },
          },
        ],
        payment: { label: { en: 'Pay With', bn: 'পে উইথ' }, mediaId: 9 },
      },
    });

    const footer = await service.getPublic('EN');

    expect(footer.social[0].imageUrl).toBe('https://cdn.example/tiktok.png');
    expect(footer.payment.imageUrl).toBe('https://cdn.example/pay.png');
  });

  it('resolves a chosen footer logo mediaId to a url', async () => {
    prisma.client.media.findMany.mockResolvedValue([
      { id: 12, url: 'https://cdn.example/footer-logo.png' },
    ]);
    prisma.client.setting.findUnique.mockResolvedValue({
      key: 'footer_config',
      value: { ...FOOTER_DEFAULTS, logo: { mediaId: 12 } },
    });

    const footer = await service.getPublic('EN');

    expect(footer.logo.imageUrl).toBe('https://cdn.example/footer-logo.png');
  });

  it('leaves logo.imageUrl null when no footer logo is chosen, so the storefront falls back to the site logo', async () => {
    prisma.client.setting.findUnique.mockResolvedValue(null);

    const footer = await service.getPublic('EN');

    expect(footer.logo.imageUrl).toBeNull();
  });

  it('upserts and triggers a layout revalidate on update', async () => {
    prisma.client.setting.findUnique.mockResolvedValue(null);
    prisma.client.setting.upsert.mockResolvedValue({
      key: 'footer_config',
      value: FOOTER_DEFAULTS,
    });

    await service.update(FOOTER_DEFAULTS);

    expect(prisma.client.setting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: 'footer_config' } }),
    );
    // Asserting only the upsert call would still pass if the revalidate call
    // were deleted entirely — pin down the actual fire-and-forget call too.
    expect(revalidate).toHaveBeenCalledWith(['/[locale]'], 'layout');
  });

  it('does not throw when a stored section carries a null sub-object instead of being absent', async () => {
    prisma.client.setting.findUnique.mockResolvedValue({
      key: 'footer_config',
      value: {
        ...FOOTER_DEFAULTS,
        contact: { address: null },
        apps: { buttons: null },
      },
    });

    const footer = await service.getPublic('EN');

    expect(footer.contact.address.label).toBe(FOOTER_DEFAULTS.contact.address.label.en);
    expect(footer.apps.buttons).toHaveLength(FOOTER_DEFAULTS.apps.buttons.length);
  });

  // FIX 3 (final review): footer_config has a second, unvalidated write path
  // (the generic PUT /api/v1/admin/settings/:key), so getPublic()/getAdmin()
  // must not trust that a stored document matches FooterConfig's shape.
  it('falls back to default columns when the stored value is an object rather than an array', async () => {
    prisma.client.setting.findUnique.mockResolvedValue({
      key: 'footer_config',
      value: { ...FOOTER_DEFAULTS, columns: {} },
    });

    const footer = await service.getPublic('EN');

    expect(footer.columns).toHaveLength(FOOTER_DEFAULTS.columns.length);
  });

  it('falls back to default social when the stored value is a string rather than an array', async () => {
    prisma.client.setting.findUnique.mockResolvedValue({
      key: 'footer_config',
      value: { ...FOOTER_DEFAULTS, social: 'x' },
    });

    const footer = await service.getPublic('EN');

    expect(footer.social).toHaveLength(FOOTER_DEFAULTS.social.length);
  });

  it('drops a link whose href is an offsite protocol-relative url while its siblings survive', async () => {
    prisma.client.setting.findUnique.mockResolvedValue({
      key: 'footer_config',
      value: {
        ...FOOTER_DEFAULTS,
        columns: [
          {
            heading: { en: 'Links', bn: 'Links' },
            links: [
              { label: { en: 'Evil', bn: 'Evil' }, href: '//evil.example/pay', newTab: false },
              { label: { en: 'Safe', bn: 'Safe' }, href: '/about-us', newTab: false },
            ],
          },
        ],
      },
    });

    const footer = await service.getPublic('EN');

    expect(footer.columns).toHaveLength(1);
    expect(footer.columns[0].links).toHaveLength(1);
    expect(footer.columns[0].links[0].href).toBe('/about-us');
  });

  it('drops a social entry whose url is neither absolute http(s) nor empty', async () => {
    prisma.client.setting.findUnique.mockResolvedValue({
      key: 'footer_config',
      value: {
        ...FOOTER_DEFAULTS,
        social: [
          { icon: 'facebook', mediaId: null, url: 'javascript:alert(1)', label: { en: 'Evil', bn: 'Evil' } },
          { icon: 'instagram', mediaId: null, url: 'https://instagram.com/amader', label: { en: 'IG', bn: 'IG' } },
        ],
      },
    });

    const footer = await service.getPublic('EN');

    expect(footer.social).toHaveLength(1);
    expect(footer.social[0].url).toBe('https://instagram.com/amader');
  });

  it('resolves a stale mediaId (row no longer in media) to a null imageUrl instead of throwing', async () => {
    prisma.client.media.findMany.mockResolvedValue([]);
    prisma.client.setting.findUnique.mockResolvedValue({
      key: 'footer_config',
      value: {
        ...FOOTER_DEFAULTS,
        social: [
          {
            icon: 'custom',
            mediaId: 404,
            url: 'https://tiktok.com/@amader',
            label: { en: 'TikTok', bn: 'টিকটক' },
          },
        ],
      },
    });

    const footer = await service.getPublic('EN');

    expect(footer.social[0].imageUrl).toBeNull();
  });
});
