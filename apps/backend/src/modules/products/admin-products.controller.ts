import {
  Body,
  Controller,
  Delete,
  Get,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiConsumes, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PaginatedResult } from '@amader/shared';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { SuperAdminGuard } from '../../common/auth/super-admin.guard';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ApiPaginatedResponse } from '../../common/dto/paginated-response.dto';
import { ProductsService, type CsvImportResult } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateProductVariantDto } from './dto/create-product-variant.dto';
import { AdminProductQueryDto } from './dto/admin-product-query.dto';
import { AdminDeletedProductDto, AdminProductDto, AdminProductListItemDto, AdminProductPickerItemDto } from './dto/product-response.dto';
import { UpdateVariantStockDto } from './dto/update-variant-stock.dto';
import { UpdateVariantPriceDto } from './dto/update-variant-price.dto';
import { UpdateVariantSkuDto } from './dto/update-variant-sku.dto';
import { UpdateVariantWeightDto } from './dto/update-variant-weight.dto';
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
  @ApiPaginatedResponse(AdminProductListItemDto)
  list(
    @Query() { page, pageSize }: PaginationQueryDto,
    @Query() filters: AdminProductQueryDto,
  ): Promise<PaginatedResult<AdminProductListItemDto>> {
    return this.products.adminList(page ?? 1, pageSize ?? 20, filters);
  }

  @Get('stats')
  @RequirePermission('product.view')
  stats() {
    return this.products.adminStats();
  }

  // Lightweight id/slug/name list for pickers (collection/cross-sell/etc.
  // editors) — deliberately skips the full adminList()'s heavy nested
  // include (variants, media, categories/tags/attributes) since a picker
  // only ever renders a checkbox list of names.
  @Get('picker')
  @RequirePermission('product.view')
  @ApiOkResponse({ type: [AdminProductPickerItemDto] })
  pickerList(): Promise<AdminProductPickerItemDto[]> {
    return this.products.adminPickerList();
  }

  @Get('export')
  @RequirePermission('product.view')
  async export(@Query() filters: AdminProductQueryDto, @Res() res: Response) {
    const csv = await this.products.adminExportCsv(filters);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="products-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  }

  @Post('import')
  @RequirePermission('product.create')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  importCsv(
    @UploadedFile(new ParseFilePipe({ validators: [new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 })] }))
    file: Express.Multer.File,
  ): Promise<CsvImportResult> {
    return this.products.importCsv(file.buffer.toString('utf-8'));
  }

  // Super-admin only regardless of granted permissions — see SuperAdminGuard.
  // Declared before `:id` so Nest's route matching doesn't try to parse
  // "trash" as a numeric id first.
  @Get('trash')
  @UseGuards(SuperAdminGuard)
  @ApiPaginatedResponse(AdminDeletedProductDto)
  listDeleted(
    @Query() { page, pageSize }: PaginationQueryDto,
    @Query('q') q?: string,
  ): Promise<PaginatedResult<AdminDeletedProductDto>> {
    return this.products.listDeleted(page ?? 1, pageSize ?? 20, q);
  }

  @Get(':id')
  @RequirePermission('product.view')
  @ApiOkResponse({ type: AdminProductDto })
  get(@Param('id', ParseIntPipe) id: number): Promise<AdminProductDto> {
    return this.products.adminGet(id);
  }

  @Post(':id/preview-token')
  @RequirePermission('product.view')
  previewToken(@Param('id', ParseIntPipe) id: number): Promise<{ token: string }> {
    return this.products.generatePreviewToken(id);
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

  @Post(':id/duplicate')
  @RequirePermission('product.create')
  @ApiOkResponse({ type: AdminProductDto })
  duplicate(@Param('id', ParseIntPipe) id: number): Promise<AdminProductDto> {
    return this.products.duplicate(id);
  }

  // Super-admin only regardless of granted permissions — see SuperAdminGuard.
  @Post(':id/restore')
  @UseGuards(SuperAdminGuard)
  @ApiOkResponse({ type: AdminProductDto })
  restore(@Param('id', ParseIntPipe) id: number): Promise<AdminProductDto> {
    return this.products.restore(id);
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

  @Patch(':id/variants/:variantId/weight')
  @RequirePermission('product.update')
  updateVariantWeight(
    @Param('id', ParseIntPipe) id: number,
    @Param('variantId', ParseIntPipe) variantId: number,
    @Body() dto: UpdateVariantWeightDto,
  ): Promise<void> {
    return this.products.updateVariantWeight(id, variantId, dto.weightOverride);
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

  @Get(':id/frequently-bought-together')
  @RequirePermission('product.view')
  getFrequentlyBoughtTogether(@Param('id', ParseIntPipe) id: number): Promise<number[]> {
    return this.products.getFrequentlyBoughtTogether(id);
  }

  @Patch(':id/frequently-bought-together')
  @RequirePermission('product.update')
  updateFrequentlyBoughtTogether(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCrossSellDto,
  ): Promise<number[]> {
    return this.products.updateFrequentlyBoughtTogether(id, dto.productIds);
  }
}
