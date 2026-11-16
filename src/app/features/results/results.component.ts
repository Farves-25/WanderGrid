import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CABIN_LABEL, FlightOffer, SearchParams, SearchResult } from '../../core/models/flight.model';
import { AlertsService, alertParams, trackedPrice } from '../../core/services/alerts.service';
import { AuthService } from '../../core/services/auth.service';
import { ApiError, FlightSearchService } from '../../core/services/flight-search.service';
import { SavedService } from '../../core/services/saved.service';
import { ToastService } from '../../core/services/toast.service';
import { formatDate } from '../../core/util/date.util';
import { cityOf, departureBand, formatDuration, lowestPrice, offerTimes, paxCount, routeCodes, tripDates } from '../../core/util/flight-format';
import { QueryInput, fromQuery, toQuery } from '../../core/util/search-query';
import { IconComponent } from '../../shared/components/icon.component';
import { ModalComponent } from '../../shared/components/modal.component';
import { MoneyPipe } from '../../shared/components/money.pipe';
import { SearchFormComponent } from '../../shared/components/search-form.component';
import { BookingOptionsComponent } from './booking-options.component';
import { FlightBadges, FlightCardComponent } from './flight-card.component';
import { PriceInsightsComponent } from './price-insights.component';

type Sort = 'best' | 'cheapest' | 'fastest' | 'earliest';
type Stops = 'any' | 'direct' | 'max1';
type Band = 'night' | 'morning' | 'afternoon' | 'evening';

const BANDS: { id: Band; label: string; hours: string }[] = [
  { id: 'night', label: 'Night', hours: 'Before 6am' },
  { id: 'morning', label: 'Morning', hours: '6am–12pm' },
  { id: 'afternoon', label: 'Afternoon', hours: '12pm–6pm' },
  { id: 'evening', label: 'Evening', hours: 'After 6pm' },
];

