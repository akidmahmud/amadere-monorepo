import {
  Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../../../common/auth/permission.guard';
import { RequirePermission } from '../../../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../../../common/audit-log/audit-log.interceptor';
import { CurrentAdmin } from '../../../../common/auth/current-admin.decorator';
import { MastersService } from './masters.service';
import { CreateMasterDto } from './dto/create-master.dto';
import { LockPeriodDto } from './dto/lock-period.dto';

@ApiTags('admin/net-profit/accounts')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/net-profit/accounts/masters')
export class AdminMastersController {
  constructor(private readonly masters: MastersService) {}

  // --- Expense categories -------------------------------------------------
  // No delete route on either lookup: a voucher references its category and
  // must keep doing so. Set isActive:false to retire one.

  @Get('expense-categories')
  @RequirePermission('net_profit_accounts.view')
  listCategories(@Query('includeInactive') includeInactive?: string) {
    return this.masters.listCategories(includeInactive === 'true');
  }

  @Post('expense-categories')
  @RequirePermission('net_profit_accounts.manage')
  createCategory(@Body() dto: CreateMasterDto) {
    return this.masters.createCategory(dto);
  }

  @Put('expense-categories/:id')
  @RequirePermission('net_profit_accounts.manage')
  updateCategory(@Param('id', ParseIntPipe) id: number, @Body() dto: Partial<CreateMasterDto>) {
    return this.masters.updateCategory(id, dto);
  }

  // --- Cost centres -------------------------------------------------------

  @Get('cost-centres')
  @RequirePermission('net_profit_accounts.view')
  listCostCentres(@Query('includeInactive') includeInactive?: string) {
    return this.masters.listCostCentres(includeInactive === 'true');
  }

  @Post('cost-centres')
  @RequirePermission('net_profit_accounts.manage')
  createCostCentre(@Body() dto: CreateMasterDto) {
    return this.masters.createCostCentre(dto);
  }

  @Put('cost-centres/:id')
  @RequirePermission('net_profit_accounts.manage')
  updateCostCentre(@Param('id', ParseIntPipe) id: number, @Body() dto: Partial<CreateMasterDto>) {
    return this.masters.updateCostCentre(id, dto);
  }

  // --- Period locks -------------------------------------------------------
  // Once a VAT return is filed for a month, that month must stop changing.

  @Get('period-locks')
  @RequirePermission('net_profit_accounts.view')
  listPeriodLocks() {
    return this.masters.listPeriodLocks();
  }

  @Post('period-locks')
  @RequirePermission('net_profit_accounts.manage')
  lockPeriod(@Body() dto: LockPeriodDto, @CurrentAdmin() admin: { id: number }) {
    return this.masters.lockPeriod(dto.month, admin.id, dto.note);
  }

  @Delete('period-locks/:month')
  @RequirePermission('net_profit_accounts.manage')
  unlockPeriod(@Param('month') month: string) {
    return this.masters.unlockPeriod(month);
  }
}
