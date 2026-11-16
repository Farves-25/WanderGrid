import { findAirport } from '../data/airports';
import { FlightOffer, SearchParams, Segment } from '../models/flight.model';
import { diffDays, formatDate } from './date.util';

/** Flight times arrive as local `YYYY-MM-DD HH:MM` strings; these helpers never apply a timezone. */
export function timeOf(local: string): string {
  return local.slice(11, 16);
}

export function dateOf(local: string): string {
  return local.slice(0, 10);
}

export function shortDate(local: string): string {
  return formatDate(dateOf(local), { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Whole calendar days the arrival falls after the departure (the "+1" marker). */
export function plusDays(dep: string, arr: string): number {
  const d = diffDays(dateOf(dep), dateOf(arr));
  return Number.isFinite(d) ? d : 0;
}

export interface Times {
  from: string;
  to: string;
  depTime: string;
  arrTime: string;
  depDate: string;
  arrDate: string;
  plusDays: number;
}

export function offerTimes(o: FlightOffer): Times {
  return times(o.segments[0].from, o.segments[o.segments.length - 1].to, o.dep, o.arr);
}

export function segmentTimes(s: Segment): Times {
  return times(s.from, s.to, s.dep, s.arr);
}

function times(from: string, to: string, dep: string, arr: string): Times {
  return { from, to, depTime: timeOf(dep), arrTime: timeOf(arr), depDate: shortDate(dep), arrDate: shortDate(arr), plusDays: plusDays(dep, arr) };
}

export function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

export function stopsLabel(o: FlightOffer): string {
  if (o.stops === 0) return 'Nonstop';
  const via = o.layovers.map((l) => l.airport).filter(Boolean).join(', ');
  return `${o.stops} stop${o.stops > 1 ? 's' : ''}${via ? ' · ' + via : ''}`;
}

/** City for an airport code, falling back to the name the airline published, then the code. */
export function cityOf(code: string, fallbackName = ''): string {
  return findAirport(code)?.city ?? (fallbackName || code);
}

/** Departure time-of-day band at the origin. */
export function departureBand(o: FlightOffer): 'night' | 'morning' | 'afternoon' | 'evening' {
  const h = Number(timeOf(o.dep).slice(0, 2));
  return h < 6 ? 'night' : h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
}

export function paxCount(p: SearchParams): number {
  return p.adults + p.children + p.infants;
}

/** "LHR ⇄ JFK" / "LHR → JFK" / "LHR → JFK → LAX" */
export function routeCodes(p: SearchParams): string {
  if (p.type === 'multi') return p.legs.map((l) => l.from).concat(p.legs[p.legs.length - 1].to).join(' → ');
  return `${p.legs[0].from} ${p.type === 'round' ? '⇄' : '→'} ${p.legs[0].to}`;
}

export function routeCities(p: SearchParams): string {
  if (p.type === 'multi') return p.legs.map((l) => cityOf(l.from)).concat(cityOf(p.legs[p.legs.length - 1].to)).join(' → ');
  return `${cityOf(p.legs[0].from)} ${p.type === 'round' ? '⇄' : '→'} ${cityOf(p.legs[0].to)}`;
}

export function tripDates(p: SearchParams): string {
  const d = (x: string): string => formatDate(x, { day: 'numeric', month: 'short' });
  return p.legs.length > 1 ? `${d(p.legs[0].date)} – ${d(p.legs[p.legs.length - 1].date)}` : d(p.legs[0].date);
}

/** Stable identity of a search, used to match alerts, caches and recent searches. */
export function searchKey(p: SearchParams): string {
  return `${p.type}|${p.legs.map((l) => `${l.from}.${l.to}.${l.date}`).join('~')}|${p.adults}.${p.children}.${p.infants}|${p.cabin}`;
}

/** Lowest published price in a result list, or null when none carries a price. */
export function lowestPrice(offers: readonly FlightOffer[]): number | null {
  const prices = offers.map((o) => o.priceUsd).filter((n): n is number => n !== null);
  return prices.length ? Math.min(...prices) : null;
}
