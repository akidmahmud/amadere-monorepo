import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailTemplatesService } from '../../email-templates/email-templates.service';
import { SettingsService } from '../../settings/settings.service';
import { OtpNotifier } from './otp-notifier.interface';
import { SmsService } from '../../net-profit/sms/sms.service';
import { SmtpEmailProvider } from '../../net-profit/cart-campaigns/providers/smtp-email.provider';

const BD_PHONE_RE = /^(?:\+?880|0)?1\d{9}$/;

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
    private readonly emailTemplates: EmailTemplatesService,
    private readonly settings: SettingsService,
    private readonly config: ConfigService,
  ) {}

  private async storeLogoUrl(): Promise<string> {
    try {
      return (await this.settings.getSiteInfo()).logoUrl ?? '';
    } catch {
      // A missing logo must never block a verification code.
      return '';
    }
  }

  async send(identifier: string, code: string): Promise<void> {
    if (BD_PHONE_RE.test(identifier)) {
      await this.sms.sendTemplate('otp', identifier, 'EN', { code });
      return;
    }
    // Rendered from the admin-editable `customer_otp` row in
    // Settings > Email templates — no hardcoded body. Falls back to plain
    // text only if that row is missing or an admin disabled it, so a
    // template problem can never silently stop people receiving codes.
    const rendered = await this.emailTemplates.render('customer_otp', {
      code,
      expiry_minutes: '5',
      logo_url: await this.storeLogoUrl(),
      shop_url: this.config.get<string>('STOREFRONT_BASE_URL') ?? '',
    });
    const result = rendered
      ? await this.email.send(identifier, rendered.subject, rendered.html, { html: rendered.html })
      : await this.email.send(
          identifier,
          'Your verification code',
          `Your verification code is ${code}. It expires in 5 minutes. If you didn't request this, you can ignore this email.`,
        );
    if (result.failed) this.logger.warn(`Email OTP send failed for ${identifier}: ${result.error}`);
  }
}
