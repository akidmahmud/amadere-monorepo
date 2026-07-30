import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PaginatedResult } from '@amader/shared';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { CurrentAdmin } from '../../common/auth/current-admin.decorator';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ApiPaginatedResponse } from '../../common/dto/paginated-response.dto';
import { OrdersService } from './orders.service';
import { AdminOrderCreationService } from './admin-order-creation.service';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { RefundOrderDto } from './dto/refund-order.dto';
import { CreateManualOrderDto } from './dto/create-manual-order.dto';
import { AddOrderItemDto } from './dto/add-order-item.dto';
import { UpdateOrderItemDto } from './dto/update-order-item.dto';
import { UpdateOrderDetailsDto } from './dto/update-order-details.dto';
import { UpdateOrderPaymentDto } from './dto/update-order-payment.dto';
import { UpdateOrderAmountsDto } from './dto/update-order-amounts.dto';
import { OrderDto } from './orders.mapper';

@ApiTags('admin/orders')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly orderCreation: AdminOrderCreationService,
  ) {}

  @Get()
  @RequirePermission('order.view')
  @ApiQuery({ name: 'status', required: false })
  @ApiPaginatedResponse(OrderDto)
  list(
    @Query() { page, pageSize }: PaginationQueryDto,
    @Query('status') status?: string,
  ): Promise<PaginatedResult<OrderDto>> {
    return this.orders.adminList(page ?? 1, pageSize ?? 20, status);
  }

  @Post()
  @RequirePermission('order.create')
  @ApiOkResponse({ type: OrderDto })
  create(
    @Body() dto: CreateManualOrderDto,
    @CurrentAdmin() admin: { id: number },
  ): Promise<OrderDto> {
    return this.orderCreation.create(dto, admin.id);
  }

  @Get(':id')
  @RequirePermission('order.view')
  @ApiOkResponse({ type: OrderDto })
  get(@Param('id', ParseIntPipe) id: number): Promise<OrderDto> {
    return this.orders.adminGet(id);
  }

  @Patch(':id/status')
  @RequirePermission('order.update')
  @ApiOkResponse({ type: OrderDto })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentAdmin() admin: { id: number },
  ): Promise<OrderDto> {
    return this.orders.updateStatus(id, dto, admin.id);
  }

  @Post(':id/refund')
  @RequirePermission('order.refund')
  @ApiOkResponse({ type: OrderDto })
  refund(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RefundOrderDto,
    @CurrentAdmin() admin: { id: number },
  ): Promise<OrderDto> {
    return this.orders.refund(id, dto, admin.id);
  }

  @Post(':id/items')
  @RequirePermission('order.update')
  @ApiOkResponse({ type: OrderDto })
  addItem(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddOrderItemDto,
  ): Promise<OrderDto> {
    return this.orders.addItem(id, dto);
  }

  @Patch(':id/items/:itemId')
  @RequirePermission('order.update')
  @ApiOkResponse({ type: OrderDto })
  updateItem(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: UpdateOrderItemDto,
  ): Promise<OrderDto> {
    return this.orders.updateItemQuantity(id, itemId, dto);
  }

  @Delete(':id/items/:itemId')
  @RequirePermission('order.update')
  @ApiOkResponse({ type: OrderDto })
  removeItem(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
  ): Promise<OrderDto> {
    return this.orders.removeItem(id, itemId);
  }

  @Patch(':id/details')
  @RequirePermission('order.update')
  @ApiOkResponse({ type: OrderDto })
  updateDetails(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderDetailsDto,
  ): Promise<OrderDto> {
    return this.orders.updateDetails(id, dto);
  }

  @Patch(':id/payment')
  @RequirePermission('order.update')
  @ApiOkResponse({ type: OrderDto })
  updatePayment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderPaymentDto,
  ): Promise<OrderDto> {
    return this.orders.updatePayment(id, dto);
  }

  @Patch(':id/amounts')
  @RequirePermission('order.update')
  @ApiOkResponse({ type: OrderDto })
  updateAmounts(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderAmountsDto,
  ): Promise<OrderDto> {
    return this.orders.updateAmounts(id, dto);
  }

  @Post(':id/resend-confirmation')
  @RequirePermission('order.update')
  resendConfirmation(
    @Param('id', ParseIntPipe) id: number,
    @CurrentAdmin() admin: { id: number },
  ): Promise<{ sent: boolean; reason?: string }> {
    return this.orders.sendConfirmationEmail(id, admin.id);
  }

  @Post(':id/reorder')
  @RequirePermission('order.create')
  @ApiOkResponse({ type: OrderDto })
  reorder(
    @Param('id', ParseIntPipe) id: number,
    @CurrentAdmin() admin: { id: number },
  ): Promise<OrderDto> {
    return this.orderCreation.reorder(id, admin.id);
  }
}
