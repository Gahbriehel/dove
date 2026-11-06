import { BadRequestException } from '@nestjs/common';
import { normalizePhone } from '../../common/utils/phone.util';

export const COMMON_PINS = new Set([
  '1212',
  '1122',
  '2580',
  '0852',
  '1004',
  '6969',
]);

const ASCENDING_RUNS = '0123456789012';
const DESCENDING_RUNS = '9876543210987';

/**
 * Checks whether a 4-digit PIN violates weak-PIN rules:
 * - all digits the same (0000, 1111 ...)
 * - ascending or descending runs (1234, 4321, 0123, 9876 ...)
 * - common PINs (1212, 1122, 2580, 0852, 1004, 6969)
 */
export function isWeakPin(pin: string): boolean {
  if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
    return true;
  }

  // All digits the same (0000, 1111 ... 9999)
  if (pin[0] === pin[1] && pin[1] === pin[2] && pin[2] === pin[3]) {
    return true;
  }

  // Ascending or descending runs
  if (ASCENDING_RUNS.includes(pin) || DESCENDING_RUNS.includes(pin)) {
    return true;
  }

  // Common PINs denylist
  if (COMMON_PINS.has(pin)) {
    return true;
  }

  return false;
}

/**
 * Throws a 400 Bad Request with code PIN_TOO_WEAK if the PIN is weak.
 */
export function validatePinStrength(pin: string): void {
  if (isWeakPin(pin)) {
    throw new BadRequestException({
      message:
        'The PIN chosen is too weak or easy to guess. Please choose a different 4-digit PIN.',
      code: 'PIN_TOO_WEAK',
    });
  }
}

/**
 * Generates alternative candidate strings for matching phone numbers
 * (e.g. domestic Nigerian '0803...' vs E.164 '+234803...' vs un-prefixed '234803...').
 */
export function getPhoneCandidates(raw: string): string[] {
  const trimmed = raw.trim();
  const normalized = normalizePhone(trimmed);
  const candidates = new Set<string>();

  candidates.add(trimmed);
  if (normalized) {
    candidates.add(normalized);
    if (normalized.startsWith('+234') && normalized.length === 14) {
      candidates.add(`0${normalized.slice(4)}`);
      candidates.add(normalized.slice(1));
    }
    candidates.add(normalized.replace(/^\+/, ''));
  }
  if (/^0\d{10}$/.test(trimmed)) {
    candidates.add(`+234${trimmed.slice(1)}`);
    candidates.add(`234${trimmed.slice(1)}`);
  }

  return Array.from(candidates);
}
