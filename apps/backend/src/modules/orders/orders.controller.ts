import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PaginatedResult } from '@amader/shared';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CustomerJwtGuard } from '../../common/auth/customer-jwt.guard';
import { CurrentCustomer } from '../../common/auth/current-customer.decorator';
import { ApiPaginatedResponse } from '../../common/dto/paginated-response.dto';
import { OrdersService } from './orders.service';
import { TrackOrderDto } from './dto/track-order.dto';
import { OrderDto } from './orders.mapper';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post('track')
  @ApiOkResponse({ type: OrderDto })
  track(@Body() dto: TrackOrderDto): Promise<OrderDto> {
    return this.orders.track(dto);
  }

  @ApiBearerAuth()
  @UseGuards(CustomerJwtGuard)
  @Get()
  @ApiPaginatedResponse(OrderDto)
  myList(
    @CurrentCustomer() customer: { id: number },
    @Query() { page, pageSize }: PaginationQueryDto,
  ): Promise<PaginatedResult<OrderDto>> {
    return this.orders.myList(customer.id, page ?? 1, pageSize ?? 20);
  }

  @ApiBearerAuth()
  @UseGuards(CustomerJwtGuard)
  @Get(':orderNumber')
  @ApiOkResponse({ type: OrderDto })
  myGet(
    @CurrentCustomer() customer: { id: number },
    @Param('orderNumber') orderNumber: string,
  ): Promise<OrderDto> {
    return this.orders.myGet(customer.id, orderNumber);
  }
}
