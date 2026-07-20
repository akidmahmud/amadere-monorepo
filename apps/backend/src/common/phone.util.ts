// Normalizes any of the common BD phone input shapes (01XXXXXXXXX,
// 8801XXXXXXXXX, +8801XXXXXXXXX) to E.164 for the "Call" button. Returns
// null for anything that isn't a valid 11-digit BD mobile number.
export function toE164Bd(phone: string): string | null {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('880')) digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (!/^1[3-9]\d{8}$/.test(digits)) return null;
  return `+880${digits}`;
}
