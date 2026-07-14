import { Injectable, Logger } from '@nestjs/common';
import { OtpNotifier } from './otp-notifier.interface';
import { SmsService } from '../../net-profit/sms/sms.service';

const BD_PHONE_RE = /^(?:\+?880|0)?1[3-9]\d{8}$/;

// Real send, replacing ConsoleOtpNotifier — routes through the same
// SmsService/SmsTemplate('otp') path every other transactional SMS in this
// app uses (§H). `identifier` can be a phone or an email (customer
// register/login accepts either, see OtpRequestDto) — only phone-shaped
// identifiers go out as SMS; email identifiers still just log, since no
// email-OTP delivery path exists yet (a separate, un-requested feature).
@Injectable()
export class SmsOtpNotifier implements OtpNotifier {
  private readonly logger = new Logger(SmsOtpNotifier.name);

  constructor(private readonly sms: SmsService) {}

  async send(identifier: string, code: string): Promise<void> {
    if (!BD_PHONE_RE.test(identifier)) {
      this.logger.log(`OTP for ${identifier}: ${code}`);
      return;
    }
    await this.sms.sendTemplate('otp', identifier, 'EN', { code });
  }
}
