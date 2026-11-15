import { airline } from '../data/airlines';
import { airport, distanceKm } from '../data/airports';
import { AircraftInfo, Airline, Airport, Cabin, Fare, FareFamily, FlightOffer, Layover, SearchLeg, Segment } from '../models/flight.model';
import { hashString, rng, Rng } from './prng';
import { localToUtc } from './time';
import { AIRLINES } from '../data/airlines';

export interface EngineContext {
  /** Current instant (ms). */
  nowMs: number;
  /** Local "today" as YYYY-MM-DD; drives lead-time pricing and daily market drift. */
  todayIso: string;
}

const MIN = 60_000;
const DAY_MS = 86_400_000;

const CABIN_MULT: Record<Cabin, number> = { economy: 1, premium: 1.85, business: 3.7, first: 6.2 };
const FAMILY_MULT: Record<FareFamily, number> = { basic: 1, standard: 1.16, flex: 1.5 };
const SEASON = [0.94, 0.93, 1, 1.03, 1, 1.1, 1.18, 1.16, 1, 1.02, 0.95, 1.17];

function aircraftFor(a: Airline, dist: number, r: Rng): AircraftInfo {
  if (a.lcc) {
    const name = r.pick(['Airbus A320', 'Airbus A321neo', 'Boeing 737-800']);
    return { name, widebody: false, wifi: false, power: false, entertainment: false };
  }
  if (dist < 1700) {
    return { name: r.pick(['Airbus A320', 'Boeing 737-800', 'Embraer E195']), widebody: false, wifi: a.quality >= 4, power: a.quality >= 3.8, entertainment: a.quality >= 4.4 };
  }
  if (dist < 4800) {
    return { name: r.pick(['Airbus A321neo', 'Boeing 737 MAX 8', 'Airbus A320neo', 'Boeing 757-200']), widebody: false, wifi: a.quality >= 3.8, power: a.quality >= 3.6, entertainment: a.quality >= 4.2 };
  }
  const pool = dist > 9000 ? ['Boeing 777-300ER', 'Airbus A350-900', 'Boeing 787-9', 'Boeing 777-300ER'] : ['Boeing 787-8', 'Airbus A330-300', 'Boeing 767-300ER', 'Airbus A350-900'];
  const big = a.quality >= 4.3 && dist > 7000 && r.chance(0.25) ? ['Airbus A380-800'] : [];
  const name = r.pick([...pool, ...big]);
  return { name, widebody: true, wifi: a.quality >= 3.5, power: true, entertainment: true };
}

function blockMinutes(from: Airport, to: Airport, dist: number, r: Rng): number {
  const speed = dist < 1000 ? 600 : dist < 3000 ? 720 : 830;
  let mins = (dist / speed) * 60 + (dist < 1000 ? 28 : 38);
  const dlon = ((to.lon - from.lon + 540) % 360) - 180;
  if (dist > 4000) mins *= dlon > 0 ? 0.95 : 1.05;
  mins *= 0.97 + r.next() * 0.06;
  return Math.max(35, Math.round(mins / 5) * 5);
}

function segmentBase(d: number): number {
  return 28 + 0.11 * Math.min(d, 1500) + 0.062 * Math.max(0, Math.min(d, 6000) - 1500) + 0.048 * Math.max(0, d - 6000);
}

function demandFactor(daysAhead: number, depIso: string): number {
  const lead = daysAhead <= 0 ? 1.7 : daysAhead <= 2 ? 1.65 : daysAhead <= 6 ? 1.38 : daysAhead <= 13 ? 1.2 : daysAhead <= 27 ? 1.07 : daysAhead <= 59 ? 1 : daysAhead <= 120 ? 0.93 : 0.97;
  const [y, m, d] = depIso.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const week = dow === 5 || dow === 0 ? 1.07 : dow === 6 ? 0.97 : dow === 2 || dow === 3 ? 0.92 : 1;
  return lead * week * SEASON[m - 1];
}

function eligibleCabin(a: Airline, segs: { widebody: boolean; dist: number }[], cabin: Cabin): boolean {
  if (cabin === 'economy') return true;
  if (a.lcc) return false;
  if (cabin === 'business') return true;
  if (cabin === 'premium') return a.premium && segs.every((s) => s.widebody);
  return a.first && segs.every((s) => s.widebody && s.dist > 3500);
}

