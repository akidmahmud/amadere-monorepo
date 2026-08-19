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
    const existingPhone = await this.prisma.client.customer.findFirst({
      where: { phone: { in: phoneLookupCandidates(dto.phone) } },
    });
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
    if (dto.email) {
      const existingEmail = await this.prisma.client.customer.findUnique({
        where: { email: dto.email },
      });
      if (existingEmail && existingEmail.id !== existingPhone?.id) {
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
    if (existingPhone) {
      await this.prisma.client.customer.update({
        where: { id: existingPhone.id },
        data,
      });
    } else {
      await this.prisma.client.customer.create({
        data: { ...data, phone: dto.phone },
      });
    }
    await this.otp.request(dto.phone, 'REGISTER');
    return { pending: true };
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
