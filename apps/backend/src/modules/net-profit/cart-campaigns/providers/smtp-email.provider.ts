import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { EmailProvider, EmailSendResult } from './email-provider.interface';
import { EmailSettingsService } from '../../../email-settings/email-settings.service';

// Real SMTP via nodemailer (a standard, minimal dependency — no bespoke
// HTTP client for a generic email API this codebase has never had).
// Admin-configured credentials (Settings > Email) win when present, same
// "DB wins, .env is the bootstrap fallback" pattern as every other provider
// this session (Steadfast, Pathao, RedX, ...) — reads fresh per call, not
// the constructor, so the app boots fine with none set either way.
@Injectable()
export class SmtpEmailProvider implements EmailProvider {
  private readonly logger = new Logger(SmtpEmailProvider.name);

  constructor(
    private readonly config: ConfigService,
    private readonly emailSettings: EmailSettingsService,
  ) {}

  async send(to: string, subject: string, body: string): Promise<EmailSendResult> {
    const stored = await this.emailSettings.getCredentials();
    const host = stored.host || this.config.get<string>('SMTP_HOST');
    const port = stored.host ? stored.port : Number(this.config.get<string>('SMTP_PORT'));
    const user = stored.username || this.config.get<string>('SMTP_USER');
    const pass = stored.password || this.config.get<string>('SMTP_PASS');
    const from =
      stored.senderEmail ||
      this.config.get<string>('SMTP_FROM') ||
      user;
    if (!host || !port || !user || !pass) {
      return { failed: true, error: 'SMTP is not configured (missing host/port/username/password)' };
    }

    try {
      const transport = nodemailer.createTransport({
        host,
        port,
        secure: stored.host ? stored.encryption === 'ssl' : port === 465,
        auth: { user, pass },
      });
      const fromHeader = stored.senderName ? `"${stored.senderName}" <${from}>` : from;
      const info = await transport.sendMail({ from: fromHeader, to, subject, text: body });
      return { id: info.messageId };
    } catch (err) {
      this.logger.warn(`SMTP send failed for ${to}: ${err instanceof Error ? err.message : String(err)}`);
      return { failed: true, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }
}