function buildFares(a: Airline, cabin: Cabin, base: number, taxes: number, maxSeg: number): Record<FareFamily, Fare> {
  const bags: Record<Cabin, [number, number, number]> = {
    economy: a.lcc ? [0, 1, 2] : maxSeg < 3500 ? [0, 1, 2] : [1, 1, 2],
    premium: [1, 2, 2],
    business: [2, 2, 3],
    first: [3, 3, 3],
  };
  const kg = cabin === 'economy' || cabin === 'premium' ? (a.lcc ? 20 : 23) : 32;
  const premiumCabin = cabin === 'business' || cabin === 'first';
  const changeStd = cabin === 'first' ? 200 : cabin === 'business' ? 150 : cabin === 'premium' ? 100 : 75;
  const cancelStd = cabin === 'first' ? 350 : cabin === 'business' ? 250 : cabin === 'premium' ? 200 : 150;
  const fam = (family: FareFamily, i: number): Fare => {
    const mult = family === 'standard' && a.lcc ? 1.22 : family === 'flex' && a.lcc ? 1.6 : FAMILY_MULT[family];
    const b = Math.round(base * mult);
    return {
      family,
      base: b,
      taxes,
      total: b + taxes,
      checkedBags: bags[cabin][i],
      bagKg: kg,
      cabinBag: true,
      seatSelection: family === 'basic' && !premiumCabin ? 'paid' : 'free',
      changeFeeUsd: family === 'basic' ? null : family === 'standard' ? changeStd : 0,
      refund: family === 'basic' ? 'none' : family === 'standard' ? 'partial' : 'full',
      cancelFeeUsd: family === 'basic' ? b : family === 'standard' ? cancelStd : 0,
      milesPct: family === 'basic' ? 25 : family === 'standard' ? 100 : 150,
      priorityBoarding: family === 'flex' || premiumCabin,
    };
  };
  return { basic: fam('basic', 0), standard: fam('standard', 1), flex: fam('flex', 2) };
}

interface Plan {
  airline: Airline;
  via: Airport | null;
  count: number;
}

function planFor(a: Airline, from: Airport, to: Airport, direct: number, r: Rng): Plan[] {
  const range = a.lcc ? 6500 : 16500;
  const served = (ap: Airport): boolean => a.hubs.includes(ap.code) || hashString(a.code + ap.code) % 100 < (a.lcc ? 55 : 72);
  const plans: Plan[] = [];
  const hubEnd = a.hubs.includes(from.code) || a.hubs.includes(to.code);
  if (hubEnd && direct <= range && served(from) && served(to)) {
    plans.push({ airline: a, via: null, count: r.int(1, 3) });
  }
  if (direct >= 1200) {
    let best: { hub: Airport; total: number } | null = null;
    for (const code of a.hubs) {
      if (code === from.code || code === to.code) continue;
      const hub = airport(code);
      const d1 = distanceKm(from, hub);
      const d2 = distanceKm(hub, to);
      if (d1 > range || d2 > range || d1 < 300 || d2 < 300) continue;
      if (d1 + d2 > Math.max(1.55 * direct, direct + 1800)) continue;
      if (!served(from) || !served(to)) continue;
      if (!best || d1 + d2 < best.total) best = { hub, total: d1 + d2 };
    }
    if (best) plans.push({ airline: a, via: best.hub, count: r.int(1, 2) });
  }
  return plans;
}

function flightNumber(a: Airline, r: Rng): string {
  return `${a.code}${r.int(a.lcc ? 100 : 1, 8999)}`;
}

export function searchFlights(leg: SearchLeg, legIndex: number, cabin: Cabin, ctx: EngineContext): FlightOffer[] {
  if (leg.from === leg.to) return [];
  let from: Airport;
  let to: Airport;
  try {
    from = airport(leg.from);
    to = airport(leg.to);
  } catch {
    return [];
  }
  const direct = distanceKm(from, to);
  const key = `${leg.from}-${leg.to}-${leg.date}`;
  const [ty, tm, td] = ctx.todayIso.split('-').map(Number);
  const [dy, dm, dd] = leg.date.split('-').map(Number);
  const daysAhead = Math.round((Date.UTC(dy, dm - 1, dd) - Date.UTC(ty, tm - 1, td)) / DAY_MS);
  const market = 0.95 + rng(`${key}|${ctx.todayIso}`).next() * 0.1;
  const demand = demandFactor(daysAhead, leg.date) * market;

  const offers = new Map<string, FlightOffer>();

  for (const a of AIRLINES) {
    const r = rng(`${key}|${a.code}`);
    for (const plan of planFor(a, from, to, direct, r)) {
      const used = new Set<number>();
      for (let n = 0; n < plan.count; n++) {
        let dep = Math.round(r.int(330, 1410) / 5) * 5;
        for (let guard = 0; guard < 12 && [...used].some((u) => Math.abs(u - dep) < 90); guard++) dep = Math.round(r.int(330, 1410) / 5) * 5;
        used.add(dep);
        const offer = buildOffer(plan, from, to, leg, legIndex, cabin, dep, direct, daysAhead, demand, ctx, r);
        if (offer) offers.set(offer.id, offer);
      }
    }
  }
  return [...offers.values()].sort((x, y) => x.fares.basic.total - y.fares.basic.total).slice(0, 70);
}

