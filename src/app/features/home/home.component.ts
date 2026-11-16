import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { airport, findAirport } from '../../core/data/airports';
import { CABIN_LABEL, SearchParams } from '../../core/models/flight.model';
import { PreferencesService } from '../../core/services/preferences.service';
import { SavedService } from '../../core/services/saved.service';
import { addDays, todayIso } from '../../core/util/date.util';
import { paxCount, routeCities, searchKey, tripDates } from '../../core/util/flight-format';
import { hashString } from '../../core/util/hash';
import { toQuery } from '../../core/util/search-query';
import { IconComponent } from '../../shared/components/icon.component';
import { MoneyPipe } from '../../shared/components/money.pipe';
import { SearchFormComponent } from '../../shared/components/search-form.component';

const DESTINATIONS = ['JFK', 'LHR', 'DXB', 'SIN', 'CDG', 'HND', 'SYD', 'LAX', 'BKK', 'IST', 'FCO', 'BCN', 'DEL', 'CPT', 'MEX', 'ICN', 'AMS', 'DPS'];

const FAQ = [
  { q: 'Are these real flights and prices?', a: 'Yes. Every search is run live against Google Flights, so the schedules, airlines and fares are the ones on sale right now. Prices can change at any moment, and the seller confirms the final amount when you book.' },
  { q: 'Do I book and pay on WanderGrid?', a: 'No. Once you have chosen your flights we list the airlines and travel sites that sell them, with each one’s price. “Book now” takes you to that seller’s own website to enter passenger details and pay.' },
  { q: 'What does the price include?', a: 'The price shown covers the whole trip for all the travelers in your search, including taxes and mandatory fees. Bags and seat selection may cost extra — each booking option lists what it includes.' },
  { q: 'How do price alerts work?', a: 'Tap “Track price” on a search and set a target. The alert records the live price whenever you search that trip or press “Check now”, and tells you when the fare is at or below your target.' },
  { q: 'Why can the final price differ slightly?', a: 'Fares are fetched in US dollars and converted with today’s exchange rate so you can compare them. The seller’s site charges in its own currency, and fares can sell out between your search and your booking.' },
];

@Component({
  selector: 'app-home',
  imports: [SearchFormComponent, IconComponent, MoneyPipe, RouterLink],
  template: `
    <section class="relative overflow-hidden">
      <div class="page !pb-10 !pt-10 md:!pt-16">
        <div class="grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
          <div class="rise">
            <span class="badge mb-6 !px-3.5 !py-1.5 text-[0.78rem]"><app-icon name="globe" [size]="14" /> Live fares · 100+ airports · 6 continents</span>
            <h1 class="text-[2.7rem] font-bold leading-[1.02] sm:text-6xl xl:text-7xl">
              Real flights.<br /><span class="gradient-text">Real prices. Right now.</span>
            </h1>
            <p class="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              Search live schedules and fares, see whether today’s price is a good one, then book directly with the airline or travel site that sells it.
            </p>
            <ul class="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-muted">
              <li class="flex items-center gap-2"><app-icon name="shield-check" [size]="16" /> Live Google Flights data</li>
              <li class="flex items-center gap-2"><app-icon name="tag" [size]="16" /> No booking fees</li>
              <li class="flex items-center gap-2"><app-icon name="external-link" [size]="16" /> Book direct with the seller</li>
            </ul>
          </div>
          <div class="relative hidden h-[22rem] lg:block" aria-hidden="true">
            <div class="hero-orbit">
              <svg viewBox="0 0 560 340" class="absolute inset-0 h-full w-full" fill="none">
                <path d="M40 270 C 160 40, 400 40, 520 90" stroke="url(#g1)" stroke-width="2" stroke-dasharray="3 9" stroke-linecap="round" />
                <path d="M70 120 C 200 300, 380 300, 500 230" stroke="url(#g2)" stroke-width="2" stroke-dasharray="3 9" stroke-linecap="round" />
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#a78bfa" /><stop offset="1" stop-color="#22d3ee" /></linearGradient>
                  <linearGradient id="g2" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#34d399" /><stop offset="1" stop-color="#a78bfa" /></linearGradient>
                </defs>
                <circle cx="40" cy="270" r="6" fill="#a78bfa" /><circle cx="520" cy="90" r="6" fill="#22d3ee" />
                <circle cx="70" cy="120" r="6" fill="#34d399" /><circle cx="500" cy="230" r="6" fill="#f472b6" />
              </svg>
              <span class="plane-fly"><app-icon name="plane" [size]="26" [stroke]="2.2" /></span>
              <div class="glass absolute left-2 top-4 flex items-center gap-3 !rounded-2xl px-4 py-3"><span class="font-display text-2xl font-bold">LHR</span><app-icon name="arrow-right" [size]="16" /><span class="font-display text-2xl font-bold">JFK</span></div>
              <div class="glass absolute bottom-10 right-0 !rounded-2xl px-4 py-3 text-sm"><p class="text-xs text-muted">Book with</p><p class="font-display text-lg font-bold">Airline or travel site</p></div>
              <div class="glass absolute right-10 top-0 !rounded-2xl px-4 py-3 text-sm"><p class="text-xs text-muted">Price insights</p><p class="flex items-center gap-1.5 font-display text-lg font-bold text-ok"><app-icon name="trending-down" [size]="17" /> Low · Typical · High</p></div>
            </div>
          </div>
        </div>

        <div class="rise mt-10 [animation-delay:120ms]"><app-search-form (search)="go($event)" /></div>
      </div>
    </section>

    @if (recent().length > 0) {
      <section class="page !pt-4" aria-labelledby="recent-h">
        <div class="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="recent-h" class="text-3xl font-bold">Pick up where you <span class="gradient-text">left off</span></h2>
            <p class="mt-1 text-muted">Your recent searches, with the lowest live price we saw.</p>
          </div>
          <button type="button" class="btn btn-sm btn-ghost" (click)="saved.clearRecent()">Clear recent searches</button>
        </div>
        <ul class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          @for (r of recent(); track r.key) {
            <li class="card relative p-4">
              <h3 class="font-display text-lg font-bold leading-tight"><a class="stretched-link" [routerLink]="['/flights']" [queryParams]="r.query">{{ r.route }}</a></h3>
              <p class="mt-1 text-sm text-muted">{{ r.meta }}</p>
              <p class="mt-3 flex items-end justify-between">
                <span class="text-xs text-faint">{{ r.when }}</span>
                @if (r.usd !== null) { <span class="font-display text-2xl font-bold">{{ r.usd | money }}</span> }
              </p>
            </li>
          }
        </ul>
      </section>
    }

    <section class="page !pt-4" aria-labelledby="deals-h">
      <h2 id="deals-h" class="text-3xl font-bold">Popular from <span class="gradient-text">{{ originCity() }}</span></h2>
      <p class="mt-1 text-muted">Pick a destination to see live prices for a week away, a month from now.</p>
      <ul class="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        @for (d of destinations(); track d.code; let i = $index) {
          <li class="deal-card rise" [style]="d.style" [style.animation-delay.ms]="i * 50">
            <div class="deal-cover">
              <span class="font-display text-5xl font-bold tracking-tight text-white/95 drop-shadow">{{ d.code }}</span>
            </div>
            <div class="p-4">
              <h3 class="text-lg font-bold leading-tight"><a class="stretched-link" [routerLink]="['/flights']" [queryParams]="d.query">{{ d.city }}</a></h3>
              <p class="text-sm text-muted">{{ d.country }}</p>
              <p class="mt-3 flex items-center gap-1.5 text-sm font-semibold text-accent">See live prices <app-icon name="arrow-right" [size]="14" /></p>
            </div>
          </li>
        }
      </ul>
    </section>

    <section class="page !pt-4" aria-labelledby="why-h">
      <h2 id="why-h" class="text-3xl font-bold">Find it here, book it at the source</h2>
      <ul class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        @for (f of features; track f.title) {
          <li class="card p-5">
            <span class="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--accent-soft)] text-accent"><app-icon [name]="f.icon" [size]="22" /></span>
            <h3 class="mt-4 text-lg font-bold">{{ f.title }}</h3>
            <p class="mt-1 text-sm leading-relaxed text-muted">{{ f.text }}</p>
          </li>
        }
      </ul>
    </section>

    <section class="page !pt-4" aria-labelledby="faq-h">
      <h2 id="faq-h" class="text-3xl font-bold">Good to know</h2>
      <div class="mt-6 grid gap-3 lg:grid-cols-2">
        @for (f of faq; track f.q) {
          <details class="card group p-5">
            <summary class="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
              {{ f.q }} <app-icon name="chevron-down" [size]="18" />
            </summary>
            <p class="mt-3 text-sm leading-relaxed text-muted">{{ f.a }}</p>
          </details>
        }
      </div>
    </section>
  `,
})
export class HomeComponent {
  private readonly router = inject(Router);
  private readonly prefs = inject(PreferencesService);
  protected readonly saved = inject(SavedService);

