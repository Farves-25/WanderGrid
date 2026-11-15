import { Component, computed, input, output, signal } from '@angular/core';
import { airline } from '../../core/data/airlines';
import { airport } from '../../core/data/airports';
import { formatDuration } from '../../core/engine/time';
import { CABIN_LABEL, FAMILY_LABEL, FareFamily, FlightOffer, SearchParams } from '../../core/models/flight.model';
import { offerTimes, segmentTimes, stopsLabel } from '../../core/util/flight-format';
import { AirlineChipComponent } from '../../shared/components/airline-chip.component';
import { IconComponent } from '../../shared/components/icon.component';
import { MoneyPipe } from '../../shared/components/money.pipe';

export interface FlightBadges {
  cheapest: boolean;
  fastest: boolean;
  best: boolean;
}

@Component({
  selector: 'app-flight-card',
  imports: [IconComponent, AirlineChipComponent, MoneyPipe],
  host: { class: 'block' },
  template: `
    <article class="flight-card" [class.is-selected]="selectedFamily() !== null" [attr.aria-label]="ariaLabel()">
      <div class="grid gap-4 p-4 sm:p-5 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <div class="mb-3 flex flex-wrap items-center gap-2">
            @for (code of offer().airlines; track code) {
              <app-airline-chip [code]="code" [size]="30" />
              <span class="text-sm font-semibold">{{ airlineName(code) }}</span>
            }
            <span class="text-xs text-faint">· {{ offer().segments[0].flightNo }}{{ offer().segments.length > 1 ? ' +' + (offer().segments.length - 1) : '' }}</span>
            <span class="ml-auto flex flex-wrap gap-1.5">
              @if (badges().best) { <span class="badge badge-ok"><app-icon name="sparkles" [size]="11" /> Best</span> }
              @if (badges().cheapest) { <span class="badge badge-ok"><app-icon name="tag" [size]="11" /> Cheapest</span> }
              @if (badges().fastest) { <span class="badge badge-ok"><app-icon name="zap" [size]="11" /> Fastest</span> }
              @if (offer().seatsLeft <= 4) { <span class="badge badge-warn"><app-icon name="flame" [size]="11" /> {{ offer().seatsLeft }} left</span> }
            </span>
          </div>

          <div class="grid grid-cols-[auto_1fr_auto] items-center gap-3 sm:gap-5">
            <div>
              <p class="font-display text-2xl font-bold leading-none tracking-tight sm:text-3xl">{{ t().depTime }}</p>
              <p class="mt-1 text-sm font-semibold">{{ t().from }}</p>
              <p class="text-xs text-faint">{{ t().depDate }}</p>
            </div>
            <div class="px-1 text-center">
              <p class="text-xs font-semibold text-muted">{{ duration() }}</p>
              <div class="route-line" aria-hidden="true">
                <span class="route-dot"></span>
                @for (l of offer().layovers; track l.airport) { <span class="route-stop"></span> }
                <span class="route-dot"></span>
              </div>
              <p class="text-xs font-semibold" [class.text-ok]="offer().stops === 0" [class.text-warn]="offer().stops > 0">{{ stops() }}</p>
            </div>
            <div class="text-right">
              <p class="font-display text-2xl font-bold leading-none tracking-tight sm:text-3xl">
                {{ t().arrTime }}@if (t().plusDays > 0) {<sup class="ml-0.5 text-xs font-bold text-warn">+{{ t().plusDays }}</sup>}
              </p>
              <p class="mt-1 text-sm font-semibold">{{ t().to }}</p>
              <p class="text-xs text-faint">{{ t().arrDate }}</p>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-between gap-4 border-t border-[var(--border)] pt-4 md:min-w-[11rem] md:flex-col md:items-end md:border-l md:border-t-0 md:pl-6 md:pt-0">
          <div class="md:text-right">
            <p class="text-xs text-faint">{{ cabinLabel() }} from</p>
            <p class="font-display text-3xl font-bold tracking-tight">{{ offer().fares.basic.total | money }}</p>
            <p class="text-xs text-muted">per traveler{{ pax() > 1 ? ' · ' : '' }}@if (pax() > 1) {<span>{{ totalFor('basic') | money }} total</span>}</p>
          </div>
          <button type="button" class="btn btn-primary" [attr.aria-expanded]="panel() === 'fares'" (click)="toggle('fares')">
            @if (selectedFamily(); as f) { <app-icon name="check" [size]="16" /> {{ familyLabel(f) }} } @else { Select }
          </button>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-[var(--border)] px-4 py-2.5 text-xs text-muted sm:px-5">
        <button type="button" class="inline-flex items-center gap-1 font-semibold text-accent hover:underline" [attr.aria-expanded]="panel() === 'details'" (click)="toggle('details')">
          Flight details <app-icon [name]="panel() === 'details' ? 'chevron-up' : 'chevron-down'" [size]="14" />
        </button>
        <span class="inline-flex items-center gap-1"><app-icon name="clock" [size]="13" /> {{ offer().onTimePct }}% on time</span>
        <span class="inline-flex items-center gap-1"><app-icon name="leaf" [size]="13" /> {{ offer().co2Kg }} kg CO₂</span>
        @if (amenities().wifi) { <span class="inline-flex items-center gap-1"><app-icon name="wifi" [size]="13" /> Wi-Fi</span> }
        @if (amenities().power) { <span class="inline-flex items-center gap-1"><app-icon name="plug" [size]="13" /> Power</span> }
        @if (amenities().tv) { <span class="inline-flex items-center gap-1"><app-icon name="tv" [size]="13" /> Entertainment</span> }
      </div>

      @if (panel() === 'details') {
        <div class="border-t border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
          <ol class="grid gap-0">
            @for (s of offer().segments; track s.id; let i = $index) {
              <li>
                <div class="grid grid-cols-[4.5rem_1fr] gap-4">
                  <div class="text-right"><p class="font-display text-lg font-bold">{{ seg(s).depTime }}</p><p class="text-xs text-faint">{{ seg(s).depDate }}</p></div>
                  <div class="seg-rail">
                    <p class="font-semibold">{{ city(s.from) }} <span class="text-muted">({{ s.from }}) · {{ airportName(s.from) }}</span></p>
                    <p class="my-2 text-sm text-muted">{{ airlineName(s.airline) }} {{ s.flightNo }} · {{ s.aircraft.name }} · {{ dur(s.durationMin) }} · {{ cabinLabel() }}</p>
                    <p class="font-semibold">{{ city(s.to) }} <span class="text-muted">({{ s.to }}) · arrives {{ seg(s).arrTime }}@if (seg(s).plusDays > 0) { +{{ seg(s).plusDays }} }</span></p>
                  </div>
                </div>
                @if (offer().layovers[i]; as lay) {
                  <p class="my-3 ml-[5.5rem] flex items-center gap-2 rounded-xl border border-dashed border-[var(--border-strong)] px-3 py-2 text-sm" [class.text-warn]="lay.overnight">
                    <app-icon name="timer" [size]="15" /> {{ dur(lay.minutes) }} layover in {{ city(lay.airport) }} ({{ lay.airport }}){{ lay.overnight ? ' · long wait' : '' }}
                  </p>
                }
              </li>
            }
          </ol>
        </div>
      }

      @if (panel() === 'fares') {
        <div class="border-t border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
          <p class="mb-3 text-sm font-semibold">Choose your fare</p>
          <div class="grid gap-3 md:grid-cols-3">
            @for (f of families; track f) {
              <div class="fare-col" [class.is-picked]="selectedFamily() === f">
                <div class="flex items-center justify-between">
                  <p class="font-bold">{{ familyLabel(f) }}</p>
                  @if (f === 'standard') { <span class="badge badge-ok">Popular</span> }
                </div>
                <p class="mt-1 font-display text-2xl font-bold">{{ offer().fares[f].total | money }}</p>
                <p class="text-xs text-muted">per traveler{{ pax() > 1 ? ' · ' + (totalFor(f) | money) + ' total' : '' }}</p>
                <ul class="my-4 grid gap-1.5 text-[0.82rem]">
                  <li class="flex items-start gap-2"><app-icon name="briefcase" [size]="14" /> Carry-on bag included</li>
                  <li class="flex items-start gap-2" [class.text-faint]="offer().fares[f].checkedBags === 0"><app-icon name="luggage" [size]="14" /> {{ bagsText(f) }}</li>
                  <li class="flex items-start gap-2" [class.text-faint]="offer().fares[f].seatSelection === 'paid'"><app-icon name="armchair" [size]="14" /> {{ offer().fares[f].seatSelection === 'free' ? 'Free seat selection' : 'Seat selection for a fee' }}</li>
                  <li class="flex items-start gap-2" [class.text-faint]="offer().fares[f].changeFeeUsd === null"><app-icon name="refresh-cw" [size]="14" /> {{ changeText(f) }}</li>
                  <li class="flex items-start gap-2" [class.text-faint]="offer().fares[f].refund === 'none'"><app-icon name="receipt" [size]="14" /> {{ refundText(f) }}</li>
                  <li class="flex items-start gap-2"><app-icon name="award" [size]="14" /> {{ offer().fares[f].milesPct }}% WanderMiles</li>
                </ul>
                <button type="button" class="btn w-full" [class.btn-primary]="f === 'standard' || selectedFamily() === f" (click)="choose.emit(f)">
                  {{ selectedFamily() === f ? 'Selected' : 'Choose ' + familyLabel(f) }}<span class="sr-only"> {{ familyLabel(f) }} fare, {{ offer().fares[f].total | money }} per traveler</span>
                </button>
              </div>
            }
          </div>
        </div>
      }
    </article>
  `,
})
export class FlightCardComponent {
  readonly offer = input.required<FlightOffer>();
  readonly params = input.required<SearchParams>();
  readonly badges = input<FlightBadges>({ cheapest: false, fastest: false, best: false });
  readonly selectedFamily = input<FareFamily | null>(null);
  readonly choose = output<FareFamily>();

