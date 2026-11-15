import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { airline } from '../../core/data/airlines';
import { airport } from '../../core/data/airports';
import { formatDuration, localIsoDate } from '../../core/engine/time';
import { Booking, FlightOffer } from '../../core/models/flight.model';
import { BookingsService } from '../../core/services/bookings.service';
import { FlightSearchService } from '../../core/services/flight-search.service';
import { PreferencesService } from '../../core/services/preferences.service';
import { ToastService } from '../../core/services/toast.service';
import { addDays, todayIso } from '../../core/util/date.util';
import { offerTimes, stopsLabel } from '../../core/util/flight-format';
import { IconComponent } from '../../shared/components/icon.component';
import { ModalComponent } from '../../shared/components/modal.component';
import { MoneyPipe } from '../../shared/components/money.pipe';

@Component({
  selector: 'app-change-flight-modal',
  imports: [ModalComponent, IconComponent, MoneyPipe],
  template: `
    <app-modal heading="Change flight" [subtitle]="route()" [wide]="true" (closed)="closed.emit()">
      @if (picked(); as o) {
        <div role="region" aria-label="Confirm change">
          <p class="text-sm text-muted">New flight</p>
          <p class="font-display text-xl font-bold">{{ t(o).depDate }} · {{ t(o).depTime }} → {{ t(o).arrTime }}</p>
          <p class="text-sm text-muted">{{ airlineName(o) }} {{ o.segments[0].flightNo }} · {{ stops(o) }}</p>
          <dl class="mt-5 grid gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-solid-2)] p-4 text-sm">
            <div class="flex justify-between"><dt class="text-muted">Fare difference</dt><dd class="tabular-nums">{{ quote().diffUsd | money: 2 }}</dd></div>
            <div class="flex justify-between"><dt class="text-muted">Change fee</dt><dd class="tabular-nums">{{ quote().feeUsd | money: 2 }}</dd></div>
            <div class="flex justify-between border-t border-[var(--border)] pt-2 font-bold"><dt>{{ quote().netUsd < 0 ? 'Refund to your card' : 'Amount to pay' }}</dt><dd class="font-display text-xl tabular-nums" [class.text-ok]="quote().netUsd < 0">{{ abs(quote().netUsd) | money: 2 }}</dd></div>
          </dl>
          <p class="mt-3 text-xs text-muted">Seats on the old flight are released; we'll assign new ones at check-in. Charged to {{ booking().payment.brand }} ••{{ booking().payment.last4 }}.</p>
          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" (click)="picked.set(null)">Back</button>
            <button type="button" class="btn btn-primary" (click)="confirm(o)"><app-icon name="check" [size]="16" /> Confirm change</button>
          </div>
        </div>
      } @else {
        <div class="flex flex-wrap items-end gap-3">
          <div>
            <label class="label" for="chg-date">New departure date</label>
            <input id="chg-date" class="input" type="date" [min]="minDate()" [max]="maxDate()" [value]="date()" (input)="setDate($any($event.target).value)" />
          </div>
          <p class="pb-2 text-sm text-muted">Showing {{ cabinLabel() }} flights · your {{ family() }} fare rules apply.</p>
        </div>
        @if (loading()) {
          <ul class="mt-4 grid gap-3" aria-hidden="true">@for (n of [1, 2, 3]; track n) { <li class="skeleton h-20"></li> }</ul>
        } @else if (rows().length === 0) {
          <p class="mt-6 rounded-2xl border border-dashed border-[var(--border-strong)] p-8 text-center text-muted">No flights available on that date. Try another day.</p>
        } @else {
          <ul class="mt-4 grid max-h-[26rem] gap-3 overflow-y-auto pr-1">
            @for (r of rows(); track r.offer.id) {
              <li class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-solid-2)] p-4">
                <div>
                  <p class="font-display text-lg font-bold">{{ t(r.offer).depTime }} → {{ t(r.offer).arrTime }}@if (t(r.offer).plusDays > 0) {<sup class="text-warn"> +{{ t(r.offer).plusDays }}</sup>}</p>
                  <p class="text-xs text-muted">{{ airlineName(r.offer) }} {{ r.offer.segments[0].flightNo }} · {{ dur(r.offer.durationMin) }} · {{ stops(r.offer) }}</p>
                </div>
                <div class="flex items-center gap-4">
                  @if (r.quote.allowed) {
                    <p class="text-right"><span class="block font-display text-lg font-bold tabular-nums" [class.text-ok]="r.quote.netUsd < 0">{{ r.quote.netUsd >= 0 ? '+' : '−' }}{{ abs(r.quote.netUsd) | money }}</span><span class="text-[0.7rem] text-faint">incl. {{ r.quote.feeUsd | money }} fee</span></p>
                    <button type="button" class="btn btn-sm" [attr.aria-label]="'Select ' + t(r.offer).depTime + ' flight'" (click)="picked.set(r.offer)">Select</button>
                  } @else {
                    <p class="max-w-[14rem] text-right text-xs text-warn">{{ r.quote.reason }}</p>
                  }
                </div>
              </li>
            }
          </ul>
        }
      }
    </app-modal>
  `,
})
export class ChangeFlightModalComponent implements OnInit {
  readonly booking = input.required<Booking>();
  readonly legIndex = input.required<number>();
  readonly closed = output<void>();

