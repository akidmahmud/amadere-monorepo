import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { phoneLookupCandidates, toBdCompact } from '@amader/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TokenService } from '../../common/auth/token.service';
import { TokenPair } from '../../common/auth/token.types';
import { hashPassword, verifyPassword } from '../../common/auth/password.util';
import { OtpService } from './otp.service';
import { isEmailFormat } from './identifier.util';
import { RegisterDto } from './dto/register.dto';
import { RegisterPendingDto } from './dto/register-pending.dto';
import { LoginDto } from './dto/login.dto';
import { OtpRequestDto } from './dto/otp-request.dto';
import { OtpVerifyDto } from './dto/otp-verify.dto';
import { SocialLoginDto } from './dto/social-login.dto';
import { CustomerProfileDto, toCustomerProfileDto } from './customer.mapper';
import { SOCIAL_LOGIN_VERIFIER } from './notification/social-login-verifier.interface';
import type { SocialLoginVerifier } from './notification/social-login-verifier.interface';
import {
  CUSTOMER_REGISTERED_EVENT,
  CustomerRegisteredEvent,
} from './auth.events';

@Injectable()
export class CustomerAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly otp: OtpService,
    private readonly events: EventEmitter2,
    @Inject(SOCIAL_LOGIN_VERIFIER)
    private readonly socialVerifier: SocialLoginVerifier,
  ) {}

  // Doesn't sign the customer in — the account is only real once the phone
  // OTP is verified (verifyOtp() below). Until then this upserts a
  // *pending* (phoneVerifiedAt: null) Customer row keyed on phone, so:
  //   - resubmitting the same phone (e.g. the OTP expired, or they mistyped
  //     a field) updates the pending row and re-sends a code, instead of
  //     permanently squatting the phone number on a customer who never
  //     finishes signing up (Customer.phone is @unique).
  //   - a phone that already belongs to a *verified* account still 409s.
  async register(dto: RegisterDto): Promise<RegisterPendingDto> {
    // At least one identifier, or the account can never be signed into.
    // Phone is optional specifically so customers abroad (no BD mobile) can
    // register on their email instead — see RegisterDto.phone.
    if (!dto.phone && !dto.email) {
      throw new BadRequestException({
        message: 'Enter a mobile number or an email address',
        details: { field: 'phone' },
      });
    }

    const existingPhone = dto.phone
      ? await this.prisma.client.customer.findFirst({
          where: { phone: { in: phoneLookupCandidates(dto.phone) } },
        })
      : null;
    if (existingPhone?.phoneVerifiedAt) {
      // `details.field` lets the client show this under the phone input
      // specifically instead of a generic form-level banner — same
      // structured-extras mechanism the Blocker Manager popup already uses
      // (see HttpExceptionFilter's `details` passthrough).
      throw new ConflictException({
        message: 'Phone number already registered',
        details: { field: 'phone' },
      });
    }
    // Same "pending rows may be reused, verified ones may not" rule the
    // phone branch above uses. Without the phoneVerifiedAt/emailVerifiedAt
    // check an email-only signup could never be retried: the first attempt
    // creates the row, and every retry (expired code, typo in the name)
    // would 409 against the customer's own unverified row.
    let existingEmail = null as Awaited<ReturnType<typeof this.prisma.client.customer.findUnique>>;
    if (dto.email) {
      existingEmail = await this.prisma.client.customer.findUnique({
        where: { email: dto.email },
      });
      const belongsToSomeoneElse = existingEmail && existingEmail.id !== existingPhone?.id;
      const alreadyVerified =
        existingEmail?.phoneVerifiedAt !== null && existingEmail?.phoneVerifiedAt !== undefined
          ? true
          : !!existingEmail?.emailVerifiedAt;
      if (belongsToSomeoneElse && alreadyVerified) {
        throw new ConflictException({
          message: 'Email already registered',
          details: { field: 'email' },
        });
      }
      if (belongsToSomeoneElse && existingPhone) {
        // Two different pending rows (one found by phone, one by email) can't
        // be merged without silently discarding one — make the customer pick.
        throw new ConflictException({
          message: 'Email already registered',
          details: { field: 'email' },
        });
      }
    }

    const passwordHash = await hashPassword(dto.password);
    const data = {
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      passwordHash,
    };
    const pendingRow = existingPhone ?? existingEmail;
    if (pendingRow) {
      await this.prisma.client.customer.update({
        where: { id: pendingRow.id },
        // `phone` only when one was actually supplied — an email-only retry
        // must not blank out a phone the row already carries.
        data: dto.phone ? { ...data, phone: dto.phone } : data,
      });
    } else {
      await this.prisma.client.customer.create({
        data: { ...data, phone: dto.phone ?? null },
      });
    }
    // Channel choice. Only meaningful when an email was actually supplied —
    // with no email there is nowhere else to send it, so PHONE stands.
    // 'EMAIL' with no email is a client bug, and rejecting it beats silently
    // sending to the phone and leaving the customer watching the wrong inbox.
    if (dto.otpChannel === 'EMAIL' && !dto.email) {
      throw new BadRequestException({
        message: 'Choose email delivery only after entering an email address',
        details: { field: 'email' },
      });
    }
    // With no phone there is only one possible destination, so the channel
    // is forced rather than defaulted — a client that omits otpChannel (or
    // sends PHONE) on an email-only signup still gets the code delivered
    // instead of a send to `undefined`.
    const useEmail = !dto.phone || (dto.otpChannel === 'EMAIL' && !!dto.email);
    const otpIdentifier = useEmail ? dto.email! : dto.phone!;

    await this.otp.request(otpIdentifier, 'REGISTER');
    // The verify call must reuse this exact identifier — OtpService keys the
    // stored code on it (normalizing phones, leaving emails alone).
    return { pending: true, otpChannel: useEmail ? 'EMAIL' : 'PHONE', otpIdentifier };
  }

  // Accepts phone OR email. Reuses findByIdentifier — the same resolver the
  // OTP flows already used — rather than a second phone-only lookup, so
  // "which identifiers can sign in" has one answer across every auth path.
  async login(dto: LoginDto): Promise<TokenPair> {
    const identifier = (dto.identifier ?? dto.phone ?? '').trim();
    if (!identifier) {
      throw new BadRequestException('identifier is required');
    }
    const customer = await this.findByIdentifier(identifier);
    // Deliberately one message for "no such account", "account has no
    // password" and "wrong password" — distinguishing them would let anyone
    // probe which phone numbers and emails have accounts here.
    if (
      !customer?.passwordHash ||
      !(await verifyPassword(dto.password, customer.passwordHash))
    ) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // register() writes the password onto a PENDING row (phoneVerifiedAt
    // null) on purpose — see its comment: the row has to exist so a
    // re-submitted signup updates it instead of permanently squatting the
    // @unique phone. But nothing here ever checked that flag, so the OTP
    // step was decorative: anyone could sign up with a phone number they do
    // not own, set a password, skip the code entirely and log straight in.
    // Verified by reproduction before this line existed.
    //
    // Checked AFTER the password comparison, so the specific message is only
    // ever shown to a caller who already proved they know the password — it
    // leaks nothing a correct-password caller doesn't already have.
    //
    // Either factor counts: phone for the OTP signup path, email for
    // accounts verified by an email code. Safe against the migrated
    // customers (2,370 of them) — they carry no passwordHash at all and
    // sign in by OTP, which sets these flags on the way through.
    if (!customer.phoneVerifiedAt && !customer.emailVerifiedAt) {
      throw new UnauthorizedException(
        'Please verify your account with the OTP code before signing in',
      );
    }

    return this.tokens.signCustomerTokens(customer.id);
  }

  async requestOtp(dto: OtpRequestDto): Promise<void> {
    const existing = await this.findByIdentifier(dto.identifier);
    if (dto.purpose === 'REGISTER' && existing) {
      throw new ConflictException('Identifier already registered');
    }
    if (dto.purpose === 'LOGIN' && !existing) {
      throw new NotFoundException('No account with this identifier');
    }
    await this.otp.request(dto.identifier, dto.purpose);
  }

  async verifyOtp(dto: OtpVerifyDto): Promise<TokenPair> {
    await this.otp.verify(dto.identifier, dto.code, dto.purpose);

    if (dto.purpose === 'LOGIN') {
      const customer = await this.findByIdentifier(dto.identifier);
      if (!customer)
        throw new NotFoundException('No account with this identifier');
      await this.markVerified(customer.id, dto.identifier);
      return this.tokens.signCustomerTokens(customer.id);
    }

    // REGISTER — activates the pending Customer row register() created
    // (sets phoneVerifiedAt, making the account real). Falls back to a bare
    // create for any caller that requests a REGISTER OTP for an identifier
    // with no pending row at all (the older passwordless-signup shape) —
    // cheap safety net, not the primary path anymore.
    const isEmail = isEmailFormat(dto.identifier);
    let customer = await this.findByIdentifier(dto.identifier);
    if (customer) {
      customer = await this.prisma.client.customer.update({
        where: { id: customer.id },
        data: isEmail ? { emailVerifiedAt: new Date() } : { phoneVerifiedAt: new Date() },
      });
    } else {
      customer = await this.prisma.client.customer.create({
        data: {
          email: isEmail ? dto.identifier : undefined,
          // This is the passwordless-signup fallback path, so unlike every
          // other Customer.phone write, `dto.identifier` never went through
          // a @NormalizeBdPhone()-decorated DTO field — normalize it here
          // instead, same compact storage format as everywhere else.
          phone: isEmail ? undefined : (toBdCompact(dto.identifier) ?? dto.identifier),
          emailVerifiedAt: isEmail ? new Date() : undefined,
          phoneVerifiedAt: isEmail ? undefined : new Date(),
        },
      });
    }
    this.events.emit(CUSTOMER_REGISTERED_EVENT, {
      customerId: customer.id,
    } satisfies CustomerRegisteredEvent);
    return this.tokens.signCustomerTokens(customer.id);
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    const payload = await this.tokens.verifyCustomerRefreshToken(refreshToken);
    return this.tokens.signCustomerTokens(payload.sub);
  }

  async me(customerId: number): Promise<CustomerProfileDto> {
    const customer = await this.prisma.client.customer.findUniqueOrThrow({
      where: { id: customerId },
    });
    return toCustomerProfileDto(customer);
  }

  async socialLogin(dto: SocialLoginDto): Promise<TokenPair> {
    const profile = await this.socialVerifier.verify(
      dto.provider,
      dto.accessToken,
    );

    const existingLink = await this.prisma.client.socialAccount.findUnique({
      where: {
        provider_providerUserId: {
          provider: dto.provider,
          providerUserId: profile.providerUserId,
        },
      },
    });
    if (existingLink) {
      return this.tokens.signCustomerTokens(existingLink.customerId);
    }

    const customer = await this.prisma.client.customer.create({
      data: {
        email: profile.email,
        firstName: profile.name,
        emailVerifiedAt: profile.email ? new Date() : undefined,
        socialAccounts: {
          create: {
            provider: dto.provider,
            providerUserId: profile.providerUserId,
          },
        },
      },
    });
    this.events.emit(CUSTOMER_REGISTERED_EVENT, {
      customerId: customer.id,
    } satisfies CustomerRegisteredEvent);
    return this.tokens.signCustomerTokens(customer.id);
  }

  private async findByIdentifier(identifier: string) {
    if (isEmailFormat(identifier)) {
      return this.prisma.client.customer.findUnique({ where: { email: identifier } });
    }
    // otp-request/otp-verify DTOs don't run @NormalizeBdPhone() on
    // `identifier` (it's ambiguously phone-or-email, so it can't be) —
    // phoneLookupCandidates() normalizes internally regardless of which
    // raw shape the client actually sent, same as everywhere else a phone
    // is looked up rather than freshly written.
    return this.prisma.client.customer.findFirst({
      where: { phone: { in: phoneLookupCandidates(identifier) } },
    });
  }

  private async markVerified(
    customerId: number,
    identifier: string,
  ): Promise<void> {
    const isEmail = isEmailFormat(identifier);
    await this.prisma.client.customer.update({
      where: { id: customerId },
      data: isEmail
        ? { emailVerifiedAt: new Date() }
        : { phoneVerifiedAt: new Date() },
    });
  }
}
