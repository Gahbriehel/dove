import { RelativeRateLimiter } from './relative-rate-limiter';

describe('RelativeRateLimiter', () => {
  let limiter: RelativeRateLimiter;

  beforeEach(() => {
    limiter = new RelativeRateLimiter();
  });

  describe('tryConsumeAdd', () => {
    it('allows up to 10 adds in 24 hours per member', () => {
      const now = 1000000;
      for (let i = 0; i < 10; i++) {
        expect(limiter.tryConsumeAdd('member-1', now + i)).toBe(true);
      }
      expect(limiter.tryConsumeAdd('member-1', now + 10)).toBe(false);
      // Different member is independent
      expect(limiter.tryConsumeAdd('member-2', now + 10)).toBe(true);
    });

    it('resets after 24 hours', () => {
      const now = 1000000;
      for (let i = 0; i < 10; i++) {
        limiter.tryConsumeAdd('member-1', now + i);
      }
      const dayLater = now + 24 * 60 * 60 * 1000 + 1;
      expect(limiter.tryConsumeAdd('member-1', dayLater)).toBe(true);
    });
  });

  describe('tryConsumeClaimLink', () => {
    it('allows up to 3 claim link generations in 24 hours per target person', () => {
      const now = 1000000;
      for (let i = 0; i < 3; i++) {
        expect(limiter.tryConsumeClaimLink('target-1', now + i)).toBe(true);
      }
      expect(limiter.tryConsumeClaimLink('target-1', now + 3)).toBe(false);
      // Different target is independent
      expect(limiter.tryConsumeClaimLink('target-2', now + 3)).toBe(true);
    });

    it('resets after 24 hours', () => {
      const now = 1000000;
      for (let i = 0; i < 3; i++) {
        limiter.tryConsumeClaimLink('target-1', now + i);
      }
      const dayLater = now + 24 * 60 * 60 * 1000 + 1;
      expect(limiter.tryConsumeClaimLink('target-1', dayLater)).toBe(true);
    });
  });
});
