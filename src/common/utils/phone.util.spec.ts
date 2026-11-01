import { BadRequestException } from '@nestjs/common';
import {
  normalizePhone,
  normalizePhoneOrThrow,
  toWhatsAppDigits,
} from './phone.util';

describe('phone.util', () => {
  describe('normalizePhone', () => {
    it.each([
      ['08034567890', '+2348034567890'],
      ['0803 456 7890', '+2348034567890'],
      ['8034567890', '+2348034567890'],
      ['+234 803 456 7890', '+2348034567890'],
      ['+2348034567890', '+2348034567890'],
      ['2348034567890', '+2348034567890'],
      ['+44 7911 123456', '+447911123456'],
    ])('normalises %s to %s', (raw, expected) => {
      expect(normalizePhone(raw)).toBe(expected);
    });

    it('rejects landline-shaped numbers that are not valid in Nigeria', () => {
      expect(normalizePhone('01 271 2345')).toBeNull();
    });

    it.each(['', '   ', '123', '0803', 'abc', '+234 803'])(
      'returns null for %p',
      (raw) => {
        expect(normalizePhone(raw)).toBeNull();
      },
    );

    it('uses the supplied default country', () => {
      expect(normalizePhone('07911 123456', 'GB')).toBe('+447911123456');
    });
  });

  describe('toWhatsAppDigits', () => {
    it('strips the leading plus', () => {
      expect(toWhatsAppDigits('+2348034567890')).toBe('2348034567890');
    });
  });

  describe('normalizePhoneOrThrow', () => {
    it('returns null for blank input', () => {
      expect(normalizePhoneOrThrow(undefined)).toBeNull();
      expect(normalizePhoneOrThrow(null)).toBeNull();
      expect(normalizePhoneOrThrow('  ')).toBeNull();
    });

    it('returns E.164 for valid input', () => {
      expect(normalizePhoneOrThrow('08034567890')).toBe('+2348034567890');
    });

    it('throws a 400 for invalid input', () => {
      expect(() => normalizePhoneOrThrow('12')).toThrow(BadRequestException);
      expect(() => normalizePhoneOrThrow('12')).toThrow(
        'Please enter a valid phone number',
      );
    });
  });
});
