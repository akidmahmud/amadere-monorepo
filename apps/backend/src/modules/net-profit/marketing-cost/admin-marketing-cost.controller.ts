import { Body, Controller, Get, Param, Put, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../../common/auth/permission.guard';
import { RequirePermission } from '../../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../../common/audit-log/audit-log.interceptor';
import { MarketingCostService } from './marketing-cost.service';
import { DailyProfitCacheService } from './daily-profit-cache.service';
import { SetMarketingCostDto } from './dto/set-marketing-cost.dto';

@ApiTags('admin/net-profit/marketing-cost')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/net-profit/marketing-cost')
export class AdminMarketingCostController {
  constructor(
    private readonly marketingCost: MarketingCostService,
    private readonly dailyProfitCache: DailyProfitCacheService,
  ) {}

  @Get()
  @RequirePermission('net_profit_profit.view')
  list(@Query('from') from: string, @Query('to') to: string) {
    return this.marketingCost.list(new Date(from), new Date(to));
  }

  @Put(':date')
  @RequirePermission('net_profit_profit.manage')
  async set(@Param('date') date: string, @Body() dto: SetMarketingCostDto) {
    const row = await this.marketingCost.upsert(new Date(date), dto.adsCost, dto.otherCost, dto.note);
    await this.dailyProfitCache.recomputeForDate(new Date(date));
    return row;
  }
}
