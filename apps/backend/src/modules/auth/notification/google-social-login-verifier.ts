import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { SocialProvider } from '@amader/db';
import {
  SocialLoginVerifier,
  SocialProfile,
} from './social-login-verifier.interface';

// Facebook still isn't configured — only GOOGLE is real here. Verifies the
// ID token the frontend gets from Google Identity Services client-side
// (LoginForm's Google button), rather than exchanging a code server-side, so
// no client secret is needed.
@Injectable()
export class GoogleSocialLoginVerifier implements SocialLoginVerifier {
  private readonly client: OAuth2Client | null;
  private readonly clientId?: string;

  constructor(config: ConfigService) {
    this.clientId = config.get<string>('GOOGLE_CLIENT_ID');
    this.client = this.clientId ? new OAuth2Client(this.clientId) : null;
  }

  async verify(
    provider: SocialProvider,
    providerAccessToken: string,
  ): Promise<SocialProfile> {
    if (provider !== 'GOOGLE' || !this.client || !this.clientId) {
      throw new ServiceUnavailableException(
        `${provider} login is not configured yet`,
      );
    }

    const ticket = await this.client
      .verifyIdToken({ idToken: providerAccessToken, audience: this.clientId })
      .catch(() => {
        throw new UnauthorizedException('Invalid Google token');
      });
    const payload = ticket.getPayload();
    if (!payload?.sub) throw new UnauthorizedException('Invalid Google token');

    return {
      providerUserId: payload.sub,
      email: payload.email,
      name: payload.name,
    };
  }
}
