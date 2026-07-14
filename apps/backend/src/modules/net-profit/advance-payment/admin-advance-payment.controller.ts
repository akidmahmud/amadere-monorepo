import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdvanceStatus, Prisma } from '@amader/db';
import { AdminJwtGuard } from '../../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../../common/auth/permission.guard';
import { RequirePermission } from '../../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../../common/audit-log/audit-log.interceptor';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { AdvancePaymentService } from './advance-payment.service';
import { RequireAdvanceDto } from './dto/require-advance.dto';
import { RecordAdvanceDto } from './dto/record-advance.dto';

@ApiTags('admin/net-profit/advance-payment')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/net-profit/advance')
export class AdminAdvancePaymentController {
  constructor(private readonly advance: AdvancePaymentService) {}

  @Get()
  @RequirePermission('net_profit_advance.manage')
  list(@Query() { page, pageSize }: PaginationQueryDto, @Query('status') status?: AdvanceStatus) {
    return this.advance.list(page ?? 1, pageSize ?? 20, status);
  }

  @Get(':orderId')
  @RequirePermission('net_profit_advance.manage')
  get(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.advance.get(orderId);
  }

  @Post(':orderId/require')
  @RequirePermission('net_profit_advance.manage')
  require(@Param('orderId', ParseIntPipe) orderId: number, @Body() dto: RequireAdvanceDto) {
    return this.advance.require(orderId, new Prisma.Decimal(dto.required), dto.reason ?? 'manual');
  }

  @Post(':orderId/record')
  @RequirePermission('net_profit_advance.manage')
  record(@Param('orderId', ParseIntPipe) orderId: number, @Body() dto: RecordAdvanceDto) {
    return this.advance.record(orderId, new Prisma.Decimal(dto.amount));
  }

  @Post(':orderId/waive')
  @RequirePermission('net_profit_advance.manage')
  waive(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.advance.waive(orderId);
  }
}
