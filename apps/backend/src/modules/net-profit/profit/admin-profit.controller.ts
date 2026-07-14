import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@amader/db';
import { AdminJwtGuard } from '../../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../../common/auth/permission.guard';
import { RequirePermission } from '../../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../../common/audit-log/audit-log.interceptor';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { ProfitService, FallbackProfitSettings } from './profit.service';
import { SetAdSpendDto } from './dto/set-ad-spend.dto';
import { SetProductCostDto } from './dto/set-product-cost.dto';
import { BulkSetProductCostDto } from './dto/bulk-set-product-cost.dto';

@ApiTags('admin/net-profit/profit')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/net-profit/profit')
export class AdminProfitController {
  constructor(private readonly profit: ProfitService) {}

  @Get('report')
  @RequirePermission('net_profit_profit.view')
  report(@Query('from') from?: string, @Query('to') to?: string) {
    return this.profit.report(from ? new Date(from) : undefined, to ? new Date(to) : undefined);
  }

  @Get('orders')
  @RequirePermission('net_profit_profit.view')
  list(@Query() { page, pageSize }: PaginationQueryDto) {
    return this.profit.list(page ?? 1, pageSize ?? 20);
  }

  @Get('orders/:orderId')
  @RequirePermission('net_profit_profit.view')
  get(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.profit.getForOrder(orderId);
  }

  @Post('orders/:orderId/recompute')
  @RequirePermission('net_profit_profit.manage')
  recompute(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.profit.computeForOrder(orderId);
  }

  @Put('orders/:orderId/ad-spend')
  @RequirePermission('net_profit_profit.manage')
  setAdSpend(@Param('orderId', ParseIntPipe) orderId: number, @Body() dto: SetAdSpendDto) {
    return this.profit.setAdSpend(orderId, new Prisma.Decimal(dto.adSpend));
  }

  @Get('fallback-settings')
  @RequirePermission('net_profit_profit.view')
  getFallbackSettings() {
    return this.profit.getFallbackSettings();
  }

  @Put('fallback-settings')
  @RequirePermission('net_profit_profit.manage')
  updateFallbackSettings(@Body() dto: Partial<FallbackProfitSettings>) {
    return this.profit.updateFallbackSettings(dto);
  }

  @Get('product-cost')
  @RequirePermission('net_profit_profit.view')
  productCosts(@Query() { page, pageSize }: PaginationQueryDto, @Query('search') search?: string) {
    return this.profit.listProductCosts(page ?? 1, pageSize ?? 20, search);
  }

  @Put('product-cost/:productId')
  @RequirePermission('net_profit_profit.manage')
  setProductCost(@Param('productId', ParseIntPipe) productId: number, @Body() dto: SetProductCostDto) {
    return this.profit.setProductCost(productId, new Prisma.Decimal(dto.buyPrice));
  }

  @Post('product-cost/bulk')
  @RequirePermission('net_profit_profit.manage')
  async bulkSetProductCost(@Body() dto: BulkSetProductCostDto) {
    const updated = await this.profit.bulkSetProductCost(dto.rows);
    return { updated };
  }

  @Get('product-cost/:productId/variants')
  @RequirePermission('net_profit_profit.view')
  variantCosts(@Param('productId', ParseIntPipe) productId: number) {
    return this.profit.listVariantCosts(productId);
  }

  @Put('variant-cost/:variantId')
  @RequirePermission('net_profit_profit.manage')
  setVariantCost(@Param('variantId', ParseIntPipe) variantId: number, @Body() dto: SetProductCostDto) {
    return this.profit.setVariantCost(variantId, new Prisma.Decimal(dto.buyPrice));
  }
}
