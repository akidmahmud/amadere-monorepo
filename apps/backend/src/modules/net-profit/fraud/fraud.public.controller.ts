import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsPhoneNumber, IsString } from 'class-validator';
import { FraudService } from './fraud.service';

class EvaluateFraudDto {
  @IsString()
  @IsPhoneNumber('BD')
  phone!: string;
}

// Storefront-facing pre-flight (CLAUDE.net-profit.md §9): lets a checkout UI
// warn the customer before submitting, without exposing anything from the
// admin surface. The authoritative gate still runs server-side inside
// CheckoutService itself — this endpoint can't be bypassed to skip it.
@ApiTags('net-profit/fraud')
@Controller('net-profit/fraud')
export class FraudPublicController {
  constructor(private readonly fraud: FraudService) {}

  @Post('evaluate')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async evaluate(@Body() dto: EvaluateFraudDto) {
    const gate = await this.fraud.evaluateCheckoutGate(dto.phone);
    return { allowed: gate.allowed, riskLevel: gate.riskLevel };
  }
}
