import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CABIN_LABEL, SavedTrip } from '../../core/models/flight.model';
import { SavedService } from '../../core/services/saved.service';
import { ToastService } from '../../core/services/toast.service';
import { todayIso } from '../../core/util/date.util';
import { formatDuration, offerTimes, paxCount, routeCities, stopsLabel, tripDates } from '../../core/util/flight-format';
import { toQuery } from '../../core/util/search-query';
import { AirlineChipComponent } from '../../shared/components/airline-chip.component';
import { IconComponent } from '../../shared/components/icon.component';
import { MoneyPipe } from '../../shared/components/money.pipe';

@Component({
  selector: 'app-saved',
  imports: [RouterLink, IconComponent, AirlineChipComponent, MoneyPipe],
  template: `
    <div class="page">
      <header class="rise">
        <h1 class="text-4xl font-bold sm:text-5xl">Saved <span class="gradient-text">trips</span></h1>
        <p class="mt-2 max-w-2xl text-muted">Itineraries you saved, with the price we saw at the time. Fares move, so check the live price before you book.</p>
      </header>

      @if (trips().length > 0) {
        <ul class="mt-8 grid gap-5 lg:grid-cols-2">
          @for (t of trips(); track t.trip.id; let i = $index) {
            <li class="card rise p-5" [style.animation-delay.ms]="i * 50">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <h2 class="font-display text-xl font-bold leading-tight">{{ t.route }}</h2>
                  <p class="mt-1 text-sm text-muted">{{ t.meta }}</p>
                </div>
                @if (t.past) { <span class="badge">Date passed</span> }
              </div>

              <ol class="mt-4 grid gap-2.5" aria-label="Flights">
                @for (o of t.trip.legs; track o.id) {
                  <li class="flex items-center gap-3 rounded-xl border border-[var(--border)] px-3 py-2.5">
                    <app-airline-chip [name]="o.airlines[0]" [logo]="o.logo" [size]="30" />
                    <div class="min-w-0 text-sm">
                      <p class="font-semibold">{{ times(o).from }} {{ times(o).depTime }} → {{ times(o).to }} {{ times(o).arrTime }} <span class="font-normal text-muted">· {{ times(o).depDate }}</span></p>
                      <p class="truncate text-xs text-muted">{{ o.airlines.join(', ') }} · {{ dur(o.durationMin) }} · {{ stops(o) }}</p>
                    </div>
                  </li>
                }
              </ol>

              <div class="mt-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p class="text-xs text-faint">Price when saved · {{ t.savedOn }}</p>
                  <p class="font-display text-2xl font-bold">{{ t.trip.priceUsd | money }}</p>
                </div>
                <div class="flex flex-wrap gap-2">
                  <button type="button" class="btn btn-sm btn-ghost icon-btn-danger" [attr.aria-label]="'Remove saved trip ' + t.route" (click)="remove(t.trip)"><app-icon name="trash-2" [size]="15" /> Remove</button>
                  @if (t.trip.googleUrl; as href) {
                    <a class="btn btn-sm" [href]="href" target="_blank" rel="noopener noreferrer"><app-icon name="external-link" [size]="14" /> Google Flights<span class="sr-only"> for {{ t.route }} (opens in a new tab)</span></a>
                  }
                  @if (!t.past) {
                    <a class="btn btn-sm btn-primary" [routerLink]="['/flights']" [queryParams]="t.query">Check live price <app-icon name="arrow-right" [size]="14" /><span class="sr-only"> for {{ t.route }}</span></a>
                  }
                </div>
              </div>
            </li>
          }
        </ul>
      } @else {
        <div class="card mt-8 grid place-items-center gap-3 px-6 py-16 text-center">
          <app-icon name="bookmark" [size]="34" />
          <h2 class="text-xl font-bold">No saved trips yet</h2>
          <p class="max-w-md text-muted">Choose your flights, then tap “Save trip” on the booking step to keep the itinerary here.</p>
          <a routerLink="/" class="btn btn-primary mt-2">Search flights</a>
        </div>
      }
    </div>
  `,
})
export class SavedComponent {
  private readonly saved = inject(SavedService);
  private readonly toast = inject(ToastService);

  protected readonly trips = computed(() => {
    const today = todayIso();
    return this.saved.mine().map((trip) => {
      const p = trip.params;
      const n = paxCount(p);
      return {
        trip,
        route: routeCities(p),
        meta: `${tripDates(p)} · ${n} traveler${n > 1 ? 's' : ''} · ${CABIN_LABEL[p.cabin]}`,
        savedOn: new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(trip.savedAt)),
        past: p.legs[0].date < today,
        query: toQuery(p),
      };
    });
  });

  protected readonly times = offerTimes;
  protected readonly stops = stopsLabel;
  protected dur(min: number): string {
    return formatDuration(min);
  }

  protected remove(t: SavedTrip): void {
    this.saved.remove(t.id);
    this.toast.success('Saved trip removed', { actionLabel: 'Undo', action: () => this.saved.restore(t) });
  }
}
