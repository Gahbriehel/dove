import { Injectable } from '@nestjs/common';

const MIN_GAP_MS = 60 * 1000;
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const PRUNE_THRESHOLD = 1000;

/**
 * Per-email limiter for profile link requests: 1 per 60 s and 5 per hour.
 * Counters live in memory, which is correct for a single instance. Use a
 * shared store (Redis) if Dove is ever run as more than one instance.
 */
@Injectable()
export class ClaimRateLimiter {
  private readonly hits = new Map<string, number[]>();

  /** Records an attempt and returns false when the email is over its limit. */
  tryConsume(email: string, now = Date.now()): boolean {
    if (this.hits.size > PRUNE_THRESHOLD) this.prune(now);

    const recent = (this.hits.get(email) ?? []).filter(
      (t) => now - t < WINDOW_MS,
    );
    const last = recent[recent.length - 1];
    if (
      recent.length >= MAX_PER_WINDOW ||
      (last !== undefined && now - last < MIN_GAP_MS)
    ) {
      this.hits.set(email, recent);
      return false;
    }

    recent.push(now);
    this.hits.set(email, recent);
    return true;
  }

  private prune(now: number) {
    for (const [key, times] of this.hits) {
      if (times.every((t) => now - t >= WINDOW_MS)) this.hits.delete(key);
    }
  }
}
