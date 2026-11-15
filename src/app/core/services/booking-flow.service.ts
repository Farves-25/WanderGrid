import { Service, computed, inject, signal } from '@angular/core';
import { seatCharge, allSeats, buildSeatMap, SeatMap } from '../engine/seatmap';
import {
  Cabin,
  Contact,
  Extras,
  FlightOffer,
  InsurancePlan,
  Passenger,
  PaxType,
  Pricing,
  SearchParams,
  SelectedFlight,
  Segment,
  FareFamily,
} from '../models/flight.model';
import { diffDays, todayIso } from '../util/date.util';
import { round2 } from '../util/id.util';
import { blankPassenger } from '../util/passenger-validation';
import { OfflineCacheService } from './offline-cache.service';

export interface PromoDef {
  code: string;
  description: string;
}

interface PromoRule extends PromoDef {
  kind: 'pct' | 'flat';
  value: number;
  cap?: number;
  minSubtotal?: number;
  cabins?: Cabin[];
  minDaysAhead?: number;
}

const PROMOS: PromoRule[] = [
  { code: 'WANDER10', description: '10% off your fare (up to $150)', kind: 'pct', value: 10, cap: 150 },
  { code: 'WELCOME25', description: '$25 off orders over $200', kind: 'flat', value: 25, minSubtotal: 200 },
  { code: 'FLYHIGH75', description: '$75 off Business & First bookings', kind: 'flat', value: 75, cabins: ['business', 'first'] },
  { code: 'EARLYBIRD', description: '7% off when you book 45+ days ahead (up to $200)', kind: 'pct', value: 7, cap: 200, minDaysAhead: 45 },
];

export const PROMO_HINTS: readonly PromoDef[] = PROMOS.map(({ code, description }) => ({ code, description }));

export type PromoResult = { valid: true; discount: number; description: string } | { valid: false; message: string };

interface FlowState {
  signature: string;
  params: SearchParams | null;
  selections: (SelectedFlight | null)[];
  passengers: Passenger[];
  contact: Contact;
  extras: Extras;
  promo: string | null;
}

const KEY = 'wg:flow';

export function emptyExtras(): Extras {
  return { bags: {}, seats: {}, meals: {}, insurance: 'none', priority: false, offset: false };
}

export function signatureOf(p: SearchParams): string {
  return JSON.stringify([p.type, p.legs, p.adults, p.children, p.infants, p.cabin]);
}

export function extraBagPrice(distanceKm: number): number {
  return distanceKm < 3000 ? 35 : distanceKm < 8000 ? 60 : 95;
}

export const INSURANCE_RATE: Record<InsurancePlan, number> = { none: 0, basic: 0.045, plus: 0.085 };
export const PRIORITY_PRICE = 12;
export const OFFSET_RATE_PER_KG = 0.022;
export const MAX_EXTRA_BAGS = 3;

function paxTypes(p: SearchParams): PaxType[] {
  return [...Array<PaxType>(p.adults).fill('adult'), ...Array<PaxType>(p.children).fill('child'), ...Array<PaxType>(p.infants).fill('infant')];
}

@Service()
export class BookingFlowService {
  private readonly cache = inject(OfflineCacheService);

  private readonly state = signal<FlowState>(this.load());

  readonly params = computed(() => this.state().params);
  readonly selections = computed(() => this.state().selections);
  readonly passengers = computed(() => this.state().passengers);
  readonly contact = computed(() => this.state().contact);
  readonly extras = computed(() => this.state().extras);
  readonly promoCode = computed(() => this.state().promo);

  readonly allSelected = computed(() => {
    const s = this.state();
    return s.params !== null && s.selections.length === s.params.legs.length && s.selections.every((x) => x !== null);
  });

  readonly legs = computed(() => this.state().selections.filter((s): s is SelectedFlight => s !== null));
  readonly payingPax = computed(() => (this.params()?.adults ?? 0) + (this.params()?.children ?? 0));
  readonly firstDeparture = computed(() => this.legs()[0]?.offer.segments[0].depUtc ?? null);

