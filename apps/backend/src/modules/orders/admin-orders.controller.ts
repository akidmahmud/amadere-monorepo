import {
  Body,
  Controller,
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
}
