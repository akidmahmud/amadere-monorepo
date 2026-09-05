import { Body, Controller, Get, Post, Put, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { PushService } from './push.service';
import { SendTestPushDto, UpdatePushKeysDto } from './dto/push.dto';
import { StockAlertsService } from './stock-alerts.service';

@ApiTags('admin/push')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/push')
export class AdminPushController {
  constructor(
    private readonly push: PushService,
    private readonly stockAlerts: StockAlertsService,
  ) {}

  /** Configuration state and the opt-in funnel. Never returns the private key. */
  @Get('settings')
  @RequirePermission('net_profit_sms.view')
  async settings() {
    const [configured, publicKey, stats] = await Promise.all([
      this.push.isConfigured(),
      this.push.getPublicKey(),
      this.push.stats(),
    ]);
    return { configured, publicKey, ...stats };
  }

  /**
   * A fresh key pair for the admin to look at and save.
   *
   * Deliberately does NOT save: rotating keys invalidates every existing
   * subscription on the site, so it takes a second, explicit action.
   */
  @Post('generate-keys')
  @RequirePermission('net_profit_sms.manage')
  generateKeys() {
    return this.push.generateKeys();
  }

  @Put('settings')
  @RequirePermission('net_profit_sms.manage')
  async updateSettings(@Body() dto: UpdatePushKeysDto) {
    await this.push.saveKeys(dto);
    return this.settings();
  }

  /**
   * Run the back-in-stock sweep now instead of waiting for the 10-minute tick.
   *
   * Exists for the case that actually happens: stock is corrected by hand and
   * whoever did it wants the waiting customers told immediately, not at some
   * point in the next ten minutes.
   */
  @Post('stock-alerts/sweep')
  @RequirePermission('net_profit_sms.manage')
  sweepStockAlerts() {
    return this.stockAlerts.sweep();
  }

  @Post('test')
  @RequirePermission('net_profit_sms.manage')
  async test(@Body() dto: SendTestPushDto) {
    return this.push.sendToOne(dto.endpoint, {
      title: dto.title?.trim() || 'Amader™',
      body: dto.body?.trim() || 'Test notification — push is working.',
      url: '/',
      tag: 'amader-test',
    });
  }
}
