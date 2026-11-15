import { Component, computed, inject, output, signal } from '@angular/core';
import { airline } from '../../core/data/airlines';
import { airport } from '../../core/data/airports';
import { formatDuration } from '../../core/engine/time';
import { InsurancePlan, MEAL_LABEL, MealCode, SelectedFlight, Segment } from '../../core/models/flight.model';
import {
  BookingFlowService,
  INSURANCE_RATE,
  MAX_EXTRA_BAGS,
  OFFSET_RATE_PER_KG,
  PRIORITY_PRICE,
  extraBagPrice,
} from '../../core/services/booking-flow.service';
import { IconComponent } from '../../shared/components/icon.component';
import { MoneyPipe } from '../../shared/components/money.pipe';
import { SeatMapComponent } from './seat-map.component';

const MEALS: MealCode[] = ['standard', 'vegetarian', 'vegan', 'halal', 'kosher', 'gluten-free'];

@Component({
  selector: 'app-extras-step',
  imports: [IconComponent, MoneyPipe, SeatMapComponent],
  template: `
    <div class="grid gap-6">
      <!-- Seats -->
      <section class="card p-5 sm:p-6" aria-labelledby="seat-h">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="seat-h" class="flex items-center gap-2 text-xl font-bold"><app-icon name="armchair" [size]="20" /> Choose your seats</h2>
            <p class="mt-1 text-sm text-muted">Optional — skip it and we'll assign seats at check-in.</p>
          </div>
        </div>
        <div class="tabs mt-5 max-w-full overflow-x-auto" role="group" aria-label="Flight segment">
          @for (s of segments(); track s.seg.id; let i = $index) {
            <button type="button" class="tab !px-4" [attr.aria-pressed]="segIdx() === i" (click)="segIdx.set(i)">{{ s.seg.from }} → {{ s.seg.to }}</button>
          }
        </div>
        @if (current(); as c) {
          <p class="mt-3 text-sm text-muted">{{ c.seg.flightNo }} · {{ airlineName(c.seg.airline) }} · {{ c.seg.aircraft.name }} · {{ dur(c.seg.durationMin) }}</p>
          <div class="mt-4">
            <app-seat-map [map]="c.map" [passengers]="flow.passengers()" [seats]="c.seats" [fare]="c.fare" [cabin]="c.sel.offer.cabin" (pick)="pickSeat(c.seg.id, $event)" />
          </div>
        }
      </section>

      <!-- Baggage -->
      <section class="card p-5 sm:p-6" aria-labelledby="bag-h">
        <h2 id="bag-h" class="flex items-center gap-2 text-xl font-bold"><app-icon name="luggage" [size]="20" /> Baggage</h2>
        <p class="mt-1 text-sm text-muted">Each fare includes the allowance shown. Add extra 23 kg bags now — it's cheaper than at the airport.</p>
        <div class="mt-4 grid gap-5">
          @for (sel of flow.legs(); track sel.offer.id; let li = $index) {
            <div>
              <h3 class="text-sm font-bold">{{ city(sel.offer.segments[0].from) }} → {{ city(sel.offer.segments[sel.offer.segments.length - 1].to) }}
                <span class="font-normal text-muted">· includes {{ sel.offer.fares[sel.family].checkedBags }} checked bag{{ sel.offer.fares[sel.family].checkedBags === 1 ? '' : 's' }} + cabin bag · extra bag {{ bagPrice(sel) | money }}</span></h3>
              <ul class="mt-2 grid gap-2 sm:grid-cols-2">
                @for (p of flow.passengers(); track $index; let pi = $index) {
                  <li class="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-solid-2)] px-4 py-2.5">
                    <span class="min-w-0 truncate text-sm font-semibold">{{ name(pi) }}</span>
                    @if (p.type === 'infant') {
                      <span class="text-xs text-muted">Infant allowance applies</span>
                    } @else {
                      <span class="flex items-center gap-2">
                        <button type="button" class="icon-btn icon-btn-sm !border-[var(--border)]" [attr.aria-label]="'Remove an extra bag for ' + name(pi) + ', flight ' + (li + 1)" [disabled]="bags(li, pi) === 0" (click)="flow.setBags(li, pi, bags(li, pi) - 1)"><app-icon name="minus" [size]="14" /></button>
                        <span class="w-5 text-center font-bold tabular-nums" aria-live="polite">{{ bags(li, pi) }}</span>
                        <button type="button" class="icon-btn icon-btn-sm !border-[var(--border)]" [attr.aria-label]="'Add an extra bag for ' + name(pi) + ', flight ' + (li + 1)" [disabled]="bags(li, pi) >= maxBags" (click)="flow.setBags(li, pi, bags(li, pi) + 1)"><app-icon name="plus" [size]="14" /></button>
                      </span>
                    }
                  </li>
                }
              </ul>
            </div>
          }
        </div>
      </section>

      <!-- Meals -->
      @if (mealSegments().length > 0) {
        <section class="card p-5 sm:p-6" aria-labelledby="meal-h">
          <h2 id="meal-h" class="flex items-center gap-2 text-xl font-bold"><app-icon name="utensils" [size]="20" /> Meals</h2>
          <p class="mt-1 text-sm text-muted">Complimentary on full-service flights over 2.5 hours. Choose a special meal if you need one.</p>
          <div class="mt-4 grid gap-4">
            @for (s of mealSegments(); track s.id) {
              <div>
                <h3 class="text-sm font-bold">{{ s.from }} → {{ s.to }} <span class="font-normal text-muted">· {{ airlineName(s.airline) }} {{ s.flightNo }}</span></h3>
                <ul class="mt-2 grid gap-2 sm:grid-cols-2">
                  @for (p of flow.passengers(); track $index; let pi = $index) {
                    <li class="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-solid-2)] px-4 py-2">
                      <label class="min-w-0 flex-1 truncate text-sm font-semibold" [for]="'meal-' + s.id + pi">{{ name(pi) }}</label>
                      <select [id]="'meal-' + s.id + pi" class="select input-sm !w-auto" [value]="meal(s.id, pi, p.type)" (change)="setMeal(s.id, pi, $any($event.target).value)">
                        @if (p.type === 'child' || p.type === 'infant') { <option value="child" [selected]="meal(s.id, pi, p.type) === 'child'">{{ mealLabel('child') }}</option> }
                        @for (m of meals; track m) { <option [value]="m" [selected]="meal(s.id, pi, p.type) === m">{{ mealLabel(m) }}</option> }
                      </select>
                    </li>
                  }
                </ul>
              </div>
            }
          </div>
        </section>
      }

      <!-- Protection & extras -->
      <section class="card p-5 sm:p-6" aria-labelledby="ins-h">
        <h2 id="ins-h" class="flex items-center gap-2 text-xl font-bold"><app-icon name="shield-check" [size]="20" /> Protect your trip</h2>
        <div class="mt-4 grid gap-3 md:grid-cols-3" role="radiogroup" aria-labelledby="ins-h">
          @for (o of insurance; track o.id) {
            <button type="button" role="radio" class="opt-card" [attr.aria-checked]="flow.extras().insurance === o.id" [class.is-on]="flow.extras().insurance === o.id" (click)="flow.patchExtras({ insurance: o.id })">
              <span class="flex items-center justify-between"><span class="font-bold">{{ o.label }}</span><span class="font-display font-bold">{{ o.id === 'none' ? 'Free' : (insuranceCost(o.id) | money: 2) }}</span></span>
              <span class="mt-1 block text-xs text-muted">{{ o.text }}</span>
            </button>
          }
        </div>
        <div class="mt-5 grid gap-3 sm:grid-cols-2">
          <label class="opt-card !flex items-start gap-3" [class.is-on]="flow.extras().priority">
            <input type="checkbox" class="check mt-0.5" [checked]="flow.extras().priority" (change)="flow.patchExtras({ priority: $any($event.target).checked })" />
            <span><span class="block font-bold">Priority boarding <span class="font-normal text-muted">· {{ priorityPrice | money }} per traveler per flight</span></span><span class="text-xs text-muted">Board first and secure overhead space. Free on Flex and premium cabins.</span></span>
          </label>
          <label class="opt-card !flex items-start gap-3" [class.is-on]="flow.extras().offset">
            <input type="checkbox" class="check mt-0.5" [checked]="flow.extras().offset" (change)="flow.patchExtras({ offset: $any($event.target).checked })" />
            <span><span class="block font-bold">Offset my flight's carbon <span class="font-normal text-muted">· {{ offsetCost() | money: 2 }}</span></span><span class="text-xs text-muted">Funds verified forestry and clean-energy projects ({{ co2() }} kg CO₂).</span></span>
          </label>
        </div>
      </section>

      <div class="flex flex-wrap items-center justify-between gap-3">
        <button type="button" class="btn btn-ghost" (click)="back.emit()"><app-icon name="arrow-left" [size]="17" /> Back</button>
        <button type="button" class="btn btn-primary btn-lg" (click)="done.emit()">Continue to payment <app-icon name="arrow-right" [size]="18" /></button>
      </div>
    </div>
  `,
})
export class ExtrasStepComponent {
  readonly done = output<void>();
  readonly back = output<void>();

