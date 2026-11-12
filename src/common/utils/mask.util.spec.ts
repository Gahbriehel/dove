import { maskEmail, maskPhone } from './mask.util';

describe('mask.util', () => {
  describe('maskEmail', () => {
    it('masks standard email to first char and ***@domain', () => {
      expect(maskEmail('tunde@example.com')).toBe('t***@example.com');
      expect(maskEmail('ADA.ADEYEMI@CHURCH.ORG')).toBe('a***@church.org');
    });

    it('returns null for null, undefined or invalid emails', () => {
      expect(maskEmail(null)).toBeNull();
      expect(maskEmail(undefined)).toBeNull();
      expect(maskEmail('')).toBeNull();
      expect(maskEmail('invalid-email')).toBeNull();
    });
  });

  describe('maskPhone', () => {
    it('masks phone to bullet dots and last 4 digits', () => {
      expect(maskPhone('08034567890')).toBe('•••• ••• 7890');
      expect(maskPhone('+2348034567890')).toBe('•••• ••• 7890');
      expect(maskPhone('+44 7911 123456')).toBe('•••• ••• 3456');
    });

    it('returns null for null, undefined or too short numbers', () => {
      expect(maskPhone(null)).toBeNull();
      expect(maskPhone(undefined)).toBeNull();
      expect(maskPhone('')).toBeNull();
      expect(maskPhone('123')).toBeNull();
    });
  });
});
