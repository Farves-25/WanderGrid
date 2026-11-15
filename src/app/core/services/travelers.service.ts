import { Service, computed, inject, signal } from '@angular/core';
import { Passenger, SavedTraveler } from '../models/flight.model';
import { newId } from '../util/id.util';
import { AuthService } from './auth.service';
import { OfflineCacheService } from './offline-cache.service';

interface Stored extends SavedTraveler {
  userId: string;
}

const KEY = 'wg:travelers';

/** Frequent travelers that autofill the passenger form (passport details stay on this device). */
@Service()
export class TravelersService {
  private readonly cache = inject(OfflineCacheService);
  private readonly auth = inject(AuthService);

  private readonly all = signal<Stored[]>(this.cache.read<Stored[]>(KEY, []));

  readonly mine = computed<SavedTraveler[]>(() => {
    const u = this.auth.user();
    return u ? this.all().filter((t) => t.userId === u.id) : [];
  });

  save(p: Passenger, id?: string): SavedTraveler | null {
    const u = this.auth.user();
    if (!u) return null;
    const existing = id ? this.all().find((t) => t.id === id) : this.all().find((t) => t.userId === u.id && t.firstName.toLowerCase() === p.firstName.toLowerCase() && t.lastName.toLowerCase() === p.lastName.toLowerCase() && t.dob === p.dob);
    const next: Stored = { ...p, id: existing?.id ?? newId(), userId: u.id };
    this.write(existing ? this.all().map((t) => (t.id === next.id ? next : t)) : [...this.all(), next]);
    return next;
  }

  remove(id: string): void {
    this.write(this.all().filter((t) => t.id !== id));
  }

  private write(list: Stored[]): void {
    this.all.set(list);
    this.cache.write(KEY, list);
  }
}
