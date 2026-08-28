import { Body, Controller, Get, Param, ParseIntPipe, Put, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../../../common/auth/permission.guard';
import { RequirePermission } from '../../../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../../../common/audit-log/audit-log.interceptor';
import { VatService } from './vat.service';
import { SetVatExceptionDto } from './dto/set-vat-exception.dto';

@ApiTags('admin/net-profit/accounts')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/net-profit/accounts/vat')
export class AdminVatController {
  constructor(private readonly vat: VatService) {}

  @Get('return')
  @RequirePermission('net_profit_accounts.view')
  vatReturn(@Query('from') from?: string, @Query('to') to?: string) {
    return this.vat.vatReturn(from, to);
  }

  @Get('at-risk')
  @RequirePermission('net_profit_accounts.view')
  atRisk(@Query('from') from?: string, @Query('to') to?: string) {
    return this.vat.atRisk(from, to);
  }

  @Get('exceptions')
  @RequirePermission('net_profit_accounts.view')
  exceptions() {
    return this.vat.listExceptions();
  }

  // PUT with a nullable rate rather than PUT + DELETE: "back to the store
  // rate" and "zero-rated" are different outcomes and both are edits of the
  // same field, so one idempotent endpoint covers it without a second route
  // whose only job is to write null.
  @Put('exceptions/:productId')
  @RequirePermission('net_profit_accounts.manage')
  setException(
    @Param('productId', ParseIntPipe) productId: number,
    @Body() dto: SetVatExceptionDto,
  ) {
    return this.vat.setException(productId, dto.ratePercent);
  }
}
