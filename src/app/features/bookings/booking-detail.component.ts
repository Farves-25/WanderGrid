import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { airline } from '../../core/data/airlines';
import { airport } from '../../core/data/airports';
import { formatDuration, formatLocalDate, formatLocalTime } from '../../core/engine/time';
import { CABIN_LABEL, FAMILY_LABEL, MEAL_LABEL, Segment } from '../../core/models/flight.model';
import { BookingsService, bookingPhase, checkInWindow } from '../../core/services/bookings.service';
import { PreferencesService } from '../../core/services/preferences.service';
import { ToastService } from '../../core/services/toast.service';
import { segmentTimes } from '../../core/util/flight-format';
import { buildBookingIcs, downloadText } from '../../core/util/ics';
import { AirlineChipComponent } from '../../shared/components/airline-chip.component';
import { IconComponent } from '../../shared/components/icon.component';
import { ModalComponent } from '../../shared/components/modal.component';
import { MoneyPipe } from '../../shared/components/money.pipe';
import { BoardingPassComponent } from './boarding-pass.component';
import { ChangeFlightModalComponent } from './change-flight-modal.component';

@Component({
  selector: 'app-booking-detail',
  imports: [DecimalPipe, RouterLink, IconComponent, AirlineChipComponent, MoneyPipe, ModalComponent, BoardingPassComponent, ChangeFlightModalComponent],
  template: `
    @if (booking(); as b) {
      <div class="page">
        <a routerLink="/bookings" class="no-print mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-[var(--text)]"><app-icon name="chevron-left" [size]="16" /> My trips</a>

        @if (isNew() && b.status === 'confirmed') {
          <div class="success-hero rise no-print" role="status">
            <span class="grid h-16 w-16 place-items-center rounded-full bg-white/20"><app-icon name="check" [size]="34" [stroke]="3" /></span>
            <div>
              <h1 class="text-3xl font-bold sm:text-4xl">You're booked!</h1>
              <p class="mt-1 text-white/90">Your e-ticket is ready and a confirmation was sent to {{ b.contact.email }}.</p>
            </div>
          </div>
        }

        <header class="mt-6 flex flex-wrap items-end justify-between gap-5">
          <div>
            @if (!isNew()) { <h1 class="sr-only">Booking {{ b.ref }}</h1> }
            <p class="text-xs font-bold uppercase tracking-widest text-muted">Booking reference</p>
            <p class="font-display text-5xl font-bold tracking-[0.12em]">{{ b.ref }}</p>
            <p class="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
              <span class="badge" [class.badge-ok]="phase() === 'upcoming'" [class.badge-danger]="phase() === 'cancelled'">{{ phase() === 'upcoming' ? 'Confirmed' : phase() === 'completed' ? 'Completed' : 'Cancelled' }}</span>
              Booked {{ bookedOn() }} · {{ paxText() }} · {{ cabin() }}
            </p>
          </div>
          <div class="no-print flex flex-wrap gap-2">
            <button type="button" class="btn btn-sm" (click)="copyRef()"><app-icon name="copy" [size]="15" /> Copy ref</button>
            <button type="button" class="btn btn-sm" (click)="addToCalendar()"><app-icon name="calendar-plus" [size]="15" /> Add to calendar</button>
            <button type="button" class="btn btn-sm" (click)="print()"><app-icon name="printer" [size]="15" /> Print e-ticket</button>
          </div>
        </header>

        @if (phase() === 'cancelled') {
          <p class="form-error mt-6" role="status">This booking was cancelled{{ b.refundedUsd > 0 ? ' and ' + (b.refundedUsd | money: 2) + ' was refunded to ' + b.payment.brand + ' ••' + b.payment.last4 : '' }}.</p>
        }

        <div class="mt-8 grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div class="grid gap-6">
            @for (leg of b.legs; track leg.offer.id; let li = $index) {
              <section class="card overflow-hidden" [attr.aria-labelledby]="'leg-' + li">
                <div class="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-5 py-4">
                  <h2 [id]="'leg-' + li" class="flex items-center gap-2 text-lg font-bold">
                    <app-icon name="plane-takeoff" [size]="19" /> {{ legTitle(li) }}
                  </h2>
                  <span class="flex items-center gap-2 text-sm text-muted">{{ family(li) }} fare @if (b.checkedIn[li]) { <span class="badge badge-ok"><app-icon name="check" [size]="11" /> Checked in</span> }</span>
                </div>

                <ol class="grid gap-0 p-5">
                  @for (s of leg.offer.segments; track s.id; let si = $index) {
                    <li>
                      <div class="flex items-start gap-4">
                        <app-airline-chip [code]="s.airline" [size]="38" />
                        <div class="grid flex-1 grid-cols-[1fr_auto_1fr] items-center gap-3">
                          <div><p class="font-display text-2xl font-bold">{{ seg(s).depTime }}</p><p class="text-sm font-semibold">{{ s.from }} · {{ city(s.from) }}</p><p class="text-xs text-faint">{{ seg(s).depDate }}</p></div>
                          <div class="text-center text-xs text-muted"><p>{{ dur(s.durationMin) }}</p><div class="route-line" aria-hidden="true"><span class="route-dot"></span><span class="route-dot"></span></div><p>{{ s.flightNo }}</p></div>
                          <div class="text-right"><p class="font-display text-2xl font-bold">{{ seg(s).arrTime }}@if (seg(s).plusDays > 0) {<sup class="text-xs text-warn"> +{{ seg(s).plusDays }}</sup>}</p><p class="text-sm font-semibold">{{ s.to }} · {{ city(s.to) }}</p><p class="text-xs text-faint">{{ seg(s).arrDate }}</p></div>
                        </div>
                      </div>
                      <p class="mb-1 ml-[3.5rem] mt-2 text-xs text-muted">{{ airlineName(s) }} · {{ s.aircraft.name }}</p>
                      @if (leg.offer.layovers[si]; as lay) {
                        <p class="my-3 ml-[3.5rem] flex items-center gap-2 rounded-xl border border-dashed border-[var(--border-strong)] px-3 py-2 text-sm text-muted"><app-icon name="timer" [size]="15" /> {{ dur(lay.minutes) }} layover in {{ city(lay.airport) }}</p>
                      }
                    </li>
                  }
                </ol>

                @if (b.status === 'confirmed') {
                  <div class="no-print border-t border-[var(--border)] bg-[var(--surface)] px-5 py-4">
                    <div class="flex flex-wrap items-center justify-between gap-3">
                      <div class="text-sm">
                        @switch (checkInState(li)) {
                          @case ('open') { <p class="font-semibold text-ok">Online check-in is open</p><p class="text-xs text-muted">Closes {{ when(checkInCloses(li), li) }}</p> }
                          @case ('early') { <p class="font-semibold">Check-in opens {{ when(checkInOpens(li), li) }}</p><p class="text-xs text-muted">48 hours before departure</p> }
                          @default { <p class="font-semibold text-warn">Online check-in has closed</p><p class="text-xs text-muted">Please see the airline desk at the airport.</p> }
                        }
                      </div>
                      <div class="flex flex-wrap gap-2">
                        @if (phase() === 'upcoming') {
                          <button type="button" class="btn btn-sm" (click)="changeLeg.set(li)"><app-icon name="refresh-cw" [size]="14" /> Change flight</button>
                        }
                        @if (!b.checkedIn[li]) {
                          <button type="button" class="btn btn-sm btn-primary" [disabled]="checkInState(li) !== 'open'" (click)="checkIn(li)"><app-icon name="badge-check" [size]="14" /> Check in</button>
                        } @else {
                          <button type="button" class="btn btn-sm" [attr.aria-expanded]="passesFor() === li" (click)="passesFor.set(passesFor() === li ? null : li)"><app-icon name="qr-code" [size]="14" /> {{ passesFor() === li ? 'Hide' : 'Show' }} boarding passes</button>
                        }
                      </div>
                    </div>
                  </div>
                  @if (b.checkedIn[li] && (passesFor() === li || printing())) {
                    <div class="grid gap-4 border-t border-[var(--border)] p-5">
                      @for (si of segIdx(li); track si) {
                        @for (p of b.passengers; track $index; let pi = $index) {
                          <app-boarding-pass [booking]="b" [legIndex]="li" [segIndex]="si" [paxIndex]="pi" />
                        }
                      }
                    </div>
                  }
                }
              </section>
            }

            <section class="card p-5 sm:p-6" aria-labelledby="pax-h">
              <h2 id="pax-h" class="mb-4 flex items-center gap-2 text-lg font-bold"><app-icon name="users" [size]="19" /> Travelers</h2>
              <div class="overflow-x-auto">
                <table class="ptable min-w-[34rem]">
                  <caption class="sr-only">Travelers and tickets</caption>
                  <thead><tr><th scope="col">Name</th><th scope="col">Type</th><th scope="col">E-ticket</th><th scope="col">Seats</th></tr></thead>
                  <tbody>
                    @for (p of b.passengers; track $index; let pi = $index) {
                      <tr>
                        <td class="font-semibold">{{ p.title }} {{ p.firstName }} {{ p.lastName }}</td>
                        <td class="capitalize text-muted">{{ p.type }}</td>
                        <td class="tabular-nums">{{ b.tickets[pi] }}</td>
                        <td class="text-muted">{{ seatsText(pi) }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
              @if (mealsText()) { <p class="mt-3 text-sm text-muted"><app-icon name="utensils" [size]="14" /> {{ mealsText() }}</p> }
            </section>

            <section class="card p-5 sm:p-6" aria-labelledby="tl-h">
              <h2 id="tl-h" class="mb-4 text-lg font-bold">Activity</h2>
              <ol class="grid gap-3">
                @for (e of events(); track $index) {
                  <li class="flex gap-3 text-sm"><span class="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]" aria-hidden="true"></span><div><p>{{ e.text }}</p><p class="text-xs text-faint">{{ e.when }}</p></div></li>
                }
              </ol>
            </section>
          </div>

          <aside class="grid gap-6 lg:sticky lg:top-24" aria-label="Payment and manage">
            <div class="card p-5">
              <h2 class="text-lg font-bold">Payment summary</h2>
              <dl class="mt-3 grid gap-2 text-sm">
                <div class="flex justify-between"><dt class="text-muted">Fares</dt><dd class="tabular-nums">{{ b.pricing.fare | money: 2 }}</dd></div>
                <div class="flex justify-between"><dt class="text-muted">Taxes &amp; charges</dt><dd class="tabular-nums">{{ b.pricing.taxes | money: 2 }}</dd></div>
                @if (b.pricing.seats > 0) { <div class="flex justify-between"><dt class="text-muted">Seats</dt><dd class="tabular-nums">{{ b.pricing.seats | money: 2 }}</dd></div> }
                @if (b.pricing.bags > 0) { <div class="flex justify-between"><dt class="text-muted">Baggage</dt><dd class="tabular-nums">{{ b.pricing.bags | money: 2 }}</dd></div> }
                @if (b.pricing.insurance > 0) { <div class="flex justify-between"><dt class="text-muted">Insurance</dt><dd class="tabular-nums">{{ b.pricing.insurance | money: 2 }}</dd></div> }
                @if (b.pricing.priority > 0) { <div class="flex justify-between"><dt class="text-muted">Priority boarding</dt><dd class="tabular-nums">{{ b.pricing.priority | money: 2 }}</dd></div> }
                @if (b.pricing.offset > 0) { <div class="flex justify-between"><dt class="text-muted">Carbon offset</dt><dd class="tabular-nums">{{ b.pricing.offset | money: 2 }}</dd></div> }
                @if (b.pricing.discount > 0) { <div class="flex justify-between text-ok"><dt>Promo {{ b.promo }}</dt><dd class="tabular-nums">−{{ b.pricing.discount | money: 2 }}</dd></div> }
                <div class="flex items-end justify-between border-t border-[var(--border)] pt-3"><dt class="font-bold">Total paid</dt><dd class="font-display text-2xl font-bold tabular-nums">{{ b.pricing.totalUsd | money: 2 }}</dd></div>
                @if (b.refundedUsd > 0) { <div class="flex justify-between text-ok"><dt>Refunded</dt><dd class="tabular-nums">{{ b.refundedUsd | money: 2 }}</dd></div> }
              </dl>
              <p class="mt-3 flex items-center gap-2 text-xs text-muted"><app-icon name="credit-card" [size]="13" /> {{ b.payment.brand }} ••{{ b.payment.last4 }}</p>
              <p class="mt-2 flex items-center gap-2 text-xs text-muted"><app-icon name="award" [size]="13" /> {{ b.milesEarned | number }} WanderMiles earned</p>
            </div>

            @if (b.status === 'confirmed') {
              <div class="card no-print p-5">
                <h2 class="text-lg font-bold">Manage booking</h2>
                <p class="mt-1 text-sm text-muted">{{ cancelHint() }}</p>
                <button type="button" class="btn btn-danger mt-4 w-full" [disabled]="!quote().allowed" (click)="cancelOpen.set(true)"><app-icon name="trash-2" [size]="16" /> Cancel booking</button>
              </div>
            }
          </aside>
        </div>
      </div>

      @if (changeLeg() !== null) {
        <app-change-flight-modal [booking]="b" [legIndex]="changeLeg()!" (closed)="changeLeg.set(null)" />
      }

      @if (cancelOpen()) {
        <app-modal heading="Cancel this booking?" [subtitle]="'Reference ' + b.ref" (closed)="cancelOpen.set(false)">
          <p class="text-sm text-muted">{{ quote().reason }}</p>
          <ul class="mt-4 grid gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-solid-2)] p-4 text-sm">
            @for (l of quote().lines; track l.label) { <li class="flex justify-between gap-3"><span class="text-muted">{{ l.label }}</span><span class="tabular-nums">{{ l.usd | money: 2 }}</span></li> }
            <li class="flex justify-between border-t border-[var(--border)] pt-2 font-bold"><span>You'll get back</span><span class="font-display text-xl tabular-nums" [class.text-ok]="quote().refundUsd > 0">{{ quote().refundUsd | money: 2 }}</span></li>
          </ul>
          <p class="mt-3 text-xs text-muted">Refunds go to {{ b.payment.brand }} ••{{ b.payment.last4 }} within 5–7 business days. This can't be undone.</p>
          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" (click)="cancelOpen.set(false)">Keep booking</button>
            <button type="button" class="btn btn-danger" (click)="cancel()">Yes, cancel booking</button>
          </div>
        </app-modal>
      }
    } @else {
      <div class="page"><div class="glass mx-auto mt-12 max-w-lg p-10 text-center">
        <app-icon name="ticket" [size]="34" />
        <h1 class="mt-3 text-2xl font-bold">Booking not found</h1>
        <p class="mt-2 text-muted">We couldn't find a booking with reference {{ ref() }} on your account.</p>
        <a routerLink="/bookings" class="btn btn-primary mt-6">View my trips</a>
      </div></div>
    }
  `,
})
export class BookingDetailComponent {
  readonly ref = input.required<string>();
  readonly new = input<string | undefined>();

