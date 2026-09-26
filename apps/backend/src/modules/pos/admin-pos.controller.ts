import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import {
  Can,
  type PermissionCheck,
  RequirePermission,
} from '../../common/auth/permission.decorator';
import { CurrentAdmin } from '../../common/auth/current-admin.decorator';
import { StoresService } from '../stores/stores.service';
import { StoreQueryDto } from '../stores/dto/store.dto';
import { requireOneStore } from '../stores/store-scope';
import { PosCatalogService } from './pos-catalog.service';
import {
  PosCatalogQueryDto,
  PosDateQueryDto,
  PosRangeQueryDto,
} from './dto/pos-query.dto';
import {
  CUSTOMER_SHEET_COLUMNS,
  PosReportsService,
  PROFIT_COLUMNS,
  SALES_SHEET_COLUMNS,
  SHEET_HEADERS,
  toCsv,
} from './pos-reports.service';
import { PosSettingsService } from './pos-settings.service';
import { UpdatePosVatDto } from './dto/pos-settings.dto';
import { PosInvoiceService } from './pos-invoice.service';
import { PosCouponsService } from './pos-coupons.service';
import { PosCouponDto } from './dto/pos-coupon.dto';
import { PosProductsService } from './pos-products.service';
import { PosProductDto } from './dto/pos-product.dto';
import { SavePosInvoiceDto } from './dto/pos-invoice.dto';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { PosSaleService } from './pos-sale.service';
import {
  CreateHeldSaleDto,
  CreatePosSaleDto,
  PosCustomerQueryDto,
  PosQuoteDto,
  QuickCustomerDto,
  ReturnPosSaleDto,
} from './dto/create-pos-sale.dto';

type Admin = { id: number };

@ApiTags('admin/pos')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@Controller('admin/pos')
export class AdminPosController {
  constructor(
    private readonly stores: StoresService,
    private readonly catalog: PosCatalogService,
    private readonly sales: PosSaleService,
    private readonly reports: PosReportsService,
    private readonly settings: PosSettingsService,
    private readonly invoices: PosInvoiceService,
    private readonly coupons: PosCouponsService,
    private readonly products: PosProductsService,
  ) {}

  private async oneStore(a: Admin, can: PermissionCheck, requested?: number) {
    return requireOneStore(await this.stores.scope(a.id, can, requested));
  }

  // The till reads it (VAT label); only pos.settings may change it.
  @Get('settings/vat')
  @RequirePermission('pos.access')
  getVat() {
    return this.settings.getVat();
  }

  @Put('settings/vat')
  @RequirePermission('pos.settings')
  @UseInterceptors(AuditLogInterceptor)
  setVat(@Body() dto: UpdatePosVatDto) {
    return this.settings.setVat(dto);
  }

  // ---- POS coupons (POS Settings › Coupons) ----
  @Get('coupons')
  @RequirePermission('pos.settings')
  listCoupons() {
    return this.coupons.list();
  }

  /** Coupons usable at this store now — for the till's "View coupons" list. */
  @Get('coupons/available')
  @RequirePermission('pos.access')
  async availableCoupons(
    @CurrentAdmin() a: Admin,
    @Can() can: PermissionCheck,
    @Query() q: StoreQueryDto,
  ) {
    return this.coupons.available(await this.oneStore(a, can, q.storeId));
  }

  @Post('coupons')
  @RequirePermission('pos.settings')
  @UseInterceptors(AuditLogInterceptor)
  createCoupon(@Body() dto: PosCouponDto) {
    return this.coupons.create(dto);
  }

  @Put('coupons/:id')
  @RequirePermission('pos.settings')
  @UseInterceptors(AuditLogInterceptor)
  updateCoupon(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PosCouponDto,
  ) {
    return this.coupons.update(id, dto);
  }

