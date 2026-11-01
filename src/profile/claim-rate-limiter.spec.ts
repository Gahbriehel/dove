import { ClaimRateLimiter } from './claim-rate-limiter';

describe('ClaimRateLimiter', () => {
  const t0 = 1_000_000;

  it('blocks a second request within 60 seconds', () => {
    const limiter = new ClaimRateLimiter();
    expect(limiter.tryConsume('a@x.com', t0)).toBe(true);
    expect(limiter.tryConsume('a@x.com', t0 + 30_000)).toBe(false);
    expect(limiter.tryConsume('a@x.com', t0 + 61_000)).toBe(true);
  });

  it('allows at most 5 per hour', () => {
    const limiter = new ClaimRateLimiter();
    for (let i = 0; i < 5; i++) {
      expect(limiter.tryConsume('a@x.com', t0 + i * 61_000)).toBe(true);
    }
    expect(limiter.tryConsume('a@x.com', t0 + 6 * 61_000)).toBe(false);
    expect(limiter.tryConsume('a@x.com', t0 + 61 * 60_000)).toBe(true);
  });

  it('tracks emails independently', () => {
    const limiter = new ClaimRateLimiter();
    expect(limiter.tryConsume('a@x.com', t0)).toBe(true);
    expect(limiter.tryConsume('b@x.com', t0)).toBe(true);
  });
});
