import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { CallProvider } from './call-provider.interface';

// Same deferred-provider pattern as UnconfiguredCourierProvider /
// GoogleSocialLoginVerifier's Facebook branch — real telephony API details
// arrive later; this always throws until a real provider replaces it in
// customers.module.ts.
@Injectable()
export class UnconfiguredCallProvider implements CallProvider {
  async dial(): Promise<never> {
    await Promise.resolve();
    throw new ServiceUnavailableException('Calling is not configured yet');
  }
}
