import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CourierProviderName } from '@amader/db';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../../common/auth/permission.guard';
import {
  Can,
  RequireAnyPermission,
  RequirePermission,
  type PermissionCheck,
} from '../../../common/auth/permission.decorator';
import { CurrentAdmin } from '../../../common/auth/current-admin.decorator';
import { AuditLogInterceptor } from '../../../common/audit-log/audit-log.interceptor';
import { ProductCostHistoryService } from '../../product-cost-history/product-cost-history.service';
import { AddCostDto, ConfirmCostDto } from './dto/add-cost.dto';
import { SalesReportV2Service, type Scope } from './sales-report-v2.service';
import {
  REPORT_COURIERS,
  ReportSettingsService,
  zoneNames,
} from './report-settings.service';
import { ReportV2QueryDto } from './dto/report-v2-query.dto';
import { CourierBillsService } from './courier-bills.service';

const VIEW = 'net_profit_reports.view';
const VIEW_OWN = 'net_profit_reports.view_own';
const MANAGE = 'net_profit_settings.manage';

/** Full view with `view`; otherwise (view_own only) scoped to the caller's own orders. */
const scopeFor = (adminId: number, can: PermissionCheck): Scope =>
  can(VIEW) ? {} : { agentId: adminId };

@ApiTags('admin/net-profit/sales-report')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/net-profit/sales-report/v2')
export class AdminSalesReportV2Controller {
  constructor(
    private readonly report: SalesReportV2Service,
    private readonly settings: ReportSettingsService,
    private readonly costs: ProductCostHistoryService,
    private readonly bills: CourierBillsService,
  ) {}

  @Get('overview')
  @RequireAnyPermission(VIEW, VIEW_OWN)
  overview(
    @Query() q: ReportV2QueryDto,
    @CurrentAdmin() admin: { id: number },
    @Can() can: PermissionCheck,
  ) {
    return this.report.overview(q, scopeFor(admin.id, can));
  }

  @Get('orders')
  @RequireAnyPermission(VIEW, VIEW_OWN)
  orders(
    @Query() q: ReportV2QueryDto,
    @CurrentAdmin() admin: { id: number },
    @Can() can: PermissionCheck,
  ) {
    return this.report.orders(q, scopeFor(admin.id, can));
  }

  @Get('exceptions')
  @RequireAnyPermission(VIEW, VIEW_OWN)
  exceptions(
    @Query() q: ReportV2QueryDto,
    @CurrentAdmin() admin: { id: number },
    @Can() can: PermissionCheck,
  ) {
    return this.report.exceptions(q, scopeFor(admin.id, can));
  }

  @Get('agents')
  @RequirePermission(VIEW)
  agents(@Query() q: ReportV2QueryDto) {
    return this.report.agents(q);
  }

  @Get('products')
  @RequirePermission(VIEW)
  products(@Query() q: ReportV2QueryDto) {
    return this.report.products(q);
  }

  @Get('couriers')
  @RequirePermission(VIEW)
  couriers(@Query() q: ReportV2QueryDto) {
    return this.report.couriers(q);
  }

  @Get('districts')
  @RequirePermission(VIEW)
  districts(@Query() q: ReportV2QueryDto) {
    return this.report.districts(q);
  }

  @Get('settings')
  @RequirePermission(VIEW)
  async getSettings(@Can() can: PermissionCheck) {
    const [settings, zones] = await Promise.all([
      this.settings.get(),
      this.settings.zoneConfig(),
    ]);
    return {
      settings,
      couriers: REPORT_COURIERS,
      zones: zoneNames(zones),
      canEdit: can(MANAGE),
    };
  }

  @Put('settings')
  @RequirePermission(MANAGE)
  async putSettings(@Body() body: unknown) {
    const [settings, zones] = await Promise.all([
      this.settings.update(body),
      this.settings.zoneConfig(),
    ]);
    return {
      settings,
      couriers: REPORT_COURIERS,
      zones: zoneNames(zones),
      canEdit: true,
    };
  }

  @Get('costs')
  @RequirePermission(VIEW)
  listCosts(@Query('productId', ParseIntPipe) productId: number) {
    return this.costs.list(productId);
  }

  @Post('costs')
  @RequirePermission(MANAGE)
  addCost(@Body() body: AddCostDto, @CurrentAdmin() admin: { id: number }) {
    return this.costs.addCost(body, admin.id);
  }

  @Patch('costs/:id')
  @RequirePermission(MANAGE)
  confirmCost(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ConfirmCostDto,
  ) {
    return this.costs.setConfirmed(id, body.confirmed);
  }

  @Delete('costs/:id')
  @RequirePermission(MANAGE)
  async removeCost(@Param('id', ParseIntPipe) id: number) {
    await this.costs.remove(id);
    return { id };
  }

  @Post('courier-bills')
  @RequirePermission(MANAGE)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  importBills(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('provider') provider: string,
  ) {
    if (!file)
      throw new BadRequestException('Attach the courier statement CSV');
    if (!REPORT_COURIERS.includes(provider))
      throw new BadRequestException('Unknown courier');
    return this.bills.import(
      provider as CourierProviderName,
      file.buffer.toString('utf8'),
      file.originalname,
    );
  }
}