@Component({
  selector: 'app-results',
  imports: [NgTemplateOutlet, FlightCardComponent, BookingOptionsComponent, PriceInsightsComponent, SearchFormComponent, IconComponent, ModalComponent, MoneyPipe, RouterLink],
  template: `
    <div class="page">
      @if (error()) {
        <div class="glass mx-auto mt-8 max-w-xl p-10 text-center">
          <app-icon name="circle-alert" [size]="34" />
          <h1 class="mt-3 text-2xl font-bold">We couldn't run that search</h1>
          <p class="mt-2 text-muted">{{ error() }}</p>
          <a routerLink="/" class="btn btn-primary mt-6">Start a new search</a>
        </div>
      } @else if (params(); as p) {
        <details class="no-print mb-6" #edit>
          <summary class="card flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-5 py-3.5">
            <span class="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span class="font-display text-lg font-bold">{{ summaryRoute() }}</span>
              <span class="text-sm text-muted">{{ summaryMeta() }}</span>
            </span>
            <span class="btn btn-sm"><app-icon name="pencil" [size]="14" /> Modify search</span>
          </summary>
          <div class="mt-3"><app-search-form [initial]="p" (search)="newSearch($event, edit)" /></div>
        </details>

        <!-- leg stepper -->
        @if (p.legs.length > 1) {
          <ol class="no-print mb-6 grid gap-3" [class.md:grid-cols-2]="p.legs.length === 2" [class.md:grid-cols-3]="p.legs.length >= 3" aria-label="Your itinerary">
            @for (leg of p.legs; track $index; let i = $index) {
              <li class="leg-step" [class.is-active]="!booking() && i === activeIdx()" [class.is-done]="selections()[i] !== null">
                <div class="flex items-center gap-3">
                  <span class="step-dot" aria-hidden="true">@if (selections()[i]) { <app-icon name="check" [size]="14" [stroke]="3" /> } @else { {{ i + 1 }} }</span>
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-bold">{{ legTitle(i) }}</p>
                    <p class="truncate text-xs text-muted">
                      @if (selections()[i]; as sel) { {{ selSummary(sel) }} } @else { {{ legDate(i) }} }
                    </p>
                  </div>
                  @if (selections()[i] && (booking() || i !== activeIdx())) {
                    <button type="button" class="btn btn-sm btn-ghost" [attr.aria-label]="'Change flight ' + (i + 1)" (click)="changeLeg(i)">Change</button>
                  }
                </div>
              </li>
            }
          </ol>
        }

        @if (booking()) {
          <app-booking-options [params]="p" [legs]="chosen()" [googleUrl]="googleUrl()" (changeLeg)="changeLeg($event)" />
        } @else if (apiError(); as e) {
          <div class="glass mx-auto mt-4 max-w-2xl p-8 sm:p-10" role="alert">
            @if (e.code === 'not_configured' || e.code === 'invalid_key') {
              <app-icon name="key-round" [size]="34" />
              <h1 class="mt-3 text-2xl font-bold">{{ e.code === 'invalid_key' ? 'The flight data key was rejected' : 'Connect live flight data' }}</h1>
              <p class="mt-2 text-muted">WanderGrid shows real schedules and prices from Google Flights through SerpApi. It needs an API key on the server to do that.</p>
              <ol class="mt-4 list-decimal space-y-1.5 pl-5 text-sm">
                <li>Create a free SerpApi account and copy your key from <span class="font-semibold">serpapi.com/manage-api-key</span>.</li>
                <li>Copy <code>.env.example</code> to <code>.env</code> in the project folder and set <code>SERPAPI_KEY=your key</code>.</li>
                <li>Restart the app with <code>npm start</code>, then search again.</li>
              </ol>
            } @else {
              <app-icon name="circle-alert" [size]="34" />
              <h1 class="mt-3 text-2xl font-bold">{{ e.code === 'quota' ? 'Search limit reached' : 'Live flight data is unavailable' }}</h1>
              <p class="mt-2 text-muted">{{ e.message }}</p>
            }
            <button type="button" class="btn btn-primary mt-6" (click)="retry()"><app-icon name="refresh-cw" [size]="16" /> Try again</button>
          </div>
        } @else {
          <div class="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
            <!-- Filters (desktop) -->
            <aside class="no-print hidden lg:block" aria-label="Filters">
              <div class="sticky top-24 border-t-2 border-[var(--text)] pt-5">
                <ng-container [ngTemplateOutlet]="filtersTpl" />
              </div>
            </aside>

            <section aria-labelledby="res-h">
              <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h1 id="res-h" class="text-3xl sm:text-4xl">{{ headline() }}</h1>
                  <p class="text-sm text-muted" role="status" aria-live="polite">
                    @if (loading()) { Searching live fares… } @else { {{ shown().length }} of {{ offers().length }} flights · {{ priceNote() }}, taxes included }
                  </p>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <button type="button" class="btn btn-sm lg:hidden" (click)="filtersOpen.set(true)"><app-icon name="sliders-horizontal" [size]="15" /> Filters@if (activeFilters() > 0) { <span class="badge badge-ok !px-1.5">{{ activeFilters() }}</span> }</button>
                  @if (p.type !== 'multi') {
                    <button type="button" class="btn btn-sm" [disabled]="alertBusy()" (click)="trackPrice()"><app-icon name="bell" [size]="15" /> {{ alertBusy() ? 'Checking…' : 'Track price' }}</button>
                  }
                  <button type="button" class="btn btn-sm" [disabled]="loading()" (click)="refresh()"><app-icon name="refresh-cw" [size]="15" /> Refresh</button>
                </div>
              </div>

              @if (!loading() && activeIdx() === 0 && insights(); as pi) {
                <app-price-insights class="no-print mb-4" [insights]="pi" />
              }

              <div class="no-print mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Sort flights">
                @for (s of sorts; track s.id) {
                  <button type="button" class="chip" [attr.aria-pressed]="sort() === s.id" (click)="sort.set(s.id)">{{ s.label }}</button>
                }
                @if (!loading() && updated()) { <span class="ml-auto text-xs text-faint">Live from Google Flights · updated {{ updated() }}</span> }
              </div>

              @if (loading()) {
                <ul class="grid gap-4" aria-hidden="true">
                  @for (n of [1, 2, 3, 4]; track n) { <li class="skeleton h-44"></li> }
                </ul>
              } @else if (offers().length === 0) {
                <div class="card grid place-items-center gap-3 p-12 text-center">
                  <app-icon name="plane" [size]="34" />
                  <h2 class="text-xl font-bold">No flights found</h2>
                  <p class="max-w-md text-muted">Google Flights has no {{ cabinLabel() }} flights for this route and date. Try another date, a nearby airport{{ p.cabin !== 'economy' ? ' or Economy class' : '' }}.</p>
                </div>
              } @else if (shown().length === 0) {
                <div class="card grid place-items-center gap-3 p-12 text-center">
                  <app-icon name="sliders-horizontal" [size]="34" />
                  <h2 class="text-xl font-bold">No flights match your filters</h2>
                  <button type="button" class="btn btn-sm" (click)="resetFilters()">Reset filters</button>
                </div>
              } @else {
                <ul class="grid gap-4">
                  @for (o of shown(); track o.id) {
                    <li><app-flight-card [offer]="o" [badges]="badgesFor(o)" [selected]="selections()[activeIdx()]?.id === o.id" [actionLabel]="isLastLeg() ? 'Book now' : 'Select'" [priceNote]="cardNote(o)" (choose)="pick(o)" /></li>
                  }
                </ul>
              }
            </section>
          </div>
        }
      }
    </div>

    <ng-template #filtersTpl>
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-bold">Filters</h2>
        @if (activeFilters() > 0) { <button type="button" class="text-sm font-semibold text-accent hover:underline" (click)="resetFilters()">Reset</button> }
      </div>

      <fieldset class="mt-5">
        <legend class="label">Stops</legend>
        @for (s of stopOptions; track s.id) {
          <label class="opt"><input type="radio" name="stops" class="check !rounded-full" [checked]="stops() === s.id" (change)="stops.set(s.id)" /> {{ s.label }}</label>
        }
      </fieldset>

      @if (bounds().maxP > bounds().minP) {
        <div class="mt-6">
          <label class="label" for="f-price">Max price: <span class="text-[var(--text)]">{{ (maxPrice() ?? bounds().maxP) | money }}</span></label>
          <input id="f-price" type="range" class="range" [min]="bounds().minP" [max]="bounds().maxP" step="1" [value]="maxPrice() ?? bounds().maxP" (input)="maxPrice.set(+$any($event.target).value)" />
        </div>
      }

      <div class="mt-6">
        <label class="label" for="f-dur">Max duration: <span class="text-[var(--text)]">{{ dur(maxDur() ?? bounds().maxD) }}</span></label>
        <input id="f-dur" type="range" class="range" [min]="bounds().minD" [max]="bounds().maxD" step="15" [value]="maxDur() ?? bounds().maxD" (input)="maxDur.set(+$any($event.target).value)" />
      </div>

      <fieldset class="mt-6">
        <legend class="label">Departure time</legend>
        <div class="grid grid-cols-2 gap-2">
          @for (b of bands; track b.id) {
            <button type="button" class="band-btn" [attr.aria-pressed]="bandSet().has(b.id)" (click)="toggleBand(b.id)"><span class="font-semibold">{{ b.label }}</span><span class="text-[0.68rem] text-muted">{{ b.hours }}</span></button>
          }
        </div>
      </fieldset>

      <fieldset class="mt-6">
        <legend class="label">Airlines</legend>
        <div class="grid max-h-60 gap-0.5 overflow-y-auto pr-1">
          @for (a of airlineList(); track a.name) {
            <label class="opt justify-between">
              <span class="flex min-w-0 items-center gap-2.5"><input type="checkbox" class="check" [checked]="airlineSet().has(a.name)" (change)="toggleAirline(a.name)" /> <span class="truncate">{{ a.name }}</span></span>
              <span class="shrink-0 text-xs text-muted">{{ a.minUsd | money }}</span>
            </label>
          }
        </div>
      </fieldset>
    </ng-template>

    @if (filtersOpen()) {
      <app-modal heading="Filters" (closed)="filtersOpen.set(false)">
        <ng-container [ngTemplateOutlet]="filtersTpl" />
        <div class="modal-actions"><button type="button" class="btn btn-primary" (click)="filtersOpen.set(false)">Show {{ shown().length }} flights</button></div>
      </app-modal>
    }

    @if (alertSeed(); as seed) {
      <app-modal heading="Track this price" subtitle="We’ll flag it on your Price alerts page when the live fare reaches your target." (closed)="alertSeed.set(null)">
        <p class="text-sm text-muted">Lowest {{ cabinLabel() }} fare right now: <strong class="text-[var(--text)]">{{ alertCurrent() | money }}</strong> for one adult{{ params()?.type === 'round' ? ', round trip' : '' }}.</p>
        <label class="label mt-4" for="alert-target">Alert me at or below (USD)</label>
        <input id="alert-target" class="input" type="number" min="1" step="1" [value]="alertTarget()" (input)="alertTarget.set(+$any($event.target).value)" />
        <p class="mt-1 text-xs text-faint">Suggested: 10% below today's price. Prices are re-checked when you search this trip or press “Check now” on the alerts page.</p>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" (click)="alertSeed.set(null)">Cancel</button>
          <button type="button" class="btn btn-primary" (click)="saveAlert(seed)"><app-icon name="bell-ring" [size]="16" /> Create alert</button>
        </div>
      </app-modal>
    }
  `,
})
export class ResultsComponent {
  // route query params (bound via withComponentInputBinding)
  readonly type = input<string>();
  readonly legs = input<string>();
  readonly adt = input<string>();
  readonly chd = input<string>();
  readonly inf = input<string>();
  readonly cabin = input<string>();