  protected readonly flow = inject(BookingFlowService);
  protected readonly meals = MEALS;
  protected readonly maxBags = MAX_EXTRA_BAGS;
  protected readonly priorityPrice = PRIORITY_PRICE;
  protected readonly insurance: { id: InsurancePlan; label: string; text: string }[] = [
    { id: 'none', label: 'No cover', text: 'Travel at your own risk.' },
    { id: 'basic', label: 'Essential', text: 'Medical emergencies, lost baggage and delay cover.' },
    { id: 'plus', label: 'Plus', text: 'Everything in Essential plus cancel-for-any-reason (80% back).' },
  ];

  protected readonly segIdx = signal(0);

  protected readonly segments = computed(() => {
    const out: { seg: Segment; sel: SelectedFlight }[] = [];
    for (const sel of this.flow.legs()) for (const seg of sel.offer.segments) out.push({ seg, sel });
    return out;
  });

  protected readonly current = computed(() => this.build(Math.min(this.segIdx(), this.segments().length - 1)));

  protected readonly mealSegments = computed(() =>
    this.segments()
      .filter(({ seg }) => seg.durationMin >= 150 && !airline(seg.airline).lcc)
      .map(({ seg }) => seg),
  );

  protected readonly co2 = computed(() => this.flow.legs().reduce((n, s) => n + s.offer.co2Kg * this.flow.payingPax(), 0));
  protected readonly offsetCost = computed(() => Math.round(this.co2() * OFFSET_RATE_PER_KG * 100) / 100);

