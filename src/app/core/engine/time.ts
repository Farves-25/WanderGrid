import { Airport, DstRule } from '../models/flight.model';

const DAY = 86_400_000;
const HOUR = 3_600_000;

/** n-th (1-based) or last (n = -1) Sunday of a month, as UTC midnight. */
function sunday(year: number, month: number, n: number): number {
  if (n === -1) {
    const last = Date.UTC(year, month + 1, 0);
    return last - new Date(last).getUTCDay() * DAY;
  }
  const first = Date.UTC(year, month, 1);
  const firstSunday = first + ((7 - new Date(first).getUTCDay()) % 7) * DAY;
  return firstSunday + (n - 1) * 7 * DAY;
}

function dstActive(rule: DstRule, tz: number, utcMs: number): boolean {
  if (rule === 'none') return false;
  const y = new Date(utcMs).getUTCFullYear();
  switch (rule) {
    case 'eu':
      return utcMs >= sunday(y, 2, -1) + HOUR && utcMs < sunday(y, 9, -1) + HOUR;
    case 'us':
      return utcMs >= sunday(y, 2, 2) + (2 - tz) * HOUR && utcMs < sunday(y, 10, 1) + (1 - tz) * HOUR;
    case 'au': {
      // southern hemisphere: DST spans the year boundary
      const start = sunday(y, 9, 1) + (2 - tz) * HOUR;
      const end = sunday(y, 3, 1) + (2 - tz) * HOUR;
      return utcMs >= start || utcMs < end;
    }
    case 'nz': {
      const start = sunday(y, 8, -1) + (2 - tz) * HOUR;
      const end = sunday(y, 3, 1) + (2 - tz) * HOUR;
      return utcMs >= start || utcMs < end;
    }
  }
}

/** Offset from UTC, in minutes, that applies at the airport at the given instant. */
export function offsetMinutes(ap: Airport, utcMs: number): number {
  return Math.round((ap.tz + (dstActive(ap.dst, ap.tz, utcMs) ? 1 : 0)) * 60);
}

/** UTC instant for a given local calendar date and minute-of-day at an airport. */
export function localToUtc(ap: Airport, isoDate: string, minuteOfDay: number): number {
  const [y, m, d] = isoDate.split('-').map(Number);
  const naive = Date.UTC(y, m - 1, d) + minuteOfDay * 60_000;
  const guess = naive - ap.tz * 3_600_000;
  return naive - offsetMinutes(ap, guess) * 60_000;
}

function localParts(ap: Airport, utcMs: number): Date {
  return new Date(utcMs + offsetMinutes(ap, utcMs) * 60_000);
}

export function localIsoDate(ap: Airport, utcMs: number): string {
  const d = localParts(ap, utcMs);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function localMinuteOfDay(ap: Airport, utcMs: number): number {
  const d = localParts(ap, utcMs);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/** "14:35" in 24h or "2:35 PM". */
export function formatLocalTime(ap: Airport, utcMs: number, h12 = false): string {
  const d = localParts(ap, utcMs);
  const h = d.getUTCHours();
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  if (!h12) return `${String(h).padStart(2, '0')}:${m}`;
  return `${h % 12 === 0 ? 12 : h % 12}:${m} ${h >= 12 ? 'PM' : 'AM'}`;
}

export function formatLocalDate(ap: Airport, utcMs: number, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }): string {
  return new Intl.DateTimeFormat('en-GB', { ...opts, timeZone: 'UTC' }).format(localParts(ap, utcMs));
}

/** Whole calendar days the arrival is after the departure (for the "+1" marker). */
export function dayDelta(dep: Airport, depUtc: number, arr: Airport, arrUtc: number): number {
  const a = localIsoDate(dep, depUtc);
  const b = localIsoDate(arr, arrUtc);
  return Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8))) / DAY);
}

export function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}
