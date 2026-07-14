export interface EmailSendResult {
  id?: string;
  failed?: boolean;
  error?: string;
}

// The genuinely new integration this addendum needs (§C's EMAIL channel) —
// no email-sending capability existed anywhere in this codebase before
// (confirmed by grep before building this: even password-reset delivery
// goes through the OTP notifier, which only ever had a console stub).
// Never throws — matches every other provider in this stack.
export interface EmailProvider {
  send(to: string, subject: string, body: string): Promise<EmailSendResult>;
}
