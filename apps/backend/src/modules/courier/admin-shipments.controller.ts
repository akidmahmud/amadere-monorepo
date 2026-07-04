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
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CourierProviderName } from '@amader/db';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { CurrentAdmin } from '../../common/auth/current-admin.decorator';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ShipmentsService } from './shipments.service';
import { DispatchShipmentDto } from './dto/dispatch-shipment.dto';
import { CancelShipmentDto } from './dto/cancel-shipment.dto';

@ApiTags('admin/shipments')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/shipments')
export class AdminShipmentsController {
  constructor(private readonly shipments: ShipmentsService) {}

  @Get()
  @RequirePermission('shipment.view')
  @ApiQuery({ name: 'provider', required: false, enum: CourierProviderName })
  list(
    @Query() { page, pageSize }: PaginationQueryDto,
    @Query('provider') provider?: CourierProviderName,
  ) {
    return this.shipments.adminList(page ?? 1, pageSize ?? 20, provider);
  }

  @Get('performance')
  @RequirePermission('shipment.view')
  @ApiQuery({ name: 'provider', required: false, enum: CourierProviderName })
  performance(@Query('provider') provider?: CourierProviderName) {
    return this.shipments.performance(provider);
  }

  @Get(':id')
  @RequirePermission('shipment.view')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.shipments.adminGet(id);
  }

  @Post('dispatch')
  @RequirePermission('shipment.dispatch')
  dispatch(
    @Body() dto: DispatchShipmentDto,
    @CurrentAdmin() admin: { id: number },
  ) {
    return this.shipments.dispatch(dto, admin.id);
  }

  @Post(':id/track')
  @RequirePermission('shipment.update')
  track(@Param('id', ParseIntPipe) id: number) {
    return this.shipments.track(id);
  }

  @Post(':id/cancel')
  @RequirePermission('shipment.update')
  cancel(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelShipmentDto,
  ) {
    return this.shipments.cancelOrReturn(id, dto);
  }
}
