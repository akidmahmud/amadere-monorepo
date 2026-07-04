import { Body, Controller, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { LocaleQueryDto } from '../../common/dto/locale-query.dto';
import { CartIdentityGuard } from '../cart/cart-identity.guard';
import type { RequestWithCartIdentity } from '../cart/cart-identity.guard';
import { CheckoutService } from './checkout.service';
import { CheckoutDto } from './dto/checkout.dto';
import { RequestCodOtpDto } from './dto/request-cod-otp.dto';

@ApiTags('checkout')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Guest-Token', required: false })
@UseGuards(CartIdentityGuard)
@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}

  @Post('cod-otp/request')
  requestCodOtp(@Body() dto: RequestCodOtpDto) {
    return this.checkout.requestCodOtp(dto);
  }

  @Post()
  placeOrder(
    @Req() req: RequestWithCartIdentity,
    @Body() dto: CheckoutDto,
    @Query() { locale }: LocaleQueryDto,
  ) {
    return this.checkout.checkout(req.cartIdentity, dto, locale ?? 'EN');
  }
}
