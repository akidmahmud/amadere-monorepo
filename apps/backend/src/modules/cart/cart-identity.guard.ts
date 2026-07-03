import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { TokenService } from '../../common/auth/token.service';
import { extractBearerToken } from '../../common/auth/extract-bearer-token.util';

export interface RequestWithCartIdentity extends Request {
  cartIdentity: { customerId?: number; guestToken?: string };
}

// Cart endpoints work for guests AND logged-in customers: a valid customer
// bearer token wins; otherwise the X-Guest-Token header identifies the cart.
// Neither present is still allowed — add-to-cart creates a fresh guest cart.
@Injectable()
export class CartIdentityGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithCartIdentity>();
    const identity: RequestWithCartIdentity['cartIdentity'] = {};

    const bearer = extractBearerToken(request);
    if (bearer) {
      const payload = await this.tokens.verifyCustomerAccessToken(bearer);
      identity.customerId = payload.sub;
    }

    const guestToken = request.headers['x-guest-token'];
    if (typeof guestToken === 'string' && guestToken.length > 0) {
      identity.guestToken = guestToken;
    }

    request.cartIdentity = identity;
    return true;
  }
}