function buildOffer(
  plan: Plan,
  from: Airport,
  to: Airport,
  leg: SearchLeg,
  legIndex: number,
  cabin: Cabin,
  depMinute: number,
  direct: number,
  daysAhead: number,
  demand: number,
  ctx: EngineContext,
  r: Rng,
): FlightOffer | null {
  const a = plan.airline;
  const stops = plan.via ? [from, plan.via, to] : [from, to];
  const depUtc = localToUtc(from, leg.date, depMinute);
  if (depUtc < ctx.nowMs + 3 * 3_600_000) return null;

  const segments: Segment[] = [];
  const layovers: Layover[] = [];
  let cursor = depUtc;
  const segInfo: { widebody: boolean; dist: number }[] = [];
  for (let i = 0; i < stops.length - 1; i++) {
    const s = stops[i];
    const t = stops[i + 1];
    const dist = distanceKm(s, t);
    const duration = blockMinutes(s, t, dist, r);
    const aircraft = aircraftFor(a, dist, r);
    const flightNo = flightNumber(a, r);
    const dep = cursor;
    const arr = dep + duration * MIN;
    segments.push({ id: `${flightNo}-${s.code}${t.code}-${new Date(dep).toISOString().slice(0, 10)}`, airline: a.code, flightNo, aircraft, from: s.code, to: t.code, depUtc: dep, arrUtc: arr, durationMin: duration, distanceKm: dist });
    segInfo.push({ widebody: aircraft.widebody, dist });
    cursor = arr;
    if (i < stops.length - 2) {
      const layover = r.chance(0.82) ? r.int(16, 34) * 5 : r.int(60, 110) * 5;
      layovers.push({ airport: t.code, minutes: layover, overnight: layover >= 420 });
      cursor = arr + layover * MIN;
    }
  }
  if (!eligibleCabin(a, segInfo, cabin)) return null;

  const arrUtc = segments[segments.length - 1].arrUtc;
  const flown = segInfo.reduce((n, s) => n + s.dist, 0);
  const hour = depMinute / 60;
  const timeFactor = hour < 6 || hour >= 22 ? 0.92 : (hour >= 7 && hour <= 9.5) || (hour >= 17 && hour <= 19.5) ? 1.06 : 1;
  const noise = 0.9 + r.next() * 0.28;
  const cabinMult = cabin === 'business' && segInfo.every((s) => s.dist < 3000) ? 2.7 : CABIN_MULT[cabin];
  const bundle = plan.via ? 0.84 : 1;
  const rawBase = segInfo.reduce((sum, s) => sum + segmentBase(s.dist), 0) * bundle;
  const base = Math.max(a.lcc ? 22 : 54, Math.round(rawBase * a.priceFactor * cabinMult * demand * timeFactor * noise));
  const taxes = Math.round(segInfo.reduce((sum, s) => sum + 11 + (a.lcc ? 0 : 0.004 * s.dist), 0) + 0.085 * base);
  const maxSeg = Math.max(...segInfo.map((s) => s.dist));

  const co2Rate = flown < 1500 ? 0.11 : flown < 5000 ? 0.095 : 0.085;
  const cabinCo2 = { economy: 1, premium: 1.6, business: 2.9, first: 4 }[cabin];
  const durationMin = Math.round((arrUtc - depUtc) / MIN);

  const seatsLeft = daysAhead <= 6 ? r.int(1, 6) : r.int(2, 9);
  return {
    id: `${leg.from}${leg.to}-${leg.date}-${segments.map((s) => s.flightNo).join('+')}-${cabin}`,
    legIndex,
    cabin,
    segments,
    airlines: [a.code],
    depUtc,
    arrUtc,
    durationMin,
    stops: stops.length - 2,
    layovers,
    seatsLeft,
    co2Kg: Math.round(flown * co2Rate * cabinCo2),
    onTimePct: r.int(71, 94),
    distanceKm: direct,
    fares: buildFares(a, cabin, base, taxes, maxSeg),
  };
}

export function airlineName(code: string): string {
  return airline(code).name;
}
