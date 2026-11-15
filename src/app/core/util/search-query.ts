import { findAirport } from '../data/airports';
import { Cabin, SearchLeg, SearchParams, TripType } from '../models/flight.model';
import { addDays, isIsoDate, todayIso } from './date.util';

export const MAX_ADVANCE_DAYS = 330;
export const MAX_PAX = 9;
const CABINS: Cabin[] = ['economy', 'premium', 'business', 'first'];

export interface QueryInput {
  type?: string;
  legs?: string;
  adt?: string;
  chd?: string;
  inf?: string;
  cabin?: string;
}

export function toQuery(p: SearchParams): Record<string, string> {
  return {
    type: p.type,
    legs: p.legs.map((l) => `${l.from}.${l.to}.${l.date}`).join('~'),
    adt: String(p.adults),
    chd: String(p.children),
    inf: String(p.infants),
    cabin: p.cabin,
  };
}

function int(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return Number.isInteger(n) ? n : fallback;
}

/** Strictly parses and validates search params from the URL; returns an error string when invalid. */
export function fromQuery(q: QueryInput): { ok: true; params: SearchParams } | { ok: false; message: string } {
  const type = (['oneway', 'round', 'multi'] as TripType[]).find((t) => t === q.type) ?? 'oneway';
  const legs: SearchLeg[] = [];
  for (const part of (q.legs ?? '').split('~').filter(Boolean)) {
    const [from, to, date] = part.split('.');
    legs.push({ from: from?.toUpperCase() ?? '', to: to?.toUpperCase() ?? '', date: date ?? '' });
  }
  const adults = int(q.adt, 1);
  const children = int(q.chd, 0);
  const infants = int(q.inf, 0);
  const cabin = CABINS.find((c) => c === q.cabin) ?? 'economy';
  const params: SearchParams = { type, legs, adults, children, infants, cabin };
  const error = validateSearch(params);
  return error ? { ok: false, message: error } : { ok: true, params };
}

export function validateSearch(p: SearchParams): string | null {
  const expected = p.type === 'oneway' ? 1 : p.type === 'round' ? 2 : -1;
  if (p.legs.length === 0 || (expected > 0 && p.legs.length !== expected) || p.legs.length > 5 || (p.type === 'multi' && p.legs.length < 2)) {
    return 'Choose where you want to fly.';
  }
  const today = todayIso();
  const max = addDays(today, MAX_ADVANCE_DAYS);
  let prev = '';
  for (const [i, l] of p.legs.entries()) {
    const label = p.type === 'round' ? (i === 0 ? 'outbound' : 'return') : `flight ${i + 1}`;
    if (!findAirport(l.from) || !findAirport(l.to)) return `Pick an airport for the ${label} flight.`;
    if (l.from === l.to) return `The ${label} flight needs different departure and arrival airports.`;
    if (!isIsoDate(l.date)) return `Pick a date for the ${label} flight.`;
    if (l.date < today) return `The ${label} date is in the past.`;
    if (l.date > max) return `Flights can be booked up to ${MAX_ADVANCE_DAYS} days ahead.`;
    if (prev && l.date < prev) return `The ${label} date can’t be before the previous flight.`;
    prev = l.date;
  }
  if (p.type === 'round' && (p.legs[1].from !== p.legs[0].to || p.legs[1].to !== p.legs[0].from)) return 'Return flight must reverse your outbound route.';
  if (p.adults < 1 || p.adults > MAX_PAX) return 'At least one adult must travel.';
  if (p.children < 0 || p.infants < 0) return 'Invalid passenger count.';
  if (p.adults + p.children + p.infants > MAX_PAX) return `You can book up to ${MAX_PAX} travelers at once.`;
  if (p.infants > p.adults) return 'Each infant must travel with an adult.';
  return null;
}
