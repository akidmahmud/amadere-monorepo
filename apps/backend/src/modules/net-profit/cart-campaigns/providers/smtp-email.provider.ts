import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { EmailProvider, EmailSendResult } from './email-provider.interface';

// Real SMTP via nodemailer (a standard, minimal dependency — no bespoke
// HTTP client for a generic email API this codebase has never had). Lazy
// credential read, same pattern as every other provider: reads
// SMTP_HOST/PORT/USER/PASS/FROM per call, not the constructor, so the app
// boots fine with none set. No real SMTP credentials exist in this
// environment, so a send attempt honestly resolves `{ failed: true }`
// rather than being tested against a live inbox.
@Injectable()
export class SmtpEmailProvider implements EmailProvider {
  private readonly logger = new Logger(SmtpEmailProvider.name);

  constructor(private readonly config: ConfigService) {}

  async send(to: string, subject: string, body: string): Promise<EmailSendResult> {
    const host = this.config.get<string>('SMTP_HOST');
    const port = this.config.get<string>('SMTP_PORT');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    const from = this.config.get<string>('SMTP_FROM') ?? user;
    if (!host || !port || !user || !pass) {
      return { failed: true, error: 'SMTP is not configured (missing SMTP_HOST/PORT/USER/PASS)' };
    }

    try {
      const transport = nodemailer.createTransport({
        host,
        port: Number(port),
        secure: Number(port) === 465,
        auth: { user, pass },
      });
      const info = await transport.sendMail({ from, to, subject, text: body });
      return { id: info.messageId };
    } catch (err) {
      this.logger.warn(`SMTP send failed for ${to}: ${err instanceof Error ? err.message : String(err)}`);
      return { failed: true, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }
}
