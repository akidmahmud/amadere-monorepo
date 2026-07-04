import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CustomerJwtGuard } from '../../common/auth/customer-jwt.guard';
import { CurrentCustomer } from '../../common/auth/current-customer.decorator';
import { OrdersService } from './orders.service';
import { TrackOrderDto } from './dto/track-order.dto';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post('track')
  track(@Body() dto: TrackOrderDto) {
    return this.orders.track(dto);
  }

  @ApiBearerAuth()
  @UseGuards(CustomerJwtGuard)
  @Get()
  myList(
    @CurrentCustomer() customer: { id: number },
    @Query() { page, pageSize }: PaginationQueryDto,
  ) {
    return this.orders.myList(customer.id, page ?? 1, pageSize ?? 20);
  }

  @ApiBearerAuth()
  @UseGuards(CustomerJwtGuard)
  @Get(':orderNumber')
  myGet(
    @CurrentCustomer() customer: { id: number },
    @Param('orderNumber') orderNumber: string,
  ) {
    return this.orders.myGet(customer.id, orderNumber);
  }
}
