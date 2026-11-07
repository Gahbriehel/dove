/**
 * Date and time utilities for Web Push & Night Prayer in Africa/Lagos (UTC+1).
 */

const LAGOS_OFFSET_MS = 60 * 60 * 1000;

export function toLagosDate(now: Date = new Date()): Date {
  return new Date(now.getTime() + LAGOS_OFFSET_MS);
}

export function getTodayInLagos(now: Date = new Date()): string {
  const local = toLagosDate(now);
  const year = local.getUTCFullYear();
  const month = String(local.getUTCMonth() + 1).padStart(2, '0');
  const day = String(local.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getLagosTimeParts(now: Date = new Date()) {
  const local = toLagosDate(now);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth() + 1;
  const day = local.getUTCDate();
  const hours = local.getUTCHours();
  const minutes = local.getUTCMinutes();
  const dayOfWeek = local.getUTCDay(); // 0 = Sunday .. 6 = Saturday

  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

  return {
    year,
    month,
    day,
    hours,
    minutes,
    dayOfWeek,
    dateStr,
    timeStr,
  };
}

export function lagosTimeToUtc(dateStr: string, timeOfDay: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeOfDay.split(':').map(Number);
  const utcMs =
    Date.UTC(year, month - 1, day, hours, minutes) - LAGOS_OFFSET_MS;
  return new Date(utcMs);
}

export function formatTime12h(timeOfDay: string): string {
  const [h, m] = timeOfDay.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  const minStr = String(m).padStart(2, '0');
  return `${hour12}:${minStr} ${period}`;
}

export function formatOffsetMinutes(offsetMin: number): string {
  if (offsetMin === 60) {
    return '1 hour';
  }
  if (offsetMin % 60 === 0) {
    return `${offsetMin / 60} hours`;
  }
  return `${offsetMin} minutes`;
}

export function stripMarkdownAndTruncate(
  text: string,
  maxLen: number = 120,
): string {
  if (!text) return '';
  const cleaned = text
    .replace(/[*_#`~>[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length <= maxLen) {
    return cleaned;
  }
  const truncated = cleaned.slice(0, maxLen - 1);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxLen * 0.6) {
    return truncated.slice(0, lastSpace).trimEnd() + '…';
  }
  return truncated.trimEnd() + '…';
}

export function diffDays(dateStrA: string, dateStrB: string): number {
  const [yA, mA, dA] = dateStrA.split('-').map(Number);
  const [yB, mB, dB] = dateStrB.split('-').map(Number);
  const msA = Date.UTC(yA, mA - 1, dA);
  const msB = Date.UTC(yB, mB - 1, dB);
  return Math.round((msA - msB) / (24 * 60 * 60 * 1000));
}

export function addDaysToDateStr(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
