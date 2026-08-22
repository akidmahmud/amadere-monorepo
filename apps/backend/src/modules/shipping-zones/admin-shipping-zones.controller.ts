import { Body, Controller, Get, Put, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { ShippingZonesService } from './shipping-zones.service';
import { ShippingZonesConfig } from './shipping-zones.types';
import { UpdateShippingZonesDto } from './dto/update-shipping-zones.dto';

@ApiTags('admin/shipping-zones')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/shipping-zones')
export class AdminShippingZonesController {
  constructor(private readonly zones: ShippingZonesService) {}

  // Typed as the DTO rather than the bare config interface so the class
  // reaches the OpenAPI document for the admin app's typegen.
  @Get()
  @RequirePermission('shipping_zone.view')
  @ApiOkResponse({ type: UpdateShippingZonesDto })
  get(): Promise<ShippingZonesConfig> {
    return this.zones.getConfig();
  }

  // PUT, not PATCH: the editor always submits the whole zone list, and a
  // partial merge of a nested array is the ambiguity storing this as one
  // document avoids.
  @Put()
  @RequirePermission('shipping_zone.update')
  @ApiOkResponse({ type: UpdateShippingZonesDto })
  update(@Body() dto: UpdateShippingZonesDto): Promise<ShippingZonesConfig> {
    return this.zones.update(dto as unknown as ShippingZonesConfig);
  }
}
