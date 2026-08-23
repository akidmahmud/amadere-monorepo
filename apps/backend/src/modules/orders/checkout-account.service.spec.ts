import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { phoneLookupCandidates } from '@amader/shared';
import { CheckoutAccountService } from './checkout-account.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TokenService } from '../../common/auth/token.service';

function createMockPrismaService() {
  return { client: { customer: { findFirst: jest.fn(), create: jest.fn() } } };
}

describe('CheckoutAccountService', () => {
  let service: CheckoutAccountService;
  let prisma: ReturnType<typeof createMockPrismaService>;
  let tokens: { signCustomerTokens: jest.Mock };

  beforeEach(async () => {
    prisma = createMockPrismaService();
    tokens = { signCustomerTokens: jest.fn().mockResolvedValue({ accessToken: 'a', refreshToken: 'r' }) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckoutAccountService,
        { provide: PrismaService, useValue: prisma },
        { provide: TokenService, useValue: tokens },
      ],
    }).compile();
    service = module.get(CheckoutAccountService);
  });

  const input = { firstName: 'A', lastName: 'B', email: 'new@test.com', phone: '8801711111111' };

  it('creates an account and issues a session for a brand-new buyer', async () => {
    prisma.client.customer.findFirst.mockResolvedValue(null);
    prisma.client.customer.create.mockResolvedValue({ id: 5 });
    const res = await service.ensureAccount(input);
    expect(res.customerId).toBe(5);
    expect(res.tokens).not.toBeNull();
    expect(res.existingAccount).toBe(false);
  });

  it('creates the account with NO password', async () => {
    prisma.client.customer.findFirst.mockResolvedValue(null);
    prisma.client.customer.create.mockResolvedValue({ id: 5 });
    await service.ensureAccount(input);
    const data = prisma.client.customer.create.mock.calls[0][0].data;
    expect(data.passwordHash ?? null).toBeNull();
  });

  // Task 7 correction: nothing verified the email at creation time, so
  // emailVerifiedAt must stay null. Otherwise a typed-in email becomes
  // "verified" and its real owner can never register it.
  it('creates the account with emailVerifiedAt and phoneVerifiedAt both null', async () => {
    prisma.client.customer.findFirst.mockResolvedValue(null);
    prisma.client.customer.create.mockResolvedValue({ id: 5 });
    await service.ensureAccount(input);
    const data = prisma.client.customer.create.mock.calls[0][0].data;
    expect(data.emailVerifiedAt ?? null).toBeNull();
    expect(data.phoneVerifiedAt ?? null).toBeNull();
  });

  // Fix round 1, Critical 2: lookups must be exact-match-safe. Email is
  // stored lowercased (customers.service.ts's own convention), so a newly
  // created row must be too, or a later lookup for the same buyer (this
  // flow's own repeat-purchase path, or customer-auth login) would miss it.
  it('stores the email lowercased', async () => {
    prisma.client.customer.findFirst.mockResolvedValue(null);
    prisma.client.customer.create.mockResolvedValue({ id: 5 });
    await service.ensureAccount({ ...input, email: 'New@Test.com' });
    const data = prisma.client.customer.create.mock.calls[0][0].data;
    expect(data.email).toBe('new@test.com');
  });

  // Fix round 1, Critical 2: the review found NO test covered the lookup's
  // `where` shape at all — precisely where both Criticals lived. Exact
  // string matching misses ~97% of stored phones (legacy 01X format) and
  // any differently-cased email, so this asserts the real normalized query
  // rather than trusting the mock (which ignores `where` regardless of
  // whether the service builds it correctly).
  it('looks up existing customers via phoneLookupCandidates and a lowercased email', async () => {
    prisma.client.customer.findFirst.mockResolvedValue(null);
    prisma.client.customer.create.mockResolvedValue({ id: 5 });
    await service.ensureAccount({ ...input, email: 'New@Test.com' });
    const where = prisma.client.customer.findFirst.mock.calls[0][0].where;
    expect(where.OR).toContainEqual({ email: 'new@test.com' });
    expect(where.OR).toContainEqual({ phone: { in: phoneLookupCandidates(input.phone) } });
  });

  it('does NOT issue a session when the email belongs to a verified customer', async () => {
    prisma.client.customer.findFirst.mockResolvedValue({ id: 9, emailVerifiedAt: new Date(), phoneVerifiedAt: null, passwordHash: null });
    const res = await service.ensureAccount(input);
    expect(res.customerId).toBe(9);
    expect(res.tokens).toBeNull();
    expect(res.existingAccount).toBe(true);
    expect(tokens.signCustomerTokens).not.toHaveBeenCalled();
  });

  it('does NOT issue a session when the phone belongs to a verified customer', async () => {
    prisma.client.customer.findFirst.mockResolvedValue({ id: 9, emailVerifiedAt: null, phoneVerifiedAt: new Date(), passwordHash: null });
    const res = await service.ensureAccount(input);
    expect(res.tokens).toBeNull();
    expect(res.existingAccount).toBe(true);
  });

  it('does NOT issue a session when an unverified match already has a password set', async () => {
    prisma.client.customer.findFirst.mockResolvedValue({ id: 8, emailVerifiedAt: null, phoneVerifiedAt: null, passwordHash: 'hash' });
    const res = await service.ensureAccount(input);
    expect(res.tokens).toBeNull();
    expect(res.existingAccount).toBe(true);
    expect(tokens.signCustomerTokens).not.toHaveBeenCalled();
  });

  // THE security test (Fix round 1, Critical 1 — the coordinator's own
  // rule reversal). An unverified, passwordless Customer is NOT proof this
  // flow created it: customer-order-event.listener.ts auto-creates exactly
  // this shape for every guest physical order (measured: 83% of the real
  // customer base). Without this guard, an attacker placing a ৳0 digital
  // order with any past COD buyer's phone number would be handed that
  // buyer's real account — order history, addresses, dues — and could set
  // a permanent password on it via POST /customers/me/password.
  it('does NOT issue a session for an unverified, passwordless match (a guest physical-order row, not one this flow created)', async () => {
    prisma.client.customer.findFirst.mockResolvedValue({ id: 7, emailVerifiedAt: null, phoneVerifiedAt: null, passwordHash: null });
    const res = await service.ensureAccount(input);
    expect(res.customerId).toBe(7);
    expect(res.tokens).toBeNull();
    expect(res.existingAccount).toBe(true);
    expect(tokens.signCustomerTokens).not.toHaveBeenCalled();
  });

  // Strengthened per review: the old version of this test only asserted
  // `create` wasn't called, which would pass with or without the
  // account-takeover guard above. Pins down the full outcome for the exact
  // match shape the attack relies on.
  it('never creates a duplicate, and issues no session, when any match exists', async () => {
    prisma.client.customer.findFirst.mockResolvedValue({ id: 7, emailVerifiedAt: null, phoneVerifiedAt: null, passwordHash: null });
    const res = await service.ensureAccount(input);
    expect(prisma.client.customer.create).not.toHaveBeenCalled();
    expect(res.tokens).toBeNull();
    expect(res.existingAccount).toBe(true);
  });

  // Fix round 1, Important 3: both createAccount fields are optional at the
  // DTO layer, so this is the only place "neither supplied" is actually
  // caught. Without it, `OR: []` matches nothing, an identifier-less
  // Customer gets created, a session is issued, and the blocker gets empty
  // contact fields again — the exact gap this task closed.
  it('throws when neither email nor phone is supplied', async () => {
    await expect(
      service.ensureAccount({ firstName: 'A', lastName: 'B' }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.client.customer.findFirst).not.toHaveBeenCalled();
  });
});
