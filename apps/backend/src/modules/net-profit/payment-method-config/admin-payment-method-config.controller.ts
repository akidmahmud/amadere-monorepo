import { Body, Controller, Get, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../../common/auth/permission.guard';
import { RequirePermission } from '../../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../../common/audit-log/audit-log.interceptor';
import { PaymentMethodConfigService } from './payment-method-config.service';
import { UpsertPaymentMethodConfigDto } from './dto/upsert-payment-method-config.dto';

@ApiTags('admin/net-profit/payment-methods')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/net-profit/payment-methods')
export class AdminPaymentMethodConfigController {
  constructor(private readonly config: PaymentMethodConfigService) {}

  @Get()
  @RequirePermission('net_profit_settings.manage')
  list() {
    return this.config.list();
  }

  @Post()
  @RequirePermission('net_profit_settings.manage')
  upsert(@Body() dto: UpsertPaymentMethodConfigDto) {
    return this.config.upsert(dto);
  }
}