  protected readonly families: FareFamily[] = ['basic', 'standard', 'flex'];
  protected readonly panel = signal<'none' | 'fares' | 'details'>('none');

  protected readonly t = computed(() => offerTimes(this.offer()));
  protected readonly duration = computed(() => formatDuration(this.offer().durationMin));
  protected readonly stops = computed(() => stopsLabel(this.offer()));
  protected readonly pax = computed(() => this.params().adults + this.params().children + this.params().infants);
  protected readonly cabinLabel = computed(() => CABIN_LABEL[this.offer().cabin]);
  protected readonly amenities = computed(() => {
    const segs = this.offer().segments;
    return { wifi: segs.every((s) => s.aircraft.wifi), power: segs.every((s) => s.aircraft.power), tv: segs.every((s) => s.aircraft.entertainment) };
  });
  protected readonly ariaLabel = computed(() => `${this.airlineName(this.offer().airlines[0])} flight ${this.t().from} to ${this.t().to}, departs ${this.t().depTime}, arrives ${this.t().arrTime}, ${this.stops()}`);

  protected toggle(p: 'fares' | 'details'): void {
    this.panel.update((cur) => (cur === p ? 'none' : p));
  }

  protected totalFor(f: FareFamily): number {
    const p = this.params();
    const fare = this.offer().fares[f];
    return Math.round(fare.base * (p.adults + 0.75 * p.children + 0.1 * p.infants) + fare.taxes * (p.adults + p.children + 0.4 * p.infants));
  }

  protected airlineName(code: string): string { return airline(code).name; }
  protected city(code: string): string { return airport(code).city; }
  protected airportName(code: string): string { return airport(code).name; }
  protected dur(min: number): string { return formatDuration(min); }
  protected seg = segmentTimes;
  protected familyLabel(f: FareFamily): string { return FAMILY_LABEL[f]; }

  protected bagsText(f: FareFamily): string {
    const fare = this.offer().fares[f];
    return fare.checkedBags === 0 ? 'No checked bag' : `${fare.checkedBags} checked bag${fare.checkedBags > 1 ? 's' : ''} (${fare.bagKg} kg)`;
  }
  protected changeText(f: FareFamily): string {
    const c = this.offer().fares[f].changeFeeUsd;
    return c === null ? 'Changes not allowed' : c === 0 ? 'Free changes' : 'Changes for a fee';
  }
  protected refundText(f: FareFamily): string {
    const r = this.offer().fares[f].refund;
    return r === 'none' ? 'Non-refundable (taxes back)' : r === 'partial' ? 'Refundable with a fee' : 'Fully refundable';
  }
}
