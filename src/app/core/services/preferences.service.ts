import { Service, computed, inject, signal } from '@angular/core';
import { CURRENCIES } from '../models/flight.model';
import { OfflineCacheService } from './offline-cache.service';
import { RatesService } from './rates.service';

@Service()
export class PreferencesService {
  private readonly cache = inject(OfflineCacheService);

  readonly currency = signal<string>(this.initialCurrency());
  private readonly rates = inject(RatesService);

  readonly rate = computed(() => this.rates.rate(this.currency()));
  readonly lastFrom = signal<string>(this.cache.read<string>('wg:last-from', 'LHR'));

  private initialCurrency(): string {
    const saved = this.cache.read<string>('wg:currency', 'USD');
    return CURRENCIES.some((c) => c.code === saved) ? saved : 'USD';
  }

  setCurrency(code: string): void {
    if (!CURRENCIES.some((c) => c.code === code)) return;
    this.currency.set(code);
    this.cache.write('wg:currency', code);
  }

  rememberFrom(code: string): void {
    this.lastFrom.set(code);
    this.cache.write('wg:last-from', code);
  }

  /** Formats a USD amount in the selected display currency. */
  format(usd: number, decimals: 0 | 2 = 0): string {
    return this.formatIn(usd, this.currency(), this.rate(), decimals);
  }

  formatIn(usd: number, currency: string, rate: number, decimals: 0 | 2 = 0): string {
    const amount = usd * rate;
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        minimumFractionDigits: currency === 'JPY' ? 0 : decimals,
        maximumFractionDigits: currency === 'JPY' ? 0 : decimals,
      }).format(amount);
    } catch {
      return `${currency} ${amount.toFixed(decimals)}`;
    }
  }
}
