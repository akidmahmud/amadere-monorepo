import { Body, Controller, Ip, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { LocaleQueryDto } from '../../common/dto/locale-query.dto';
import { CartIdentityGuard } from '../cart/cart-identity.guard';
import type { RequestWithCartIdentity } from '../cart/cart-identity.guard';
import { CheckoutService } from './checkout.service';
import type { CheckoutResultDto } from './checkout.service';
import { CheckoutDto } from './dto/checkout.dto';
import { RequestCodOtpDto } from './dto/request-cod-otp.dto';
import { OrderDto } from './orders.mapper';

@ApiTags('checkout')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Guest-Token', required: false })
@UseGuards(CartIdentityGuard)
@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}

  @Post('cod-otp/request')
  requestCodOtp(@Body() dto: RequestCodOtpDto, @Ip() ip: string): Promise<void> {
    return this.checkout.requestCodOtp(dto, ip);
  }

  @Post()
  // Response shape is OrderDto plus two fields present only for a
  // digital-only, no-session checkout (see CheckoutResultDto) — swagger
  // still documents it as OrderDto since ApiOkResponse needs a decorated
  // class, not this plain intersection type.
  @ApiOkResponse({ type: OrderDto })
  placeOrder(
    @Req() req: RequestWithCartIdentity,
    @Body() dto: CheckoutDto,
    @Query() { locale }: LocaleQueryDto,
  ): Promise<CheckoutResultDto> {
    return this.checkout.checkout(req.cartIdentity, dto, locale ?? 'EN', req.ip);
  }
}
