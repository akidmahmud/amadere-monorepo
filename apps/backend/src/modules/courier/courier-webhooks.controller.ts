import {
  Body,
  Controller,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditLogService } from '../../common/audit-log/audit-log.service';
import { ShipmentsService } from './shipments.service';

interface SteadfastWebhookPayload {
  consignment_id: string;
  status: string;
  updated_at?: string;
}

// Pathao/RedX have no publicly-documented webhook payload shape available
// to verify against (unlike Steadfast, confirmed live against the real
// reference integration in B7) — this is a reasonable, honest best-effort
// shape (a consignment/tracking id + a status string), the same fields
// every BD courier's status callback carries. Upgrade the field names here
// once real Pathao/RedX webhook docs or a live payload sample exist.
interface GenericCourierWebhookPayload {
  consignment_id?: string;
  tracking_code?: string;
  status: string;
  [key: string]: unknown;
}

class WebhookAckDto {
  status!: boolean;
}

@ApiTags('webhooks')
@Controller('webhooks')
export class CourierWebhooksController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shipments: ShipmentsService,
    private readonly auditLog: AuditLogService,
  ) {}

  @Post('steadfast')
  @ApiOkResponse({ type: WebhookAckDto })
  async steadfast(
    @Headers('authorization') authorization: string | undefined,
    @Body() payload: SteadfastWebhookPayload,
  ): Promise<WebhookAckDto> {
    await this.verifyToken('steadfast_webhook_token', authorization);
    await this.shipments.handleSteadfastWebhook(payload);
    await this.auditLog.record({
      adminUserId: null,
      action: 'webhook.courier_status',
      entityType: 'shipment',
      changes: { provider: 'STEADFAST', consignmentId: payload.consignment_id, status: payload.status },
    });
    return { status: true };
  }

  // ADDENDUM §F — inbound status push so Pathao/RedX orders move the same
  // way Steadfast's already do, feeding Returned analytics (§B2) and fraud
  // history (§A) off the same Shipment rows. Never trusts the payload
  // blindly: the settings-token check below runs before anything else, and
  // a consignment id that doesn't match a real Shipment 404s rather than
  // silently no-oping (handleCourierWebhook throws NotFoundException).
  @Post('pathao')
  @ApiOkResponse({ type: WebhookAckDto })
  async pathao(
    @Headers('authorization') authorization: string | undefined,
    @Body() payload: GenericCourierWebhookPayload,
  ): Promise<WebhookAckDto> {
    await this.verifyToken('pathao_webhook_token', authorization);
    const consignmentId = payload.consignment_id ?? payload.tracking_code;
    if (!consignmentId) throw new UnauthorizedException('Missing consignment identifier');
    await this.shipments.handleCourierWebhook('PATHAO', consignmentId, payload.status, payload);
    await this.auditLog.record({
      adminUserId: null,
      action: 'webhook.courier_status',
      entityType: 'shipment',
      changes: { provider: 'PATHAO', consignmentId, status: payload.status },
    });
    return { status: true };
  }

  @Post('redx')
  @ApiOkResponse({ type: WebhookAckDto })
  async redx(
    @Headers('authorization') authorization: string | undefined,
    @Body() payload: GenericCourierWebhookPayload,
  ): Promise<WebhookAckDto> {
    await this.verifyToken('redx_webhook_token', authorization);
    const consignmentId = payload.consignment_id ?? payload.tracking_code;
    if (!consignmentId) throw new UnauthorizedException('Missing consignment identifier');
    await this.shipments.handleCourierWebhook('REDX', consignmentId, payload.status, payload);
    await this.auditLog.record({
      adminUserId: null,
      action: 'webhook.courier_status',
      entityType: 'shipment',
      changes: { provider: 'REDX', consignmentId, status: payload.status },
    });
    return { status: true };
  }

  private async verifyToken(settingKey: string, authorization: string | undefined): Promise<void> {
    const setting = await this.prisma.client.setting.findUnique({ where: { key: settingKey } });
    const expected = typeof setting?.value === 'string' ? setting.value : undefined;
    const provided = authorization?.replace(/^Bearer\s+/i, '');
    if (!expected || provided !== expected) throw new UnauthorizedException();
  }
}