  private readonly api = inject(FlightSearchService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly alerts = inject(AlertsService);
  private readonly savedTrips = inject(SavedService);
  private readonly toast = inject(ToastService);

  protected readonly sorts: { id: Sort; label: string }[] = [
    { id: 'best', label: 'Best' },
    { id: 'cheapest', label: 'Cheapest' },
    { id: 'fastest', label: 'Fastest' },
    { id: 'earliest', label: 'Earliest' },
  ];
  protected readonly stopOptions: { id: Stops; label: string }[] = [
    { id: 'any', label: 'Any number of stops' },
    { id: 'direct', label: 'Nonstop only' },
    { id: 'max1', label: '1 stop or fewer' },
  ];
  protected readonly bands = BANDS;

  private readonly parsed = computed(() => fromQuery({ type: this.type(), legs: this.legs(), adt: this.adt(), chd: this.chd(), inf: this.inf(), cabin: this.cabin() } as QueryInput));
  protected readonly params = computed<SearchParams | null>(() => {
    const r = this.parsed();
    return r.ok ? r.params : null;
  }, { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) });
  protected readonly error = computed(() => {
    const r = this.parsed();
    return r.ok ? '' : r.message;
  });

  /** The flight chosen for each leg. Choosing leg N clears every leg after it, because later results depend on it. */
  protected readonly selections = signal<(FlightOffer | null)[]>([]);
  private readonly editing = signal<number | null>(null);
  protected readonly activeIdx = computed(() => {
    const e = this.editing();
    if (e !== null) return e;
    const sel = this.selections();
    const firstNull = sel.findIndex((s) => s === null);
    return firstNull === -1 ? Math.max(0, sel.length - 1) : firstNull;
  });
  protected readonly chosen = computed(() => this.selections().filter((s): s is FlightOffer => s !== null));
  /** All flights are chosen → show where to book. */
  protected readonly booking = computed(() => this.editing() === null && this.selections().length > 0 && this.selections().every((s) => s !== null));
  protected readonly isLastLeg = computed(() => this.activeIdx() === (this.params()?.legs.length ?? 1) - 1);
  private readonly activeLeg = computed(() => this.params()?.legs[this.activeIdx()] ?? { from: '', to: '', date: '' });
  /** Token needed to load the active leg: none for the first, the previous choice's token after that. */
  private readonly activeToken = computed(() => (this.activeIdx() === 0 ? null : (this.selections()[this.activeIdx() - 1]?.nextToken ?? null)));

