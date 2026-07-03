import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { SocialProvider } from '@amader/db';
import {
  SocialLoginVerifier,
  SocialProfile,
} from './social-login-verifier.interface';

@Injectable()
export class UnconfiguredSocialLoginVerifier implements SocialLoginVerifier {
  async verify(provider: SocialProvider): Promise<SocialProfile> {
    await Promise.resolve();
    throw new ServiceUnavailableException(
      `${provider} login is not configured yet`,
    );
  }
}
