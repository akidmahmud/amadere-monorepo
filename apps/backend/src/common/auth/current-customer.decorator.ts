import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestWithCustomer } from './customer-jwt.guard';

export const CurrentCustomer = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithCustomer>();
    return request.customer;
  },
);
