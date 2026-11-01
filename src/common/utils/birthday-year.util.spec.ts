import { resolveBirthdayTargetYear } from './birthday-year.util';

describe('resolveBirthdayTargetYear', () => {
  const dob = new Date('1990-10-15T00:00:00.000Z');

  it('targets this year when the birthday is today', async () => {
    const isGreeted = jest.fn();
    const year = await resolveBirthdayTargetYear(
      dob,
      isGreeted,
      new Date('2026-10-15T08:00:00.000Z'),
    );
    expect(year).toBe(2026);
    expect(isGreeted).not.toHaveBeenCalled();
  });

  it('targets this year when the birthday is still ahead', async () => {
    const year = await resolveBirthdayTargetYear(
      dob,
      jest.fn(),
      new Date('2026-10-01T08:00:00.000Z'),
    );
    expect(year).toBe(2026);
  });

  it('targets this year for a late greeting when none was recorded', async () => {
    const isGreeted = jest.fn().mockResolvedValue(false);
    const year = await resolveBirthdayTargetYear(
      dob,
      isGreeted,
      new Date('2026-10-20T08:00:00.000Z'),
    );
    expect(year).toBe(2026);
    expect(isGreeted).toHaveBeenCalledWith(2026);
  });

  it('targets next year when this year was already greeted', async () => {
    const year = await resolveBirthdayTargetYear(
      dob,
      jest.fn().mockResolvedValue(true),
      new Date('2026-10-20T08:00:00.000Z'),
    );
    expect(year).toBe(2027);
  });
});
