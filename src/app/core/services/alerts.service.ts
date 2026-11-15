import { Service, computed, inject, signal } from '@angular/core';
import { Cabin, PriceAlert } from '../models/flight.model';
import { addDays, todayIso } from '../util/date.util';
import { newId, nowIso } from '../util/id.util';
import { AuthService } from './auth.service';
import { FlightSearchService } from './flight-search.service';
import { OfflineCacheService } from './offline-cache.service';

const KEY = 'wg:alerts';

export interface AlertStatus {
  alert: PriceAlert;
  currentUsd: number | null;
  triggered: boolean;
  /** Oldest → newest cheapest total over the last two weeks. */
  history: number[];
  changePct: number;
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
  readonly triggeredCount = computed(() => this.statuses().filter((s) => s.triggered).length);

  /** Cheapest round-trip / one-way price per adult for the alert's route right now. */
  currentPrice(a: Pick<PriceAlert, 'from' | 'to' | 'date' | 'returnDate' | 'cabin'>, todayOverride?: string): number | null {
    const ctx = this.search.ctx(todayOverride);
    const out = this.search.cheapest({ from: a.from, to: a.to, date: a.date }, a.cabin, ctx);
    if (out === null) return null;
    if (!a.returnDate) return out;
    const back = this.search.cheapest({ from: a.to, to: a.from, date: a.returnDate }, a.cabin, ctx);
    return back === null ? null : out + back;
  }

  private statusOf(a: PriceAlert): AlertStatus {
    const today = todayIso();
    const current = this.currentPrice(a);
    const history: number[] = [];
    for (let k = 13; k >= 0; k--) {
      const p = this.currentPrice(a, addDays(today, -k));
      if (p !== null) history.push(p);
    }
    const first = history[0] ?? current ?? 0;
    const changePct = first > 0 && current !== null ? Math.round(((current - first) / first) * 100) : 0;
    return { alert: a, currentUsd: current, triggered: current !== null && current <= a.targetUsd, history, changePct };
  }

  create(input: { from: string; to: string; date: string; returnDate: string | null; cabin: Cabin; targetUsd: number }): PriceAlert | null {
    const u = this.auth.user();
    if (!u) return null;
    const current = this.currentPrice(input);
    if (current === null) return null;
    const alert: PriceAlert = { id: newId(), userId: u.id, ...input, createdAt: nowIso(), createdPriceUsd: current };
    this.save([...this.all(), alert]);
    return alert;
  }

  updateTarget(id: string, targetUsd: number): void {
    this.save(this.all().map((a) => (a.id === id ? { ...a, targetUsd } : a)));
  }

  remove(id: string): PriceAlert | undefined {
    const a = this.all().find((x) => x.id === id);
    this.save(this.all().filter((x) => x.id !== id));
    return a;
  }

  restore(a: PriceAlert): void {
    this.save([...this.all(), a]);
  }

  private save(list: PriceAlert[]): void {
    this.all.set(list);
    this.cache.write(KEY, list);
  }
}
