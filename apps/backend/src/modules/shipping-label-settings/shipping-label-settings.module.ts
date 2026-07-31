import { Module } from '@nestjs/common';
import { AdminShippingLabelSettingsController } from './admin-shipping-label-settings.controller';
import { ShippingLabelSettingsService } from './shipping-label-settings.service';

@Module({
  controllers: [AdminShippingLabelSettingsController],
  providers: [ShippingLabelSettingsService],
})
export class ShippingLabelSettingsModule {}
