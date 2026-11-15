/**
 * Calendar-date helpers. Dates are plain `YYYY-MM-DD` strings and all arithmetic is done
 * in UTC so that daylight-saving shifts and the viewer's timezone can never move a day.
 */

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(value: string | null | undefined): value is string {
  if (!value) return false;
  const m = ISO_RE.exec(value);
  if (!m) return false;
  const ms = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  return toIso(ms) === value;
}

function toMs(iso: string): number {
  const m = ISO_RE.exec(iso);
  if (!m) return NaN;
  return Date.UTC(+m[1], +m[2] - 1, +m[3]);
}

function toIso(ms: number): string {
  const d = new Date(ms);
  const y = String(d.getUTCFullYear()).padStart(4, '0');
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const da = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

export function addDays(iso: string, days: number): string {
  return toIso(toMs(iso) + days * 86_400_000);
}

/** Whole days from `a` to `b` (b - a). */
export function diffDays(a: string, b: string): number {
  return Math.round((toMs(b) - toMs(a)) / 86_400_000);
}

/** Inclusive number of calendar days between start and end. */
export function inclusiveDays(start: string, end: string): number {
  return diffDays(start, end) + 1;
}

/** Today's date in the viewer's local calendar. */
export function todayIso(): string {
  const d = new Date();
  const y = String(d.getFullYear()).padStart(4, '0');
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

export function formatDate(
  iso: string,
  opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' },
): string {
  const ms = toMs(iso);
  if (Number.isNaN(ms)) return iso;
  return new Intl.DateTimeFormat(undefined, { ...opts, timeZone: 'UTC' }).format(new Date(ms));
}

export function formatRange(start: string, end: string): string {
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  const a = formatDate(start, sameYear ? { month: 'short', day: 'numeric' } : undefined);
  const b = formatDate(end);
  return `${a} – ${b}`;
}

/** "HH:MM" → minutes since midnight, or null. */
export function timeToMinutes(t: string | null | undefined): number | null {
  if (!t) return null;
  const m = /^(\d{2}):(\d{2})/.exec(t);
  if (!m) return null;
  const h = +m[1];
  const min = +m[2];
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Trims "HH:MM:SS" (Postgres `time`) to "HH:MM". */
export function normalizeTime(t: string | null | undefined): string | null {
  if (!t) return null;
  const m = /^(\d{2}):(\d{2})/.exec(t);
  return m ? `${m[1]}:${m[2]}` : null;
}

export function formatTime(t: string | null | undefined): string {
  const mins = timeToMinutes(t);
  if (mins === null) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** Compact ICS date: YYYYMMDD */
export function icsDate(iso: string): string {
  return iso.replaceAll('-', '');
}
