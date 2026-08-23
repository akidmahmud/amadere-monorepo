import { BadRequestException, Injectable } from '@nestjs/common';
import { phoneLookupCandidates } from '@amader/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TokenService } from '../../common/auth/token.service';
import type { TokenPair } from '../../common/auth/token.types';

export interface EnsureAccountInput {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
}

export interface EnsureAccountResult {
  customerId: number;
  tokens: TokenPair | null;
  existingAccount: boolean;
}

@Injectable()
export class CheckoutAccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  /**
   * Creates a passwordless account for a digital-product buyer and logs them
   * in — used only for the digital-only checkout path, before the Order row
   * is created (DownloadsService.createForOrder needs order.customerId).
   *
   * Passwordless account-creation-plus-session is an established pattern here
   * — `otp/verify` with purpose REGISTER (customer-auth.service.ts:216-246)
   * and `socialLogin` both bare-create a Customer and immediately return
   * tokens the same way.
   *
   * THE RULE THAT MATTERS (account-takeover guard, Fix round 1): a session
   * is issued ONLY when the lookup below finds NO existing Customer at all.
   * ANY match — verified or not, password or not — returns
   * { tokens: null, existingAccount: true } and nothing is created.
   *
   * This task's first version tried to be cleverer: reuse a match that was
   * unverified with no passwordHash, on the theory that shape is "a row this
   * flow created earlier for the same buyer". That theory was wrong — an
   * unverified, passwordless Customer is also exactly what
   * `customer-order-event.listener.ts` auto-creates for every guest
   * *physical* order, and what CSV import / admin customer-create produce.
   * Measured against the real database: 1,997 of 2,403 customers (83%)
   * match that shape. Reusing on it meant an attacker could place a ৳0
   * digital order quoting any past COD buyer's phone number and receive a
   * session — a real person's order history, saved addresses and dues,
   * with `POST /customers/me/password` (works while the hash is null)
   * making it permanent. There is no shape of "unverified match" that is
   * safe to silently log into. A duplicate Customer row for a repeat guest
   * buyer is an acceptable, mergeable cost; handing over someone else's
   * account is not.
   */
  async ensureAccount(input: EnsureAccountInput): Promise<EnsureAccountResult> {
    if (!input.email && !input.phone) {
      // Same wording as checkout.service.ts's own guard for the "no
      // createAccount at all" case — this is the "createAccount present but
      // both fields empty" case, which the DTO's @IsOptional() decorators
      // don't catch on their own. Required here too: without an identifier
      // there's nothing to look up, so the account-takeover guard above
      // would never even get a chance to run, and the blocker (which reads
      // these same contact fields) would silently get empty phone/email —
      // reopening the gap this task exists to close.
      throw new BadRequestException(
        'Name and an email or phone are required to receive a digital order',
      );
    }

    // Exact-match lookups miss almost everyone in this database. Phones:
    // 2,290 of 2,362 stored rows are still the legacy 01X local format,
    // only 6 are the current 880-compact format the checkout DTO normalizes
    // to — phoneLookupCandidates() (the same helper customer-auth.service.ts's
    // findByIdentifier uses) tries all three known stored shapes. Email:
    // customers.service.ts lowercases on every write specifically because
    // lookups are exact-match, so the read side has to match that here too
    // or "VICTIM@x.com" sails straight past a stored "victim@x.com" — a
    // second, differently-cased row with no unique-index collision to catch
    // it, and a session issued into what looks like a brand-new account
    // that actually shares the victim's identifier.
    const email = input.email?.trim().toLowerCase();
    const phoneCandidates = input.phone ? phoneLookupCandidates(input.phone) : [];

    const existing = await this.prisma.client.customer.findFirst({
      where: {
        OR: [
          ...(email ? [{ email }] : []),
          ...(phoneCandidates.length ? [{ phone: { in: phoneCandidates } }] : []),
        ],
      },
    });

    if (existing) {
      return { customerId: existing.id, tokens: null, existingAccount: true };
    }

    const customer = await this.prisma.client.customer.create({
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        // Same lowercased value the lookup above just searched for — stored
        // that way so a *later* lookup (this flow's own repeat-purchase
        // case, or customer-auth's login) still finds this row by exact
        // match instead of drifting into another duplicate.
        email,
        phone: input.phone,
        // No password — POST /customers/me/password already lets them set
        // one later, and it only works while the hash is null.
        //
        // Nothing verified this email/phone yet, so both stay null (Task 7
        // correction — do NOT stamp emailVerifiedAt here). Marking it
        // verified would let someone else's real email get permanently
        // claimed as "verified" so its true owner could never register it.
        emailVerifiedAt: null,
        phoneVerifiedAt: null,
      },
    });

    return {
      customerId: customer.id,
      tokens: await this.tokens.signCustomerTokens(customer.id),
      existingAccount: false,
    };
  }
}
