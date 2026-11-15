import { Service, computed, inject, signal } from '@angular/core';
import { airport } from '../data/airports';
import { autoSeat, buildSeatMap } from '../engine/seatmap';
import { localIsoDate } from '../engine/time';
import { hashString } from '../engine/prng';
import { Booking, Cabin, FlightOffer, Passenger, PriceLine, SelectedFlight } from '../models/flight.model';
import { newId, nowIso, round2 } from '../util/id.util';
import { AuthService } from './auth.service';
import { BookingFlowService } from './booking-flow.service';
import { OfflineCacheService } from './offline-cache.service';

const KEY = 'wg:bookings';
const HOUR = 3_600_000;

export interface CancelQuote {
  allowed: boolean;
  reason: string;
  riskFree: boolean;
  refundUsd: number;
  lines: PriceLine[];
}

export interface ChangeQuote {
  allowed: boolean;
  reason: string;
  diffUsd: number;
  feeUsd: number;
  /** Positive = customer pays, negative = refunded. */
  netUsd: number;
}

export interface BoardingInfo {
  gate: string;
  terminal: string;
  boardingUtc: number;
  group: string;
}

export type BookingPhase = 'upcoming' | 'completed' | 'cancelled';

const MILES_CABIN: Record<Cabin, number> = { economy: 1, premium: 1.5, business: 2, first: 3 };

export function weights(b: Pick<Booking, 'params'>): { base: number; tax: number; paying: number } {
  const { adults, children, infants } = b.params;
  return { base: adults + 0.75 * children + 0.1 * infants, tax: adults + children + 0.4 * infants, paying: adults + children };
}

export function bookingPhase(b: Booking, nowMs = Date.now()): BookingPhase {
  if (b.status === 'cancelled') return 'cancelled';
  const last = b.legs[b.legs.length - 1].offer.arrUtc;
  return last < nowMs ? 'completed' : 'upcoming';
}

export function checkInWindow(leg: SelectedFlight): { opens: number; closes: number } {
  const dep = leg.offer.depUtc;
  return { opens: dep - 48 * HOUR, closes: dep - 1 * HOUR };
}

export function boardingInfo(seg: { id: string; depUtc: number }): BoardingInfo {
  const h = hashString(seg.id);
  return {
    gate: `${'ABCDEFGHK'[h % 9]}${(h >> 4) % 38 + 1}`,
    terminal: String(((h >> 9) % 4) + 1),
    boardingUtc: seg.depUtc - 45 * 60_000,
    group: String(((h >> 12) % 5) + 1),
  };
}

function ref(existing: Set<string>): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (;;) {
    let out = '';
    for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
    if (!existing.has(out)) return out;
  }
}

function ticketNumber(): string {
  let n = '';
  for (let i = 0; i < 10; i++) n += Math.floor(Math.random() * 10);
  return `${Math.floor(100 + Math.random() * 899)}-${n}`;
}

@Service()
export class BookingsService {
  private readonly cache = inject(OfflineCacheService);
  private readonly auth = inject(AuthService);
  private readonly flow = inject(BookingFlowService);

  private readonly all = signal<Booking[]>(this.cache.read<Booking[]>(KEY, []));

  readonly mine = computed(() => {
    const u = this.auth.user();
    return u ? this.all().filter((b) => b.userId === u.id).sort((a, b) => a.legs[0].offer.depUtc - b.legs[0].offer.depUtc) : [];
  });

  readonly miles = computed(() => this.mine().filter((b) => b.status === 'confirmed').reduce((n, b) => n + b.milesEarned, 0));

  byRef(refCode: string): Booking | undefined {
    const u = this.auth.user();
    const code = refCode.toUpperCase();
    return u ? this.all().find((b) => b.ref === code && b.userId === u.id) : undefined;
  }

  /** Persists a new booking built from the current checkout flow. */
  create(payment: { brand: string; last4: string }): Booking | null {
    const user = this.auth.user();
    const s = this.flow.snapshot();
    if (!user || !s.params || !this.flow.allSelected()) return null;
    const legs = this.flow.legs();
    const pricing = this.flow.pricing();
    let miles = 0;
    for (const sel of legs) {
      const f = sel.offer.fares[sel.family];
      miles += Math.round(sel.offer.distanceKm * 0.6 * (f.milesPct / 100) * MILES_CABIN[sel.offer.cabin] * this.flow.payingPax());
    }
    const existing = new Set(this.all().map((b) => b.ref));
    const booking: Booking = {
      id: newId(),
      userId: user.id,
      ref: ref(existing),
      status: 'confirmed',
      createdAt: nowIso(),
      params: s.params,
      legs,
      passengers: s.passengers,
      contact: s.contact,
      extras: s.extras,
      pricing,
      currency: 'USD',
      rate: 1,
      promo: this.flow.promoResult()?.valid ? s.promo : null,
      payment,
      tickets: s.passengers.map(() => ticketNumber()),
      checkedIn: {},
      events: [{ at: nowIso(), text: `Booking confirmed and paid with ${payment.brand} ••${payment.last4}` }],
      milesEarned: miles,
      refundedUsd: 0,
    };
    this.save([...this.all(), booking]);
    return booking;
  }

