import { BadRequestException } from '@nestjs/common';
import {
  CountryCode,
  isValidPhoneNumber,
  parsePhoneNumberFromString,
} from 'libphonenumber-js';

export const INVALID_PHONE_MESSAGE = 'Please enter a valid phone number';

/**
 * Converts a phone number typed in any common format to E.164
 * (e.g. `0803 456 7890` -> `+2348034567890`). Returns null when the input is
 * not a valid number for the given default country.
 */
export function normalizePhone(
  raw: string,
  defaultCountry: CountryCode = 'NG',
): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;

  // Numbers stored without a "+" but already carrying the country code
  // (e.g. 2348034567890) are parsed as international numbers.
  const candidates = /^\d{11,15}$/.test(trimmed.replace(/[\s\-().]/g, ''))
    ? [trimmed, `+${trimmed.replace(/[\s\-().]/g, '')}`]
    : [trimmed];

  for (const candidate of candidates) {
    const parsed = parsePhoneNumberFromString(candidate, defaultCountry);
    if (parsed && isValidPhoneNumber(parsed.number)) {
      return parsed.number;
    }
  }
  return null;
}

/** Strips the leading "+" so the number can be used in a wa.me link. */
export function toWhatsAppDigits(e164: string): string {
  return e164.replace(/^\+/, '');
}

/**
 * Normalises a phone number being written through the API. Blank input clears
 * the value (null); an invalid number is rejected with a 400.
 */
export function normalizePhoneOrThrow(
  raw: string | null | undefined,
): string | null {
  if (raw === null || raw === undefined || raw.trim() === '') return null;
  const normalized = normalizePhone(raw);
  if (!normalized) {
    throw new BadRequestException(INVALID_PHONE_MESSAGE);
  }
  return normalized;
}
