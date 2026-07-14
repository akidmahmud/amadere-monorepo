import { Body, Controller, Get, Param, Post, Put, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../../common/auth/permission.guard';
import { RequirePermission } from '../../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../../common/audit-log/audit-log.interceptor';
import { FraudService } from './fraud.service';
import { FraudListQueryDto } from './dto/fraud-list-query.dto';
import { FraudSettingsDto, UpdateFraudSettingsDto } from './dto/fraud-settings.dto';
import { FraudCheckDto } from './fraud.mapper';

@ApiTags('admin/net-profit/fraud')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/net-profit/fraud')
export class AdminFraudController {
  constructor(private readonly fraud: FraudService) {}

  @Get('checks')
  @RequirePermission('net_profit_fraud.view')
  list(@Query() query: FraudListQueryDto) {
    return this.fraud.adminList({
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      risk: query.risk,
    });
  }

  @Get('checks/:phone')
  @RequirePermission('net_profit_fraud.view')
  @ApiOkResponse({ type: FraudCheckDto })
  get(@Param('phone') phone: string): Promise<FraudCheckDto> {
    return this.fraud.adminGet(phone);
  }

  @Post('checks/:phone/recheck')
  @RequirePermission('net_profit_fraud.manage')
  @ApiOkResponse({ type: FraudCheckDto })
  recheck(@Param('phone') phone: string): Promise<FraudCheckDto> {
    return this.fraud.evaluate(phone, true);
  }

  @Get('savings')
  @RequirePermission('net_profit_fraud.view')
  savings(@Query() query: FraudListQueryDto) {
    return this.fraud.savingsList({
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
    });
  }

  @Get('settings')
  @RequirePermission('net_profit_fraud.view')
  @ApiOkResponse({ type: FraudSettingsDto })
  getSettings(): Promise<FraudSettingsDto> {
    return this.fraud.getSettings();
  }

  @Put('settings')
  @RequirePermission('net_profit_fraud.manage')
  @ApiOkResponse({ type: FraudSettingsDto })
  updateSettings(@Body() dto: UpdateFraudSettingsDto): Promise<FraudSettingsDto> {
    return this.fraud.updateSettings(dto);
  }
}
