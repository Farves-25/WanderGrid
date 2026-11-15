import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { airport, findAirport } from '../../core/data/airports';
import { hashString } from '../../core/engine/prng';
import { SearchParams } from '../../core/models/flight.model';
import { FlightSearchService } from '../../core/services/flight-search.service';
import { PreferencesService } from '../../core/services/preferences.service';
import { addDays, todayIso } from '../../core/util/date.util';
import { toQuery } from '../../core/util/search-query';
import { IconComponent } from '../../shared/components/icon.component';
import { MoneyPipe } from '../../shared/components/money.pipe';
import { SearchFormComponent } from '../../shared/components/search-form.component';

const DEAL_POOL = ['JFK', 'LHR', 'DXB', 'SIN', 'CDG', 'HND', 'SYD', 'LAX', 'BKK', 'IST', 'FCO', 'BCN', 'DEL', 'CPT', 'MEX', 'ICN', 'AMS', 'DPS'];

const FAQ = [
  { q: 'Are these real flights?', a: 'WanderGrid is a demonstration platform. Schedules, fares and availability come from a realistic simulation engine, and payments are simulated — nothing real is booked or charged.' },
  { q: 'Can I cancel or change a booking?', a: 'Yes. Every booking has 24-hour risk-free cancellation (when you book 7+ days before departure). After that, your fare family decides: Basic can be cancelled for unused taxes, Standard allows changes and partial refunds, Flex is fully flexible.' },
  { q: 'When does online check-in open?', a: 'Check-in opens 48 hours before departure and closes 1 hour before. Your QR boarding pass appears instantly and seats are assigned automatically if you haven’t picked one.' },
  { q: 'What do I need to fly internationally?', a: 'A passport valid for at least six months after your return date. We check this for every traveler before payment and remind you that visa rules depend on your nationality and destination.' },
  { q: 'Which cards can I test with?', a: 'Use 4242 4242 4242 4242 (approved), 4000 0000 0000 3220 (3-D Secure challenge) or 4000 0000 0000 0002 (declined) with any future expiry and any 3-digit CVC.' },
];

