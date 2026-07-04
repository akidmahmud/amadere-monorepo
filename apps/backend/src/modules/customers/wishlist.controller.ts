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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CustomerJwtGuard } from '../../common/auth/customer-jwt.guard';
import { CurrentCustomer } from '../../common/auth/current-customer.decorator';
import { LocaleQueryDto } from '../../common/dto/locale-query.dto';
import { WishlistService } from './wishlist.service';

@ApiTags('customers')
@ApiBearerAuth()
@UseGuards(CustomerJwtGuard)
@Controller('customers/me/wishlist')
export class WishlistController {
  constructor(private readonly wishlist: WishlistService) {}

  @Get()
  list(
    @CurrentCustomer() customer: { id: number },
    @Query() { locale }: LocaleQueryDto,
  ) {
    return this.wishlist.list(customer.id, locale ?? 'EN');
  }

  @Post(':productId')
  add(
    @CurrentCustomer() customer: { id: number },
    @Param('productId', ParseIntPipe) productId: number,
  ) {
    return this.wishlist.add(customer.id, productId);
  }

  @Delete(':productId')
  remove(
    @CurrentCustomer() customer: { id: number },
    @Param('productId', ParseIntPipe) productId: number,
  ) {
    return this.wishlist.remove(customer.id, productId);
  }
}