  protected readonly loading = signal(true);
  protected readonly apiError = signal<ApiError | null>(null);
  private readonly result = signal<SearchResult | null>(null);
  private readonly firstResult = signal<SearchResult | null>(null);
  protected readonly offers = computed(() => this.result()?.offers ?? []);
  protected readonly insights = computed(() => this.result()?.insights ?? null);
  protected readonly googleUrl = computed(() => this.firstResult()?.googleUrl ?? null);
  private readonly reload = signal<{ n: number; fresh: boolean }>({ n: 0, fresh: false });
  private run = 0;
  private usedReload = 0;

  // filters
  protected readonly sort = signal<Sort>('best');
  protected readonly stops = signal<Stops>('any');
  protected readonly maxPrice = signal<number | null>(null);
  protected readonly maxDur = signal<number | null>(null);
  protected readonly bandSet = signal<ReadonlySet<Band>>(new Set());
  protected readonly airlineSet = signal<ReadonlySet<string>>(new Set());
  protected readonly filtersOpen = signal(false);

  protected readonly alertSeed = signal<SearchResult | null>(null);
  protected readonly alertTarget = signal(0);
  protected readonly alertBusy = signal(false);
  protected readonly alertCurrent = computed(() => {
    const s = this.alertSeed();
    return s ? trackedPrice(s) : null;
  });

