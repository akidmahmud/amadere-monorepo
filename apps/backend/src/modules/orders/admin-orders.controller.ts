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
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { CurrentAdmin } from '../../common/auth/current-admin.decorator';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { OrdersService } from './orders.service';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { RefundOrderDto } from './dto/refund-order.dto';

@ApiTags('admin/orders')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  @RequirePermission('order.view')
  @ApiQuery({ name: 'status', required: false })
  list(
    @Query() { page, pageSize }: PaginationQueryDto,
    @Query('status') status?: string,
  ) {
    return this.orders.adminList(page ?? 1, pageSize ?? 20, status);
  }

  @Get(':id')
  @RequirePermission('order.view')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.orders.adminGet(id);
  }

  @Patch(':id/status')
  @RequirePermission('order.update')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentAdmin() admin: { id: number },
  ) {
    return this.orders.updateStatus(id, dto, admin.id);
  }

  @Post(':id/refund')
  @RequirePermission('order.refund')
  refund(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RefundOrderDto,
    @CurrentAdmin() admin: { id: number },
  ) {
    return this.orders.refund(id, dto, admin.id);
  }
}
