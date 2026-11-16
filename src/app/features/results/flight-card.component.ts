import { Component, computed, input, output, signal } from '@angular/core';
import { FlightOffer } from '../../core/models/flight.model';
import { cityOf, formatDuration, offerTimes, segmentTimes, stopsLabel } from '../../core/util/flight-format';
import { AirlineChipComponent } from '../../shared/components/airline-chip.component';
import { IconComponent } from '../../shared/components/icon.component';
import { MoneyPipe } from '../../shared/components/money.pipe';

export interface FlightBadges {
  cheapest: boolean;
  fastest: boolean;
}

@Component({
  selector: 'app-flight-card',
  imports: [IconComponent, AirlineChipComponent, MoneyPipe],
  host: { class: 'block' },
  template: `
    <article class="flight-card" [class.is-selected]="selected()" [attr.aria-label]="ariaLabel()">
      <div class="grid gap-4 p-4 sm:p-6 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <div class="mb-3 flex flex-wrap items-center gap-2">
            <app-airline-chip [name]="offer().airlines[0]" [logo]="offer().logo" [size]="30" />
            <span class="text-sm font-semibold">{{ offer().airlines.join(' · ') }}</span>
            <span class="text-xs text-faint">· {{ flightNos() }}</span>
            <span class="ml-auto flex flex-wrap gap-1.5">
              @if (offer().best) { <span class="badge badge-ok"><app-icon name="sparkles" [size]="11" /> Best</span> }
              @if (badges().cheapest) { <span class="badge badge-ok"><app-icon name="tag" [size]="11" /> Cheapest</span> }
              @if (badges().fastest) { <span class="badge badge-ok"><app-icon name="zap" [size]="11" /> Fastest</span> }
              @if (oftenDelayed()) { <span class="badge badge-warn"><app-icon name="triangle-alert" [size]="11" /> Often delayed 30+ min</span> }
            </span>
          </div>

          <div class="grid grid-cols-[auto_1fr_auto] items-center gap-3 sm:gap-5">
            <div>
              <p class="flight-time">{{ t().depTime }}</p>
              <p class="mt-1.5 text-sm font-bold tracking-wide">{{ t().from }}</p>
              <p class="text-xs text-faint">{{ t().depDate }}</p>
            </div>
            <div class="px-1 text-center">
              <p class="text-xs font-semibold text-muted">{{ duration() }}</p>
              <div class="route-line" aria-hidden="true">
                <span class="route-dot"></span>
                @for (l of offer().layovers; track $index) { <span class="route-stop"></span> }
                <span class="route-dot"></span>
              </div>
              <p class="text-xs font-semibold" [class.text-ok]="offer().stops === 0" [class.text-warn]="offer().stops > 0">{{ stops() }}</p>
            </div>
            <div class="text-right">
              <p class="flight-time">
                {{ t().arrTime }}@if (t().plusDays !== 0) {<sup class="ml-0.5 font-sans text-xs font-bold tracking-normal text-accent">{{ t().plusDays > 0 ? '+' : '' }}{{ t().plusDays }}<span class="sr-only"> day</span></sup>}
              </p>
              <p class="mt-1.5 text-sm font-bold tracking-wide">{{ t().to }}</p>
              <p class="text-xs text-faint">{{ t().arrDate }}</p>
            </div>
          </div>
        </div>

        <div class="ticket-stub flex items-center justify-between gap-4 pt-4 md:min-w-[12rem] md:flex-col md:items-end md:justify-center md:self-stretch md:pl-6 md:pt-0">
          <div class="md:text-right">
            @if (offer().priceUsd !== null) {
              <p class="flight-price">{{ offer().priceUsd | money }}</p>
              <p class="text-xs text-muted">{{ priceNote() }}</p>
            } @else {
              <p class="font-display text-lg font-bold">Price on booking site</p>
              <p class="text-xs text-muted">Not published for this flight</p>
            }
          </div>
          <button type="button" class="btn btn-primary" (click)="choose.emit()">
            @if (selected()) { <app-icon name="check" [size]="16" /> Selected } @else { {{ actionLabel() }} }
            <span class="sr-only"> {{ offer().airlines[0] }} {{ t().depTime }} flight</span>
          </button>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-[var(--border)] px-4 py-2.5 text-xs text-muted sm:px-5">
        <button type="button" class="inline-flex items-center gap-1 font-semibold text-accent hover:underline" [attr.aria-expanded]="open()" (click)="open.set(!open())">
          Flight details <app-icon [name]="open() ? 'chevron-up' : 'chevron-down'" [size]="14" />
        </button>
        @if (offer().co2Kg !== null) {
          <span class="inline-flex items-center gap-1" [class.text-ok]="(offer().co2DiffPct ?? 0) < 0">
            <app-icon name="leaf" [size]="13" /> {{ offer().co2Kg }} kg CO₂e@if (offer().co2DiffPct !== null && offer().co2DiffPct !== 0) { <span>({{ offer().co2DiffPct! > 0 ? '+' : '' }}{{ offer().co2DiffPct }}% vs typical)</span> }
          </span>
        }
        @if (legroom(); as lr) { <span class="inline-flex items-center gap-1"><app-icon name="ruler" [size]="13" /> {{ lr }} legroom</span> }
        @if (amenities().wifi) { <span class="inline-flex items-center gap-1"><app-icon name="wifi" [size]="13" /> Wi-Fi</span> }
        @if (amenities().power) { <span class="inline-flex items-center gap-1"><app-icon name="plug" [size]="13" /> Power</span> }
        @if (amenities().video) { <span class="inline-flex items-center gap-1"><app-icon name="tv" [size]="13" /> Entertainment</span> }
        @for (x of offer().extensions; track x) { <span>{{ x }}</span> }
      </div>

      @if (open()) {
        <div class="rounded-b-[17px] border-t border-[var(--border)] bg-[var(--surface-solid-2)] p-4 sm:p-5">
          <ol class="grid gap-0">
            @for (s of offer().segments; track $index; let i = $index) {
              <li>
                <div class="grid grid-cols-[4.5rem_1fr] gap-4">
                  <div class="text-right"><p class="font-display text-lg font-bold">{{ seg(s).depTime }}</p><p class="text-xs text-faint">{{ seg(s).depDate }}</p></div>
                  <div class="seg-rail">
                    <p class="font-semibold">{{ s.fromName || s.from }} <span class="text-muted">({{ s.from }})</span></p>
                    <p class="my-2 text-sm text-muted">
                      {{ s.airline }} {{ s.flightNo }}@if (s.aircraft) { · {{ s.aircraft }} } · {{ dur(s.durationMin) }}@if (s.cabin) { · {{ s.cabin }} }
                    </p>
                    @if (s.operatedBy) { <p class="-mt-1 mb-2 text-xs text-faint">Operated by {{ s.operatedBy }}</p> }
                    @if (s.alsoSoldBy.length > 0) { <p class="-mt-1 mb-2 text-xs text-faint">Also sold by {{ s.alsoSoldBy.join(', ') }}</p> }
                    @if (s.extensions.length > 0) {
                      <ul class="mb-2 flex flex-wrap gap-1.5">
                        @for (x of s.extensions; track x) { <li class="badge">{{ x }}</li> }
                      </ul>
                    }
                    @if (s.overnight) { <p class="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-warn"><app-icon name="moon" [size]="13" /> Overnight flight</p> }
                    @if (s.oftenDelayed) { <p class="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-warn"><app-icon name="triangle-alert" [size]="13" /> Often delayed by 30+ minutes</p> }
                    <p class="font-semibold">{{ s.toName || s.to }} <span class="text-muted">({{ s.to }}) · arrives {{ seg(s).arrTime }}@if (seg(s).plusDays !== 0) { {{ seg(s).plusDays > 0 ? '+' : '' }}{{ seg(s).plusDays }} day }</span></p>
                  </div>
                </div>
                @if (offer().layovers[i]; as lay) {
                  <p class="my-3 ml-[5.5rem] flex items-center gap-2 rounded-xl border border-dashed border-[var(--border-strong)] px-3 py-2 text-sm" [class.text-warn]="lay.overnight">
                    <app-icon name="timer" [size]="15" /> {{ dur(lay.minutes) }} layover in {{ city(lay.airport, lay.name) }} ({{ lay.airport }}){{ lay.overnight ? ' · overnight' : '' }}
                  </p>
                }
              </li>
            }
          </ol>
        </div>
      }
    </article>
  `,
})
export class FlightCardComponent {
  readonly offer = input.required<FlightOffer>();
  readonly badges = input<FlightBadges>({ cheapest: false, fastest: false });
  readonly selected = input(false);
  readonly actionLabel = input('Select');
  /** Short note under the price, e.g. "round trip · 2 travelers". */
  readonly priceNote = input('');
  readonly choose = output<void>();