  protected readonly bounds = computed(() => {
    const o = this.offers();
    if (o.length === 0) return { minP: 0, maxP: 0, minD: 0, maxD: 1 };
    const prices = o.map((x) => x.priceUsd).filter((n): n is number => n !== null);
    const durs = o.map((x) => x.durationMin);
    return {
      minP: prices.length ? Math.min(...prices) : 0,
      maxP: prices.length ? Math.max(...prices) : 0,
      minD: Math.floor(Math.min(...durs) / 15) * 15,
      maxD: Math.ceil(Math.max(...durs) / 15) * 15,
    };
  });

  protected readonly airlineList = computed(() => {
    const map = new Map<string, number | null>();
    for (const o of this.offers()) {
      for (const name of o.airlines) {
        const cur = map.get(name) ?? null;
        map.set(name, o.priceUsd === null ? cur : cur === null ? o.priceUsd : Math.min(cur, o.priceUsd));
      }
    }
    return [...map.entries()].map(([name, minUsd]) => ({ name, minUsd })).sort((a, b) => a.name.localeCompare(b.name));
  });

  protected readonly activeFilters = computed(
    () => (this.stops() !== 'any' ? 1 : 0) + (this.maxPrice() !== null ? 1 : 0) + (this.maxDur() !== null ? 1 : 0) + (this.bandSet().size > 0 ? 1 : 0) + (this.airlineSet().size > 0 ? 1 : 0),
  );

  protected readonly shown = computed(() => {
    const stops = this.stops();
    const mp = this.maxPrice();
    const md = this.maxDur();
    const bands = this.bandSet();
    const al = this.airlineSet();
    const list = this.offers().filter(
      (o) =>
        (stops === 'any' || (stops === 'direct' ? o.stops === 0 : o.stops <= 1)) &&
        (mp === null || (o.priceUsd !== null && o.priceUsd <= mp)) &&
        (md === null || o.durationMin <= md) &&
        (bands.size === 0 || bands.has(departureBand(o))) &&
        (al.size === 0 || o.airlines.some((c) => al.has(c))),
    );
    const price = (o: FlightOffer): number => o.priceUsd ?? Infinity;
    switch (this.sort()) {
      case 'cheapest': return list.sort((x, y) => price(x) - price(y) || x.durationMin - y.durationMin);
      case 'fastest': return list.sort((x, y) => x.durationMin - y.durationMin || price(x) - price(y));
      case 'earliest': return list.sort((x, y) => x.dep.localeCompare(y.dep));
      default: return list; // Google Flights' own ranking
    }
  });

