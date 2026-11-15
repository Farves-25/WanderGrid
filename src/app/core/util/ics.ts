import { airline } from '../data/airlines';
import { airport } from '../data/airports';
import { Booking } from '../models/flight.model';

function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = ' ' + rest.slice(74);
  }
  out.push(rest);
  return out.join('\r\n');
}

function utc(ms: number): string {
  return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export function buildBookingIcs(b: Booking): string {
  const stamp = utc(Date.now());
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//WanderGrid//Flights//EN', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:Flight ${b.ref}`];
  for (const leg of b.legs) {
    for (const s of leg.offer.segments) {
      const a = airport(s.from);
      const z = airport(s.to);
      lines.push(
        'BEGIN:VEVENT',
        `UID:${s.id}-${b.ref}@wandergrid.app`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${utc(s.depUtc)}`,
        `DTEND:${utc(s.arrUtc)}`,
        `SUMMARY:${esc(`${s.flightNo} ${a.city} (${s.from}) → ${z.city} (${s.to})`)}`,
        `LOCATION:${esc(`${a.name}, ${a.city}`)}`,
        `DESCRIPTION:${esc(`${airline(s.airline).name} ${s.flightNo}\nBooking reference ${b.ref}\nAircraft ${s.aircraft.name}`)}`,
        'END:VEVENT',
      );
    }
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

export function downloadText(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
