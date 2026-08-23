import { Body, Controller, Get, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CourierProviderName } from '@amader/db';
import { AdminJwtGuard } from '../../../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../../../common/auth/permission.guard';
import { RequirePermission } from '../../../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../../../common/audit-log/audit-log.interceptor';
import { CurrentAdmin } from '../../../../common/auth/current-admin.decorator';
import { CodSettlementService } from './cod-settlement.service';
import { CreateSettlementDto } from './dto/create-settlement.dto';

@ApiTags('admin/net-profit/accounts')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/net-profit/accounts/cod')
export class AdminCodController {
  constructor(private readonly cod: CodSettlementService) {}

  @Get('pending')
  @RequirePermission('net_profit_accounts.view')
  pending(@Query('provider') provider?: CourierProviderName) {
    return this.cod.pending(provider);
  }

  @Post('settlements')
  @RequirePermission('net_profit_accounts.manage')
  settle(@Body() dto: CreateSettlementDto, @CurrentAdmin() admin: { id: number }) {
    return this.cod.settle(dto, admin.id);
  }
}
