import { BkashSettingsService } from './bkash-settings.service';

// getPublicConfig is what decides whether checkout offers bKash at all, and
// isGatewayLive is what decides which provider handles it. They MUST agree —
// a storefront offering an option the server then routes to the manual flow
// (or vice versa) is the exact class of bug this pair exists to prevent.
function makeService(opts: { stored?: object | null; secrets?: Record<string, string | null> }) {
  const prisma = {
    client: {
      setting: {
        findUnique: jest.fn().mockResolvedValue(
          opts.stored === null || opts.stored === undefined ? null : { value: opts.stored },
        ),
      },
    },
  } as never;
  const secrets = opts.secrets ?? {};
  const credentials = {
    getCredential: jest.fn((k: string) => Promise.resolve(secrets[k] ?? null)),
    hasCredential: jest.fn((k: string) => Promise.resolve(!!secrets[k])),
    saveCredential: jest.fn(),
  } as never;
  return new BkashSettingsService(prisma, credentials);
}

const ALL_SECRETS = {
  'payment.bkash.username': 'u',
  'payment.bkash.password': 'p',
  'payment.bkash.appKey': 'k',
  'payment.bkash.appSecretKey': 's',
};

describe('BkashSettingsService', () => {
  it('is not live, and offers no public config, when nothing is configured', async () => {
    const service = makeService({ stored: null });
    await expect(service.isGatewayLive()).resolves.toBe(false);
    await expect(service.getPublicConfig()).resolves.toBeNull();
  });

  it('is not live while switched off, even with every credential stored', async () => {
    const service = makeService({ stored: { isActive: false }, secrets: ALL_SECRETS });
    await expect(service.isGatewayLive()).resolves.toBe(false);
    await expect(service.getPublicConfig()).resolves.toBeNull();
  });

  it('is not live while active but missing a credential', async () => {
    const { 'payment.bkash.appSecretKey': _omitted, ...partial } = ALL_SECRETS;
    const service = makeService({ stored: { isActive: true }, secrets: partial });
    await expect(service.isGatewayLive()).resolves.toBe(false);
    await expect(service.getPublicConfig()).resolves.toBeNull();
  });

  it('is live, and publishes display fields only, when active and complete', async () => {
    const service = makeService({
      stored: { isActive: true, methodNameEn: 'bKash', logoUrl: 'https://cdn/logo.png' },
      secrets: ALL_SECRETS,
    });
    await expect(service.isGatewayLive()).resolves.toBe(true);
    const config = await service.getPublicConfig();
    expect(config).toMatchObject({ methodNameEn: 'bKash', logoUrl: 'https://cdn/logo.png' });
    // No secret may ever reach the storefront.
    expect(JSON.stringify(config)).not.toMatch(/username|password|appKey|appSecretKey/i);
  });
});
