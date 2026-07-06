import {
  Body,
  Controller,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ShipmentsService } from './shipments.service';

interface SteadfastWebhookPayload {
  consignment_id: string;
  status: string;
  updated_at?: string;
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
  ) {}

  @Post('steadfast')
  @ApiOkResponse({ type: WebhookAckDto })
  async steadfast(
    @Headers('authorization') authorization: string | undefined,
    @Body() payload: SteadfastWebhookPayload,
  ): Promise<WebhookAckDto> {
    const setting = await this.prisma.client.setting.findUnique({
      where: { key: 'steadfast_webhook_token' },
    });
    const expected =
      typeof setting?.value === 'string' ? setting.value : undefined;
    const provided = authorization?.replace(/^Bearer\s+/i, '');

    if (!expected || provided !== expected) throw new UnauthorizedException();

    await this.shipments.handleSteadfastWebhook(payload);
    return { status: true };
  }
}
