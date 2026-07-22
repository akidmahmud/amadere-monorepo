import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PaginatedResult } from '@amader/shared';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ApiPaginatedResponse } from '../../common/dto/paginated-response.dto';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateProductVariantDto } from './dto/create-product-variant.dto';
import { AdminProductQueryDto } from './dto/admin-product-query.dto';
import { AdminProductDto } from './dto/product-response.dto';
import { UpdateVariantStockDto } from './dto/update-variant-stock.dto';
import { UpdateVariantPriceDto } from './dto/update-variant-price.dto';
import { UpdateVariantSkuDto } from './dto/update-variant-sku.dto';
import { UpdateCrossSellDto } from './dto/update-cross-sell.dto';

@ApiTags('admin/products')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/products')
export class AdminProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @RequirePermission('product.view')
  @ApiPaginatedResponse(AdminProductDto)
  list(
    @Query() { page, pageSize }: PaginationQueryDto,
    @Query() filters: AdminProductQueryDto,
  ): Promise<PaginatedResult<AdminProductDto>> {
    return this.products.adminList(page ?? 1, pageSize ?? 20, filters);
  }

  @Get('stats')
  @RequirePermission('product.view')
  stats() {
    return this.products.adminStats();
  }

  @Get('export')
  @RequirePermission('product.view')
  async export(@Query() filters: AdminProductQueryDto, @Res() res: Response) {
    const csv = await this.products.adminExportCsv(filters);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="products-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  }

  @Get(':id')
  @RequirePermission('product.view')
  @ApiOkResponse({ type: AdminProductDto })
  get(@Param('id', ParseIntPipe) id: number): Promise<AdminProductDto> {
    return this.products.adminGet(id);
  }

  @Get(':id/stats')
  @RequirePermission('product.view')
  statsFor(@Param('id', ParseIntPipe) id: number) {
    return this.products.adminStatsFor(id);
  }

  @Post()
  @RequirePermission('product.create')
  @ApiOkResponse({ type: AdminProductDto })
  create(@Body() dto: CreateProductDto): Promise<AdminProductDto> {
    return this.products.create(dto);
  }

  @Patch(':id')
  @RequirePermission('product.update')
  @ApiOkResponse({ type: AdminProductDto })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductDto,
  ): Promise<AdminProductDto> {
    return this.products.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('product.delete')
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.products.delete(id);
  }

  @Post(':id/variants')
  @RequirePermission('product.update')
  @ApiOkResponse({ type: AdminProductDto })
  addVariant(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateProductVariantDto,
  ): Promise<AdminProductDto> {
    return this.products.addVariant(id, dto);
  }

  @Delete(':id/variants/:variantId')
  @RequirePermission('product.update')
  removeVariant(
    @Param('id', ParseIntPipe) id: number,
    @Param('variantId', ParseIntPipe) variantId: number,
  ): Promise<void> {
    return this.products.removeVariant(id, variantId);
  }

  @Patch(':id/variants/:variantId/stock')
  @RequirePermission('product.update')
  updateVariantStock(
    @Param('id', ParseIntPipe) id: number,
    @Param('variantId', ParseIntPipe) variantId: number,
    @Body() dto: UpdateVariantStockDto,
  ): Promise<void> {
    return this.products.updateVariantStock(id, variantId, dto.stock);
  }

  @Patch(':id/variants/:variantId/price')
  @RequirePermission('product.update')
  updateVariantPrice(
    @Param('id', ParseIntPipe) id: number,
    @Param('variantId', ParseIntPipe) variantId: number,
    @Body() dto: UpdateVariantPriceDto,
  ): Promise<void> {
    return this.products.updateVariantPrice(id, variantId, dto);
  }

  @Patch(':id/variants/:variantId/sku')
  @RequirePermission('product.update')
  updateVariantSku(
    @Param('id', ParseIntPipe) id: number,
    @Param('variantId', ParseIntPipe) variantId: number,
    @Body() dto: UpdateVariantSkuDto,
  ): Promise<void> {
    return this.products.updateVariantSku(id, variantId, dto.sku);
  }

  @Get(':id/cross-sell')
  @RequirePermission('product.view')
  getCrossSell(@Param('id', ParseIntPipe) id: number): Promise<number[]> {
    return this.products.getCrossSell(id);
  }

  @Patch(':id/cross-sell')
  @RequirePermission('product.update')
  updateCrossSell(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCrossSellDto,
  ): Promise<number[]> {
    return this.products.updateCrossSell(id, dto.productIds);
  }
}
