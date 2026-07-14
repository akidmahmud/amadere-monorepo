import { Controller, Get, Param, Patch, Body, Query, Res, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AdminJwtGuard } from '../../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../../common/auth/permission.guard';
import { RequirePermission } from '../../../common/auth/permission.decorator';
import { OverviewService } from './overview.service';
import { InventoryService } from './inventory.service';
import type { InventoryFilter } from './inventory.service';
import { ReturnedOrdersService } from './returned-orders.service';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { SetLowStockThresholdDto } from './dto/set-low-stock-threshold.dto';
import { SetHourlySlotDto } from './dto/set-hourly-slot.dto';

const RANGE_DAYS: Record<string, number> = { today: 1, '7d': 7, '30d': 30 };

@ApiTags('admin/net-profit/overview')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@Controller('admin/net-profit/overview')
export class AdminOverviewController {
  constructor(
    private readonly overview: OverviewService,
    private readonly inventory: InventoryService,
    private readonly returnedOrders: ReturnedOrdersService,
  ) {}

  @Get()
  @RequirePermission('net_profit_overview.view')
  async get(@Query('range') range?: string, @Query('from') fromParam?: string, @Query('to') toParam?: string) {
    const { from, to } = this.resolveRange(range, fromParam, toParam);
    const [kpis, revenueVsProfit, ordersByRisk, orderStatusBreakdown, hourlyPerformance] = await Promise.all([
      this.overview.kpis(from, to),
      this.overview.revenueVsProfit(from, to),
      this.overview.ordersByRisk(from, to),
      this.overview.orderStatusBreakdown(from, to),
      this.overview.hourlyPerformance(from, to),
    ]);
    return { from, to, kpis, revenueVsProfit, ordersByRisk, orderStatusBreakdown, hourlyPerformance };
  }

  @Get('hourly-slot')
  @RequirePermission('net_profit_overview.view')
  async getHourlySlot() {
    return { hourlySlotHours: await this.overview.getHourlySlotHours() };
  }

  @Patch('hourly-slot')
  @RequirePermission('net_profit_settings.manage')
  setHourlySlot(@Body() dto: SetHourlySlotDto) {
    return this.overview.setHourlySlotHours(dto.hourlySlotHours);
  }

  @Get('inventory')
  @RequirePermission('net_profit_overview.view')
  async inventoryList(
    @Query('filter') filter: InventoryFilter = 'all',
    @Query('search') search: string | undefined,
    @Query('stockMin') stockMin: string | undefined,
    @Query('stockMax') stockMax: string | undefined,
    @Query() { page, pageSize }: PaginationQueryDto,
  ) {
    const [list, threshold, counts] = await Promise.all([
      this.inventory.list({
        filter,
        search,
        stockMin: stockMin !== undefined ? Number(stockMin) : undefined,
        stockMax: stockMax !== undefined ? Number(stockMax) : undefined,
        page: page ?? 1,
        pageSize: pageSize ?? 50,
      }),
      this.inventory.getThreshold(),
      this.inventory.counts(),
    ]);
    return { ...list, lowStockThreshold: threshold, counts };
  }

  @Get('inventory/export')
  @RequirePermission('net_profit_overview.view')
  async inventoryExport(@Query('filter') filter: InventoryFilter = 'all', @Res() res: Response) {
    const csv = await this.inventory.exportCsv(filter);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="inventory.csv"');
    res.send(csv);
  }

  @Patch('inventory/threshold')
  @RequirePermission('net_profit_settings.manage')
  setThreshold(@Body() dto: SetLowStockThresholdDto) {
    return this.inventory.setThreshold(dto.lowStockThreshold);
  }

  @Get('returned')
  @RequirePermission('net_profit_overview.view')
  async returned(@Query('range') range?: string, @Query('from') fromParam?: string, @Query('to') toParam?: string) {
    const { from, to } = this.resolveRange(range, fromParam, toParam);
    const [summary, trend, byCourier, topReasons, byProduct, byArea] = await Promise.all([
      this.returnedOrders.summary(from, to),
      this.returnedOrders.trend(from, to),
      this.returnedOrders.byCourier(from, to),
      this.returnedOrders.topReasons(from, to),
      this.returnedOrders.byProduct(from, to),
      this.returnedOrders.byArea(from, to),
    ]);
    return { from, to, summary, trend, byCourier, topReasons, byProduct, byArea };
  }

  @Get('returned/orders')
  @RequirePermission('net_profit_overview.view')
  async returnedOrdersList(
    @Query('range') range: string | undefined,
    @Query('from') fromParam: string | undefined,
    @Query('to') toParam: string | undefined,
    @Query() { page, pageSize }: PaginationQueryDto,
  ) {
    const { from, to } = this.resolveRange(range, fromParam, toParam);
    return this.returnedOrders.returnedOrdersList(from, to, page ?? 1, pageSize ?? 20);
  }

  @Get('returned/export')
  @RequirePermission('net_profit_overview.view')
  async returnedExport(@Query('range') range: string | undefined, @Query('from') fromParam: string | undefined, @Query('to') toParam: string | undefined, @Res() res: Response) {
    const { from, to } = this.resolveRange(range, fromParam, toParam);
    const csv = await this.returnedOrders.exportCsv(from, to);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="returned-orders.csv"');
    res.send(csv);
  }

  private resolveRange(range: string | undefined, fromParam?: string, toParam?: string): { from: Date; to: Date } {
    if (fromParam && toParam) {
      return { from: new Date(fromParam), to: new Date(toParam) };
    }
    const days = RANGE_DAYS[range ?? '7d'] ?? 7;
    const to = new Date();
    const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
    return { from, to };
  }
}
