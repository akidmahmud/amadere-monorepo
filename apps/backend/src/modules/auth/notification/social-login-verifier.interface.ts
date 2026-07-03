import { SocialProvider } from '@amader/db';

export const SOCIAL_LOGIN_VERIFIER = Symbol('SOCIAL_LOGIN_VERIFIER');

export interface SocialProfile {
  providerUserId: string;
  email?: string;
  name?: string;
}

// Verifies a provider access token and returns the profile it belongs to.
// Real Google/Facebook SDK verification plugs in here once credentials
// arrive — same deferred-provider pattern as Payment/Courier (AGENTS.md §4.1/§6).
export interface SocialLoginVerifier {
  verify(
    provider: SocialProvider,
    providerAccessToken: string,
  ): Promise<SocialProfile>;
}
