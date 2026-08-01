import { Module } from '@nestjs/common';
import { AdminInvoiceTemplateSettingsController } from './admin-invoice-template-settings.controller';
import { InvoiceTemplateSettingsService } from './invoice-template-settings.service';

@Module({
  controllers: [AdminInvoiceTemplateSettingsController],
  providers: [InvoiceTemplateSettingsService],
})
export class InvoiceTemplateSettingsModule {}
