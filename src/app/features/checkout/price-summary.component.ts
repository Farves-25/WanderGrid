import { Component, computed, inject, input, signal } from '@angular/core';
import { airport } from '../../core/data/airports';
import { CABIN_LABEL, FAMILY_LABEL } from '../../core/models/flight.model';
import { BookingFlowService, PROMO_HINTS } from '../../core/services/booking-flow.service';
import { offerTimes } from '../../core/util/flight-format';
import { IconComponent } from '../../shared/components/icon.component';
import { MoneyPipe } from '../../shared/components/money.pipe';

@Component({
  selector: 'app-price-summary',
  imports: [MoneyPipe, IconComponent],
  template: `
    <div class="card p-5">
      <h2 class="text-lg font-bold">Your trip</h2>
      <ul class="mt-4 grid gap-3">
        @for (l of legs(); track l.offer.id) {
          <li class="rounded-2xl border border-[var(--border)] bg-[var(--surface-solid-2)] p-3.5">
            <p class="flex items-center gap-2 font-display text-lg font-bold">{{ city(l.offer.segments[0].from) }} <app-icon name="arrow-right" [size]="14" /> {{ city(l.offer.segments[l.offer.segments.length - 1].to) }}</p>
            <p class="mt-0.5 text-xs text-muted">{{ times(l.offer).depDate }} · {{ times(l.offer).depTime }}–{{ times(l.offer).arrTime }}@if (times(l.offer).plusDays > 0) {<span> +{{ times(l.offer).plusDays }}</span>}</p>
            <p class="mt-0.5 text-xs text-muted">{{ cabin }} · {{ family(l.family) }} · {{ l.offer.stops === 0 ? 'Direct' : l.offer.stops + ' stop' }}</p>
          </li>
        }
      </ul>

      <h3 class="mt-6 text-sm font-bold uppercase tracking-wider text-muted">Price details</h3>
      <dl class="mt-3 grid gap-2 text-sm">
        <div class="flex justify-between gap-3"><dt class="text-muted">Fares ({{ paxText() }})</dt><dd class="tabular-nums">{{ p().fare | money: 2 }}</dd></div>
        <div class="flex justify-between gap-3"><dt class="text-muted">Taxes &amp; carrier charges</dt><dd class="tabular-nums">{{ p().taxes | money: 2 }}</dd></div>
        @if (p().seats > 0) { <div class="flex justify-between gap-3"><dt class="text-muted">Seat selection</dt><dd class="tabular-nums">{{ p().seats | money: 2 }}</dd></div> }
        @if (p().bags > 0) { <div class="flex justify-between gap-3"><dt class="text-muted">Extra baggage</dt><dd class="tabular-nums">{{ p().bags | money: 2 }}</dd></div> }
        @if (p().insurance > 0) { <div class="flex justify-between gap-3"><dt class="text-muted">Travel insurance</dt><dd class="tabular-nums">{{ p().insurance | money: 2 }}</dd></div> }
        @if (p().priority > 0) { <div class="flex justify-between gap-3"><dt class="text-muted">Priority boarding</dt><dd class="tabular-nums">{{ p().priority | money: 2 }}</dd></div> }
        @if (p().offset > 0) { <div class="flex justify-between gap-3"><dt class="text-muted">Carbon offset</dt><dd class="tabular-nums">{{ p().offset | money: 2 }}</dd></div> }
        @if (p().discount > 0) { <div class="flex justify-between gap-3 text-ok"><dt>Promo {{ flow.promoCode() }}</dt><dd class="tabular-nums">−{{ p().discount | money: 2 }}</dd></div> }
        <div class="mt-2 flex items-end justify-between gap-3 border-t border-[var(--border)] pt-3">
          <dt class="font-bold">Total</dt>
          <dd class="font-display text-3xl font-bold tabular-nums" aria-live="polite">{{ p().totalUsd | money: 2 }}</dd>
        </div>
      </dl>

      @if (promoEnabled()) {
        <div class="mt-5 border-t border-[var(--border)] pt-4">
          <label class="label" for="promo">Promo code</label>
          <div class="flex gap-2">
            <input id="promo" class="input input-sm uppercase" [value]="code()" (input)="code.set($any($event.target).value)" (keydown.enter)="apply($event)" placeholder="e.g. WANDER10" autocomplete="off" />
            <button type="button" class="btn btn-sm" (click)="apply($event)">Apply</button>
          </div>
          @if (flow.promoResult(); as r) {
            @if (r.valid) {
              <p class="mt-2 flex items-center gap-2 text-xs font-semibold text-ok" role="status"><app-icon name="circle-check" [size]="14" /> {{ r.description }} — applied
                <button type="button" class="ml-auto underline" (click)="remove()">Remove</button></p>
            } @else {
              <p class="field-error" role="alert">{{ r.message }}</p>
            }
          }
          @if (!flow.promoCode()) {
            <p class="mt-2 text-xs text-faint">Try
              @for (h of hints; track h.code; let last = $last) {<button type="button" class="font-semibold text-accent hover:underline" [attr.title]="h.description" (click)="use(h.code)">{{ h.code }}</button>{{ last ? '' : ', ' }}}
            </p>
          }
        </div>
      }
    </div>
  `,
})
export class PriceSummaryComponent {
  readonly promoEnabled = input(true);
  protected readonly flow = inject(BookingFlowService);
  protected readonly hints = PROMO_HINTS;
  protected readonly code = signal('');

  protected readonly p = this.flow.pricing;
  protected readonly legs = this.flow.legs;
  protected readonly cabin = CABIN_LABEL[this.flow.params()?.cabin ?? 'economy'];

  protected readonly paxText = computed(() => {
    const x = this.flow.params();
    if (!x) return '';
    const parts = [`${x.adults} adult${x.adults > 1 ? 's' : ''}`];
    if (x.children) parts.push(`${x.children} child${x.children > 1 ? 'ren' : ''}`);
    if (x.infants) parts.push(`${x.infants} infant${x.infants > 1 ? 's' : ''}`);
    return parts.join(', ');
  });

  protected city(code: string): string { return airport(code).city; }
  protected times = offerTimes;
  protected family = (f: keyof typeof FAMILY_LABEL): string => FAMILY_LABEL[f];

  protected apply(e: Event): void {
    e.preventDefault();
    const c = this.code().trim();
    this.flow.setPromo(c || null);
  }
  protected use(c: string): void {
    this.code.set(c);
    this.flow.setPromo(c);
  }
  protected remove(): void {
    this.flow.setPromo(null);
    this.code.set('');
  }
}
