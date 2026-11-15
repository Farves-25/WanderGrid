import { Service } from '@angular/core';
import { EngineContext, searchFlights } from '../engine/flight-engine';
import { Cabin, FlightOffer, SearchLeg } from '../models/flight.model';
import { addDays, todayIso } from '../util/date.util';

/** Search facade: the deterministic engine behind a realistic latency, with result caching. */
@Service()
export class FlightSearchService {
  private readonly cache = new Map<string, FlightOffer[]>();

  ctx(todayOverride?: string): EngineContext {
    return { nowMs: Date.now(), todayIso: todayOverride ?? todayIso() };
  }

  /** Synchronous search (used for calendars, deals, alerts). */
  searchSync(leg: SearchLeg, legIndex: number, cabin: Cabin, ctx: EngineContext = this.ctx()): FlightOffer[] {
    const key = `${leg.from}|${leg.to}|${leg.date}|${cabin}|${legIndex}|${ctx.todayIso}`;
    const hit = this.cache.get(key);
    if (hit && ctx.todayIso === todayIso()) return hit;
    const res = searchFlights(leg, legIndex, cabin, ctx);
    if (ctx.todayIso === todayIso()) this.cache.set(key, res);
    return res;
  }

  /** Asynchronous search with simulated network time. */
  async search(leg: SearchLeg, legIndex: number, cabin: Cabin): Promise<FlightOffer[]> {
    const delay = 650 + Math.round(Math.random() * 500);
    await new Promise((r) => setTimeout(r, delay));
    return this.searchSync(leg, legIndex, cabin);
  }

  cheapest(leg: SearchLeg, cabin: Cabin, ctx: EngineContext = this.ctx()): number | null {
    const offers = this.searchSync(leg, 0, cabin, ctx);
    return offers.length === 0 ? null : Math.min(...offers.map((o) => o.fares.basic.total));
  }

  /** Cheapest fare for each day around `centre` (inclusive window). */
  fareCalendar(from: string, to: string, centre: string, cabin: Cabin, radius = 3): { date: string; usd: number | null }[] {
    const today = todayIso();
    const out: { date: string; usd: number | null }[] = [];
    for (let i = -radius; i <= radius; i++) {
      const date = addDays(centre, i);
      out.push({ date, usd: date < today ? null : this.cheapest({ from, to, date }, cabin) });
    }
    return out;
  }
}
