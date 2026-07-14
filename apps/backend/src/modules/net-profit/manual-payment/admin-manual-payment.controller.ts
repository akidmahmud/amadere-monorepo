import { Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ManualPayStatus } from '@amader/db';
import { AdminJwtGuard } from '../../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../../common/auth/permission.guard';
import { RequirePermission } from '../../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../../common/audit-log/audit-log.interceptor';
import { CurrentAdmin } from '../../../common/auth/current-admin.decorator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { ManualPaymentService } from './manual-payment.service';

@ApiTags('admin/net-profit/manual-payment')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/net-profit/payments/manual')
export class AdminManualPaymentController {
  constructor(private readonly manualPayment: ManualPaymentService) {}

  @Get()
  @RequirePermission('net_profit_payments.verify')
  list(@Query() { page, pageSize }: PaginationQueryDto, @Query('status') status?: ManualPayStatus) {
    return this.manualPayment.list(page ?? 1, pageSize ?? 20, status);
  }

  @Post(':id/verify')
  @RequirePermission('net_profit_payments.verify')
  verify(@Param('id', ParseIntPipe) id: number, @CurrentAdmin() admin: { id: number }) {
    return this.manualPayment.verify(id, admin.id);
  }

  @Post(':id/reject')
  @RequirePermission('net_profit_payments.verify')
  reject(@Param('id', ParseIntPipe) id: number, @CurrentAdmin() admin: { id: number }) {
    return this.manualPayment.reject(id, admin.id);
  }
}
