import {
  signUnsubscribeToken,
  verifyUnsubscribeToken,
} from './unsubscribe-token.util';

describe('unsubscribe token', () => {
  const personId = '91f67e75-3f2e-41ed-834d-add0d1448b2d';

  it('round-trips a person id', () => {
    const token = signUnsubscribeToken(personId, 'secret');
    expect(verifyUnsubscribeToken(token, 'secret')).toBe(personId);
  });

  it('rejects a token signed with a different secret', () => {
    const token = signUnsubscribeToken(personId, 'secret');
    expect(verifyUnsubscribeToken(token, 'other-secret')).toBeNull();
  });

  it('rejects a token whose person id was tampered with', () => {
    const token = signUnsubscribeToken(personId, 'secret');
    const forged = token.replace(personId, 'another-person-id');
    expect(verifyUnsubscribeToken(forged, 'secret')).toBeNull();
  });

  it('rejects malformed tokens', () => {
    expect(verifyUnsubscribeToken('', 'secret')).toBeNull();
    expect(verifyUnsubscribeToken('no-separator', 'secret')).toBeNull();
    expect(verifyUnsubscribeToken(`${personId}.`, 'secret')).toBeNull();
    expect(verifyUnsubscribeToken(`${personId}.short`, 'secret')).toBeNull();
  });
});
