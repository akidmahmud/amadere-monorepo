import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { CourierSettingsService } from './courier-settings.service';
import { PathaoCourierProvider } from './providers/pathao-courier.provider';
import { RedxCourierProvider } from './providers/redx-courier.provider';
import { UpdatePathaoSettingsDto, UpdateRedxSettingsDto, UpdateSteadfastSettingsDto } from './dto/update-courier-settings.dto';

@ApiTags('admin/courier-settings')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/courier')
export class AdminCourierSettingsController {
  constructor(
    private readonly settings: CourierSettingsService,
    private readonly pathao: PathaoCourierProvider,
    private readonly redx: RedxCourierProvider,
  ) {}

  @Get('settings/steadfast')
  @RequirePermission('shipment.view')
  getSteadfast() {
    return this.settings.getSteadfastConfig();
  }

  @Put('settings/steadfast')
  @RequirePermission('shipment.manage')
  updateSteadfast(@Body() dto: UpdateSteadfastSettingsDto) {
    return this.settings.updateSteadfastConfig(dto);
  }

  @Get('settings/pathao')
  @RequirePermission('shipment.view')
  getPathao() {
    return this.settings.getPathaoConfig();
  }

  @Put('settings/pathao')
  @RequirePermission('shipment.manage')
  updatePathao(@Body() dto: UpdatePathaoSettingsDto) {
    return this.settings.updatePathaoConfig(dto);
  }

  @Post('settings/pathao/test')
  @RequirePermission('shipment.manage')
  testPathao() {
    return this.pathao.testConnection();
  }

  @Get('settings/redx')
  @RequirePermission('shipment.view')
  getRedx() {
    return this.settings.getRedxConfig();
  }

  @Put('settings/redx')
  @RequirePermission('shipment.manage')
  updateRedx(@Body() dto: UpdateRedxSettingsDto) {
    return this.settings.updateRedxConfig(dto);
  }

  @Post('settings/redx/test')
  @RequirePermission('shipment.manage')
  testRedx() {
    return this.redx.testConnection();
  }

  // Location cascades for the per-order consign modal.
  @Get('pathao/stores')
  @RequirePermission('shipment.view')
  pathaoStores() {
    return this.pathao.getStores();
  }

  @Get('pathao/cities')
  @RequirePermission('shipment.view')
  pathaoCities() {
    return this.pathao.getCities();
  }

  @Get('pathao/zones/:cityId')
  @RequirePermission('shipment.view')
  pathaoZones(@Param('cityId', ParseIntPipe) cityId: number) {
    return this.pathao.getZones(cityId);
  }

  @Get('pathao/areas/:zoneId')
  @RequirePermission('shipment.view')
  pathaoAreas(@Param('zoneId', ParseIntPipe) zoneId: number) {
    return this.pathao.getAreas(zoneId);
  }

  @Get('redx/areas')
  @RequirePermission('shipment.view')
  redxAreas() {
    return this.redx.getAreas();
  }

  @Get('redx/pickup-stores')
  @RequirePermission('shipment.view')
  redxPickupStores() {
    return this.redx.getPickupStores();
  }
}
