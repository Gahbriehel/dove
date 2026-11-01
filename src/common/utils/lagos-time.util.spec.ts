import { lagosDay, toLagosClock } from './lagos-time.util';

describe('lagos-time.util', () => {
  it('computes the Lagos day from a mid-day UTC instant', () => {
    const day = lagosDay(new Date('2026-10-15T12:00:00.000Z'));
    expect(day).toMatchObject({ year: 2026, month: 10, day: 15 });
    expect(day.start.toISOString()).toBe('2026-10-14T23:00:00.000Z');
    expect(day.end.toISOString()).toBe('2026-10-15T22:59:59.999Z');
  });

  it('rolls into the next day at 23:00 UTC', () => {
    const day = lagosDay(new Date('2026-10-15T23:30:00.000Z'));
    expect(day).toMatchObject({ year: 2026, month: 10, day: 16 });
  });

  it('stays on the previous day just before 23:00 UTC', () => {
    const day = lagosDay(new Date('2026-10-15T22:59:59.999Z'));
    expect(day.day).toBe(15);
  });

  it('rolls the year over at Lagos midnight', () => {
    const day = lagosDay(new Date('2026-12-31T23:00:00.000Z'));
    expect(day).toMatchObject({ year: 2027, month: 1, day: 1 });
  });

  it('toLagosClock shifts by one hour', () => {
    expect(
      toLagosClock(new Date('2026-12-31T23:00:00.000Z')).toISOString(),
    ).toBe('2027-01-01T00:00:00.000Z');
  });
});
