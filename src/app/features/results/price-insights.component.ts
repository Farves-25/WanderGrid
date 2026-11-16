import { Component, computed, inject, input } from '@angular/core';
import { PriceInsights } from '../../core/models/flight.model';
import { PreferencesService } from '../../core/services/preferences.service';
import { IconComponent } from '../../shared/components/icon.component';
import { MoneyPipe } from '../../shared/components/money.pipe';

let uid = 0;

/** Google Flights' own read on the price: level, typical range and the recent price history. */
@Component({
  selector: 'app-price-insights',
  imports: [IconComponent, MoneyPipe],
  host: { class: 'block' },
  template: `
    <section class="card p-5" [attr.aria-labelledby]="id + '-h'">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 [id]="id + '-h'" class="flex items-center gap-2 text-lg font-bold"><app-icon name="chart-line" [size]="18" /> Price insights</h2>
          <p class="mt-1 text-sm text-muted">{{ verdict() }}</p>
        </div>
        @if (insights().level; as level) {
          <span class="badge" [class.badge-ok]="level === 'low'" [class.badge-warn]="level === 'high'">
            <app-icon [name]="level === 'low' ? 'trending-down' : level === 'high' ? 'trending-up' : 'gauge'" [size]="12" /> {{ levelLabel() }}
          </span>
        }
      </div>

      <div class="mt-4 grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
        <dl class="grid grid-cols-2 gap-3 sm:grid-cols-1">
          @if (insights().lowestUsd !== null) {
            <div class="stat !p-3"><dt class="stat-label">Lowest now</dt><dd class="stat-value !text-xl">{{ insights().lowestUsd | money }}</dd></div>
          }
          @if (insights().typicalRange; as r) {
            <div class="stat !p-3"><dt class="stat-label">Usually</dt><dd class="stat-value !text-xl">{{ r[0] | money }} – {{ r[1] | money }}</dd></div>
          }
        </dl>

        @if (chart(); as c) {
          <figure class="min-w-0">
            <svg viewBox="0 0 300 80" class="h-24 w-full" role="img" [attr.aria-label]="c.label" preserveAspectRatio="none">
              <defs><linearGradient [attr.id]="id + '-g'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" /><stop offset="1" stop-color="var(--accent)" stop-opacity="0" /></linearGradient></defs>
              @if (c.band; as b) { <rect x="0" [attr.y]="b.y" width="300" [attr.height]="b.h" fill="var(--accent)" opacity="0.1" /> }
              <path [attr.d]="c.area" [attr.fill]="'url(#' + id + '-g)'" opacity="0.35" />
              <path [attr.d]="c.line" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />
            </svg>
            <figcaption class="mt-1 flex justify-between text-xs text-faint"><span>{{ c.from }}</span><span>Price history{{ c.band ? ' · shaded: usual range' : '' }}</span><span>{{ c.to }}</span></figcaption>
          </figure>
        }
      </div>
      <p class="mt-3 text-xs text-faint">Source: Google Flights.</p>
    </section>
  `,
})
export class PriceInsightsComponent {
  readonly insights = input.required<PriceInsights>();
  private readonly prefs = inject(PreferencesService);
  protected readonly id = `pi-${++uid}`;

  protected readonly levelLabel = computed(() => {
    const l = this.insights().level;
    return l === 'low' ? 'Prices are low' : l === 'high' ? 'Prices are high' : l === 'typical' ? 'Prices are typical' : (l ?? '');
  });

  protected readonly verdict = computed(() => {
    const i = this.insights();
    const low = i.lowestUsd;
    const r = i.typicalRange;
    if (low !== null && r) {
      if (low < r[0]) return `The lowest price is ${this.prefs.format(r[0] - low)} below the usual range for this trip.`;
      if (low > r[1]) return `The lowest price is ${this.prefs.format(low - r[1])} above the usual range for this trip.`;
      return 'The lowest price is within the usual range for this trip.';
    }
    return 'How current prices compare with what this trip usually costs.';
  });

  protected readonly chart = computed(() => {
    const i = this.insights();
    const h = i.history;
    if (h.length < 2) return null;
    const values = h.map((p) => p[1]);
    const r = i.typicalRange;
    const min = Math.min(...values, ...(r ? [r[0]] : []));
    const max = Math.max(...values, ...(r ? [r[1]] : []));
    const span = Math.max(1, max - min);
    const y = (v: number): number => 72 - ((v - min) / span) * 64;
    const line = h.map((p, k) => `${k ? 'L' : 'M'}${((k / (h.length - 1)) * 300).toFixed(1)} ${y(p[1]).toFixed(1)}`).join(' ');
    const fmt = (ms: number): string => new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(new Date(ms));
    return {
      line,
      area: `${line} L300 80 L0 80 Z`,
      band: r ? { y: y(r[1]), h: Math.max(1, y(r[0]) - y(r[1])) } : null,
      from: fmt(h[0][0]),
      to: fmt(h[h.length - 1][0]),
      label: `Price history from ${fmt(h[0][0])} to ${fmt(h[h.length - 1][0])}: started at ${this.prefs.format(values[0])}, now ${this.prefs.format(values[values.length - 1])}, lowest ${this.prefs.format(Math.min(...values))}, highest ${this.prefs.format(Math.max(...values))}`,
    };
  });
}