  private readonly search = inject(FlightSearchService);
  private readonly bookings = inject(BookingsService);
  private readonly toast = inject(ToastService);
  private readonly prefs = inject(PreferencesService);

  protected readonly date = signal('');
  protected readonly loading = signal(true);
  protected readonly offers = signal<FlightOffer[]>([]);
  protected readonly picked = signal<FlightOffer | null>(null);
  private token = 0;

  private readonly leg = computed(() => this.booking().legs[this.legIndex()]);
  protected readonly route = computed(() => {
    const s = this.leg().offer.segments;
    return `${airport(s[0].from).city} → ${airport(s[s.length - 1].to).city}`;
  });
  protected readonly cabinLabel = computed(() => this.leg().offer.cabin);
  protected readonly family = computed(() => this.leg().family);
  protected readonly minDate = computed(() => {
    const prev = this.booking().legs[this.legIndex() - 1];
    const today = todayIso();
    const p = prev ? localIsoDate(airport(prev.offer.segments[prev.offer.segments.length - 1].to), prev.offer.arrUtc) : today;
    return p > today ? p : today;
  });
  protected readonly maxDate = computed(() => {
    const next = this.booking().legs[this.legIndex() + 1];
    return next ? localIsoDate(airport(next.offer.segments[0].from), next.offer.depUtc) : addDays(todayIso(), 330);
  });

  protected readonly rows = computed(() => this.offers().map((offer) => ({ offer, quote: this.bookings.quoteChange(this.booking(), this.legIndex(), offer) })).filter((r) => r.offer.id !== this.leg().offer.id));
  protected readonly quote = computed(() => {
    const o = this.picked();
    return o ? this.bookings.quoteChange(this.booking(), this.legIndex(), o) : { allowed: false, reason: '', diffUsd: 0, feeUsd: 0, netUsd: 0 };
  });

  ngOnInit(): void {
    const s = this.leg().offer.segments[0];
    this.setDate(this.booking().params.legs[this.legIndex()]?.date ?? localIsoDate(airport(s.from), s.depUtc));
  }

  protected setDate(d: string): void {
    this.date.set(d);
    if (!d || d < this.minDate() || d > this.maxDate()) {
      this.offers.set([]);
      this.loading.set(false);
      return;
    }
    const my = ++this.token;
    this.loading.set(true);
    const s = this.leg().offer.segments;
    void this.search.search({ from: s[0].from, to: s[s.length - 1].to, date: d }, this.legIndex(), this.leg().offer.cabin).then((res) => {
      if (my !== this.token) return;
      this.offers.set(res);
      this.loading.set(false);
    });
  }

  protected t = offerTimes;
  protected stops = stopsLabel;
  protected dur = formatDuration;
  protected abs = Math.abs;
  protected airlineName(o: FlightOffer): string { return airline(o.airlines[0]).name; }

  protected confirm(o: FlightOffer): void {
    const q = this.bookings.applyChange(this.booking().ref, this.legIndex(), o);
    if (!q) {
      this.toast.error('That change is no longer possible.');
      return;
    }
    this.toast.success(q.netUsd > 0 ? `Flight changed — ${this.prefs.format(q.netUsd, 2)} charged` : q.netUsd < 0 ? `Flight changed — ${this.prefs.format(-q.netUsd, 2)} refunded` : 'Flight changed');
    this.closed.emit();
  }
}