  private readonly bookings = inject(BookingsService);
  private readonly toast = inject(ToastService);
  private readonly prefs = inject(PreferencesService);

  protected readonly booking = computed(() => this.bookings.byRef(this.ref()));
  protected readonly isNew = computed(() => this.new() === '1');
  protected readonly phase = computed(() => {
    const b = this.booking();
    return b ? bookingPhase(b) : 'cancelled';
  });
  protected readonly quote = computed(() => {
    const b = this.booking();
    return b ? this.bookings.quoteCancel(b) : { allowed: false, reason: '', riskFree: false, refundUsd: 0, lines: [] };
  });

  protected readonly changeLeg = signal<number | null>(null);
  protected readonly cancelOpen = signal(false);
  protected readonly passesFor = signal<number | null>(null);
  protected readonly printing = signal(false);

  protected readonly cabin = computed(() => CABIN_LABEL[this.booking()?.params.cabin ?? 'economy']);
  protected readonly bookedOn = computed(() => new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(this.booking()?.createdAt ?? Date.now())));
  protected readonly paxText = computed(() => {
    const p = this.booking()?.params;
    const n = p ? p.adults + p.children + p.infants : 0;
    return `${n} traveler${n === 1 ? '' : 's'}`;
  });
  protected readonly cancelHint = computed(() => {
    const q = this.quote();
    return q.allowed ? (q.riskFree ? 'Free cancellation applies for 24 hours after booking.' : 'Cancel under your fare rules — see the exact refund first.') : q.reason;
  });
  protected readonly events = computed(() =>
    (this.booking()?.events ?? []).map((e) => ({ text: e.text, when: new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(e.at)) })).reverse(),
  );
  protected readonly mealsText = computed(() => {
    const b = this.booking();
    if (!b) return '';
    const special = Object.entries(b.extras.meals).filter(([, m]) => m !== 'standard' && m !== 'child');
    return special.length ? 'Special meals: ' + [...new Set(special.map(([, m]) => MEAL_LABEL[m]))].join(', ') : '';
  });

  protected seg = segmentTimes;
  protected dur = formatDuration;
  protected city(code: string): string { return airport(code).city; }
  protected airlineName(s: Segment): string { return airline(s.airline).name; }
  protected family(li: number): string { return FAMILY_LABEL[this.booking()!.legs[li].family]; }
  protected segIdx(li: number): number[] { return this.booking()!.legs[li].offer.segments.map((_, i) => i); }

  protected legTitle(li: number): string {
    const b = this.booking()!;
    const s = b.legs[li].offer.segments;
    const label = b.params.type === 'round' ? (li === 0 ? 'Outbound' : 'Return') : `Flight ${li + 1}`;
    return `${label} · ${airport(s[0].from).city} → ${airport(s[s.length - 1].to).city}`;
  }

  protected seatsText(pi: number): string {
    const b = this.booking()!;
    if (b.passengers[pi].type === 'infant') return 'Lap infant';
    const parts: string[] = [];
    for (const leg of b.legs) for (const s of leg.offer.segments) {
      const seat = b.extras.seats[`${s.id}|${pi}`];
      parts.push(`${s.from}-${s.to} ${seat ?? 'at check-in'}`);
    }
    return parts.join(' · ');
  }

  protected checkInState(li: number): 'early' | 'open' | 'closed' { return this.bookings.checkInOpen(this.booking()!, li); }
  protected checkInOpens(li: number): number { return checkInWindow(this.booking()!.legs[li]).opens; }
  protected checkInCloses(li: number): number { return checkInWindow(this.booking()!.legs[li]).closes; }

  protected when(ms: number, li: number): string {
    const ap = airport(this.booking()!.legs[li].offer.segments[0].from);
    return `${formatLocalDate(ap, ms, { weekday: 'short', day: 'numeric', month: 'short' })} at ${formatLocalTime(ap, ms)} (${ap.city} time)`;
  }

  protected checkIn(li: number): void {
    const b = this.booking();
    if (!b) return;
    if (this.bookings.checkIn(b.ref, li)) {
      this.passesFor.set(li);
      this.toast.success('Checked in — your boarding passes are ready.');
    } else this.toast.error('Check-in isn’t available right now.');
  }

  protected cancel(): void {
    const b = this.booking();
    if (!b) return;
    const refund = this.bookings.cancel(b.ref);
    this.cancelOpen.set(false);
    if (refund === null) this.toast.error('This booking can’t be cancelled any more.');
    else this.toast.success(refund > 0 ? `Booking cancelled — ${this.prefs.format(refund, 2)} refunded` : 'Booking cancelled');
  }

  protected addToCalendar(): void {
    const b = this.booking();
    if (b) downloadText(`wandergrid-${b.ref}.ics`, buildBookingIcs(b), 'text/calendar');
  }

  protected async copyRef(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.ref().toUpperCase());
      this.toast.success('Reference copied');
    } catch {
      this.toast.info(`Your reference is ${this.ref().toUpperCase()}`);
    }
  }

  protected print(): void {
    this.printing.set(true);
    setTimeout(() => {
      window.print();
      this.printing.set(false);
    }, 150);
  }
}
