import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
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
    const existingPhone = await this.prisma.client.customer.findUnique({
      where: { phone: dto.phone },
    });
    if (existingPhone?.phoneVerifiedAt) {
      throw new ConflictException('Phone number already registered');
    }
    if (dto.email) {
      const existingEmail = await this.prisma.client.customer.findUnique({
        where: { email: dto.email },
      });
      if (existingEmail && existingEmail.id !== existingPhone?.id) {
        throw new ConflictException('Email already registered');
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

  async login(dto: LoginDto): Promise<TokenPair> {
    const customer = await this.prisma.client.customer.findUnique({
      where: { phone: dto.phone },
    });
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
          phone: isEmail ? undefined : dto.identifier,
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
    return isEmailFormat(identifier)
      ? this.prisma.client.customer.findUnique({ where: { email: identifier } })
      : this.prisma.client.customer.findUnique({
          where: { phone: identifier },
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
