import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { OrderEmailsModule } from '../order-emails/order-emails.module';
import { AccountsModule } from '../net-profit/accounts/accounts.module';
import { AdminShipmentsController } from './admin-shipments.controller';
import { AdminCourierSettingsController } from './admin-courier-settings.controller';
import { CourierWebhooksController } from './courier-webhooks.controller';
import { ShipmentsService } from './shipments.service';
import { SettlementSyncService } from './settlement-sync.service';
import { ShippingChargeCalculator } from './shipping-charge.calculator';
import { CourierSettingsService } from './courier-settings.service';
import { SteadfastCourierProvider } from './providers/steadfast-courier.provider';
import { PathaoCourierProvider } from './providers/pathao-courier.provider';
import { RedxCourierProvider } from './providers/redx-courier.provider';

@Module({
  // AccountsModule: a dispatched COD order opens a receivable against the
  // courier (SalesPostingService). One-directional — Accounts does not
  // import Courier.
  imports: [OrdersModule, OrderEmailsModule, AccountsModule],
  controllers: [AdminShipmentsController, AdminCourierSettingsController, CourierWebhooksController],
  providers: [
    SettlementSyncService,
    ShipmentsService,
    ShippingChargeCalculator,
    CourierSettingsService,
    SteadfastCourierProvider,
    PathaoCourierProvider,
    RedxCourierProvider,
  ],
  // Net Profit Order Manager (§7.8/M2) bulk-consigns through the real
  // ShipmentsService rather than a second courier client.
  exports: [ShipmentsService],
})
export class CourierModule {}
