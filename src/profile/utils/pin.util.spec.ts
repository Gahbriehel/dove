import { BadRequestException } from '@nestjs/common';
import { getPhoneCandidates, isWeakPin, validatePinStrength } from './pin.util';

describe('pin.util', () => {
  describe('isWeakPin', () => {
    it('detects repeated digits', () => {
      expect(isWeakPin('0000')).toBe(true);
      expect(isWeakPin('1111')).toBe(true);
      expect(isWeakPin('5555')).toBe(true);
      expect(isWeakPin('9999')).toBe(true);
    });

    it('detects ascending runs', () => {
      expect(isWeakPin('0123')).toBe(true);
      expect(isWeakPin('1234')).toBe(true);
      expect(isWeakPin('2345')).toBe(true);
      expect(isWeakPin('6789')).toBe(true);
      expect(isWeakPin('7890')).toBe(true);
    });

    it('detects descending runs', () => {
      expect(isWeakPin('4321')).toBe(true);
      expect(isWeakPin('9876')).toBe(true);
      expect(isWeakPin('3210')).toBe(true);
      expect(isWeakPin('0987')).toBe(true);
    });

    it('detects common PINs list', () => {
      expect(isWeakPin('1212')).toBe(true);
      expect(isWeakPin('1122')).toBe(true);
      expect(isWeakPin('2580')).toBe(true);
      expect(isWeakPin('0852')).toBe(true);
      expect(isWeakPin('1004')).toBe(true);
      expect(isWeakPin('6969')).toBe(true);
    });

    it('returns false for strong PINs', () => {
      expect(isWeakPin('2846')).toBe(false);
      expect(isWeakPin('8137')).toBe(false);
      expect(isWeakPin('5820')).toBe(false);
      expect(isWeakPin('9416')).toBe(false);
    });

    it('treats invalid format as weak', () => {
      expect(isWeakPin('12')).toBe(true);
      expect(isWeakPin('12345')).toBe(true);
      expect(isWeakPin('abcd')).toBe(true);
      expect(isWeakPin('')).toBe(true);
    });
  });

  describe('validatePinStrength', () => {
    it('throws BadRequestException with code PIN_TOO_WEAK for weak PIN', () => {
      try {
        validatePinStrength('1234');
        fail('Expected validatePinStrength to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(BadRequestException);
        expect((err as BadRequestException).getResponse()).toMatchObject({
          code: 'PIN_TOO_WEAK',
        });
      }
    });

    it('does not throw for a strong PIN', () => {
      expect(() => validatePinStrength('8137')).not.toThrow();
    });
  });

  describe('getPhoneCandidates', () => {
    it('generates both 0803... and +234803... forms for Nigerian numbers', () => {
      const candidatesFromDomestic = getPhoneCandidates('08031234567');
      expect(candidatesFromDomestic).toContain('08031234567');
      expect(candidatesFromDomestic).toContain('+2348031234567');

      const candidatesFromE164 = getPhoneCandidates('+2348031234567');
      expect(candidatesFromE164).toContain('+2348031234567');
      expect(candidatesFromE164).toContain('08031234567');
    });
  });
});