  // ---------- cancellation ----------

  quoteCancel(b: Booking, nowMs = Date.now()): CancelQuote {
    const firstDep = b.legs[0].offer.depUtc;
    if (b.status === 'cancelled') return { allowed: false, reason: 'This booking is already cancelled.', riskFree: false, refundUsd: 0, lines: [] };
    if (firstDep <= nowMs) return { allowed: false, reason: 'This trip has already departed.', riskFree: false, refundUsd: 0, lines: [] };

    const riskFree = nowMs - Date.parse(b.createdAt) <= 24 * HOUR && firstDep - nowMs >= 7 * 24 * HOUR;
    if (riskFree) {
      return { allowed: true, riskFree: true, reason: '24-hour risk-free cancellation applies — full refund.', refundUsd: round2(b.pricing.totalUsd - b.refundedUsd), lines: [{ label: 'Full refund to original payment method', usd: round2(b.pricing.totalUsd - b.refundedUsd) }] };
    }
    const w = weights(b);
    const lines: PriceLine[] = [];
    let gross = 0;
    for (const sel of b.legs) {
      const f = sel.offer.fares[sel.family];
      const taxes = f.taxes * w.tax;
      const fare = f.base * w.base;
      if (f.refund === 'full') {
        gross += fare + taxes;
        lines.push({ label: `${sel.offer.segments[0].from}→${sel.offer.segments[sel.offer.segments.length - 1].to} fare & taxes (Flex)`, usd: round2(fare + taxes) });
      } else if (f.refund === 'partial') {
        const net = Math.max(taxes, fare + taxes - f.cancelFeeUsd * w.paying);
        gross += net;
        lines.push({ label: `${sel.offer.segments[0].from}→${sel.offer.segments[sel.offer.segments.length - 1].to} fare less cancellation fee`, usd: round2(net) });
      } else {
        gross += taxes;
        lines.push({ label: `${sel.offer.segments[0].from}→${sel.offer.segments[sel.offer.segments.length - 1].to} unused taxes (Basic fare)`, usd: round2(taxes) });
      }
    }
    if (b.legs.every((l) => l.family === 'flex')) {
      gross += b.pricing.seats + b.pricing.bags;
      if (b.pricing.seats + b.pricing.bags > 0) lines.push({ label: 'Seats & baggage', usd: round2(b.pricing.seats + b.pricing.bags) });
    }
    if (b.extras.insurance === 'plus') {
      const cfar = 0.8 * (b.pricing.fare + b.pricing.taxes);
      if (cfar > gross) {
        lines.length = 0;
        lines.push({ label: 'Cancel-for-any-reason cover (80% of fare & taxes)', usd: round2(cfar) });
        gross = cfar;
      }
    }
    const refund = round2(Math.max(0, Math.min(gross - b.pricing.discount, b.pricing.totalUsd - b.refundedUsd)));
    return { allowed: true, riskFree: false, reason: 'Refund is calculated from your fare rules.', refundUsd: refund, lines };
  }

  cancel(refCode: string): number | null {
    const b = this.byRef(refCode);
    if (!b) return null;
    const q = this.quoteCancel(b);
    if (!q.allowed) return null;
    const updated: Booking = {
      ...b,
      status: 'cancelled',
      refundedUsd: round2(b.refundedUsd + q.refundUsd),
      events: [...b.events, { at: nowIso(), text: q.refundUsd > 0 ? `Booking cancelled — refund of $${q.refundUsd.toFixed(2)} issued to ${b.payment.brand} ••${b.payment.last4}` : 'Booking cancelled — no refund due' }],
    };
    this.replace(updated);
    return q.refundUsd;
  }

  // ---------- changes ----------

  quoteChange(b: Booking, legIndex: number, next: FlightOffer, nowMs = Date.now()): ChangeQuote {
    const none = { diffUsd: 0, feeUsd: 0, netUsd: 0 };
    const cur = b.legs[legIndex];
    if (b.status === 'cancelled') return { allowed: false, reason: 'This booking is cancelled.', ...none };
    if (cur.offer.depUtc - nowMs < 3 * HOUR) return { allowed: false, reason: 'Flights can’t be changed within 3 hours of departure.', ...none };
    const oldF = cur.offer.fares[cur.family];
    if (oldF.changeFeeUsd === null) return { allowed: false, reason: 'Basic fares can’t be changed. Cancel and rebook, or upgrade to Standard next time.', ...none };
    const prev = b.legs[legIndex - 1];
    const after = b.legs[legIndex + 1];
    if (prev && next.depUtc <= prev.offer.arrUtc) return { allowed: false, reason: 'That flight leaves before your previous flight arrives.', ...none };
    if (after && next.arrUtc >= after.offer.depUtc) return { allowed: false, reason: 'That flight arrives after your next flight departs.', ...none };
    const newF = next.fares[cur.family];
    const w = weights(b);
    const diff = round2((newF.base - oldF.base) * w.base + (newF.taxes - oldF.taxes) * w.tax);
    const fee = round2(oldF.changeFeeUsd * w.paying);
    return { allowed: true, reason: '', diffUsd: diff, feeUsd: fee, netUsd: round2(diff + fee) };
  }