  protected readonly open = signal(false);

  protected readonly t = computed(() => offerTimes(this.offer()));
  protected readonly duration = computed(() => formatDuration(this.offer().durationMin));
  protected readonly stops = computed(() => stopsLabel(this.offer()));
  protected readonly flightNos = computed(() => this.offer().segments.map((s) => s.flightNo).filter(Boolean).join(', '));
  protected readonly oftenDelayed = computed(() => this.offer().segments.some((s) => s.oftenDelayed));
  protected readonly legroom = computed(() => {
    const all = [...new Set(this.offer().segments.map((s) => s.legroom).filter((x): x is string => !!x))];
    return all.length === 1 ? all[0] : null;
  });
  protected readonly amenities = computed(() => {
    const has = (re: RegExp): boolean => this.offer().segments.every((s) => s.extensions.some((x) => re.test(x)));
    return { wifi: has(/wi-?fi/i), power: has(/power|usb/i), video: has(/video|entertainment/i) };
  });
  protected readonly ariaLabel = computed(() => {
    const o = this.offer();
    const price = o.priceUsd === null ? '' : `, ${o.priceUsd} US dollars`;
    return `${o.airlines.join(' and ')} flight ${this.t().from} to ${this.t().to}, departs ${this.t().depTime}, arrives ${this.t().arrTime}, ${this.stops()}${price}`;
  });

  protected readonly seg = segmentTimes;
  protected readonly city = cityOf;
  protected dur(min: number): string {
    return formatDuration(min);
  }
}
