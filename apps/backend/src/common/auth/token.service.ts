import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  AdminAccessPayload,
  AdminRefreshPayload,
  AdminTwoFactorPendingPayload,
  BlogPreviewPayload,
  CustomerAccessPayload,
  CustomerRefreshPayload,
  ProductPreviewPayload,
  TokenPair,
} from './token.types';

const ACCESS_EXPIRES_IN = '15m';
const REFRESH_EXPIRES_IN = '30d';
const TWO_FACTOR_PENDING_EXPIRES_IN = '5m';
// Long enough that an admin reviewing a draft over a day or two doesn't have
// to keep re-generating the link, short enough that an old preview link
// doesn't stay a permanent, unlisted way to view unpublished content.
const BLOG_PREVIEW_EXPIRES_IN = '7d';
const PRODUCT_PREVIEW_EXPIRES_IN = '7d';

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async signAdminTokens(adminUserId: number): Promise<TokenPair> {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(
        { sub: adminUserId, tokenType: 'access' } satisfies AdminAccessPayload,
        {
          secret: this.config.getOrThrow('ADMIN_JWT_ACCESS_SECRET'),
          expiresIn: ACCESS_EXPIRES_IN,
        },
      ),
      this.jwt.signAsync(
        {
          sub: adminUserId,
          tokenType: 'refresh',
        } satisfies AdminRefreshPayload,
        {
          secret: this.config.getOrThrow('ADMIN_JWT_REFRESH_SECRET'),
          expiresIn: REFRESH_EXPIRES_IN,
        },
      ),
    ]);
    return { accessToken, refreshToken };
  }

  async verifyAdminAccessToken(token: string): Promise<AdminAccessPayload> {
    return this.verify<AdminAccessPayload>(
      token,
      'ADMIN_JWT_ACCESS_SECRET',
      'access',
    );
  }

  async verifyAdminRefreshToken(token: string): Promise<AdminRefreshPayload> {
    return this.verify<AdminRefreshPayload>(
      token,
      'ADMIN_JWT_REFRESH_SECRET',
      'refresh',
    );
  }

  async signAdminTwoFactorPendingToken(adminUserId: number): Promise<string> {
    return this.jwt.signAsync(
      {
        sub: adminUserId,
        tokenType: 'two_factor_pending',
      } satisfies AdminTwoFactorPendingPayload,
      {
        secret: this.config.getOrThrow('ADMIN_JWT_ACCESS_SECRET'),
        expiresIn: TWO_FACTOR_PENDING_EXPIRES_IN,
      },
    );
  }

  async verifyAdminTwoFactorPendingToken(
    token: string,
  ): Promise<AdminTwoFactorPendingPayload> {
    return this.verify<AdminTwoFactorPendingPayload>(
      token,
      'ADMIN_JWT_ACCESS_SECRET',
      'two_factor_pending',
    );
  }

  async signCustomerTokens(customerId: number): Promise<TokenPair> {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(
        {
          sub: customerId,
          tokenType: 'access',
        } satisfies CustomerAccessPayload,
        {
          secret: this.config.getOrThrow('CUSTOMER_JWT_ACCESS_SECRET'),
          expiresIn: ACCESS_EXPIRES_IN,
        },
      ),
      this.jwt.signAsync(
        {
          sub: customerId,
          tokenType: 'refresh',
        } satisfies CustomerRefreshPayload,
        {
          secret: this.config.getOrThrow('CUSTOMER_JWT_REFRESH_SECRET'),
          expiresIn: REFRESH_EXPIRES_IN,
        },
      ),
    ]);
    return { accessToken, refreshToken };
  }

  async verifyCustomerAccessToken(
    token: string,
  ): Promise<CustomerAccessPayload> {
    return this.verify<CustomerAccessPayload>(
      token,
      'CUSTOMER_JWT_ACCESS_SECRET',
      'access',
    );
  }

  async verifyCustomerRefreshToken(
    token: string,
  ): Promise<CustomerRefreshPayload> {
    return this.verify<CustomerRefreshPayload>(
      token,
      'CUSTOMER_JWT_REFRESH_SECRET',
      'refresh',
    );
  }

  async signBlogPreviewToken(postId: number): Promise<string> {
    return this.jwt.signAsync(
      { postId, tokenType: 'blog_preview' } satisfies BlogPreviewPayload,
      {
        secret: this.config.getOrThrow('ADMIN_JWT_ACCESS_SECRET'),
        expiresIn: BLOG_PREVIEW_EXPIRES_IN,
      },
    );
  }

  async verifyBlogPreviewToken(token: string): Promise<BlogPreviewPayload> {
    return this.verify<BlogPreviewPayload>(
      token,
      'ADMIN_JWT_ACCESS_SECRET',
      'blog_preview',
    );
  }

  async signProductPreviewToken(productId: number): Promise<string> {
    return this.jwt.signAsync(
      { productId, tokenType: 'product_preview' } satisfies ProductPreviewPayload,
      {
        secret: this.config.getOrThrow('ADMIN_JWT_ACCESS_SECRET'),
        expiresIn: PRODUCT_PREVIEW_EXPIRES_IN,
      },
    );
  }

  async verifyProductPreviewToken(token: string): Promise<ProductPreviewPayload> {
    return this.verify<ProductPreviewPayload>(
      token,
      'ADMIN_JWT_ACCESS_SECRET',
      'product_preview',
    );
  }

  private async verify<T extends { tokenType: string }>(
    token: string,
    secretKey: string,
    expectedTokenType: string,
  ): Promise<T> {
    try {
      const payload = await this.jwt.verifyAsync<T>(token, {
        secret: this.config.getOrThrow(secretKey),
      });
      if (payload.tokenType !== expectedTokenType) {
        throw new UnauthorizedException('Invalid token type');
      }
      return payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
