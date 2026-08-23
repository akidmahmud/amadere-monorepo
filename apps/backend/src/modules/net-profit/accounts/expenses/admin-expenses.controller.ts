import {
  Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../../../common/auth/permission.guard';
import { RequirePermission } from '../../../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../../../common/audit-log/audit-log.interceptor';
import { CurrentAdmin } from '../../../../common/auth/current-admin.decorator';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ExpenseQueryDto } from './dto/expense-query.dto';
import { RecordExpensePaymentDto } from './dto/record-expense-payment.dto';

// There is deliberately no DELETE route. Hard-deleting a voucher that has
// ledger entries against it makes the books unreconcilable; POST :id/void
// writes reversing entries and keeps the trail.
@ApiTags('admin/net-profit/accounts')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/net-profit/accounts/expenses')
export class AdminExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get()
  @RequirePermission('net_profit_accounts.view')
  list(@Query() query: ExpenseQueryDto) {
    return this.expenses.list(query);
  }

  @Get(':id')
  @RequirePermission('net_profit_accounts.view')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.expenses.findOne(id);
  }

  @Post()
  @RequirePermission('net_profit_accounts.manage')
  create(@Body() dto: CreateExpenseDto, @CurrentAdmin() admin: { id: number }) {
    return this.expenses.create(dto, admin.id);
  }

  @Put(':id')
  @RequirePermission('net_profit_accounts.manage')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateExpenseDto) {
    return this.expenses.update(id, dto);
  }

  @Post(':id/payments')
  @RequirePermission('net_profit_accounts.manage')
  recordPayment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RecordExpensePaymentDto,
    @CurrentAdmin() admin: { id: number },
  ) {
    return this.expenses.recordPayment(id, dto, admin.id);
  }

  @Post(':id/void')
  @RequirePermission('net_profit_accounts.manage')
  void(@Param('id', ParseIntPipe) id: number, @CurrentAdmin() admin: { id: number }) {
    return this.expenses.void(id, admin.id);
  }
}
