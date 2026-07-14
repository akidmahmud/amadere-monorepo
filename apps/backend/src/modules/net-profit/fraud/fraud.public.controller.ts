import { Body, Controller, Post } from '@nestjs/common';
import { ApiProperty, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsPhoneNumber, IsString } from 'class-validator';
import { FraudService } from './fraud.service';

class EvaluateFraudDto {
  @ApiProperty()
  @IsString()
  @IsPhoneNumber('BD')
  phone!: string;
}

// Storefront-facing pre-flight (CLAUDE.net-profit.md §9): lets a checkout UI
// warn the customer before submitting, without exposing anything from the
// admin surface (no breakdown, no history log). The authoritative gate
// still runs server-side inside CheckoutService itself — this endpoint
// can't be bypassed to skip it, it only mirrors the verdict for live UI
// feedback (badge/popup/COD-hiding — the plugin's checkout fraud widget).
@ApiTags('net-profit/fraud')
@Controller('net-profit/fraud')
export class FraudPublicController {
  constructor(private readonly fraud: FraudService) {}

  @Post('evaluate')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async evaluate(@Body() dto: EvaluateFraudDto) {
    const gate = await this.fraud.evaluateCheckoutGate(dto.phone);
    const check = await this.fraud.peekCached(dto.phone);
    return {
      allowed: gate.allowed,
      riskLevel: gate.riskLevel,
      verdict: gate.verdict,
      hasHistory: (check?.totalOrders ?? 0) > 0,
      successRatePercent: check?.successRate !== null && check?.successRate !== undefined ? Math.round(check.successRate * 1000) / 10 : null,
      totalOrders: check?.totalOrders ?? 0,
      requireAdvancePercent: gate.requireAdvancePercent,
      blockMessage: gate.blockMessage,
    };
  }
}
