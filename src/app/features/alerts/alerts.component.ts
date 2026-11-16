import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CABIN_LABEL, PriceAlert } from '../../core/models/flight.model';
import { AlertStatus, AlertsService, alertParams } from '../../core/services/alerts.service';
import { ApiError } from '../../core/services/flight-search.service';
import { PreferencesService } from '../../core/services/preferences.service';
import { ToastService } from '../../core/services/toast.service';
import { formatDate } from '../../core/util/date.util';
import { cityOf } from '../../core/util/flight-format';
import { toQuery } from '../../core/util/search-query';
import { IconComponent } from '../../shared/components/icon.component';
import { MoneyPipe } from '../../shared/components/money.pipe';

@Component({
  selector: 'app-alerts',
  imports: [RouterLink, IconComponent, MoneyPipe],
  template: `
    <div class="page">
      <header class="rise">
        <h1 class="text-4xl font-bold sm:text-5xl">Price <span class="gradient-text">alerts</span></h1>
        <p class="mt-2 max-w-2xl text-muted">Live fares for the trips you track, for one adult. Prices update whenever you search the trip or press “Check now” — each check uses one live search.</p>
      </header>

      @if (alerts.statuses().length > 0) {
        <ul class="mt-8 grid gap-5 lg:grid-cols-2">
          @for (s of alerts.statuses(); track s.alert.id; let i = $index) {
            <li class="alert-card rise" [class.is-hit]="s.triggered && !s.expired" [style.animation-delay.ms]="i * 50">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <h2 class="font-display text-xl font-bold leading-tight">{{ city(s.alert.from) }} {{ s.alert.returnDate ? '⇄' : '→' }} {{ city(s.alert.to) }}</h2>
                  <p class="mt-1 text-sm text-muted">{{ dates(s.alert) }} · {{ cabin(s.alert) }}</p>
                </div>
                @if (s.expired) { <span class="badge">Travel date passed</span> }
                @else if (s.triggered) { <span class="badge badge-ok"><app-icon name="bell-ring" [size]="12" /> Target reached</span> }
                @else { <span class="badge">Watching</span> }
              </div>

              <dl class="mt-5 grid grid-cols-3 gap-3 text-center">
                <div class="stat !p-3"><dt class="stat-label">Last price</dt><dd class="stat-value !text-xl">{{ s.currentUsd | money }}</dd></div>
                <div class="stat !p-3"><dt class="stat-label">Target</dt><dd class="stat-value !text-xl">{{ s.alert.targetUsd | money }}</dd></div>
                <div class="stat !p-3"><dt class="stat-label">Since tracking</dt>
                  <dd class="stat-value !text-xl" [class.text-ok]="s.changePct < 0" [class.text-danger]="s.changePct > 0"><app-icon [name]="s.changePct <= 0 ? 'trending-down' : 'trending-up'" [size]="16" /> {{ s.changePct > 0 ? '+' : '' }}{{ s.changePct }}%</dd></div>
              </dl>

              @if (s.series.length > 1) {
                <svg viewBox="0 0 300 70" class="mt-5 h-20 w-full" role="img" [attr.aria-label]="chartLabel(s)" preserveAspectRatio="none">
                  <defs><linearGradient [attr.id]="'spark-' + s.alert.id" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" /><stop offset="1" stop-color="var(--accent)" stop-opacity="0" /></linearGradient></defs>
                  <path [attr.d]="area(s)" [attr.fill]="'url(#spark-' + s.alert.id + ')'" opacity="0.35" />
                  <path [attr.d]="line(s)" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />
                </svg>
              } @else {
                <p class="mt-5 rounded-xl border border-dashed border-[var(--border-strong)] px-3 py-4 text-center text-sm text-muted">The price chart appears after the next check.</p>
              }
              <p class="mt-2 text-xs text-faint">
                {{ s.seriesSource === 'google' ? 'Price history from Google Flights' : 'Prices recorded at each check' }} · last checked {{ checked(s.alert) }}@if (s.alert.typicalRange; as r) { · usually {{ r[0] | money }}–{{ r[1] | money }} }
              </p>

              <div class="mt-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <label class="label" [for]="'t-' + s.alert.id">Alert me at or below (USD)</label>
                  <input [id]="'t-' + s.alert.id" class="input input-sm !w-32" type="number" min="1" step="1" [value]="s.alert.targetUsd" (change)="setTarget(s.alert.id, $any($event.target))" />
                </div>
                <div class="flex flex-wrap gap-2">
                  <button type="button" class="btn btn-sm btn-ghost icon-btn-danger" [attr.aria-label]="'Delete alert ' + city(s.alert.from) + ' to ' + city(s.alert.to)" (click)="remove(s)"><app-icon name="trash-2" [size]="15" /> Delete</button>
                  @if (!s.expired) {
                    <button type="button" class="btn btn-sm" [disabled]="busy() === s.alert.id" [attr.aria-label]="'Check price now for ' + city(s.alert.from) + ' to ' + city(s.alert.to)" (click)="check(s)"><app-icon name="refresh-cw" [size]="14" /> {{ busy() === s.alert.id ? 'Checking…' : 'Check now' }}</button>
                    <a class="btn btn-sm btn-primary" [routerLink]="['/flights']" [queryParams]="query(s.alert)">{{ s.triggered ? 'Book now' : 'View flights' }} <app-icon name="arrow-right" [size]="14" /></a>
                  }
                </div>
              </div>
            </li>
          }
        </ul>
      } @else {
        <div class="card mt-8 grid place-items-center gap-3 px-6 py-16 text-center">
          <app-icon name="bell" [size]="34" />
          <h2 class="text-xl font-bold">No price alerts yet</h2>
          <p class="max-w-md text-muted">Search a trip, then tap “Track price” to follow its live fare against your target.</p>
          <a routerLink="/" class="btn btn-primary mt-2">Search flights</a>
        </div>
      }
    </div>
  `,
})
export class AlertsComponent {
  protected readonly alerts = inject(AlertsService);
  private readonly prefs = inject(PreferencesService);
  private readonly toast = inject(ToastService);

