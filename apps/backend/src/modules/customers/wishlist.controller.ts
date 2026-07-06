import {
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CustomerJwtGuard } from '../../common/auth/customer-jwt.guard';
import { CurrentCustomer } from '../../common/auth/current-customer.decorator';
import { LocaleQueryDto } from '../../common/dto/locale-query.dto';
import { SuccessResponseDto } from '../../common/dto/success-response.dto';
import { WishlistService } from './wishlist.service';
import { WishlistItemDto } from './wishlist.mapper';

@ApiTags('customers')
@ApiBearerAuth()
@UseGuards(CustomerJwtGuard)
@Controller('customers/me/wishlist')
export class WishlistController {
  constructor(private readonly wishlist: WishlistService) {}

  @Get()
  @ApiOkResponse({ type: WishlistItemDto, isArray: true })
  list(
    @CurrentCustomer() customer: { id: number },
    @Query() { locale }: LocaleQueryDto,
  ): Promise<WishlistItemDto[]> {
    return this.wishlist.list(customer.id, locale ?? 'EN');
  }

  @Post(':productId')
  @ApiOkResponse({ type: SuccessResponseDto })
  add(
    @CurrentCustomer() customer: { id: number },
    @Param('productId', ParseIntPipe) productId: number,
  ): Promise<SuccessResponseDto> {
    return this.wishlist.add(customer.id, productId);
  }

  @Delete(':productId')
  @ApiOkResponse({ type: SuccessResponseDto })
  remove(
    @CurrentCustomer() customer: { id: number },
    @Param('productId', ParseIntPipe) productId: number,
  ): Promise<SuccessResponseDto> {
    return this.wishlist.remove(customer.id, productId);
  }
}