  private readonly tags = computed(() => {
    const o = this.offers();
    if (o.length < 2) return { cheapest: '', fastest: '' };
    const priced = o.filter((x) => x.priceUsd !== null);
    const cheapest = priced.length ? priced.reduce((m, x) => (x.priceUsd! < m.priceUsd! ? x : m)) : null;
    const fastest = o.reduce((m, x) => (x.durationMin < m.durationMin ? x : m));
    return { cheapest: cheapest?.id ?? '', fastest: fastest.id };
  });

  protected readonly cabinLabel = computed(() => CABIN_LABEL[this.params()?.cabin ?? 'economy'].toLowerCase());
  protected readonly headline = computed(() => {
    const l = this.activeLeg();
    return l.from ? `${cityOf(l.from)} → ${cityOf(l.to)}` : 'Flights';
  });
  protected readonly summaryRoute = computed(() => {
    const p = this.params();
    return p ? routeCodes(p) : '';
  });
  protected readonly summaryMeta = computed(() => {
    const p = this.params();
    if (!p) return '';
    const n = paxCount(p);
    return `${tripDates(p)} · ${n} traveler${n > 1 ? 's' : ''} · ${CABIN_LABEL[p.cabin]}`;
  });
  /** What the listed prices cover. */
  protected readonly priceNote = computed(() => {
    const p = this.params();
    if (!p) return '';
    const n = paxCount(p);
    const trip = p.type === 'round' ? 'round-trip prices' : p.type === 'multi' ? 'whole-trip prices' : 'prices';
    return `${trip} for ${n} traveler${n > 1 ? 's' : ''}`;
  });
  protected readonly updated = computed(() => {
    const r = this.result();
    return r ? new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(r.fetchedAt)) : '';
  });

  constructor() {
    // a new search starts the selection over
    effect(() => {
      const p = this.params();
      untracked(() => {
        this.selections.set(p ? p.legs.map(() => null) : []);
        this.editing.set(null);
        this.firstResult.set(null);
        this.result.set(null);
      });
    });

    // load live results for the active leg
    effect(() => {
      const p = this.params();
      const idx = this.activeIdx();
      const token = this.activeToken();
      const rl = this.reload();
      // a forced refresh applies once, not to every later leg change
      const fresh = rl.fresh && rl.n !== this.usedReload;
      if (!p || this.booking()) return;
      this.usedReload = rl.n;
      const my = ++this.run;
      untracked(() => {
        this.loading.set(true);
        this.apiError.set(null);
        this.resetFilters();
      });
      if (idx > 0 && !token) {
        untracked(() => {
          this.loading.set(false);
          this.apiError.set(new ApiError('upstream_error', 'The selected flight can’t be combined with a next flight right now. Choose a different one.'));
        });
        return;
      }
      this.api.search(p, idx, token, fresh).then(
        (res) => {
          if (my !== this.run) return;
          this.result.set(res);
          this.loading.set(false);
          if (idx === 0) {
            this.firstResult.set(res);
            this.savedTrips.rememberSearch(p, trackedPrice(res) ?? lowestPrice(res.offers));
            this.alerts.record(p, res);
          }
        },
        (e: unknown) => {
          if (my !== this.run) return;
          this.result.set(null);
          this.apiError.set(e instanceof ApiError ? e : new ApiError('server_error', 'Something went wrong while loading flights.'));
          this.loading.set(false);
        },
      );
    });
  }

  protected legTitle(i: number): string {
    const l = this.params()!.legs[i];
    return `${cityOf(l.from)} → ${cityOf(l.to)}`;
  }
  protected legDate(i: number): string {
    return formatDate(this.params()!.legs[i].date, { weekday: 'short', day: 'numeric', month: 'short' });
  }
  protected selSummary(o: FlightOffer): string {
    const t = offerTimes(o);
    return `${t.depTime}–${t.arrTime} · ${o.airlines[0]}`;
  }
  protected dur(m: number): string {
    return formatDuration(m);
  }
  protected cardNote(o: FlightOffer): string {
    const n = paxCount(this.params()!);
    return `${(o.tripType ?? 'total').toLowerCase()} · ${n} traveler${n > 1 ? 's' : ''}`;
  }

  protected badgesFor(o: FlightOffer): FlightBadges {
    const t = this.tags();
    return { cheapest: t.cheapest === o.id, fastest: t.fastest === o.id };
  }

  protected pick(o: FlightOffer): void {
    const p = this.params()!;
    const i = this.activeIdx();
    const last = i === p.legs.length - 1;
    if (!last && !o.nextToken) {
      this.toast.error('This flight can’t be combined with a next flight right now. Please choose another.');
      return;
    }
    this.selections.update((sel) => sel.map((s, k) => (k === i ? o : k > i ? null : s)));
    this.editing.set(null);
    if (!last) this.toast.success(`Flight ${i + 1} selected — now choose flight ${i + 2} of ${p.legs.length}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected changeLeg(i: number): void {
    this.editing.set(i);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected retry(): void {
    this.reload.update((r) => ({ n: r.n + 1, fresh: false }));
  }

  /** Re-fetches live prices, bypassing every cache (uses one search). */
  protected refresh(): void {
    this.reload.update((r) => ({ n: r.n + 1, fresh: true }));
  }

  protected newSearch(p: SearchParams, el: HTMLDetailsElement): void {
    el.open = false;
    void this.router.navigate(['/flights'], { queryParams: toQuery(p) });
  }

  protected toggleBand(b: Band): void {
    this.bandSet.update((s) => {
      const n = new Set(s);
      if (n.has(b)) n.delete(b);
      else n.add(b);
      return n;
    });
  }

  protected toggleAirline(name: string): void {
    this.airlineSet.update((s) => {
      const n = new Set(s);
      if (n.has(name)) n.delete(name);
      else n.add(name);
      return n;
    });
  }

  protected resetFilters(): void {
    this.stops.set('any');
    this.maxPrice.set(null);
    this.maxDur.set(null);
    this.bandSet.set(new Set());
    this.airlineSet.set(new Set());
  }

  // ---- price alerts (always tracked for one adult) ----
  private alertRoute(p: SearchParams): { from: string; to: string; date: string; returnDate: string | null; cabin: SearchParams['cabin'] } {
    const l = p.legs[0];
    return { from: l.from, to: l.to, date: l.date, returnDate: p.type === 'round' ? p.legs[1].date : null, cabin: p.cabin };
  }

  protected async trackPrice(): Promise<void> {
    if (!this.auth.signedIn()) {
      void this.router.navigate(['/login'], { queryParams: { redirect: this.router.url } });
      return;
    }
    const p = this.params();
    if (!p || p.type === 'multi') return;
    this.alertBusy.set(true);
    try {
      const seed = await this.api.search(alertParams(this.alertRoute(p)), 0, null);
      const cur = trackedPrice(seed);
      if (cur === null) {
        this.toast.error('There are no published fares to track for these dates.');
        return;
      }
      this.alertTarget.set(this.alerts.find(this.alertRoute(p))?.targetUsd ?? Math.floor(cur * 0.9));
      this.alertSeed.set(seed);
    } catch (e) {
      this.toast.error(e instanceof ApiError ? e.message : 'Couldn’t load the current price.');
    } finally {
      this.alertBusy.set(false);
    }
  }

  protected saveAlert(seed: SearchResult): void {
    const p = this.params();
    if (!p) return;
    const target = this.alertTarget();
    if (!Number.isFinite(target) || target <= 0) {
      this.toast.error('Enter a target price above zero.');
      return;
    }
    const a = this.alerts.create({ ...this.alertRoute(p), targetUsd: Math.round(target) }, seed);
    this.alertSeed.set(null);
    if (a) this.toast.success('Price alert saved — see it under Price alerts.');
  }
}
