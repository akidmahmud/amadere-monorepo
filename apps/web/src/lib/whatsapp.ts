// Mirrors WhatsappSettings in the backend's whatsapp-settings.service.ts.
// The call fields are optional here because a cached/older API response may
// predate them — CallNowButton treats a missing callEnabled as "show".
export interface WhatsappConfig {
  enabled: boolean;
  phoneNumber: string;
  productMessageTemplate: string;
  floatingMessageTemplate: string;
  callEnabled?: boolean;
  callNumber?: string;
}

export function fillTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (text, [key, value]) => text.replaceAll(`{{${key}}}`, value),
    template,
  );
}

export function buildWhatsappLink(phoneNumber: string, message: string): string {
  return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
}
