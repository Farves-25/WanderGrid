import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { airport } from '../../core/data/airports';
import { formatLocalDate, formatLocalTime } from '../../core/engine/time';
import { Booking, CABIN_LABEL } from '../../core/models/flight.model';
import { BookingPhase, BookingsService, bookingPhase } from '../../core/services/bookings.service';
import { IconComponent } from '../../shared/components/icon.component';
import { MoneyPipe } from '../../shared/components/money.pipe';

type Tab = BookingPhase;

@Component({
  selector: 'app-bookings',
  imports: [DecimalPipe, RouterLink, IconComponent, MoneyPipe],
  template: `
    <div class="page">
      <header class="rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 class="text-4xl font-bold sm:text-5xl">My <span class="gradient-text">trips</span></h1>
          <p class="mt-2 text-muted">{{ bookings.mine().length }} booking{{ bookings.mine().length === 1 ? '' : 's' }} · {{ bookings.miles() | number }} WanderMiles</p>
        </div>
        <a routerLink="/" class="btn btn-primary"><app-icon name="plus" [size]="18" /> Book a flight</a>
      </header>

      @if (next(); as n) {
        <a [routerLink]="['/booking', n.b.ref]" class="next-trip rise mt-8 [animation-delay:60ms]">
          <div>
            <p class="text-xs font-bold uppercase tracking-widest text-white/80">Next departure</p>
            <p class="mt-1 font-display text-3xl font-bold sm:text-4xl">{{ n.route }}</p>
            <p class="mt-1 text-white/90">{{ n.when }}</p>
          </div>
          <div class="text-right"><p class="font-display text-5xl font-bold leading-none">{{ n.days }}</p><p class="text-sm font-semibold text-white/90">{{ n.days === 1 ? 'day to go' : 'days to go' }}</p></div>
        </a>
      }

      <div class="tabs mt-8" role="group" aria-label="Filter trips">
        @for (t of tabs; track t.id) {
          <button type="button" class="tab" [attr.aria-pressed]="tab() === t.id" (click)="tab.set(t.id)">{{ t.label }} <span class="badge !px-1.5">{{ count(t.id) }}</span></button>
        }
      </div>

      @if (visible().length > 0) {
        <ul class="mt-6 grid gap-4">
          @for (c of visible(); track c.b.id; let i = $index) {
            <li class="booking-card rise" [style.animation-delay.ms]="i * 40">
              <div class="flex flex-wrap items-center justify-between gap-4">
                <div class="min-w-0">
                  <h2 class="font-display text-xl font-bold leading-tight"><a class="stretched-link" [routerLink]="['/booking', c.b.ref]">{{ c.route }}</a></h2>
                  <p class="mt-1 text-sm text-muted">{{ c.when }} · {{ c.pax }} · {{ c.cabin }}</p>
                  <p class="mt-1 text-xs text-faint">{{ c.legs }}</p>
                </div>
                <div class="flex items-center gap-5 text-right">
                  <div><p class="text-xs text-faint">Reference</p><p class="font-display text-lg font-bold tracking-widest">{{ c.b.ref }}</p></div>
                  <div><p class="text-xs text-faint">Total</p><p class="font-display text-lg font-bold">{{ c.b.pricing.totalUsd | money: 2 }}</p></div>
                  <span class="badge" [class.badge-ok]="c.phase === 'upcoming'" [class.badge-danger]="c.phase === 'cancelled'">{{ c.phase === 'upcoming' ? 'Confirmed' : c.phase === 'completed' ? 'Completed' : 'Cancelled' }}</span>
                </div>
              </div>
            </li>
          }
        </ul>
      } @else {
        <div class="card mt-6 grid place-items-center gap-3 px-6 py-16 text-center">
          <app-icon name="ticket" [size]="34" />
          <h2 class="text-xl font-bold">{{ tab() === 'upcoming' ? 'No upcoming trips' : tab() === 'completed' ? 'No past trips yet' : 'No cancelled bookings' }}</h2>
          @if (tab() === 'upcoming') {
            <p class="max-w-md text-muted">Your next adventure is one search away.</p>
            <a routerLink="/" class="btn btn-primary mt-2">Search flights</a>
          }
        </div>
      }
    </div>
  `,
})
export class BookingsComponent {
  protected readonly bookings = inject(BookingsService);

  protected readonly tabs: { id: Tab; label: string }[] = [
    { id: 'upcoming', label: 'Upcoming' },
    { id: 'completed', label: 'Past' },
    { id: 'cancelled', label: 'Cancelled' },
  ];
  protected readonly tab = signal<Tab>('upcoming');

  private readonly cards = computed(() => this.bookings.mine().map((b) => this.card(b)));
  protected readonly visible = computed(() => {
    const list = this.cards().filter((c) => c.phase === this.tab());
    return this.tab() === 'completed' ? list.slice().reverse() : list;
  });

  protected readonly next = computed(() => {
    const c = this.cards().find((x) => x.phase === 'upcoming');
    if (!c) return null;
    const dep = c.b.legs[0].offer.depUtc;
    return { b: c.b, route: c.route, when: c.when, days: Math.max(0, Math.ceil((dep - Date.now()) / 86_400_000)) };
  });

  protected count(t: Tab): number {
    return this.cards().filter((c) => c.phase === t).length;
  }

  private card(b: Booking): { b: Booking; phase: BookingPhase; route: string; when: string; pax: string; cabin: string; legs: string } {
    const first = b.legs[0].offer.segments[0];
    const lastLeg = b.legs[b.legs.length - 1].offer;
    const ap = airport(first.from);
    const dest = b.params.type === 'round' ? airport(b.legs[0].offer.segments[b.legs[0].offer.segments.length - 1].to) : airport(lastLeg.segments[lastLeg.segments.length - 1].to);
    const n = b.params.adults + b.params.children + b.params.infants;
    const sym = b.params.type === 'round' ? '⇄' : b.params.type === 'multi' ? '→ …' : '→';
    return {
      b,
      phase: bookingPhase(b),
      route: `${ap.city} ${sym} ${dest.city}`,
      when: `${formatLocalDate(ap, first.depUtc, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · ${formatLocalTime(ap, first.depUtc)}`,
      pax: `${n} traveler${n === 1 ? '' : 's'}`,
      cabin: CABIN_LABEL[b.params.cabin],
      legs: b.legs.map((l) => `${l.offer.segments[0].from}→${l.offer.segments[l.offer.segments.length - 1].to}`).join('  ·  '),
    };
  }
}
