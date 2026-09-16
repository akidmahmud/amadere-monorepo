import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
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
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { ApiBearerAuth, ApiConsumes, ApiExcludeEndpoint, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PaginatedResult } from '@amader/shared';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { Can, RequirePermission, type PermissionCheck } from '../../common/auth/permission.decorator';
import { CustomerImportResultDto } from '../customers/dto/customer-import-result.dto';
import { CurrentAdmin } from '../../common/auth/current-admin.decorator';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { ApiPaginatedResponse } from '../../common/dto/paginated-response.dto';
import { ProductsService } from '../products/products.service';
import { AdminProductPickerItemDto } from '../products/dto/product-response.dto';
import { WholesaleService } from './wholesale.service';
import {
  WholesaleChannelDto,
  WholesaleCustomerDto,
  WholesaleOrderDto,
  WholesaleStatsDto,
} from './wholesale.mapper';
import {
  CreateWholesaleChannelDto,
  CreateWholesaleCustomerDto,
  CreateWholesaleOrderDto,
  RecordWholesalePaymentDto,
  UpdateWholesaleChannelDto,
  UpdateWholesaleCustomerDto,
  UpdateWholesaleOrderDto,
  WholesaleCustomerQueryDto,
  WholesaleOrderQueryDto,
} from './dto/wholesale.dto';

@ApiTags('admin/wholesale')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/wholesale')
export class AdminWholesaleController {
  constructor(
    private readonly wholesale: WholesaleService,
    private readonly products: ProductsService,
  ) {}

  // Same list /admin/products/picker serves, re-exposed under wholesale.view.
  // Without this, staff who manage only wholesale would open the order form to
  // an empty product dropdown and a 403 they cannot explain — the picker would
  // demand product.view, a permission this role has no other reason to hold.
  @Get('products')
  @RequirePermission('wholesale.view')
  @ApiOkResponse({ type: [AdminProductPickerItemDto] })
  productPicker(): Promise<AdminProductPickerItemDto[]> {
    return this.products.adminPickerList();
  }

  // Both dashboards' headline cards, in one call. Server-side on purpose:
  // the tables are paged, so counting rows in the browser would report the
  // page, not the business.
  @Get('stats')
  @RequirePermission('wholesale.view')
  @ApiOkResponse({ type: WholesaleStatsDto })
  stats(): Promise<WholesaleStatsDto> {
    return this.wholesale.stats();
  }

  // --- customers ---

  @Get('customers')
  @RequirePermission('wholesale.view')
  @ApiPaginatedResponse(WholesaleCustomerDto)
  listCustomers(
    @Query() query: WholesaleCustomerQueryDto,
  ): Promise<PaginatedResult<WholesaleCustomerDto>> {
    return this.wholesale.listCustomers(query);
  }

