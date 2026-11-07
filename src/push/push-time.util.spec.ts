import {
  addDaysToDateStr,
  diffDays,
  formatOffsetMinutes,
  formatTime12h,
  getLagosTimeParts,
  getTodayInLagos,
  lagosTimeToUtc,
  stripMarkdownAndTruncate,
} from './utils/push-time.util';

describe('push-time.util', () => {
  describe('Lagos time conversion and offsets', () => {
    it('converts Lagos 22:00 to UTC 21:00 on the same date', () => {
      const utcDate = lagosTimeToUtc('2026-11-08', '22:00');
      expect(utcDate.toISOString()).toBe('2026-11-08T21:00:00.000Z');
    });

    it('calculates due times for prayer at 22:00 with offset 60 min as 21:00 and 22:00 Lagos', () => {
      const startUtc = lagosTimeToUtc('2026-11-08', '22:00');
      const offset60Utc = new Date(startUtc.getTime() - 60 * 60 * 1000);

      // Start is 22:00 Lagos = 21:00 UTC
      expect(startUtc.toISOString()).toBe('2026-11-08T21:00:00.000Z');
      // 60 min before is 21:00 Lagos = 20:00 UTC
      expect(offset60Utc.toISOString()).toBe('2026-11-08T20:00:00.000Z');
    });

    it('handles early morning times across UTC date boundary (00:30 Lagos is 23:30 previous day UTC)', () => {
      const utcDate = lagosTimeToUtc('2026-11-08', '00:30');
      expect(utcDate.toISOString()).toBe('2026-11-07T23:30:00.000Z');
    });

    it('handles midnight edge: 23:50 start with 60 min duration ends next day at 00:50 and is live at 00:10', () => {
      // Prayer starts at 23:50 Lagos on 2026-11-08
      const startUtc = lagosTimeToUtc('2026-11-08', '23:50'); // 22:50 UTC
      const joinOpensAt = new Date(startUtc.getTime() - 10 * 60 * 1000); // 22:40 UTC
      const endsAt = new Date(startUtc.getTime() + 60 * 60 * 1000); // 23:50 UTC (00:50 Lagos on Nov 9)

      // Time now: 00:10 Lagos on 2026-11-09 -> 23:10 UTC on 2026-11-08
      const nowUtc = lagosTimeToUtc('2026-11-09', '00:10'); // 23:10 UTC

      expect(startUtc.toISOString()).toBe('2026-11-08T22:50:00.000Z');
      expect(endsAt.toISOString()).toBe('2026-11-08T23:50:00.000Z');
      expect(nowUtc.toISOString()).toBe('2026-11-08T23:10:00.000Z');

      // Check live condition: now >= joinOpensAt and now < endsAt
      expect(nowUtc.getTime() >= joinOpensAt.getTime()).toBe(true);
      expect(nowUtc.getTime() < endsAt.getTime()).toBe(true);
    });
  });

  describe('Formatting helpers', () => {
    it('formats 24h time into 12h display format', () => {
      expect(formatTime12h('22:00')).toBe('10:00 PM');
      expect(formatTime12h('06:30')).toBe('6:30 AM');
      expect(formatTime12h('00:00')).toBe('12:00 AM');
      expect(formatTime12h('12:00')).toBe('12:00 PM');
      expect(formatTime12h('12:45')).toBe('12:45 PM');
    });

    it('formats offset minutes correctly', () => {
      expect(formatOffsetMinutes(60)).toBe('1 hour');
      expect(formatOffsetMinutes(120)).toBe('2 hours');
      expect(formatOffsetMinutes(30)).toBe('30 minutes');
      expect(formatOffsetMinutes(45)).toBe('45 minutes');
    });

    it('strips markdown and truncates cleanly', () => {
      const markdown =
        '## **For God** so *loved* the `world` that he gave his only begotten Son...';
      const clean = stripMarkdownAndTruncate(markdown, 30);
      expect(clean).toBe('For God so loved the world…');
    });
  });

  describe('Date arithmetic', () => {
    it('computes difference in calendar days', () => {
      expect(diffDays('2026-11-10', '2026-11-07')).toBe(3);
      expect(diffDays('2026-11-08', '2026-11-08')).toBe(0);
      expect(diffDays('2026-11-08', '2026-11-09')).toBe(-1);
    });

    it('adds days to date string', () => {
      expect(addDaysToDateStr('2026-11-08', 1)).toBe('2026-11-09');
      expect(addDaysToDateStr('2026-11-30', 1)).toBe('2026-12-01');
      expect(addDaysToDateStr('2026-11-08', -1)).toBe('2026-11-07');
    });

    it('returns today in Lagos correctly', () => {
      // 2026-11-07 23:30 UTC is 2026-11-08 00:30 Lagos
      const utcDate = new Date('2026-11-07T23:30:00.000Z');
      expect(getTodayInLagos(utcDate)).toBe('2026-11-08');
      const parts = getLagosTimeParts(utcDate);
      expect(parts.dateStr).toBe('2026-11-08');
      expect(parts.timeStr).toBe('00:30');
    });
  });
});