  protected readonly faq = FAQ;
  protected readonly features = [
    { icon: 'chart-line', title: 'Live prices', text: 'Real schedules and fares from Google Flights, with price history and what the trip usually costs.' },
    { icon: 'external-link', title: 'Book at the source', text: 'Compare every airline and travel site selling your flights, then book on the one you choose.' },
    { icon: 'bell-ring', title: 'Price alerts', text: 'Set a target for a trip and see at a glance when the live fare reaches it.' },
    { icon: 'bookmark', title: 'Saved trips', text: 'Keep the itineraries you like and come back to check their price before you book.' },
  ];

  protected readonly originCity = computed(() => findAirport(this.prefs.lastFrom())?.city ?? 'you');

  protected readonly recent = computed(() =>
    this.saved.recent().map((r) => {
      const n = paxCount(r.params);
      return {
        key: searchKey(r.params),
        route: routeCities(r.params),
        meta: `${tripDates(r.params)} · ${n} traveler${n > 1 ? 's' : ''} · ${CABIN_LABEL[r.params.cabin]}`,
        when: `Seen ${new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(new Date(r.at))}`,
        usd: r.lowestUsd,
        query: toQuery(r.params),
      };
    }),
  );

  protected readonly destinations = computed(() => {
    const origin = findAirport(this.prefs.lastFrom()) ?? airport('LHR');
    const depart = addDays(todayIso(), 30);
    const ret = addDays(depart, 7);
    return DESTINATIONS.map((code) => airport(code))
      .filter((dest) => dest.city !== origin.city)
      .slice(0, 8)
      .map((dest) => {
        const h = hashString(dest.code) % 360;
        const params: SearchParams = {
          type: 'round',
          legs: [{ from: origin.code, to: dest.code, date: depart }, { from: dest.code, to: origin.code, date: ret }],
          adults: 1, children: 0, infants: 0, cabin: 'economy',
        };
        return { code: dest.code, city: dest.city, country: dest.country, style: `--h1:${h};--h2:${(h + 55) % 360};--h3:${(h + 200) % 360}`, query: toQuery(params) };
      });
  });

  protected go(p: SearchParams): void {
    void this.router.navigate(['/flights'], { queryParams: toQuery(p) });
  }
}
