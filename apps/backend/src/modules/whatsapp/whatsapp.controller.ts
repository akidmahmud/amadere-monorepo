import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { WhatsappSettingsService, WhatsappSettings } from './whatsapp-settings.service';

// Public and unauthenticated — the storefront's order button and floating
// button both need the phone number and message templates client-side to
// build a wa.me link. Nothing here is a secret (a WhatsApp business number
// is inherently public-facing), so the full settings object is fine to
// expose as-is, unlike the analytics module's split public/admin shape.
@ApiTags('whatsapp')
@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly settings: WhatsappSettingsService) {}

  @Get('config')
  getConfig(): Promise<WhatsappSettings> {
    return this.settings.getSettings();
  }
}
