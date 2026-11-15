import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { airport } from '../../core/data/airports';
import { CABIN_LABEL, PriceAlert } from '../../core/models/flight.model';
import { AlertStatus, AlertsService } from '../../core/services/alerts.service';
import { PreferencesService } from '../../core/services/preferences.service';
import { ToastService } from '../../core/services/toast.service';
import { formatDate } from '../../core/util/date.util';
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
        <p class="mt-2 max-w-2xl text-muted">We watch fares on the routes you track. Create alerts from any search with “Track price”. Fares move daily — the chart shows the last two weeks.</p>
      </header>

      @if (alerts.statuses().length > 0) {
        <ul class="mt-8 grid gap-5 lg:grid-cols-2">
          @for (s of alerts.statuses(); track s.alert.id; let i = $index) {
            <li class="alert-card rise" [class.is-hit]="s.triggered" [style.animation-delay.ms]="i * 50">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <h2 class="font-display text-xl font-bold leading-tight">{{ city(s.alert.from) }} {{ s.alert.returnDate ? '⇄' : '→' }} {{ city(s.alert.to) }}</h2>
                  <p class="mt-1 text-sm text-muted">{{ dates(s.alert) }} · {{ cabin(s.alert) }}</p>
                </div>
                @if (s.triggered) { <span class="badge badge-ok"><app-icon name="bell-ring" [size]="12" /> Target reached</span> }
                @else { <span class="badge">Watching</span> }
              </div>

              <div class="mt-5 grid grid-cols-3 gap-3 text-center">
                <div class="stat !p-3"><p class="stat-label">Now</p><p class="stat-value !text-xl">{{ s.currentUsd | money }}</p></div>
                <div class="stat !p-3"><p class="stat-label">Target</p><p class="stat-value !text-xl">{{ s.alert.targetUsd | money }}</p></div>
                <div class="stat !p-3"><p class="stat-label">14 days</p>
                  <p class="stat-value !text-xl" [class.text-ok]="s.changePct < 0" [class.text-danger]="s.changePct > 0"><app-icon [name]="s.changePct <= 0 ? 'trending-down' : 'trending-up'" [size]="16" /> {{ s.changePct > 0 ? '+' : '' }}{{ s.changePct }}%</p></div>
              </div>

              <svg viewBox="0 0 300 70" class="mt-5 h-20 w-full" role="img" [attr.aria-label]="'Price over the last 14 days: from ' + first(s) + ' to ' + last(s)" preserveAspectRatio="none">
                <path [attr.d]="area(s)" fill="url(#spark)" opacity="0.35" />
                <path [attr.d]="line(s)" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />
                <defs><linearGradient id="spark" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" /><stop offset="1" stop-color="var(--accent)" stop-opacity="0" /></linearGradient></defs>
              </svg>

              <div class="mt-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <label class="label" [for]="'t-' + s.alert.id">Alert me at or below (USD)</label>
                  <input [id]="'t-' + s.alert.id" class="input input-sm !w-32" type="number" min="1" step="1" [value]="s.alert.targetUsd" (change)="setTarget(s.alert.id, $any($event.target))" />
                </div>
                <div class="flex gap-2">
                  <button type="button" class="btn btn-sm btn-ghost icon-btn-danger" [attr.aria-label]="'Delete alert ' + city(s.alert.from) + ' to ' + city(s.alert.to)" (click)="remove(s)"><app-icon name="trash-2" [size]="15" /> Delete</button>
                  <a class="btn btn-sm btn-primary" [routerLink]="['/flights']" [queryParams]="query(s.alert)">{{ s.triggered ? 'Book now' : 'View flights' }} <app-icon name="arrow-right" [size]="14" /></a>
                </div>
              </div>
            </li>
          }
        </ul>
      } @else {
        <div class="card mt-8 grid place-items-center gap-3 px-6 py-16 text-center">
          <app-icon name="bell" [size]="34" />
          <h2 class="text-xl font-bold">No price alerts yet</h2>
          <p class="max-w-md text-muted">Search a route, then tap “Track price” and we'll flag it here when the fare falls to your target.</p>
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

  protected city(code: string): string { return airport(code).city; }
  protected cabin(a: PriceAlert): string { return CABIN_LABEL[a.cabin]; }

  protected dates(a: PriceAlert): string {
    const d = (x: string): string => formatDate(x, { day: 'numeric', month: 'short', year: 'numeric' });
    return a.returnDate ? `${d(a.date)} – ${d(a.returnDate)}` : d(a.date);
  }

  protected first(s: AlertStatus): string { return this.prefs.format(s.history[0] ?? 0); }
  protected last(s: AlertStatus): string { return this.prefs.format(s.history[s.history.length - 1] ?? 0); }

  private points(s: AlertStatus): [number, number][] {
    const h = s.history.length > 1 ? s.history : [s.history[0] ?? 0, s.history[0] ?? 0];
    const min = Math.min(...h);
    const max = Math.max(...h);
    const span = Math.max(1, max - min);
    return h.map((v, i) => [(i / (h.length - 1)) * 300, 62 - ((v - min) / span) * 54]);
  }
  protected line(s: AlertStatus): string { return this.points(s).map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' '); }
  protected area(s: AlertStatus): string { return `${this.line(s)} L300 70 L0 70 Z`; }

  protected query(a: PriceAlert): Record<string, string> {
    return toQuery({
      type: a.returnDate ? 'round' : 'oneway',
      legs: a.returnDate ? [{ from: a.from, to: a.to, date: a.date }, { from: a.to, to: a.from, date: a.returnDate }] : [{ from: a.from, to: a.to, date: a.date }],
      adults: 1, children: 0, infants: 0, cabin: a.cabin,
    });
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