  protected readonly busy = signal<string | null>(null);

  protected city(code: string): string {
    return cityOf(code);
  }
  protected cabin(a: PriceAlert): string {
    return CABIN_LABEL[a.cabin];
  }

  protected dates(a: PriceAlert): string {
    const d = (x: string): string => formatDate(x, { day: 'numeric', month: 'short', year: 'numeric' });
    return a.returnDate ? `${d(a.date)} – ${d(a.returnDate)}` : d(a.date);
  }

  protected checked(a: PriceAlert): string {
    return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(a.lastCheckedAt));
  }

  protected chartLabel(s: AlertStatus): string {
    const h = s.series;
    return `Price trend: from ${this.prefs.format(h[0])} to ${this.prefs.format(h[h.length - 1])}, lowest ${this.prefs.format(Math.min(...h))}, highest ${this.prefs.format(Math.max(...h))}`;
  }

  private points(s: AlertStatus): [number, number][] {
    const h = s.series;
    const min = Math.min(...h);
    const max = Math.max(...h);
    const span = Math.max(1, max - min);
    return h.map((v, i) => [(i / (h.length - 1)) * 300, 62 - ((v - min) / span) * 54]);
  }
  protected line(s: AlertStatus): string {
    return this.points(s).map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  }
  protected area(s: AlertStatus): string {
    return `${this.line(s)} L300 70 L0 70 Z`;
  }

  protected query(a: PriceAlert): Record<string, string> {
    return toQuery(alertParams(a));
  }

  protected async check(s: AlertStatus): Promise<void> {
    this.busy.set(s.alert.id);
    try {
      const usd = await this.alerts.check(s.alert.id);
      if (usd === null) this.toast.error('No published fares for this trip right now.');
      else if (usd <= s.alert.targetUsd) this.toast.success(`Target reached — now ${this.prefs.format(usd)}`);
      else this.toast.success(`Price updated — now ${this.prefs.format(usd)}`);
    } catch (e) {
      this.toast.error(e instanceof ApiError ? e.message : 'Couldn’t check the price.');
    } finally {
      this.busy.set(null);
    }
  }

  protected setTarget(id: string, el: HTMLInputElement): void {
    const v = Math.round(Number(el.value));
    if (!Number.isFinite(v) || v <= 0) {
      this.toast.error('Enter a target price above zero.');
      return;
    }
    this.alerts.updateTarget(id, v);
    this.toast.success('Target updated');
  }

  protected remove(s: AlertStatus): void {
    const a = this.alerts.remove(s.alert.id);
    if (a) this.toast.success('Alert deleted', { actionLabel: 'Undo', action: () => this.alerts.restore(a) });
  }
}
