import { Injectable } from '@nestjs/common';

/**
 * In-memory revocation tracking for member sessions.
 * Holds revoked JWT identifiers (jti) or raw tokens until their expiration time.
 */
@Injectable()
export class MemberSessionService {
  private readonly revoked = new Map<string, number>();

  revoke(identifier: string, expiresAtMs: number): void {
    this.prune();
    this.revoked.set(identifier, expiresAtMs);
  }

  isRevoked(jti?: string, token?: string): boolean {
    const now = Date.now();
    if (jti && this.revoked.has(jti)) {
      const exp = this.revoked.get(jti)!;
      if (exp > now) return true;
      this.revoked.delete(jti);
    }
    if (token && this.revoked.has(token)) {
      const exp = this.revoked.get(token)!;
      if (exp > now) return true;
      this.revoked.delete(token);
    }
    return false;
  }

  private prune(): void {
    const now = Date.now();
    for (const [key, exp] of this.revoked.entries()) {
      if (exp <= now) {
        this.revoked.delete(key);
      }
    }
  }
}
