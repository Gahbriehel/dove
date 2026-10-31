import { createHmac, timingSafeEqual } from 'crypto';

const TOKEN_PURPOSE = 'email-unsubscribe';

function signature(personId: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(`${TOKEN_PURPOSE}:${personId}`)
    .digest('base64url');
}

/**
 * Builds a stateless unsubscribe token (`<personId>.<hmac>`). It carries no
 * expiry on purpose: unsubscribe links in old emails must keep working.
 */
export function signUnsubscribeToken(personId: string, secret: string): string {
  return `${personId}.${signature(personId, secret)}`;
}

/** Returns the person id if the token's signature is valid, else null. */
export function verifyUnsubscribeToken(
  token: string,
  secret: string,
): string | null {
  const separator = token.lastIndexOf('.');
  if (separator <= 0) return null;

  const personId = token.slice(0, separator);
  const provided = Buffer.from(token.slice(separator + 1));
  const expected = Buffer.from(signature(personId, secret));

  if (provided.length !== expected.length) return null;
  return timingSafeEqual(provided, expected) ? personId : null;
}
