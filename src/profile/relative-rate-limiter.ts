import { Injectable } from '@nestjs/common';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_ADD_PER_DAY = 10;
const MAX_CLAIM_LINK_PER_DAY = 3;
const MAX_INVITE_EMAIL_PER_DAY = 3;
const PRUNE_THRESHOLD = 1000;

@Injectable()
export class RelativeRateLimiter {
  private readonly addHits = new Map<string, number[]>();
  private readonly claimLinkHits = new Map<string, number[]>();
  private readonly inviteEmailHits = new Map<string, number[]>();

  tryConsumeAdd(memberId: string, now = Date.now()): boolean {
    if (this.addHits.size > PRUNE_THRESHOLD) this.prune(this.addHits, now);
    const recent = (this.addHits.get(memberId) ?? []).filter(
      (t) => now - t < DAY_MS,
    );
    if (recent.length >= MAX_ADD_PER_DAY) {
      this.addHits.set(memberId, recent);
      return false;
    }
    recent.push(now);
    this.addHits.set(memberId, recent);
    return true;
  }

  tryConsumeClaimLink(personId: string, now = Date.now()): boolean {
    if (this.claimLinkHits.size > PRUNE_THRESHOLD)
      this.prune(this.claimLinkHits, now);
    const recent = (this.claimLinkHits.get(personId) ?? []).filter(
      (t) => now - t < DAY_MS,
    );
    if (recent.length >= MAX_CLAIM_LINK_PER_DAY) {
      this.claimLinkHits.set(personId, recent);
      return false;
    }
    recent.push(now);
    this.claimLinkHits.set(personId, recent);
    return true;
  }

  tryConsumeInviteEmail(personId: string, now = Date.now()): boolean {
    if (this.inviteEmailHits.size > PRUNE_THRESHOLD)
      this.prune(this.inviteEmailHits, now);
    const recent = (this.inviteEmailHits.get(personId) ?? []).filter(
      (t) => now - t < DAY_MS,
    );
    if (recent.length >= MAX_INVITE_EMAIL_PER_DAY) {
      this.inviteEmailHits.set(personId, recent);
      return false;
    }
    recent.push(now);
    this.inviteEmailHits.set(personId, recent);
    return true;
  }

  private prune(map: Map<string, number[]>, now: number) {
    for (const [key, times] of map) {
      if (times.every((t) => now - t >= DAY_MS)) map.delete(key);
    }
  }
}
