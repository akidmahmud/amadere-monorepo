export interface WhatsappConfig {
  enabled: boolean;
  phoneNumber: string;
  productMessageTemplate: string;
  floatingMessageTemplate: string;
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
