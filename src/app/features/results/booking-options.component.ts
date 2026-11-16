import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { BookingPart, BookingResult, FlightOffer, SearchParams } from '../../core/models/flight.model';
import { AuthService } from '../../core/services/auth.service';
import { ApiError, FlightSearchService } from '../../core/services/flight-search.service';
import { PreferencesService } from '../../core/services/preferences.service';
import { SavedService } from '../../core/services/saved.service';
import { ToastService } from '../../core/services/toast.service';
import { openBooking } from '../../core/util/booking-redirect';
import { cityOf, formatDuration, offerTimes, paxCount, stopsLabel } from '../../core/util/flight-format';
import { AirlineChipComponent } from '../../shared/components/airline-chip.component';
import { IconComponent } from '../../shared/components/icon.component';
import { MoneyPipe } from '../../shared/components/money.pipe';

const SCOPE_LABEL: Record<BookingPart['scope'], string> = { together: '', departing: 'Outbound ticket', returning: 'Return ticket' };

/** Final step: the chosen itinerary and the real sites that sell it, each with a "Book" hand-off. */
@Component({
  selector: 'app-booking-options',
  imports: [IconComponent, AirlineChipComponent, MoneyPipe],
  host: { class: 'block' },
  template: `
    <section aria-labelledby="bk-h">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p class="eyebrow mb-2">Last step</p>
          <h1 id="bk-h" class="text-3xl sm:text-4xl">Book your <span class="gradient-text">trip</span></h1>
          <p class="text-sm text-muted">Pick a seller below — you'll finish the booking and pay on their website, not on WanderGrid.</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="btn btn-sm" (click)="toggleSave()" [attr.aria-pressed]="saved() !== undefined">
            <app-icon [name]="saved() ? 'bookmark-check' : 'bookmark'" [size]="15" /> {{ saved() ? 'Saved' : 'Save trip' }}
          </button>
          <button type="button" class="btn btn-sm" (click)="share()"><app-icon name="share-2" [size]="15" /> Copy link</button>
        </div>
      </div>

      <!-- itinerary -->
      <ol class="mt-5 grid gap-3" aria-label="Your flights">
        @for (o of legs(); track o.id; let i = $index) {
          <li class="card flex flex-wrap items-center gap-x-5 gap-y-2 p-4">
            <app-airline-chip [name]="o.airlines[0]" [logo]="o.logo" [size]="34" />
            <div class="min-w-0 flex-1">
              <p class="font-semibold">{{ city(t(o).from) }} → {{ city(t(o).to) }} <span class="text-sm font-normal text-muted">· {{ t(o).depDate }}</span></p>
              <p class="text-sm text-muted">
                {{ t(o).depTime }} – {{ t(o).arrTime }}@if (t(o).plusDays !== 0) { ({{ t(o).plusDays > 0 ? '+' : '' }}{{ t(o).plusDays }}d) } · {{ dur(o.durationMin) }} · {{ stops(o) }} · {{ o.airlines.join(', ') }} {{ nos(o) }}
              </p>
            </div>
            <button type="button" class="btn btn-sm btn-ghost" [attr.aria-label]="'Change flight ' + (i + 1)" (click)="changeLeg.emit(i)">Change</button>
          </li>
        }
      </ol>

      <!-- sellers -->
      <div class="mt-6" aria-live="polite">
        @if (!token()) {
          <div class="card p-6 text-center">
            <p class="font-semibold">Booking sites aren't listed for this itinerary.</p>
            <p class="mt-1 text-sm text-muted">You can still check it on Google Flights or go to the airline directly.</p>
          </div>
        } @else if (loading()) {
          <p class="sr-only">Finding booking sites…</p>
          <ul class="grid gap-3" aria-hidden="true">@for (n of [1, 2, 3]; track n) { <li class="skeleton h-24"></li> }</ul>
        } @else if (error(); as e) {
          <div class="card p-6 text-center" role="alert">
            <app-icon name="circle-alert" [size]="28" />
            <p class="mt-2 font-semibold">Couldn't load booking sites</p>
            <p class="mt-1 text-sm text-muted">{{ e.message }}</p>
            <button type="button" class="btn btn-sm mt-4" (click)="reload.update(n => n + 1)"><app-icon name="refresh-cw" [size]="14" /> Try again</button>
          </div>
        } @else if (result(); as r) {
          @if (r.options.length === 0) {
            <div class="card p-6 text-center">
              <p class="font-semibold">No booking sites were returned for these flights.</p>
              <p class="mt-1 text-sm text-muted">Availability changes quickly — the fare may have just sold out. Try Google Flights or another flight.</p>
            </div>
          } @else {
            <h2 class="mb-3 text-lg font-bold">{{ r.options.length }} booking option{{ r.options.length === 1 ? '' : 's' }} <span class="text-sm font-normal text-muted">· {{ paxNote() }}</span></h2>
            <ul class="grid gap-3">
              @for (opt of r.options; track $index; let first = $first) {
                <li class="seller-card p-4 sm:p-5" [class.is-best]="first">
                  @if (opt.separate) {
                    <p class="mb-3 flex items-center gap-2 text-sm font-semibold text-warn"><app-icon name="triangle-alert" [size]="15" /> Separate tickets — you book each part on its own@if (opt.totalUsd !== null) { <span class="text-[var(--text)]">· {{ opt.totalUsd | money }} in total</span> }</p>
                  }
                  <div class="grid gap-4">
                    @for (part of opt.parts; track part.scope) {
                      <div class="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                        <div class="min-w-0">
                          <div class="flex flex-wrap items-center gap-2">
                            <app-airline-chip [name]="part.seller" [logo]="part.logos[0] ?? null" [size]="30" />
                            <p class="font-bold">{{ part.seller }}</p>
                            @if (part.isAirline) { <span class="badge badge-ok"><app-icon name="badge-check" [size]="11" /> Airline</span> }
                            @if (first && !opt.separate) { <span class="badge badge-ok"><app-icon name="tag" [size]="11" /> Lowest price</span> }
                            @if (scopeLabel(part); as sl) { <span class="badge">{{ sl }}</span> }
                          </div>
                          @if (part.title) { <p class="mt-1.5 text-sm font-semibold">{{ part.title }}</p> }
                          @if (part.extensions.length + part.baggage.length > 0) {
                            <ul class="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                              @for (x of part.baggage; track x) { <li class="inline-flex items-center gap-1"><app-icon name="luggage" [size]="12" /> {{ x }}</li> }
                              @for (x of part.extensions; track x) { <li>{{ x }}</li> }
                            </ul>
                          }
                        </div>
                        <div class="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
                          <p class="flight-price !text-[1.7rem]">{{ part.priceUsd === null ? 'See site' : (part.priceUsd | money) }}</p>
                          @if (part.request) {
                            <button type="button" class="btn btn-primary" (click)="book(part)">
                              Book now <app-icon name="external-link" [size]="15" /><span class="sr-only"> on {{ part.seller }} (opens in a new tab)</span>
                            </button>
                          } @else if (part.phone) {
                            <a class="btn" [href]="'tel:' + part.phone"><app-icon name="phone" [size]="15" /> {{ part.phone }}</a>
                          }
                        </div>
                        @if (part.request && part.phone) { <p class="text-xs text-faint sm:col-span-2">Or call {{ part.phone }}@if (part.phoneFeeUsd !== null) { (about {{ part.phoneFeeUsd | money }} phone service fee) }</p> }
                        @else if (!part.request && part.phone && part.phoneFeeUsd !== null) { <p class="text-xs text-faint sm:col-span-2">Phone bookings carry a service fee of about {{ part.phoneFeeUsd | money }}.</p> }
                      </div>
                    }
                  </div>
                </li>
              }
            </ul>
            @if (r.baggage.length > 0) {
              <p class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted"><app-icon name="luggage" [size]="15" /> @for (b of r.baggage; track b) { <span>{{ b }}</span> }</p>
            }
          }
        }
      </div>

      <div class="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
        <p class="max-w-2xl">Prices are live from Google Flights in US dollars@if (currencyNote()) {, shown in {{ currencyNote() }} at today's exchange rate}. The seller confirms the final price and availability at checkout.</p>
        @if (link(); as href) {
          <a class="btn btn-sm" [href]="href" target="_blank" rel="noopener noreferrer"><app-icon name="external-link" [size]="14" /> View on Google Flights<span class="sr-only"> (opens in a new tab)</span></a>
        }
      </div>
    </section>
  `,
})
export class BookingOptionsComponent {
  readonly params = input.required<SearchParams>();
  readonly legs = input.required<FlightOffer[]>();
  /** Google Flights link for the search, used when the booking response doesn't carry one. */
  readonly googleUrl = input<string | null>(null);
  readonly changeLeg = output<number>();

