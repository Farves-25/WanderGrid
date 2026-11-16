import { HttpClient } from '@angular/common/http';
import { Service, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CURRENCIES } from '../models/flight.model';
import { OfflineCacheService } from './offline-cache.service';

interface RatesPayload {
  base: string;
  rates: Record<string, number>;
  updatedAt: number;
}

const KEY = 'wg:rates';
const FALLBACK: Record<string, number> = Object.fromEntries(CURRENCIES.map((c) => [c.code, c.rate]));

/** USD exchange rates: live from the API server, the last saved copy when offline, built-in estimates as a last resort. */
@Service()
export class RatesService {
  private readonly http = inject(HttpClient);
  private readonly cache = inject(OfflineCacheService);

  private readonly saved = this.cache.read<RatesPayload | null>(KEY, null);
  readonly rates = signal<Record<string, number>>(this.usable(this.saved) ? this.saved.rates : FALLBACK);
  /** When the rates in use were published (epoch ms); null while using built-in estimates. */
  readonly updatedAt = signal<number | null>(this.usable(this.saved) ? this.saved.updatedAt : null);

  constructor() {
    void this.load();
  }

  rate(code: string): number {
    const r = this.rates()[code];
    return typeof r === 'number' && r > 0 ? r : (FALLBACK[code] ?? 1);
  }

  private usable(p: RatesPayload | null): p is RatesPayload {
    return !!p && typeof p.rates === 'object' && p.rates !== null && typeof p.updatedAt === 'number';
  }

  private async load(): Promise<void> {
    try {
      const p = await firstValueFrom(this.http.get<RatesPayload>('/api/rates'));
      if (!this.usable(p)) return;
      const picked: Record<string, number> = {};
      for (const c of CURRENCIES) if (typeof p.rates[c.code] === 'number') picked[c.code] = p.rates[c.code];
      this.rates.set(picked);
      this.updatedAt.set(p.updatedAt);
      this.cache.write(KEY, { base: 'USD', rates: picked, updatedAt: p.updatedAt });
    } catch {
      /* keep whatever we have */
    }
  }
}
