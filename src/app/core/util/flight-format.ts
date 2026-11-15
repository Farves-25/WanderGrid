import { airport } from '../data/airports';
import { dayDelta, formatLocalDate, formatLocalTime } from '../engine/time';
import { FlightOffer, Segment } from '../models/flight.model';

export interface OfferTimes {
  from: string;
  to: string;
  depTime: string;
  arrTime: string;
  depDate: string;
  arrDate: string;
  plusDays: number;
}

export function offerTimes(o: FlightOffer): OfferTimes {
  const first = o.segments[0];
  const last = o.segments[o.segments.length - 1];
  const a = airport(first.from);
  const b = airport(last.to);
  return {
    from: first.from,
    to: last.to,
    depTime: formatLocalTime(a, o.depUtc),
    arrTime: formatLocalTime(b, o.arrUtc),
    depDate: formatLocalDate(a, o.depUtc),
    arrDate: formatLocalDate(b, o.arrUtc),
    plusDays: dayDelta(a, o.depUtc, b, o.arrUtc),
  };
}

export interface SegmentTimes {
  depTime: string;
  arrTime: string;
  depDate: string;
  arrDate: string;
  plusDays: number;
}

export function segmentTimes(s: Segment): SegmentTimes {
  const a = airport(s.from);
  const b = airport(s.to);
  return {
    depTime: formatLocalTime(a, s.depUtc),
    arrTime: formatLocalTime(b, s.arrUtc),
    depDate: formatLocalDate(a, s.depUtc),
    arrDate: formatLocalDate(b, s.arrUtc),
    plusDays: dayDelta(a, s.depUtc, b, s.arrUtc),
  };
}

export function stopsLabel(o: FlightOffer): string {
  if (o.stops === 0) return 'Direct';
  const via = o.layovers.map((l) => l.airport).join(', ');
  return `${o.stops} stop${o.stops > 1 ? 's' : ''} · ${via}`;
}

export function routeLabel(o: FlightOffer): string {
  const t = offerTimes(o);
  return `${airport(t.from).city} → ${airport(t.to).city}`;
}

/** Departure time-of-day band at the origin. */
export function departureBand(o: FlightOffer): 'night' | 'morning' | 'afternoon' | 'evening' {
  const h = Number(offerTimes(o).depTime.slice(0, 2));
  return h < 6 ? 'night' : h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
}
