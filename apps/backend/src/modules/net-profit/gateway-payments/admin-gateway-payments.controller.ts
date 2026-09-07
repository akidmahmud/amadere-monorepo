import { Controller, Get, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PaymentProvider, PaymentStatus } from '@amader/db';
import { AdminJwtGuard } from '../../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../../common/auth/permission.guard';
import { RequirePermission } from '../../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../../common/audit-log/audit-log.interceptor';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { GatewayPaymentsService } from './gateway-payments.service';
import { GatewayPaymentDto } from './gateway-payments.mapper';

// Reuses net_profit_payments.verify rather than minting a key of its own:
// this sits on the same Net Profit > Payments screen as the manual-payment
// queue and is the same job (checking money actually arrived). A role that
// could see one but not the other would be a distinction nobody asked for.
@ApiTags('admin/net-profit/gateway-payments')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/net-profit/payments/gateway')
export class AdminGatewayPaymentsController {
  constructor(private readonly payments: GatewayPaymentsService) {}

  @Get()
  @RequirePermission('net_profit_payments.verify')
  @ApiOkResponse({ type: [GatewayPaymentDto] })
  list(
    @Query() { page, pageSize }: PaginationQueryDto,
    @Query('provider') provider?: PaymentProvider,
    @Query('status') status?: PaymentStatus,
    @Query('q') q?: string,
  ) {
    return this.payments.list(page ?? 1, pageSize ?? 20, { provider, status, q });
  }
}
