import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestWithAdmin } from './admin-jwt.guard';

export const CurrentAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithAdmin>();
    return request.adminUser;
  },
);