  applyChange(refCode: string, legIndex: number, next: FlightOffer): ChangeQuote | null {
    const b = this.byRef(refCode);
    if (!b) return null;
    const q = this.quoteChange(b, legIndex, next);
    if (!q.allowed) return null;
    const cur = b.legs[legIndex];
    const w = weights(b);
    const oldF = cur.offer.fares[cur.family];
    const newF = next.fares[cur.family];
    const seats = Object.fromEntries(Object.entries(b.extras.seats).filter(([k]) => !cur.offer.segments.some((s) => k.startsWith(`${s.id}|`))));
    const meals = Object.fromEntries(Object.entries(b.extras.meals).filter(([k]) => !cur.offer.segments.some((s) => k.startsWith(`${s.id}|`))));
    const legs = b.legs.map((l, i) => (i === legIndex ? { offer: { ...next, legIndex }, family: l.family } : l));
    const checkedIn = { ...b.checkedIn };
    delete checkedIn[legIndex];
    const newDate = localIsoDate(airport(next.segments[0].from), next.depUtc);
    const params = { ...b.params, legs: b.params.legs.map((l, i) => (i === legIndex ? { ...l, date: newDate } : l)) };
    const updated: Booking = {
      ...b,
      legs,
      params,
      extras: { ...b.extras, seats, meals },
      pricing: {
        ...b.pricing,
        fare: round2(b.pricing.fare + (newF.base - oldF.base) * w.base),
        taxes: round2(b.pricing.taxes + (newF.taxes - oldF.taxes) * w.tax),
        totalUsd: round2(b.pricing.totalUsd + q.netUsd),
      },
      refundedUsd: q.netUsd < 0 ? round2(b.refundedUsd - q.netUsd) : b.refundedUsd,
      checkedIn,
      events: [
        ...b.events,
        {
          at: nowIso(),
          text:
            q.netUsd > 0
              ? `Flight changed — $${q.netUsd.toFixed(2)} charged to ${b.payment.brand} ••${b.payment.last4} (fare difference $${q.diffUsd.toFixed(2)} + change fee $${q.feeUsd.toFixed(2)})`
              : q.netUsd < 0
                ? `Flight changed — $${Math.abs(q.netUsd).toFixed(2)} refunded to ${b.payment.brand} ••${b.payment.last4}`
                : 'Flight changed at no extra cost',
        },
      ],
    };
    this.replace(updated);
    return q;
  }

  // ---------- check-in ----------

  checkInOpen(b: Booking, legIndex: number, nowMs = Date.now()): 'early' | 'open' | 'closed' {
    const w = checkInWindow(b.legs[legIndex]);
    return nowMs < w.opens ? 'early' : nowMs > w.closes ? 'closed' : 'open';
  }

  checkIn(refCode: string, legIndex: number): boolean {
    const b = this.byRef(refCode);
    if (!b || b.status === 'cancelled' || this.checkInOpen(b, legIndex) !== 'open') return false;
    const sel = b.legs[legIndex];
    const seats = { ...b.extras.seats };
    for (const seg of sel.offer.segments) {
      const map = buildSeatMap(seg, sel.offer.cabin, sel.offer.seatsLeft);
      const taken = new Set(Object.entries(seats).filter(([k]) => k.startsWith(`${seg.id}|`)).map(([, v]) => v));
      b.passengers.forEach((p: Passenger, i) => {
        if (p.type === 'infant') return;
        const key = `${seg.id}|${i}`;
        if (!seats[key]) {
          const label = autoSeat(map, p, taken);
          if (label) {
            seats[key] = label;
            taken.add(label);
          }
        }
      });
    }
    this.replace({
      ...b,
      extras: { ...b.extras, seats },
      checkedIn: { ...b.checkedIn, [legIndex]: true },
      events: [...b.events, { at: nowIso(), text: `Checked in for ${sel.offer.segments[0].from} → ${sel.offer.segments[sel.offer.segments.length - 1].to}` }],
    });
    return true;
  }

  // ---------- internals ----------

  private replace(updated: Booking): void {
    this.save(this.all().map((b) => (b.id === updated.id ? updated : b)));
  }

  private save(list: Booking[]): void {
    this.all.set(list);
    this.cache.write(KEY, list);
  }
}
