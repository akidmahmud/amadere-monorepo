import {
  Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DueKind } from '@amader/db';
import { AdminJwtGuard } from '../../../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../../../common/auth/permission.guard';
import { RequirePermission } from '../../../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../../../common/audit-log/audit-log.interceptor';
import { CurrentAdmin } from '../../../../common/auth/current-admin.decorator';
import { DuesService } from './dues.service';
import { CreateDueDto } from './dto/create-due.dto';
import { DueQueryDto } from './dto/due-query.dto';
import { RecordDuePaymentDto } from './dto/record-due-payment.dto';

// No DELETE route, for the same reason as expenses: POST :id/void writes
// reversing entries instead of destroying the trail.
@ApiTags('admin/net-profit/accounts')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/net-profit/accounts/dues')
export class AdminDuesController {
  constructor(private readonly dues: DuesService) {}

  @Get()
  @RequirePermission('net_profit_accounts.view')
  list(@Query() query: DueQueryDto) {
    return this.dues.list(query);
  }

  // Declared before ':id' so "ageing" is not parsed as an id.
  @Get('ageing')
  @RequirePermission('net_profit_accounts.view')
  ageing(@Query('kind') kind: DueKind, @Query('asOf') asOf?: string) {
    return this.dues.ageing(kind ?? 'RECEIVABLE', asOf ? new Date(asOf) : undefined);
  }

  @Get(':id')
  @RequirePermission('net_profit_accounts.view')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.dues.findOne(id);
  }

  @Post()
  @RequirePermission('net_profit_accounts.manage')
  create(@Body() dto: CreateDueDto, @CurrentAdmin() admin: { id: number }) {
    return this.dues.create(dto, admin.id);
  }

  @Post(':id/payments')
  @RequirePermission('net_profit_accounts.manage')
  recordPayment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RecordDuePaymentDto,
    @CurrentAdmin() admin: { id: number },
  ) {
    return this.dues.recordPayment(id, dto, admin.id);
  }

  @Post(':id/void')
  @RequirePermission('net_profit_accounts.manage')
  void(@Param('id', ParseIntPipe) id: number, @CurrentAdmin() admin: { id: number }) {
    return this.dues.void(id, admin.id);
  }
}
