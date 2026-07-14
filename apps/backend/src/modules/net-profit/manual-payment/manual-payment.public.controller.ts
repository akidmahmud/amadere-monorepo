import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ManualPaymentService } from './manual-payment.service';
import { SubmitManualPaymentDto } from './dto/submit-manual-payment.dto';

// Customer-facing: "I paid to your bKash/Nagad/Rocket number, here's my trx
// id" (spec §7.12). Anyone can submit for any orderId — not a security
// hole, since a bogus submission just sits SUBMITTED until staff verifies
// it against their own gateway account statement.
@ApiTags('net-profit/manual-payment')
@Controller('net-profit/manual-payments')
export class ManualPaymentPublicController {
  constructor(private readonly manualPayment: ManualPaymentService) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  submit(@Body() dto: SubmitManualPaymentDto) {
    return this.manualPayment.submit(dto);
  }
}
