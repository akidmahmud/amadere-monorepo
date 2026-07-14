import { Body, Controller, Get, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../../common/auth/permission.guard';
import { RequirePermission } from '../../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../../common/audit-log/audit-log.interceptor';
import { CurrentAdmin } from '../../../common/auth/current-admin.decorator';
import { OrderManagerService } from './order-manager.service';
import { OrderManagerQueryDto } from './dto/order-manager-query.dto';
import { BulkOrderActionDto } from './dto/bulk-order-action.dto';

@ApiTags('admin/net-profit/orders')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/net-profit/orders')
export class AdminOrderManagerController {
  constructor(private readonly orderManager: OrderManagerService) {}

  @Get()
  @RequirePermission('net_profit_orders.view')
  list(@Query() query: OrderManagerQueryDto) {
    return this.orderManager.list(query);
  }

  @Post('bulk')
  @RequirePermission('net_profit_orders.manage')
  bulk(@Body() dto: BulkOrderActionDto, @CurrentAdmin() admin: { id: number }) {
    return this.orderManager.bulkAction(dto, admin.id);
  }
}
