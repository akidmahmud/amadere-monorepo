import { Module } from '@nestjs/common';
import { WhatsappSettingsService } from './whatsapp-settings.service';
import { AdminWhatsappController } from './admin-whatsapp.controller';
import { WhatsappController } from './whatsapp.controller';

@Module({
  controllers: [AdminWhatsappController, WhatsappController],
  providers: [WhatsappSettingsService],
})
export class WhatsappModule {}
