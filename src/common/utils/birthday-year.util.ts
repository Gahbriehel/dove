/** UTC midnight of the calendar day containing `now`. */
export function utcMidnight(now: Date = new Date()): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

/**
 * Works out which year's birthday a greeting should be recorded against.
 *
 * - This year's birthday is today or still ahead: this year.
 * - It has already passed: this year if no greeting was recorded for it yet
 *   (a late greeting), otherwise next year.
 *
 * `isGreeted` is evaluated lazily and per channel, so callers pass a lookup
 * for the channel they are sending on.
 */
export async function resolveBirthdayTargetYear(
  dateOfBirth: Date,
  isGreeted: (year: number) => Promise<boolean>,
  now: Date = new Date(),
): Promise<number> {
  const today = utcMidnight(now);
  const currentYear = today.getUTCFullYear();
  const thisYearBirthday = Date.UTC(
    currentYear,
    dateOfBirth.getUTCMonth(),
    dateOfBirth.getUTCDate(),
  );

  if (thisYearBirthday >= today.getTime()) {
    return currentYear;
  }
  return (await isGreeted(currentYear)) ? currentYear + 1 : currentYear;
}
