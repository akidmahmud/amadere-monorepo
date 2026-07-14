import { Module } from '@nestjs/common';
import { AdminPaymentMethodConfigController } from './admin-payment-method-config.controller';
import { PaymentMethodConfigPublicController } from './payment-method-config.public.controller';
import { PaymentMethodConfigService } from './payment-method-config.service';

@Module({
  controllers: [AdminPaymentMethodConfigController, PaymentMethodConfigPublicController],
  providers: [PaymentMethodConfigService],
})
export class PaymentMethodConfigModule {}