  @Delete('coupons/:id')
  @RequirePermission('pos.settings')
  @UseInterceptors(AuditLogInterceptor)
  removeCoupon(@Param('id', ParseIntPipe) id: number) {
    return this.coupons.remove(id);
  }

  // ---- invoice templates ('default' or a store id) ----
  @Get('invoice-templates')
  @RequirePermission('pos.settings')
  listInvoices() {
    return this.invoices.list();
  }

  /** What a store's receipt prints; a cashier can only ask for their own store. */
  @Get('invoice-templates/resolve')
  @RequirePermission('pos.access')
  async resolveInvoice(
    @CurrentAdmin() a: Admin,
    @Can() can: PermissionCheck,
    @Query() q: StoreQueryDto,
  ) {
    return this.invoices.resolve(await this.oneStore(a, can, q.storeId));
  }

  @Get('invoice-templates/:key')
  @RequirePermission('pos.settings')
  async getInvoice(@Param('key') key: string) {
    return { html: await this.invoices.get(templateKey(key)) };
  }

  @Put('invoice-templates/:key')
  @RequirePermission('pos.settings')
  @UseInterceptors(AuditLogInterceptor)
  async saveInvoice(
    @CurrentAdmin() a: Admin,
    @Param('key') key: string,
    @Body() dto: SavePosInvoiceDto,
  ) {
    await this.invoices.save(templateKey(key), dto.html, a.id);
    return { html: await this.invoices.get(templateKey(key)) };
  }

  @Delete('invoice-templates/:key')
  @RequirePermission('pos.settings')
  @UseInterceptors(AuditLogInterceptor)
  async resetInvoice(@Param('key') key: string) {
    await this.invoices.reset(templateKey(key));
  }

  // Store-only products, managed from the POS (not the website product form).
  @Get('products')
  @RequirePermission('pos.store_products')
  async listProducts(
    @CurrentAdmin() a: Admin,
    @Can() can: PermissionCheck,
    @Query() q: StoreQueryDto,
  ) {
    return this.products.list(await this.oneStore(a, can, q.storeId));
  }

  @Post('products')
  @RequirePermission('pos.store_products')
  @UseInterceptors(AuditLogInterceptor)
  async createProduct(
    @CurrentAdmin() a: Admin,
    @Can() can: PermissionCheck,
    @Query() q: StoreQueryDto,
    @Body() dto: PosProductDto,
  ) {
    const storeId = await this.oneStore(a, can, q.storeId);
    return this.products.create(storeId, dto, {
      storeId: await this.stores.adminStoreId(a.id),
      can,
    });
  }

  @Put('products/:id')
  @RequirePermission('pos.store_products')
  @UseInterceptors(AuditLogInterceptor)
  async updateProduct(
    @CurrentAdmin() a: Admin,
    @Can() can: PermissionCheck,
    @Param('id', ParseIntPipe) id: number,
    @Query() q: StoreQueryDto,
    @Body() dto: PosProductDto,
  ) {
    const storeId = await this.oneStore(a, can, q.storeId);
    return this.products.update(storeId, id, dto, {
      storeId: await this.stores.adminStoreId(a.id),
      can,
    });
  }

  @Get('catalog')
  @RequirePermission('pos.access')
  async list(
    @CurrentAdmin() a: Admin,
    @Can() can: PermissionCheck,
    @Query() q: PosCatalogQueryDto,
  ) {
    return this.catalog.list(
      await this.oneStore(a, can, q.storeId),
      q.q,
      q.categoryId,
      q.sort,
    );
  }

  @Get('lookup')
  @RequirePermission('pos.access')
  async lookup(
    @CurrentAdmin() a: Admin,
    @Can() can: PermissionCheck,
    @Query() q: PosCatalogQueryDto,
  ) {
    return this.catalog.lookup(
      await this.oneStore(a, can, q.storeId),
      q.code ?? '',
    );
  }

  @Get('categories')
  @RequirePermission('pos.access')
  categories() {
    return this.catalog.categories();
  }

