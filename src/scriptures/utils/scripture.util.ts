import { registerDecorator, ValidationOptions } from 'class-validator';

/**
 * Normalises text by:
 * - converting \r\n and \r to \n
 * - collapsing runs of whitespace around line breaks
 * - trimming leading and trailing whitespace
 */
export function normalizeScriptureText(text: string): string {
  if (typeof text !== 'string') return text;
  return text
    .replace(/\r\n|\r/g, '\n')
    .replace(/[^\S\n]*\n[^\S\n]*/g, '\n')
    .trim();
}

/**
 * Validates whether a string is a real calendar date in YYYY-MM-DD format.
 */
export function isValidDateOnlyString(val: unknown): boolean {
  if (typeof val !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    return false;
  }
  const [year, month, day] = val.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Custom class-validator decorator for YYYY-MM-DD calendar dates.
 */
export function IsDateOnly(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isDateOnly',
      target: object.constructor,
      propertyName: propertyName,
      options: {
        message: `${propertyName} must be a valid calendar date in YYYY-MM-DD format`,
        ...validationOptions,
      },
      validator: {
        validate(value: unknown) {
          if (value === undefined || value === null) return true;
          return isValidDateOnlyString(value);
        },
      },
    });
  };
}

/**
 * Returns today's date in Africa/Lagos timezone as YYYY-MM-DD string.
 */
export function getTodayInLagos(now: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
}

/**
 * Parses a YYYY-MM-DD string into a UTC Date object for Prisma @db.Date.
 */
export function parseDateOnly(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

/**
 * Formats a Date or date string to YYYY-MM-DD.
 */
export function formatDateOnly(date: Date | string): string {
  if (typeof date === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }
    return new Date(date).toISOString().slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
}
