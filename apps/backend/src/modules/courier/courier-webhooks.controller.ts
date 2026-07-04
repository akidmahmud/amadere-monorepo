import {
  Body,
  Controller,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ShipmentsService } from './shipments.service';

interface SteadfastWebhookPayload {
  consignment_id: string;
  status: string;
  updated_at?: string;
}

@ApiTags('webhooks')
@Controller('webhooks')
export class CourierWebhooksController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shipments: ShipmentsService,
  ) {}

  @Post('steadfast')
  async steadfast(
    @Headers('authorization') authorization: string | undefined,
    @Body() payload: SteadfastWebhookPayload,
  ) {
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