  /** Local date strings of first and last departures, for validation. */
  readonly travelDates = computed(() => {
    const p = this.params();
    return p ? { first: p.legs[0].date, last: p.legs[p.legs.length - 1].date } : null;
  });

  readonly promoResult = computed<PromoResult | null>(() => {
    const code = this.state().promo;
    return code ? this.evaluatePromo(code) : null;
  });

  readonly pricing = computed<Pricing>(() => this.computePricing());

  // ---------- lifecycle ----------

  begin(params: SearchParams): void {
    const sig = signatureOf(params);
    const cur = this.state();
    if (cur.signature === sig && cur.params) return;
    const types = paxTypes(params);
    this.commit({
      signature: sig,
      params,
      selections: params.legs.map(() => null),
      passengers: types.map(blankPassenger),
      contact: cur.contact,
      extras: emptyExtras(),
      promo: cur.promo,
    });
  }

  select(legIndex: number, offer: FlightOffer, family: FareFamily): void {
    const s = this.state();
    if (!s.params) return;
    const selections = s.selections.slice();
    selections[legIndex] = { offer, family };
    // a later leg that now departs before this one lands is no longer valid
    for (let i = legIndex + 1; i < selections.length; i++) {
      const sel = selections[i];
      const prev = selections[i - 1];
      if (sel && prev && sel.offer.depUtc <= prev.offer.arrUtc) selections[i] = null;
    }
    const bags = Object.fromEntries(Object.entries(s.extras.bags).filter(([k]) => Number(k.split('|')[0]) !== legIndex));
    this.commit({ ...s, selections, extras: { ...s.extras, bags } });
  }

  clearSelection(legIndex: number): void {
    const s = this.state();
    const selections = s.selections.slice();
    selections[legIndex] = null;
    this.commit({ ...s, selections });
  }

  setPassengers(list: Passenger[]): void {
    this.commit({ ...this.state(), passengers: list });
  }

  setContact(c: Contact): void {
    this.commit({ ...this.state(), contact: c });
  }

  patchExtras(patch: Partial<Extras>): void {
    const s = this.state();
    this.commit({ ...s, extras: { ...s.extras, ...patch } });
  }

  setSeat(segmentId: string, paxIndex: number, seat: string | null): void {
    const s = this.state();
    const seats = { ...s.extras.seats };
    const key = `${segmentId}|${paxIndex}`;
    if (seat === null) delete seats[key];
    else seats[key] = seat;
    this.commit({ ...s, extras: { ...s.extras, seats } });
  }

  setBags(legIndex: number, paxIndex: number, n: number): void {
    const s = this.state();
    const bags = { ...s.extras.bags, [`${legIndex}|${paxIndex}`]: Math.max(0, Math.min(MAX_EXTRA_BAGS, n)) };
    this.commit({ ...s, extras: { ...s.extras, bags } });
  }

  setPromo(code: string | null): void {
    this.commit({ ...this.state(), promo: code ? code.trim().toUpperCase() : null });
  }

  reset(): void {
    this.commit({ signature: '', params: null, selections: [], passengers: [], contact: this.state().contact, extras: emptyExtras(), promo: null });
  }

  /** Immutable snapshot for creating a booking. */
  snapshot(): FlowState {
    return this.state();
  }

  // ---------- seat maps ----------

  seatMap(segment: Segment, offer: FlightOffer): SeatMap {
    return buildSeatMap(segment, offer.cabin, offer.seatsLeft);
  }

  // ---------- pricing ----------

  evaluatePromo(codeRaw: string): PromoResult {
    const code = codeRaw.trim().toUpperCase();
    const rule = PROMOS.find((p) => p.code === code);
    if (!rule) return { valid: false, message: 'That promo code is not valid.' };
    const p = this.params();
    if (!p) return { valid: false, message: 'Choose your flights first.' };
    const base = this.fareTotals();
    if (rule.cabins && !rule.cabins.includes(p.cabin)) return { valid: false, message: `${rule.code} only applies to ${rule.cabins.join(' & ')} fares.` };
    if (rule.minDaysAhead && diffDays(todayIso(), p.legs[0].date) < rule.minDaysAhead) return { valid: false, message: `${rule.code} needs a departure at least ${rule.minDaysAhead} days away.` };
    const subtotal = base.fare + base.taxes;
    if (rule.minSubtotal && subtotal < rule.minSubtotal) return { valid: false, message: `${rule.code} needs an order of at least $${rule.minSubtotal}.` };
    const raw = rule.kind === 'pct' ? (base.fare * rule.value) / 100 : rule.value;
    const discount = round2(Math.min(raw, rule.cap ?? raw, subtotal));
    return { valid: true, discount, description: rule.description };
  }