  @Get('stats')
  @RequirePermission('pos.access')
  async stats(
    @CurrentAdmin() a: Admin,
    @Can() can: PermissionCheck,
    @Query() q: StoreQueryDto,
  ) {
    return this.catalog.stats(await this.oneStore(a, can, q.storeId));
  }

  @Post('quote')
  @RequirePermission('pos.access')
  async quote(
    @CurrentAdmin() a: Admin,
    @Can() can: PermissionCheck,
    @Body() dto: PosQuoteDto,
  ) {
    return this.sales.quote(await this.oneStore(a, can, dto.storeId), dto);
  }

  @Post('sales')
  @RequirePermission('pos.access')
  async sell(
    @CurrentAdmin() a: Admin,
    @Can() can: PermissionCheck,
    @Body() dto: CreatePosSaleDto,
  ) {
    return this.sales.create(
      await this.oneStore(a, can, dto.storeId),
      dto,
      a.id,
    );
  }

  @Get('sales')
  @RequirePermission('pos.access')
  async recent(
    @CurrentAdmin() a: Admin,
    @Can() can: PermissionCheck,
    @Query() q: PosDateQueryDto,
  ) {
    return this.sales.recent(
      await this.stores.scope(a.id, can, q.storeId),
      q.date,
    );
  }

  @Get('sales/:id')
  @RequirePermission('pos.access')
  async one(
    @CurrentAdmin() a: Admin,
    @Can() can: PermissionCheck,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.sales.get(await this.stores.scope(a.id, can), id);
  }

  @Post('sales/:id/return')
  @RequirePermission('pos.refund')
  @UseInterceptors(AuditLogInterceptor)
  async ret(
    @CurrentAdmin() a: Admin,
    @Can() can: PermissionCheck,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReturnPosSaleDto,
  ) {
    return this.sales.returnSale(
      await this.stores.scope(a.id, can),
      id,
      a.id,
      dto.reason,
    );
  }

  @Get('customers')
  @RequirePermission('pos.access')
  customers(@Query() q: PosCustomerQueryDto) {
    return this.sales.findCustomers(q.q);
  }

  @Post('customers')
  @RequirePermission('pos.access')
  quickCustomer(@Body() dto: QuickCustomerDto) {
    return this.sales.quickCustomer(dto.phone, dto.name);
  }

  @Get('held')
  @RequirePermission('pos.access')
  async held(
    @CurrentAdmin() a: Admin,
    @Can() can: PermissionCheck,
    @Query() q: StoreQueryDto,
  ) {
    return this.sales.held(await this.oneStore(a, can, q.storeId));
  }

  @Post('held')
  @RequirePermission('pos.access')
  async hold(
    @CurrentAdmin() a: Admin,
    @Can() can: PermissionCheck,
    @Body() dto: CreateHeldSaleDto,
  ) {
    return this.sales.hold(
      await this.oneStore(a, can, dto.storeId),
      a.id,
      dto.label,
      dto.cart,
    );
  }

  @Delete('held/:id')
  @RequirePermission('pos.access')
  async dropHeld(
    @CurrentAdmin() a: Admin,
    @Can() can: PermissionCheck,
    @Param('id', ParseIntPipe) id: number,
    @Query() q: StoreQueryDto,
  ) {
    return this.sales.dropHeld(await this.oneStore(a, can, q.storeId), id);
  }

  @Get('reports/sales')
  @RequirePermission('pos.reports')
  async salesReport(
    @CurrentAdmin() a: Admin,
    @Can() can: PermissionCheck,
    @Query() q: PosRangeQueryDto,
  ) {
    return this.reports.sales(
      await this.stores.scope(a.id, can, q.storeId),
      q.from,
      q.to,
    );
  }

