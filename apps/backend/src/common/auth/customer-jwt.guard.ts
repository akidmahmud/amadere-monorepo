import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { TokenService } from './token.service';
import { extractBearerToken } from './extract-bearer-token.util';

export interface RequestWithCustomer extends Request {
  customer: { id: number };
}

@Injectable()
export class CustomerJwtGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithCustomer>();
    const token = extractBearerToken(request);
    if (!token) throw new UnauthorizedException('Missing bearer token');

    const payload = await this.tokens.verifyCustomerAccessToken(token);
    request.customer = { id: payload.sub };
    return true;
  }
}