@Component({
  selector: 'app-home',
  imports: [SearchFormComponent, IconComponent, MoneyPipe, RouterLink],
  template: `
    <section class="relative overflow-hidden">
      <div class="page !pb-10 !pt-10 md:!pt-16">
        <div class="grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
          <div class="rise">
            <span class="badge mb-6 !px-3.5 !py-1.5 text-[0.78rem]"><app-icon name="globe" [size]="14" /> 100+ airports · 60+ airlines · 6 continents</span>
            <h1 class="text-[2.7rem] font-bold leading-[1.02] sm:text-6xl xl:text-7xl">
              The world is<br /><span class="gradient-text">one booking away.</span>
            </h1>
            <p class="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              Compare international flights, pick your exact seat, add bags and meals, and walk away with a QR boarding pass — in under three minutes.
            </p>
            <ul class="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-muted">
              <li class="flex items-center gap-2"><app-icon name="shield-check" [size]="16" /> 24-hour free cancellation</li>
              <li class="flex items-center gap-2"><app-icon name="tag" [size]="16" /> No booking fees</li>
              <li class="flex items-center gap-2"><app-icon name="award" [size]="16" /> Earn WanderMiles</li>
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
              <div class="glass absolute bottom-10 right-0 !rounded-2xl px-4 py-3 text-sm"><p class="text-xs text-muted">Boarding pass</p><p class="font-display text-lg font-bold">Seat 12A · Gate B24</p></div>
              <div class="glass absolute right-10 top-0 !rounded-2xl px-4 py-3 text-sm"><p class="text-xs text-muted">Price drop</p><p class="flex items-center gap-1.5 font-display text-lg font-bold text-ok"><app-icon name="trending-down" [size]="17" /> −14%</p></div>
            </div>
          </div>
        </div>

        <div class="rise mt-10 [animation-delay:120ms]"><app-search-form (search)="go($event)" /></div>
      </div>
    </section>

    <section class="page !pt-4" aria-labelledby="deals-h">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="deals-h" class="text-3xl font-bold">Trending from <span class="gradient-text">{{ originCity() }}</span></h2>
          <p class="mt-1 text-muted">Lowest one-way fares in the next 30 days. Change your departure airport above to refresh.</p>
        </div>
      </div>
      <ul class="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        @for (d of deals(); track d.code; let i = $index) {
          <li class="deal-card rise" [style]="d.style" [style.animation-delay.ms]="i * 50">
            <div class="deal-cover">
              <span class="font-display text-5xl font-bold tracking-tight text-white/95 drop-shadow">{{ d.code }}</span>
            </div>
            <div class="p-4">
              <h3 class="text-lg font-bold leading-tight"><a class="stretched-link" [routerLink]="['/flights']" [queryParams]="d.query">{{ d.city }}</a></h3>
              <p class="text-sm text-muted">{{ d.country }} · {{ d.hours }}</p>
              <p class="mt-3 flex items-end justify-between"><span class="text-xs text-faint">from</span><span class="font-display text-2xl font-bold">{{ d.usd | money }}</span></p>
            </div>
          </li>
        }
      </ul>
    </section>

    <section class="page !pt-4" aria-labelledby="why-h">
      <h2 id="why-h" class="text-3xl font-bold">Everything for the whole journey</h2>
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
  private readonly engine = inject(FlightSearchService);
  private readonly prefs = inject(PreferencesService);

  protected readonly faq = FAQ;
  protected readonly features = [
    { icon: 'armchair', title: 'Pick your seat', text: 'Interactive cabin maps with legroom and exit-row options for every flight.' },
    { icon: 'luggage', title: 'Bags, meals & cover', text: 'Add checked bags, special meals, priority boarding and travel insurance.' },
    { icon: 'bell-ring', title: 'Price alerts', text: 'Track a route and get notified the moment the fare drops below your target.' },
    { icon: 'refresh-cw', title: 'Change anytime', text: 'Swap your dates or cancel under clear, honest fare rules — see the cost first.' },
  ];

  protected readonly originCity = computed(() => findAirport(this.prefs.lastFrom())?.city ?? 'you');

  protected readonly deals = computed(() => {
    const origin = findAirport(this.prefs.lastFrom()) ?? airport('LHR');
    const depart = addDays(todayIso(), 30);
    const ret = addDays(depart, 7);
    const out: { code: string; city: string; country: string; usd: number; hours: string; style: string; query: Record<string, string> }[] = [];
    for (const code of DEAL_POOL) {
      const dest = airport(code);
      if (dest.city === origin.city || out.length >= 8) continue;
      const usd = this.engine.cheapest({ from: origin.code, to: code, date: depart }, 'economy');
      if (usd === null) continue;
      const offers = this.engine.searchSync({ from: origin.code, to: code, date: depart }, 0, 'economy');
      const quickest = Math.min(...offers.map((o) => o.durationMin));
      const h = hashString(code);
      const params: SearchParams = {
        type: 'round',
        legs: [{ from: origin.code, to: code, date: depart }, { from: code, to: origin.code, date: ret }],
        adults: 1, children: 0, infants: 0, cabin: 'economy',
      };
      out.push({
        code,
        city: dest.city,
        country: dest.country,
        usd,
        hours: `${Math.round(quickest / 60)}h flight`,
        style: `--h1:${h % 360};--h2:${(h % 360 + 55) % 360};--h3:${(h % 360 + 200) % 360}`,
        query: toQuery(params),
      });
    }
    return out.sort((a, b) => a.usd - b.usd).slice(0, 8);
  });

  protected go(p: SearchParams): void {
    void this.router.navigate(['/flights'], { queryParams: toQuery(p) });
  }
}
