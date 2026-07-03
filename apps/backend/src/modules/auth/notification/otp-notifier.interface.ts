export const OTP_NOTIFIER = Symbol('OTP_NOTIFIER');

export interface OtpNotifier {
  send(identifier: string, code: string): Promise<void>;
}