  private readonly api = inject(FlightSearchService);
  private readonly savedTrips = inject(SavedService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly prefs = inject(PreferencesService);

  protected readonly loading = signal(false);
  protected readonly error = signal<ApiError | null>(null);
  protected readonly result = signal<BookingResult | null>(null);
  protected readonly reload = signal(0);
  private run = 0;

  protected readonly token = computed(() => this.legs()[this.legs().length - 1]?.bookingToken ?? null);
  protected readonly link = computed(() => this.result()?.googleUrl ?? this.googleUrl());
  protected readonly saved = computed(() => this.savedTrips.findSaved(this.params(), this.legs()));
  protected readonly price = computed(() => this.result()?.options[0]?.totalUsd ?? this.legs()[this.legs().length - 1]?.priceUsd ?? null);
  protected readonly paxNote = computed(() => {
    const n = paxCount(this.params());
    return n === 1 ? 'total price for 1 traveler' : `total price for ${n} travelers`;
  });
  protected readonly currencyNote = computed(() => (this.prefs.currency() === 'USD' ? '' : this.prefs.currency()));

  constructor() {
    effect(() => {
      const token = this.token();
      const params = this.params();
      void this.reload();
      const my = ++this.run;
      untracked(() => {
        this.result.set(null);
        this.error.set(null);
        this.loading.set(token !== null);
      });
      if (!token) return;
      this.api.booking(params, token).then(
        (r) => {
          if (my !== this.run) return;
          this.result.set(r);
          this.loading.set(false);
        },
        (e: unknown) => {
          if (my !== this.run) return;
          this.error.set(e instanceof ApiError ? e : new ApiError('server_error', 'Something went wrong.'));
          this.loading.set(false);
        },
      );
    });
  }

  protected readonly t = offerTimes;
  protected readonly stops = stopsLabel;
  protected city(code: string): string {
    return cityOf(code);
  }
  protected dur(min: number): string {
    return formatDuration(min);
  }
  protected nos(o: FlightOffer): string {
    return o.segments.map((s) => s.flightNo).filter(Boolean).join(', ');
  }
  protected scopeLabel(p: BookingPart): string {
    return SCOPE_LABEL[p.scope];
  }

  protected book(part: BookingPart): void {
    if (!part.request || !openBooking(part.request)) {
      this.toast.error(`Couldn't open ${part.seller}. Try “View on Google Flights”.`);
      return;
    }
    this.toast.success(`Opening ${part.seller} in a new tab…`);
  }

  protected toggleSave(): void {
    if (!this.auth.signedIn()) {
      void this.router.navigate(['/login'], { queryParams: { redirect: this.router.url } });
      return;
    }
    const existing = this.saved();
    if (existing) {
      this.savedTrips.remove(existing.id);
      this.toast.success('Removed from saved trips', { actionLabel: 'Undo', action: () => this.savedTrips.restore(existing) });
      return;
    }
    this.savedTrips.save(this.params(), this.legs(), this.price(), this.link());
    this.toast.success('Trip saved — find it under Saved trips.');
  }

  protected async share(): Promise<void> {
    try {
      await navigator.clipboard.writeText(location.href);
      this.toast.success('Search link copied');
    } catch {
      this.toast.error('Couldn’t copy the link — copy it from the address bar instead.');
    }
  }
}
