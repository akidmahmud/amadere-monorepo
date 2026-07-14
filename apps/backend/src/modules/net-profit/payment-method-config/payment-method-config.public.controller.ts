import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PaymentMethodConfigService } from './payment-method-config.service';

@ApiTags('net-profit/payment-methods')
@Controller('net-profit/payment-methods')
export class PaymentMethodConfigPublicController {
  constructor(private readonly config: PaymentMethodConfigService) {}

  @Get()
  list() {
    return this.config.publicList();
  }
}
