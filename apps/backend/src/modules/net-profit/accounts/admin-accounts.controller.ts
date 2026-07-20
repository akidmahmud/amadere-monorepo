import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, Res, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AdminJwtGuard } from '../../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../../common/auth/permission.guard';
import { RequirePermission } from '../../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../../common/audit-log/audit-log.interceptor';
import { CurrentAdmin } from '../../../common/auth/current-admin.decorator';
import { AccountsService, VatSettings } from './accounts.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ExpenseQueryDto } from './dto/expense-query.dto';
import { CreateDueDto } from './dto/create-due.dto';
import { RecordDuePaymentDto } from './dto/record-due-payment.dto';
import { DueQueryDto } from './dto/due-query.dto';

@ApiTags('admin/net-profit/accounts')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/net-profit/accounts')
export class AdminAccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get('overview')
  @RequirePermission('net_profit_accounts.view')
  overview(@Query('from') from?: string, @Query('to') to?: string) {
    return this.accounts.overview(from, to);
  }

  @Get('expenses')
  @RequirePermission('net_profit_accounts.view')
  listExpenses(@Query() query: ExpenseQueryDto) {
    return this.accounts.listExpenses(query);
  }

  @Post('expenses')
  @RequirePermission('net_profit_accounts.manage')
  createExpense(@Body() dto: CreateExpenseDto, @CurrentAdmin() admin: { id: number }) {
    return this.accounts.createExpense(dto, admin.id);
  }

  @Put('expenses/:id')
  @RequirePermission('net_profit_accounts.manage')
  updateExpense(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateExpenseDto) {
    return this.accounts.updateExpense(id, dto);
  }

  @Delete('expenses/:id')
  @RequirePermission('net_profit_accounts.manage')
  deleteExpense(@Param('id', ParseIntPipe) id: number) {
    return this.accounts.deleteExpense(id);
  }

  @Get('dues')
  @RequirePermission('net_profit_accounts.view')
  listDues(@Query() query: DueQueryDto) {
    return this.accounts.listDues(query);
  }

  @Post('dues')
  @RequirePermission('net_profit_accounts.manage')
  createDue(@Body() dto: CreateDueDto, @CurrentAdmin() admin: { id: number }) {
    return this.accounts.createDue(dto, admin.id);
  }

  @Post('dues/:id/payments')
  @RequirePermission('net_profit_accounts.manage')
  recordDuePayment(@Param('id', ParseIntPipe) id: number, @Body() dto: RecordDuePaymentDto) {
    return this.accounts.recordDuePayment(id, dto.amount);
  }

  @Delete('dues/:id')
  @RequirePermission('net_profit_accounts.manage')
  deleteDue(@Param('id', ParseIntPipe) id: number) {
    return this.accounts.deleteDue(id);
  }

  @Get('vat-settings')
  @RequirePermission('net_profit_accounts.view')
  getVatSettings() {
    return this.accounts.getVatSettings();
  }

  @Put('vat-settings')
  @RequirePermission('net_profit_accounts.manage')
  updateVatSettings(@Body() dto: Partial<VatSettings>) {
    return this.accounts.updateVatSettings(dto);
  }

  @Get('vat-summary')
  @RequirePermission('net_profit_accounts.view')
  vatSummary(@Query('from') from?: string, @Query('to') to?: string) {
    return this.accounts.vatSummary(from, to);
  }

  @Get('cash-flow')
  @RequirePermission('net_profit_accounts.view')
  cashFlow(@Query('from') from?: string, @Query('to') to?: string) {
    return this.accounts.cashFlow(from, to);
  }

  @Get('export/:kind')
  @RequirePermission('net_profit_accounts.view')
  async export(
    @Param('kind') kind: 'expenses' | 'dues' | 'cashflow',
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Res() res: Response,
  ) {
    const buffer = await this.accounts.exportExcel(kind, from, to);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${kind}.xlsx"`);
    res.send(buffer);
  }
}
