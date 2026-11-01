/** Africa/Lagos is UTC+1 all year (no daylight saving). */
const LAGOS_OFFSET_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface LagosDay {
  /** First instant of the Lagos calendar day. */
  start: Date;
  /** Last millisecond of the Lagos calendar day. */
  end: Date;
  year: number;
  /** 1-12 */
  month: number;
  day: number;
}

/**
 * Shifts an instant so its UTC fields read as Lagos wall-clock time. Lets code
 * written against UTC date helpers (such as the birthday year logic) see the
 * Lagos calendar day.
 */
export function toLagosClock(now: Date = new Date()): Date {
  return new Date(now.getTime() + LAGOS_OFFSET_MS);
}

export function lagosDay(now: Date = new Date()): LagosDay {
  const local = toLagosClock(now);
  const year = local.getUTCFullYear();
  const monthIndex = local.getUTCMonth();
  const day = local.getUTCDate();
  const start = new Date(Date.UTC(year, monthIndex, day) - LAGOS_OFFSET_MS);
  return {
    start,
    end: new Date(start.getTime() + DAY_MS - 1),
    year,
    month: monthIndex + 1,
    day,
  };
}
