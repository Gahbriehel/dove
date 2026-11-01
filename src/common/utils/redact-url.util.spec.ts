import { redactUrl } from './redact-url.util';

describe('redactUrl', () => {
  it('redacts the profile token', () => {
    expect(redactUrl('/api/v1/profile/abc123def')).toBe(
      '/api/v1/profile/:token',
    );
  });

  it('keeps the query string', () => {
    expect(redactUrl('/api/v1/profile/abc123?x=1')).toBe(
      '/api/v1/profile/:token?x=1',
    );
  });

  it('leaves the claim route and other urls alone', () => {
    expect(redactUrl('/api/v1/profile/claim')).toBe('/api/v1/profile/claim');
    expect(redactUrl('/api/v1/people/123')).toBe('/api/v1/people/123');
  });

  it('handles empty input', () => {
    expect(redactUrl(undefined)).toBe('');
  });
});