  private build(i: number): { seg: Segment; sel: SelectedFlight; map: ReturnType<BookingFlowService['seatMap']>; fare: SelectedFlight['offer']['fares']['basic']; seats: Record<number, string> } | null {
    const s = this.segments()[i];
    if (!s) return null;
    const ex = this.flow.extras().seats;
    const seats: Record<number, string> = {};
    this.flow.passengers().forEach((_, pi) => {
      const label = ex[`${s.seg.id}|${pi}`];
      if (label) seats[pi] = label;
    });
    return { seg: s.seg, sel: s.sel, map: this.flow.seatMap(s.seg, s.sel.offer), fare: s.sel.offer.fares[s.sel.family], seats };
  }

  protected airlineName(code: string): string { return airline(code).name; }
  protected city(code: string): string { return airport(code).city; }
  protected dur(m: number): string { return formatDuration(m); }
  protected mealLabel(m: MealCode): string { return MEAL_LABEL[m]; }
  protected bagPrice(sel: SelectedFlight): number { return extraBagPrice(sel.offer.distanceKm); }

  protected name(i: number): string {
    const p = this.flow.passengers()[i];
    return `${p?.firstName ?? ''} ${p?.lastName ?? ''}`.trim() || `Traveler ${i + 1}`;
  }

  protected bags(li: number, pi: number): number {
    return this.flow.extras().bags[`${li}|${pi}`] ?? 0;
  }

  protected meal(segId: string, pi: number, type: string): MealCode {
    return this.flow.extras().meals[`${segId}|${pi}`] ?? (type === 'adult' ? 'standard' : 'child');
  }

  protected setMeal(segId: string, pi: number, m: MealCode): void {
    this.flow.patchExtras({ meals: { ...this.flow.extras().meals, [`${segId}|${pi}`]: m } });
  }

  protected pickSeat(segId: string, e: { pax: number; seat: string | null }): void {
    this.flow.setSeat(segId, e.pax, e.seat);
  }

  protected insuranceCost(plan: InsurancePlan): number {
    const p = this.flow.pricing();
    return Math.round((p.fare + p.taxes) * INSURANCE_RATE[plan] * 100) / 100;
  }
}
