import {
  Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../../../common/auth/permission.guard';
import { RequirePermission } from '../../../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../../../common/audit-log/audit-log.interceptor';
import { CurrentAdmin } from '../../../../common/auth/current-admin.decorator';
import { CashAccountsService } from './cash-accounts.service';
import { CreateCashAccountDto } from './dto/create-cash-account.dto';
import { UpdateCashAccountDto } from './dto/update-cash-account.dto';
import { CreateTransferDto } from './dto/create-transfer.dto';

@ApiTags('admin/net-profit/accounts')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/net-profit/accounts/cash-accounts')
export class AdminCashAccountsController {
  constructor(private readonly accounts: CashAccountsService) {}

  @Get()
  @RequirePermission('net_profit_accounts.view')
  list(@Query('includeInactive') includeInactive?: string) {
    return this.accounts.list(includeInactive === 'true');
  }

  // Declared before ':id/ledger' would shadow it — Nest matches in order, and
  // 'transfers' would otherwise be parsed as an :id.
  @Post('transfers')
  @RequirePermission('net_profit_accounts.manage')
  transfer(@Body() dto: CreateTransferDto, @CurrentAdmin() admin: { id: number }) {
    return this.accounts.transfer(dto, admin.id);
  }

  @Get(':id/ledger')
  @RequirePermission('net_profit_accounts.view')
  ledger(
    @Param('id', ParseIntPipe) id: number,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.accounts.ledger(id, from, to);
  }

  @Post()
  @RequirePermission('net_profit_accounts.manage')
  create(@Body() dto: CreateCashAccountDto) {
    return this.accounts.create(dto);
  }

  @Put(':id')
  @RequirePermission('net_profit_accounts.manage')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCashAccountDto) {
    return this.accounts.update(id, dto);
  }
}
