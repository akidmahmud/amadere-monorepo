export interface EmailSendResult {
  id?: string;
  failed?: boolean;
  error?: string;
}

export interface EmailSendOptions {
  html?: string;
  // Per-send sender identity override (newsletter campaigns §5: From name /
  // From email / Reply-to) — falls back to Settings > Email's stored
  // identity when omitted, same as every existing caller (recovery emails,
  // OTP) already gets.
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
}

// The genuinely new integration this addendum needs (§C's EMAIL channel) —
// no email-sending capability existed anywhere in this codebase before
// (confirmed by grep before building this: even password-reset delivery
// goes through the OTP notifier, which only ever had a console stub).
// Never throws — matches every other provider in this stack.
export interface EmailProvider {
  send(to: string, subject: string, body: string, options?: EmailSendOptions): Promise<EmailSendResult>;
}