  private fareTotals(): { fare: number; taxes: number } {
    const p = this.params();
    if (!p) return { fare: 0, taxes: 0 };
    let fare = 0;
    let taxes = 0;
    for (const sel of this.legs()) {
      const f = sel.offer.fares[sel.family];
      fare += f.base * (p.adults + 0.75 * p.children + 0.1 * p.infants);
      taxes += f.taxes * (p.adults + p.children + 0.4 * p.infants);
    }
    return { fare: round2(fare), taxes: round2(taxes) };
  }

  private computePricing(): Pricing {
    const p = this.params();
    const ex = this.extras();
    const { fare, taxes } = this.fareTotals();
    const empty: Pricing = { fare, taxes, seats: 0, bags: 0, insurance: 0, priority: 0, offset: 0, discount: 0, totalUsd: 0 };
    if (!p) return empty;
    const legs = this.legs();
    const pax = this.passengers();

    let seats = 0;
    for (const sel of legs) {
      for (const seg of sel.offer.segments) {
        const map = this.seatMap(seg, sel.offer);
        const byLabel = new Map(allSeats(map).map((s) => [s.label, s] as const));
        pax.forEach((_, i) => {
          const label = ex.seats[`${seg.id}|${i}`];
          const seat = label ? byLabel.get(label) : undefined;
          if (seat) seats += seatCharge(seat, sel.offer.fares[sel.family], sel.offer.cabin);
        });
      }
    }

    let bags = 0;
    legs.forEach((sel, li) => {
      const unit = extraBagPrice(sel.offer.distanceKm);
      pax.forEach((_, i) => {
        bags += (ex.bags[`${sel.offer.legIndex ?? li}|${i}`] ?? 0) * unit;
      });
    });

    const insurance = round2((fare + taxes) * INSURANCE_RATE[ex.insurance]);
    const priority = ex.priority ? legs.reduce((n, sel) => n + (sel.offer.fares[sel.family].priorityBoarding ? 0 : PRIORITY_PRICE * this.payingPax()), 0) : 0;
    const co2 = legs.reduce((n, sel) => n + sel.offer.co2Kg * this.payingPax(), 0);
    const offset = ex.offset ? round2(co2 * OFFSET_RATE_PER_KG) : 0;

    const subtotal = fare + taxes + seats + bags + insurance + priority + offset;
    const promo = this.promoResult();
    const discount = promo?.valid ? promo.discount : 0;
    return {
      fare,
      taxes,
      seats: round2(seats),
      bags: round2(bags),
      insurance,
      priority: round2(priority),
      offset,
      discount,
      totalUsd: round2(Math.max(0, subtotal - discount)),
    };
  }

  // ---------- persistence ----------

  private commit(next: FlowState): void {
    this.state.set(next);
    this.cache.write(KEY, next);
  }

  private load(): FlowState {
    const blank: FlowState = { signature: '', params: null, selections: [], passengers: [], contact: { email: '', phone: '' }, extras: emptyExtras(), promo: null };
    const saved = this.cache.read<Partial<FlowState> | null>(KEY, null);
    if (!saved || !saved.params || !Array.isArray(saved.selections)) return blank;
    // discard stale flows whose flights have already departed
    const stale = saved.selections.some((s) => s && s.offer.depUtc < Date.now());
    if (stale) return { ...blank, contact: saved.contact ?? blank.contact };
    return { ...blank, ...saved, extras: { ...emptyExtras(), ...(saved.extras ?? {}) } } as FlowState;
  }
}
