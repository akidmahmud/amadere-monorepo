import { Injectable, Logger } from '@nestjs/common';
import { OtpNotifier } from './otp-notifier.interface';
import { SmsService } from '../../net-profit/sms/sms.service';
import { SmtpEmailProvider } from '../../net-profit/cart-campaigns/providers/smtp-email.provider';

const BD_PHONE_RE = /^(?:\+?880|0)?1[3-9]\d{8}$/;

// Real send, replacing ConsoleOtpNotifier — routes through the same
// SmsService/SmsTemplate('otp') path every other transactional SMS in this
// app uses (§H). `identifier` can be a phone or an email (customer
// register/login accepts either, and admin login OTP always uses email —
// see OtpRequestDto / ADMIN_LOGIN purpose): phone-shaped identifiers go out
// as SMS, everything else goes out as email via the same SmtpEmailProvider
// cart-campaigns already uses (no SMTP creds in this env → logs a warning
// and the code still lands in the `Otp` row for manual/dev verification).
@Injectable()
export class SmsOtpNotifier implements OtpNotifier {
  private readonly logger = new Logger(SmsOtpNotifier.name);

  constructor(
    private readonly sms: SmsService,
    private readonly email: SmtpEmailProvider,
  ) {}

  async send(identifier: string, code: string): Promise<void> {
    if (BD_PHONE_RE.test(identifier)) {
      await this.sms.sendTemplate('otp', identifier, 'EN', { code });
      return;
    }
    const result = await this.email.send(
      identifier,
      'Your verification code',
      `Your verification code is ${code}. It expires in 5 minutes. If you didn't request this, you can ignore this email.`,
    );
    if (result.failed) this.logger.warn(`Email OTP send failed for ${identifier}: ${result.error}`);
  }
}
