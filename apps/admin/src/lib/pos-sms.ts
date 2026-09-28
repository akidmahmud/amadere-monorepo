/**
 * How many SMS a message costs. Plain English (GSM-7): 160 chars, or 153 per
 * part when split. Anything else — Bangla, ৳, emoji — is Unicode: 70 / 67.
 */
export function smsParts(text: string): {
  chars: number;
  parts: number;
  unicode: boolean;
} {
  // ponytail: GSM-7 check by character range only (ignores the extended table's double-width chars).
  const unicode =
    /[^\n\r\x20-\x7E£¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ¤¡ÄÖÑÜ§¿äöñüà]/.test(text);
  const chars = [...text].length;
  const [one, many] = unicode ? [70, 67] : [160, 153];
  return {
    chars,
    parts: chars === 0 ? 0 : chars <= one ? 1 : Math.ceil(chars / many),
    unicode,
  };
}

/** {{tag}} → value, same rule as the server (unknown tags become empty). */
export const renderSmsPreview = (tpl: string, vars: Record<string, string>) =>
  tpl
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => vars[k] ?? "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
