import * as crypto from 'crypto';

/**
 * Normalise line endings to \n and collapse three or more blank lines into one.
 * Trims leading and trailing whitespace.
 */
export function normalizeBody(body: string): string {
  if (!body) return '';
  return body
    .replace(/\r\n|\r/g, '\n')
    .replace(/\n([ \t]*\n){3,}/g, '\n\n')
    .trim();
}

/**
 * Computes SHA-256 hash of the normalized body in hex format.
 */
export function getBodyHash(body: string): string {
  const normalized = normalizeBody(body);
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}

/**
 * Computes word count by splitting trimmed body on whitespace.
 */
export function calculateWordCount(body: string): number {
  const trimmed = body?.trim() ?? '';
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/**
 * Generates an excerpt of ~160 characters cut on a word boundary with an ellipsis.
 */
export function generateExcerpt(body: string, maxLength = 160): string {
  if (!body) return '';
  const collapsed = body.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= maxLength) {
    return collapsed;
  }
  const slice = collapsed.slice(0, maxLength);
  const lastSpace = slice.lastIndexOf(' ');
  if (lastSpace > 0) {
    return slice.slice(0, lastSpace) + '…';
  }
  return slice + '…';
}

/**
 * Generates a URL-friendly slug from title (lowercase, hyphens, no punctuation).
 */
export function slugify(title: string): string {
  if (!title) return 'confession';
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.slice(0, 160) || 'confession';
}

/**
 * Tests if a string is a valid UUID format.
 */
export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}
