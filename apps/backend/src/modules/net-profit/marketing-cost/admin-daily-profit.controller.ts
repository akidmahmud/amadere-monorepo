import { Body, Controller, Get, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../../common/auth/permission.guard';
import { RequirePermission } from '../../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../../common/audit-log/audit-log.interceptor';
import { DailyProfitCacheService } from './daily-profit-cache.service';
import { RecomputeDailyProfitDto } from './dto/recompute-daily-profit.dto';

@ApiTags('admin/net-profit/daily-profit')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/net-profit/daily-profit')
export class AdminDailyProfitController {
  constructor(private readonly dailyProfitCache: DailyProfitCacheService) {}

  @Get()
  @RequirePermission('net_profit_profit.view')
  list(@Query('from') from: string, @Query('to') to: string) {
    return this.dailyProfitCache.list(new Date(from), new Date(to));
  }

  @Post('recompute')
  @RequirePermission('net_profit_profit.manage')
  recompute(@Body() dto: RecomputeDailyProfitDto) {
    return this.dailyProfitCache.recomputeRange(new Date(dto.from), new Date(dto.to ?? dto.from));
  }
}
