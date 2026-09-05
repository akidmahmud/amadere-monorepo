import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CourierProviderName } from '@amader/db';
import { PaginatedResult } from '@amader/shared';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { CurrentAdmin } from '../../common/auth/current-admin.decorator';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ApiPaginatedResponse } from '../../common/dto/paginated-response.dto';
import { ShipmentsService } from './shipments.service';
import { SettlementSyncService, SettlementSyncResult } from './settlement-sync.service';
import { DispatchShipmentDto } from './dto/dispatch-shipment.dto';
import { DispatchBulkShipmentDto } from './dto/dispatch-bulk-shipment.dto';
import { CancelShipmentDto } from './dto/cancel-shipment.dto';
import { UpdateShipmentStatusDto } from './dto/update-shipment-status.dto';
import { ShipmentDto, ShipmentPerformanceDto, ShipmentQueueRowDto } from './shipments.mapper';
import { BalanceOutcome, PaymentsOutcome } from './courier-provider.interface';

@ApiTags('admin/shipments')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/shipments')
export class AdminShipmentsController {
  constructor(
    private readonly shipments: ShipmentsService,
    private readonly settlements: SettlementSyncService,
  ) {}

  @Get()
  @RequirePermission('shipment.view')
  @ApiQuery({ name: 'provider', required: false, enum: CourierProviderName })
  @ApiPaginatedResponse(ShipmentDto)
  list(
    @Query() { page, pageSize }: PaginationQueryDto,
    @Query('provider') provider?: CourierProviderName,
  ): Promise<PaginatedResult<ShipmentDto>> {
    return this.shipments.adminList(page ?? 1, pageSize ?? 20, provider);
  }

  @Get('performance')
  @RequirePermission('shipment.view')
  @ApiQuery({ name: 'provider', required: false, enum: CourierProviderName })
  @ApiOkResponse({ type: ShipmentPerformanceDto })
  performance(
    @Query('provider') provider?: CourierProviderName,
  ): Promise<ShipmentPerformanceDto> {
    return this.shipments.performance(provider);
  }

  // Order-centric dispatch queue — every order (dispatched or not), so
  // staff can send un-dispatched ones from the same table where they track
  // ones already sent. Listed before ':id' so "queue" never gets swallowed
  // by the numeric-id route.
  @Get('queue')
  @RequirePermission('shipment.view')
  @ApiQuery({ name: 'search', required: false })
  @ApiPaginatedResponse(ShipmentQueueRowDto)
  queue(
    @Query() { page, pageSize }: PaginationQueryDto,
    @Query('search') search?: string,
  ): Promise<PaginatedResult<ShipmentQueueRowDto>> {
    return this.shipments.adminQueue(page ?? 1, pageSize ?? 20, search);
  }

  @Get('balance')
  @RequirePermission('shipment.view')
  @ApiQuery({ name: 'provider', enum: CourierProviderName })
  balance(@Query('provider') provider: CourierProviderName): Promise<BalanceOutcome> {
    return this.shipments.getBalance(provider);
  }

  // Raw settlement payload from the courier. Read-only and deliberately
  // untyped: this exists first to LEARN the payload shape (Steadfast's
  // /payments is undocumented), and only then to reconcile courier charges
  // against it. Declared before ':id' so 'payments' is not swallowed by the
  // numeric-id route below.
  @Get('payments')
  @RequirePermission('shipment.view')
  @ApiQuery({ name: 'provider', enum: CourierProviderName })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'paymentId', required: false })
  payments(
    @Query('provider') provider: CourierProviderName,
    @Query('page') page?: string,
    @Query('paymentId') paymentId?: string,
  ): Promise<PaymentsOutcome> {
    return this.shipments.getPayments(provider, {
      page: page ? Number(page) : undefined,
      id: paymentId,
    });
  }

  // Pull what the courier actually collected onto our shipment rows. POST
  // because it writes, and manual because there is no reason to hammer a
  // third party's API on a timer for numbers that only change when a payout
  // lands (roughly daily).
  @Post('settlements/sync')
  @RequirePermission('shipment.update')
  @ApiQuery({ name: 'provider', enum: CourierProviderName })
  @ApiQuery({ name: 'maxPages', required: false })
  @ApiQuery({ name: 'full', required: false })
  syncSettlements(
    @Query('provider') provider: CourierProviderName,
    @Query('maxPages') maxPages?: string,
    @Query('full') full?: string,
  ): Promise<SettlementSyncResult> {
    return this.settlements.sync(provider ?? 'STEADFAST', {
      maxPages: maxPages ? Number(maxPages) : undefined,
      full: full === 'true',
    });
  }

  @Get(':id')
  @RequirePermission('shipment.view')
  @ApiOkResponse({ type: ShipmentDto })
  get(@Param('id', ParseIntPipe) id: number): Promise<ShipmentDto> {
    return this.shipments.adminGet(id);
  }

  @Post('dispatch')
  @RequirePermission('shipment.dispatch')
  @ApiOkResponse({ type: ShipmentDto })
  dispatch(
    @Body() dto: DispatchShipmentDto,
    @CurrentAdmin() admin: { id: number },
  ): Promise<ShipmentDto> {
    return this.shipments.dispatch(dto, admin.id);
  }

  @Post('dispatch-bulk')
  @RequirePermission('shipment.dispatch')
  dispatchBulk(
    @Body() dto: DispatchBulkShipmentDto,
    @CurrentAdmin() admin: { id: number },
  ): Promise<{ succeeded: number[]; failed: { orderId: number; error: string }[] }> {
    return this.shipments.dispatchBulk(dto.orderIds, dto.provider, admin.id);
  }

  @Post(':id/track')
  @RequirePermission('shipment.update')
  @ApiOkResponse({ type: ShipmentDto })
  track(@Param('id', ParseIntPipe) id: number): Promise<ShipmentDto> {
    return this.shipments.track(id);
  }

  @Post(':id/cancel')
  @RequirePermission('shipment.update')
  @ApiOkResponse({ type: ShipmentDto })
  cancel(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelShipmentDto,
  ): Promise<ShipmentDto> {
    return this.shipments.cancelOrReturn(id, dto);
  }

  @Patch(':id/status')
  @RequirePermission('shipment.manage')
  @ApiOkResponse({ type: ShipmentDto })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateShipmentStatusDto,
  ): Promise<ShipmentDto> {
    return this.shipments.updateStatus(id, dto);
  }
}
