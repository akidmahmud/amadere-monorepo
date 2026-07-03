import { Injectable, Logger } from '@nestjs/common';
import { OtpNotifier } from './otp-notifier.interface';

// PHASE 2 HOOK (credentials, not scope): real SMS/email gateways (fob-sms
// KhudeBarta-style or similar) plug in behind OtpNotifier once credentials
// arrive — same deferred-provider pattern as Payment/Courier (AGENTS.md §6).
@Injectable()
export class ConsoleOtpNotifier implements OtpNotifier {
  private readonly logger = new Logger(ConsoleOtpNotifier.name);

  async send(identifier: string, code: string): Promise<void> {
    this.logger.log(`OTP for ${identifier}: ${code}`);
    await Promise.resolve();
  }
}