  // Before customers/:id, which would otherwise read "export" as an id.
  // Excluded from OpenAPI for the same reason as the orders export: a file,
  // not the JSON envelope.
  @Get('customers/export')
  @RequirePermission('wholesale.view')
  @ApiExcludeEndpoint()
  async exportCustomers(
    @Query() query: WholesaleCustomerQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const csv = await this.wholesale.exportCustomersCsv(query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="wholesale-customers-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    // BOM so Excel reads Bengali names and ৳ as UTF-8.
    res.send(`\uFEFF${csv}`);
  }

  @Get('customers/:id')
  @RequirePermission('wholesale.view')
  @ApiOkResponse({ type: WholesaleCustomerDto })
  findCustomer(@Param('id', ParseIntPipe) id: number): Promise<WholesaleCustomerDto> {
    return this.wholesale.findCustomer(id);
  }

  @Post('customers')
  @RequirePermission('wholesale.create')
  @ApiOkResponse({ type: WholesaleCustomerDto })
  createCustomer(@Body() dto: CreateWholesaleCustomerDto): Promise<WholesaleCustomerDto> {
    return this.wholesale.createCustomer(dto);
  }

  @Patch('customers/:id')
  @RequirePermission('wholesale.update')
  @ApiOkResponse({ type: WholesaleCustomerDto })
  updateCustomer(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWholesaleCustomerDto,
    @Can() can: PermissionCheck,
  ): Promise<WholesaleCustomerDto> {
    // Same rule as retail Customer Management: reassigning needs its own permission.
    if (dto.assignedAdminId !== undefined && !can('assignment.manage')) {
      throw new ForbiddenException('Missing permission: assignment.manage');
    }
    return this.wholesale.updateCustomer(id, dto);
  }

  // --- channels (Channel Settings) ---

  @Get('channels')
  @RequirePermission('wholesale.view')
  @ApiOkResponse({ type: [WholesaleChannelDto] })
  listChannels(): Promise<WholesaleChannelDto[]> {
    return this.wholesale.listChannels();
  }

  @Post('channels')
  @RequirePermission('wholesale.update')
  @ApiOkResponse({ type: WholesaleChannelDto })
  createChannel(@Body() dto: CreateWholesaleChannelDto): Promise<WholesaleChannelDto> {
    return this.wholesale.createChannel(dto);
  }

  @Patch('channels/:id')
  @RequirePermission('wholesale.update')
  @ApiOkResponse({ type: WholesaleChannelDto })
  updateChannel(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWholesaleChannelDto,
  ): Promise<WholesaleChannelDto> {
    return this.wholesale.updateChannel(id, dto);
  }

  @Delete('channels/:id')
  @RequirePermission('wholesale.delete')
  deleteChannel(@Param('id', ParseIntPipe) id: number): Promise<{ id: number }> {
    return this.wholesale.deleteChannel(id);
  }

  @Get('assignable-staff')
  @RequirePermission('wholesale.view')
  listAssignableStaff(): Promise<{ id: number; name: string }[]> {
    return this.wholesale.listAssignableStaff();
  }

  @Post('customers/import')
  @RequirePermission('wholesale.create')
  @ApiConsumes('multipart/form-data')
  @ApiOkResponse({ type: CustomerImportResultDto })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  importCustomers(
    @UploadedFile(new ParseFilePipe({ validators: [new MaxFileSizeValidator({ maxSize: 15 * 1024 * 1024 })] }))
    file: Express.Multer.File,
    // Preview unless explicitly told otherwise, exactly like the retail import.
    @Query('dryRun') dryRun?: string,
  ): Promise<CustomerImportResultDto> {
    return this.wholesale.importCustomers(file.buffer, dryRun !== 'false');
  }

  @Delete('customers/:id')
  @RequirePermission('wholesale.delete')
  deleteCustomer(@Param('id', ParseIntPipe) id: number): Promise<{ id: number }> {
    return this.wholesale.deleteCustomer(id);
  }

  // --- orders ---

  @Get('orders')
  @RequirePermission('wholesale.view')
  @ApiPaginatedResponse(WholesaleOrderDto)
  listOrders(
    @Query() query: WholesaleOrderQueryDto,
  ): Promise<PaginatedResult<WholesaleOrderDto>> {
    return this.wholesale.listOrders(query);
  }

  // Declared before `orders/:id` so Nest does not try to parse "export" as a
  // numeric order id. Excluded from the OpenAPI schema: it streams a file
  // rather than the JSON envelope every other endpoint returns.
  @Get('orders/export')
  @RequirePermission('wholesale.view')
  @ApiExcludeEndpoint()
  async exportOrders(
    @Query() query: WholesaleOrderQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const csv = await this.wholesale.exportOrdersCsv(query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="wholesale-orders-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    // A BOM so Excel opens the Bengali buyer names and the taka sign as UTF-8
    // instead of mojibake — the whole point of exporting for a shop owner.
    res.send(`\uFEFF${csv}`);
  }

  @Get('orders/:id')
  @RequirePermission('wholesale.view')
  @ApiOkResponse({ type: WholesaleOrderDto })
  findOrder(@Param('id', ParseIntPipe) id: number): Promise<WholesaleOrderDto> {
    return this.wholesale.findOrder(id);
  }

  @Post('orders')
  @RequirePermission('wholesale.create')
  @ApiOkResponse({ type: WholesaleOrderDto })
  createOrder(
    @Body() dto: CreateWholesaleOrderDto,
    @CurrentAdmin() admin: { id: number },
  ): Promise<WholesaleOrderDto> {
    return this.wholesale.createOrder(dto, admin.id);
  }

  @Patch('orders/:id')
  @RequirePermission('wholesale.update')
  @ApiOkResponse({ type: WholesaleOrderDto })
  updateOrder(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWholesaleOrderDto,
  ): Promise<WholesaleOrderDto> {
    return this.wholesale.updateOrder(id, dto);
  }

  @Post('orders/:id/payments')
  @RequirePermission('wholesale.update')
  @ApiOkResponse({ type: WholesaleOrderDto })
  recordPayment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RecordWholesalePaymentDto,
    @CurrentAdmin() admin: { id: number },
  ): Promise<WholesaleOrderDto> {
    return this.wholesale.recordPayment(id, dto, admin.id);
  }

  // Cancelling restocks the goods and voids the invoice, so it is a delete in
  // intent — but never a row delete: the order and its ledger history stay.
  @Post('orders/:id/cancel')
  @RequirePermission('wholesale.delete')
  @ApiOkResponse({ type: WholesaleOrderDto })
  cancelOrder(
    @Param('id', ParseIntPipe) id: number,
    @CurrentAdmin() admin: { id: number },
  ): Promise<WholesaleOrderDto> {
    return this.wholesale.cancelOrder(id, admin.id);
  }
}
