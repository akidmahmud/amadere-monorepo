import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { OrderEmailsModule } from '../order-emails/order-emails.module';
import { AdminDigitalProductsController } from './admin-digital-products.controller';
import { DigitalProductsService } from './digital-products.service';
import { CustomerDownloadsController, DownloadsController } from './downloads.controller';
import { DownloadsService } from './downloads.service';

@Module({
  // MEDIA_STORAGE is provided by MediaModule; import it rather than
  // re-providing a second R2 client.
  // OrderEmailsModule for the download-link email DownloadsService sends on
  // unlock. No cycle: OrderEmailsModule pulls only EmailTemplatesModule /
  // EmailSettingsModule, neither of which reaches back here.
  imports: [MediaModule, OrderEmailsModule],
  controllers: [AdminDigitalProductsController, DownloadsController, CustomerDownloadsController],
  providers: [DigitalProductsService, DownloadsService],
  // DownloadsService is consumed by CheckoutService (free-order unlock) and
  // ManualPaymentService (paid-order unlock) — see downloads.service.ts's
  // own comment on unlockForOrder.
  exports: [DigitalProductsService, DownloadsService],
})
export class DigitalProductsModule {}
