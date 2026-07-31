import { Module } from '@nestjs/common';
import { AdminInvoiceSettingsController } from './admin-invoice-settings.controller';
import { InvoiceSettingsService } from './invoice-settings.service';

@Module({
  controllers: [AdminInvoiceSettingsController],
  providers: [InvoiceSettingsService],
})
export class InvoiceSettingsModule {}