  @Get('reports/sales.csv')
  @RequirePermission('pos.reports')
  async salesCsv(
    @CurrentAdmin() a: Admin,
    @Can() can: PermissionCheck,
    @Query() q: PosRangeQueryDto,
    @Res() res: Response,
  ) {
    const rows = await this.reports.sales(
      await this.stores.scope(a.id, can, q.storeId),
      q.from,
      q.to,
    );
    sendCsv(res, `pos-sales-${q.from}-${q.to}.csv`, toCsv(rows));
  }

  @Get('reports/stock')
  @RequirePermission('pos.reports')
  async stockReport(
    @CurrentAdmin() a: Admin,
    @Can() can: PermissionCheck,
    @Query() q: StoreQueryDto,
  ) {
    return this.reports.stock(await this.oneStore(a, can, q.storeId));
  }

  @Get('reports/stock.csv')
  @RequirePermission('pos.reports')
  async stockCsv(
    @CurrentAdmin() a: Admin,
    @Can() can: PermissionCheck,
    @Query() q: StoreQueryDto,
    @Res() res: Response,
  ) {
    const rows = await this.reports.stock(
      await this.oneStore(a, can, q.storeId),
    );
    sendCsv(
      res,
      `stock-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(rows),
    );
  }

  @Get('reports/profit')
  @RequirePermission('pos.reports')
  async profitReport(
    @CurrentAdmin() a: Admin,
    @Can() can: PermissionCheck,
    @Query() q: PosRangeQueryDto,
  ) {
    return this.reports.profit(
      await this.stores.scope(a.id, can, q.storeId),
      q.from,
      q.to,
    );
  }

  @Get('reports/profit.csv')
  @RequirePermission('pos.reports')
  async profitCsv(
    @CurrentAdmin() a: Admin,
    @Can() can: PermissionCheck,
    @Query() q: PosRangeQueryDto,
    @Res() res: Response,
  ) {
    const rows = await this.reports.profit(
      await this.stores.scope(a.id, can, q.storeId),
      q.from,
      q.to,
    );
    sendCsv(
      res,
      `store-profit-${q.from}-${q.to}.csv`,
      toCsv(rows, PROFIT_COLUMNS, SHEET_HEADERS),
    );
  }

  /** The store's sales sheet: one row per line sold. */
  @Get('reports/sales-lines.csv')
  @RequirePermission('pos.reports')
  async salesLinesCsv(
    @CurrentAdmin() a: Admin,
    @Can() can: PermissionCheck,
    @Query() q: PosRangeQueryDto,
    @Res() res: Response,
  ) {
    const rows = await this.reports.salesLines(
      await this.oneStore(a, can, q.storeId),
      q.from,
      q.to,
    );
    sendCsv(
      res,
      `sales-${q.from}-${q.to}.csv`,
      toCsv(rows, SALES_SHEET_COLUMNS, SHEET_HEADERS),
    );
  }

  /** The store's customer sheet: one row per customer who bought there. */
  @Get('reports/customers.csv')
  @RequirePermission('pos.reports')
  async customersCsv(
    @CurrentAdmin() a: Admin,
    @Can() can: PermissionCheck,
    @Query() q: PosRangeQueryDto,
    @Res() res: Response,
  ) {
    const rows = await this.reports.customers(
      await this.oneStore(a, can, q.storeId),
      q.from,
      q.to,
    );
    sendCsv(
      res,
      `customers-${q.from}-${q.to}.csv`,
      toCsv(rows, CUSTOMER_SHEET_COLUMNS, SHEET_HEADERS),
    );
  }
}

// Same pattern as AdminCustomersController.export: @Res() bypasses the
// {success,data} envelope so the browser gets a plain file.
function sendCsv(res: Response, fileName: string, csv: string) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(csv);
}

/** 'default' → null (the Default template), otherwise a store id. */
function templateKey(key: string): number | null {
  if (key === 'default') return null;
  const id = Number(key);
  if (!Number.isInteger(id) || id <= 0)
    throw new BadRequestException('Unknown template');
  return id;
}
