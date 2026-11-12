/**
 * Masks an email address: e.g. "tunde@example.com" -> "t***@example.com"
 */
export function maskEmail(email: string | null | undefined): string | null {
  if (!email || !email.includes('@')) return null;
  const [local, domain] = email.trim().toLowerCase().split('@');
  if (!local || !domain) return null;
  const firstChar = local.charAt(0);
  return `${firstChar}***@${domain}`;
}

/**
 * Masks a phone number: e.g. "+2348034567890" -> "•••• ••• 7890"
 */
export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return null;
  const last4 = digits.slice(-4);
  return `•••• ••• ${last4}`;
}
