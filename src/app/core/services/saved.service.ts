import { Service, computed, inject, signal } from '@angular/core';
import { FlightOffer, RecentSearch, SavedTrip, SearchParams } from '../models/flight.model';
import { todayIso } from '../util/date.util';
import { searchKey } from '../util/flight-format';
import { newId, nowIso } from '../util/id.util';
import { AuthService } from './auth.service';
import { OfflineCacheService } from './offline-cache.service';

const SAVED_KEY = 'wg:saved';
const RECENT_KEY = 'wg:recent';
const MAX_RECENT = 8;

function tripKey(params: SearchParams, legs: readonly FlightOffer[]): string {
  return `${searchKey(params)}#${legs.map((l) => l.id).join('>')}`;
}

/** Saved itineraries (per account) and recent searches (per device). Kept in localStorage, so they work offline. */
@Service()
export class SavedService {
  private readonly cache = inject(OfflineCacheService);
  private readonly auth = inject(AuthService);

  private readonly all = signal<SavedTrip[]>(this.cache.read<SavedTrip[]>(SAVED_KEY, []));
  private readonly recentAll = signal<RecentSearch[]>(this.cache.read<RecentSearch[]>(RECENT_KEY, []));

  readonly mine = computed(() => {
    const u = this.auth.user();
    return u ? this.all().filter((t) => t.userId === u.id).sort((a, b) => b.savedAt.localeCompare(a.savedAt)) : [];
  });

  /** Recent searches whose first flight is still in the future. */
  readonly recent = computed(() => {
    const today = todayIso();
    return this.recentAll().filter((r) => r.params.legs[0].date >= today);
  });

  findSaved(params: SearchParams, legs: readonly FlightOffer[]): SavedTrip | undefined {
    const key = tripKey(params, legs);
    return this.mine().find((t) => tripKey(t.params, t.legs) === key);
  }

  save(params: SearchParams, legs: FlightOffer[], priceUsd: number | null, googleUrl: string | null): SavedTrip | null {
    const u = this.auth.user();
    if (!u) return null;
    const existing = this.findSaved(params, legs);
    if (existing) return existing;
    const trip: SavedTrip = { id: newId(), userId: u.id, savedAt: nowIso(), params, legs, priceUsd, googleUrl };
    this.write([...this.all(), trip]);
    return trip;
  }

  remove(id: string): SavedTrip | undefined {
    const t = this.all().find((x) => x.id === id);
    this.write(this.all().filter((x) => x.id !== id));
    return t;
  }

  /** Drops every saved trip belonging to a user (used when their account is deleted). */
  removeAllFor(userId: string): void {
    this.write(this.all().filter((t) => t.userId !== userId));
  }

  restore(t: SavedTrip): void {
    if (!this.all().some((x) => x.id === t.id)) this.write([...this.all(), t]);
  }

  rememberSearch(params: SearchParams, lowestUsd: number | null): void {
    const key = searchKey(params);
    const rest = this.recentAll().filter((r) => searchKey(r.params) !== key);
    const next = [{ params, at: nowIso(), lowestUsd }, ...rest].slice(0, MAX_RECENT);
    this.recentAll.set(next);
    this.cache.write(RECENT_KEY, next);
  }

  clearRecent(): void {
    this.recentAll.set([]);
    this.cache.remove(RECENT_KEY);
  }

  private write(list: SavedTrip[]): void {
    this.all.set(list);
    this.cache.write(SAVED_KEY, list);
  }
}
