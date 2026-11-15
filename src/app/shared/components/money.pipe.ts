import { Pipe, PipeTransform, inject } from '@angular/core';
import { PreferencesService } from '../../core/services/preferences.service';

/** Formats a USD amount in the user's chosen currency. Impure so it reacts to currency changes. */
@Pipe({ name: 'money', pure: false })
export class MoneyPipe implements PipeTransform {
  private readonly prefs = inject(PreferencesService);

  transform(usd: number | null | undefined, decimals: 0 | 2 = 0): string {
    return usd === null || usd === undefined ? '—' : this.prefs.format(usd, decimals);
  }
}
