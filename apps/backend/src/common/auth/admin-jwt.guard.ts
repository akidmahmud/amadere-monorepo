import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { TokenService } from './token.service';
import { extractBearerToken } from './extract-bearer-token.util';

export interface RequestWithAdmin extends Request {
  adminUser: { id: number };
}

@Injectable()
export class AdminJwtGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithAdmin>();
    const token = extractBearerToken(request);
    if (!token) throw new UnauthorizedException('Missing bearer token');

    const payload = await this.tokens.verifyAdminAccessToken(token);
    request.adminUser = { id: payload.sub };
    return true;
  }
}
