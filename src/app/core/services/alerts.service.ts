import { Service, computed, inject, signal } from '@angular/core';
import { Cabin, PriceAlert, SearchParams, SearchResult } from '../models/flight.model';
import { todayIso } from '../util/date.util';
import { lowestPrice } from '../util/flight-format';
import { newId, nowIso } from '../util/id.util';
import { AuthService } from './auth.service';
import { FlightSearchService } from './flight-search.service';
import { OfflineCacheService } from './offline-cache.service';

const KEY = 'wg:alerts:v2';
const MAX_OBSERVATIONS = 60;

export interface AlertStatus {
  alert: PriceAlert;
  currentUsd: number | null;
  triggered: boolean;
  /** Travel date has passed — nothing left to track. */
  expired: boolean;
  /** Oldest → newest prices to chart. */
  series: number[];
  /** Where the chart comes from. */
  seriesSource: 'google' | 'checks';
  /** Change since the alert was created, in percent. */
  changePct: number;
}

export type AlertRoute = Pick<PriceAlert, 'from' | 'to' | 'date' | 'returnDate' | 'cabin'>;

/** Alerts always track the price for one adult. */
export function alertParams(a: AlertRoute): SearchParams {
  return {
    type: a.returnDate ? 'round' : 'oneway',
    legs: a.returnDate ? [{ from: a.from, to: a.to, date: a.date }, { from: a.to, to: a.from, date: a.returnDate }] : [{ from: a.from, to: a.to, date: a.date }],
    adults: 1,
    children: 0,
    infants: 0,
    cabin: a.cabin,
  };
}

/** The price an alert tracks from a first-leg result: Google's lowest, else the cheapest listed. */
export function trackedPrice(res: SearchResult): number | null {
  return res.insights?.lowestUsd ?? lowestPrice(res.offers);
}

@Service()
export class AlertsService {
  private readonly cache = inject(OfflineCacheService);
  private readonly auth = inject(AuthService);
  private readonly search = inject(FlightSearchService);

  private readonly all = signal<PriceAlert[]>(this.cache.read<PriceAlert[]>(KEY, []));

  readonly mine = computed(() => {
    const u = this.auth.user();
    return u ? this.all().filter((a) => a.userId === u.id) : [];
  });

  readonly statuses = computed<AlertStatus[]>(() => this.mine().map((a) => this.statusOf(a)));
  readonly triggeredCount = computed(() => this.statuses().filter((s) => s.triggered && !s.expired).length);

  private statusOf(a: PriceAlert): AlertStatus {
    const current = a.observations.length ? a.observations[a.observations.length - 1].usd : null;
    const checks = a.observations.map((o) => o.usd);
    const useGoogle = a.history.length >= 2;
    const series = useGoogle ? [...a.history.map((h) => h[1]), ...(current !== null ? [current] : [])] : checks;
    const changePct = a.createdPriceUsd > 0 && current !== null ? Math.round(((current - a.createdPriceUsd) / a.createdPriceUsd) * 100) : 0;
    return { alert: a, currentUsd: current, triggered: current !== null && current <= a.targetUsd, expired: a.date < todayIso(), series, seriesSource: useGoogle ? 'google' : 'checks', changePct };
  }

  find(route: AlertRoute): PriceAlert | undefined {
    return this.mine().find((a) => a.from === route.from && a.to === route.to && a.date === route.date && a.returnDate === route.returnDate && a.cabin === route.cabin);
  }

  /** Creates an alert seeded with the live result it was created from. */
  create(input: { from: string; to: string; date: string; returnDate: string | null; cabin: Cabin; targetUsd: number }, seed: SearchResult): PriceAlert | null {
    const u = this.auth.user();
    const current = trackedPrice(seed);
    if (!u || current === null) return null;
    const existing = this.find(input);
    if (existing) {
      this.updateTarget(existing.id, input.targetUsd);
      return existing;
    }
    const now = nowIso();
    const alert: PriceAlert = {
      id: newId(),
      userId: u.id,
      ...input,
      createdAt: now,
      createdPriceUsd: current,
      observations: [{ at: now, usd: current }],
      history: seed.insights?.history ?? [],
      level: seed.insights?.level ?? null,
      typicalRange: seed.insights?.typicalRange ?? null,
      lastCheckedAt: now,
    };
    this.save([...this.all(), alert]);
    return alert;
  }

  /** Feeds a live first-leg result into any alert watching exactly this search (1 adult). */
  record(params: SearchParams, res: SearchResult): void {
    if (params.adults !== 1 || params.children !== 0 || params.infants !== 0 || params.type === 'multi') return;
    const route: AlertRoute = { from: params.legs[0].from, to: params.legs[0].to, date: params.legs[0].date, returnDate: params.type === 'round' ? params.legs[1].date : null, cabin: params.cabin };
    const a = this.find(route);
    if (a) this.apply(a.id, res);
  }

  /** Fetches the live price for an alert now. Uses one search unless the result is still cached. */
  async check(id: string): Promise<number | null> {
    const a = this.all().find((x) => x.id === id);
    if (!a) return null;
    const res = await this.search.search(alertParams(a), 0, null, true);
    this.apply(id, res);
    return trackedPrice(res);
  }

  private apply(id: string, res: SearchResult): void {
    const usd = trackedPrice(res);
    if (usd === null) return;
    const at = new Date(res.fetchedAt).toISOString();
    this.save(
      this.all().map((a) => {
        if (a.id !== id || a.lastCheckedAt >= at) return a;
        return {
          ...a,
          observations: [...a.observations, { at, usd }].slice(-MAX_OBSERVATIONS),
          history: res.insights?.history.length ? res.insights.history : a.history,
          level: res.insights?.level ?? a.level,
          typicalRange: res.insights?.typicalRange ?? a.typicalRange,
          lastCheckedAt: at,
        };
      }),
    );
  }

  updateTarget(id: string, targetUsd: number): void {
    this.save(this.all().map((a) => (a.id === id ? { ...a, targetUsd } : a)));
  }

  remove(id: string): PriceAlert | undefined {
    const a = this.all().find((x) => x.id === id);
    this.save(this.all().filter((x) => x.id !== id));
    return a;
  }

  /** Drops every alert belonging to a user (used when their account is deleted). */
  removeAllFor(userId: string): void {
    this.save(this.all().filter((a) => a.userId !== userId));
  }

  restore(a: PriceAlert): void {
    this.save([...this.all(), a]);
  }

  private save(list: PriceAlert[]): void {
    this.all.set(list);
    this.cache.write(KEY, list);
  }
}
