import { Module } from '@nestjs/common';
import { AdminEmailTemplatesController } from './admin-email-templates.controller';
import { EmailTemplatesService } from './email-templates.service';
import { EmailSettingsModule } from '../email-settings/email-settings.module';

@Module({
  imports: [EmailSettingsModule],
  controllers: [AdminEmailTemplatesController],
  providers: [EmailTemplatesService],
  // Exported for later sub-projects (order-lifecycle emails, admin
  // password reset, contact form) to import and call render().
  exports: [EmailTemplatesService],
})
export class EmailTemplatesModule {}
