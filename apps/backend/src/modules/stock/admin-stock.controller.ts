import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import {
  Can,
  type PermissionCheck,
  RequirePermission,
} from '../../common/auth/permission.decorator';
import { CurrentAdmin } from '../../common/auth/current-admin.decorator';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { StoresService } from '../stores/stores.service';
import { StoreQueryDto } from '../stores/dto/store.dto';
import { requireOneStore } from '../stores/store-scope';
import { StockDocsService } from './stock-docs.service';
import { TransfersService } from './transfers.service';
import {
  AdjustStockDto,
  CreateStockInDto,
  GenerateBarcodesDto,
  MovementsQueryDto,
} from './dto/stock-docs.dto';
import { CreateTransferDto, ReceiveTransferDto } from './dto/transfer.dto';

type Admin = { id: number };

@ApiTags('admin/stock')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/stock')
export class AdminStockController {
  constructor(
    private readonly stores: StoresService,
    private readonly docs: StockDocsService,
    private readonly transfers: TransfersService,
  ) {}

  @Post('stock-in')
  @RequirePermission('pos.stock_in')
  async stockIn(
    @CurrentAdmin() a: Admin,
    @Can() can: PermissionCheck,
    @Body() dto: CreateStockInDto,
  ) {
    return this.docs.stockIn(
      requireOneStore(await this.stores.scope(a.id, can, dto.storeId)),
      dto,
      a.id,
    );
  }

  @Post('adjust')
  @RequirePermission('pos.adjust')
  async adjust(
    @CurrentAdmin() a: Admin,
    @Can() can: PermissionCheck,
    @Body() dto: AdjustStockDto,
  ) {
    return this.docs.adjust(
      requireOneStore(await this.stores.scope(a.id, can, dto.storeId)),
      dto,
      a.id,
    );
  }

  @Get('movements')
  @RequirePermission('pos.access')
  async movements(
    @CurrentAdmin() a: Admin,
    @Can() can: PermissionCheck,
    @Query() q: MovementsQueryDto,
  ) {
    return this.docs.movements(
      await this.stores.scope(a.id, can, q.storeId),
      q.productId,
      q.variantId,
    );
  }

  @Post('barcodes/generate')
  @RequirePermission('pos.labels')
  generateBarcodes(@Body() dto: GenerateBarcodesDto) {
    return this.docs.generateBarcodes(dto.productIds);
  }

  @Get('transfers')
  @RequirePermission('pos.transfer')
  async listTransfers(
    @CurrentAdmin() a: Admin,
    @Can() can: PermissionCheck,
    @Query() q: StoreQueryDto,
  ) {
    return this.transfers.list(await this.stores.scope(a.id, can, q.storeId));
  }

  @Post('transfers')
  @RequirePermission('pos.transfer')
  async createTransfer(
    @CurrentAdmin() a: Admin,
    @Can() can: PermissionCheck,
    @Body() dto: CreateTransferDto,
  ) {
    return this.transfers.create(
      requireOneStore(await this.stores.scope(a.id, can, dto.fromStoreId)),
      dto,
      a.id,
    );
  }

  @Post('transfers/:id/approve')
  @RequirePermission('pos.transfer_approve')
  async approve(
    @CurrentAdmin() a: Admin,
    @Can() can: PermissionCheck,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.transfers.approve(await this.stores.scope(a.id, can), id, a.id);
  }

  @Post('transfers/:id/dispatch')
  @RequirePermission('pos.transfer')
  async dispatch(
    @CurrentAdmin() a: Admin,
    @Can() can: PermissionCheck,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.transfers.dispatch(
      await this.stores.scope(a.id, can),
      id,
      a.id,
    );
  }

  @Post('transfers/:id/receive')
  @RequirePermission('pos.transfer')
  async receive(
    @CurrentAdmin() a: Admin,
    @Can() can: PermissionCheck,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReceiveTransferDto,
  ) {
    return this.transfers.receive(
      await this.stores.scope(a.id, can),
      id,
      dto.items,
      a.id,
    );
  }

  @Post('transfers/:id/cancel')
  @RequirePermission('pos.transfer')
  async cancel(
    @CurrentAdmin() a: Admin,
    @Can() can: PermissionCheck,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.transfers.cancel(await this.stores.scope(a.id, can), id, a.id);
  }
}
