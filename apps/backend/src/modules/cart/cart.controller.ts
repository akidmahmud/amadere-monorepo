import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { LocaleQueryDto } from '../../common/dto/locale-query.dto';
import { CustomerJwtGuard } from '../../common/auth/customer-jwt.guard';
import { CurrentCustomer } from '../../common/auth/current-customer.decorator';
import { CartIdentityGuard } from './cart-identity.guard';
import type { RequestWithCartIdentity } from './cart-identity.guard';
import { CartService } from './cart.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { ApplyCouponDto } from './dto/apply-coupon.dto';
import { BuyNowDto } from './dto/buy-now.dto';
import { MergeCartDto } from './dto/merge-cart.dto';
import { CartViewDto, PricingSummaryDto } from './dto/cart-response.dto';

@ApiTags('cart')
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Guest-Token',
  required: false,
  description: 'Guest cart token (returned on first add-to-cart)',
})
@UseGuards(CartIdentityGuard)
@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  @ApiOkResponse({ type: CartViewDto })
  getCart(
    @Req() req: RequestWithCartIdentity,
    @Query() { locale }: LocaleQueryDto,
  ): Promise<CartViewDto> {
    return this.cart.getView(req.cartIdentity, locale ?? 'EN');
  }

  @Post('items')
  @ApiOkResponse({ type: CartViewDto })
  addItem(
    @Req() req: RequestWithCartIdentity,
    @Body() dto: AddCartItemDto,
    @Query() { locale }: LocaleQueryDto,
  ): Promise<CartViewDto> {
    return this.cart.addItem(req.cartIdentity, dto, locale ?? 'EN');
  }

  @Patch('items/:id')
  @ApiOkResponse({ type: CartViewDto })
  updateItem(
    @Req() req: RequestWithCartIdentity,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCartItemDto,
    @Query() { locale }: LocaleQueryDto,
  ): Promise<CartViewDto> {
    return this.cart.updateItem(
      req.cartIdentity,
      id,
      dto.quantity,
      locale ?? 'EN',
    );
  }

  @Delete('items/:id')
  @ApiOkResponse({ type: CartViewDto })
  removeItem(
    @Req() req: RequestWithCartIdentity,
    @Param('id', ParseIntPipe) id: number,
    @Query() { locale }: LocaleQueryDto,
  ): Promise<CartViewDto> {
    return this.cart.removeItem(req.cartIdentity, id, locale ?? 'EN');
  }

  @Post('coupon')
  @ApiOkResponse({ type: CartViewDto })
  applyCoupon(
    @Req() req: RequestWithCartIdentity,
    @Body() dto: ApplyCouponDto,
    @Query() { locale }: LocaleQueryDto,
  ): Promise<CartViewDto> {
    return this.cart.applyCoupon(req.cartIdentity, dto.code, locale ?? 'EN');
  }

  @Delete('coupon')
  @ApiOkResponse({ type: CartViewDto })
  removeCoupon(
    @Req() req: RequestWithCartIdentity,
    @Query() { locale }: LocaleQueryDto,
  ): Promise<CartViewDto> {
    return this.cart.removeCoupon(req.cartIdentity, locale ?? 'EN');
  }

  @Post('buy-now')
  @ApiOkResponse({ type: PricingSummaryDto })
  buyNow(
    @Req() req: RequestWithCartIdentity,
    @Body() dto: BuyNowDto,
    @Query() { locale }: LocaleQueryDto,
  ): Promise<PricingSummaryDto> {
    return this.cart.buyNowQuote(
      dto,
      locale ?? 'EN',
      req.cartIdentity.customerId,
    );
  }
}

@ApiTags('cart')
@ApiBearerAuth()
@UseGuards(CustomerJwtGuard)
@Controller('cart')
export class CartMergeController {
  constructor(private readonly cart: CartService) {}

  @Post('merge')
  @ApiOkResponse({ type: CartViewDto })
  merge(
    @CurrentCustomer() customer: { id: number },
    @Body() dto: MergeCartDto,
    @Query() { locale }: LocaleQueryDto,
  ): Promise<CartViewDto> {
    return this.cart.merge(customer.id, dto.guestToken, locale ?? 'EN');
  }
}
