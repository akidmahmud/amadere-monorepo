import { Body, Controller, Get, Param, Put, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { OrderStatus } from '@amader/db';
import { AdminJwtGuard } from '../../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../../common/auth/permission.guard';
import { RequirePermission } from '../../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../../common/audit-log/audit-log.interceptor';
import { OrderStatusesService } from './order-statuses.service';

@ApiTags('admin/net-profit/order-statuses')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/net-profit/order-statuses')
export class AdminOrderStatusesController {
  constructor(private readonly orderStatuses: OrderStatusesService) {}

  @Get()
  @RequirePermission('net_profit_orders.view')
  list() {
    return this.orderStatuses.list();
  }

  @Put(':status')
  @RequirePermission('net_profit_orders.manage')
  update(
    @Param('status') status: OrderStatus,
    @Body() dto: { labelEn?: string; labelBn?: string; color?: string; sortOrder?: number },
  ) {
    return this.orderStatuses.update(status, dto);
  }
}
