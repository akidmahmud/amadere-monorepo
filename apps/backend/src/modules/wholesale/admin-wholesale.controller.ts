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
import { ApiBearerAuth, ApiExcludeEndpoint, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PaginatedResult } from '@amader/shared';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { CurrentAdmin } from '../../common/auth/current-admin.decorator';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { ApiPaginatedResponse } from '../../common/dto/paginated-response.dto';
import { ProductsService } from '../products/products.service';
import { AdminProductPickerItemDto } from '../products/dto/product-response.dto';
import { WholesaleService } from './wholesale.service';
import { WholesaleCustomerDto, WholesaleOrderDto } from './wholesale.mapper';
import {
  CreateWholesaleCustomerDto,
  CreateWholesaleOrderDto,
  RecordWholesalePaymentDto,
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

  // --- customers ---

  @Get('customers')
  @RequirePermission('wholesale.view')
  @ApiPaginatedResponse(WholesaleCustomerDto)
  listCustomers(
    @Query() query: WholesaleCustomerQueryDto,
  ): Promise<PaginatedResult<WholesaleCustomerDto>> {
    return this.wholesale.listCustomers(query);
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
  ): Promise<WholesaleCustomerDto> {
    return this.wholesale.updateCustomer(id, dto);
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
