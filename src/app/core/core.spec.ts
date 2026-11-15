import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { AIRPORTS, airport, distanceKm, searchAirports } from './data/airports';
import { searchFlights } from './engine/flight-engine';
import { buildSeatMap, seatAllowed, seatCharge } from './engine/seatmap';
import { formatLocalTime, localToUtc, offsetMinutes } from './engine/time';
import { Passenger, SearchParams } from './models/flight.model';
import { AuthService } from './services/auth.service';
import { BookingFlowService } from './services/booking-flow.service';
import { BookingsService } from './services/bookings.service';
import { FlightSearchService } from './services/flight-search.service';
import { addDays, todayIso } from './util/date.util';
import { cardBrand, expiryValid, formatCardNumber, luhn, simulateAuthorization } from './util/card.util';
import { blankPassenger, validatePassenger } from './util/passenger-validation';
import { fromQuery, toQuery, validateSearch } from './util/search-query';

const today = todayIso();
const ctx = { nowMs: Date.now(), todayIso: today };

describe('airports', () => {
  it('computes great-circle distances', () => {
    expect(distanceKm(airport('LHR'), airport('JFK'))).toBeGreaterThan(5400);
    expect(distanceKm(airport('LHR'), airport('JFK'))).toBeLessThan(5700);
    expect(distanceKm(airport('LHR'), airport('SYD'))).toBeGreaterThan(16800);
  });
  it('autocompletes by code, city and country', () => {
    expect(searchAirports('jfk')[0].code).toBe('JFK');
    expect(searchAirports('tokyo').map((a) => a.code)).toEqual(expect.arrayContaining(['HND', 'NRT']));
    expect(searchAirports('são')[0].code).toBe('GRU');
    expect(searchAirports('zzzz')).toEqual([]);
  });
  it('has unique codes', () => {
    expect(new Set(AIRPORTS.map((a) => a.code)).size).toBe(AIRPORTS.length);
  });
});

describe('time zones', () => {
  it('applies DST in Europe and the US', () => {
    const summer = Date.UTC(2027, 6, 1, 12);
    const winter = Date.UTC(2027, 0, 15, 12);
    expect(offsetMinutes(airport('LHR'), summer)).toBe(60);
    expect(offsetMinutes(airport('LHR'), winter)).toBe(0);
    expect(offsetMinutes(airport('JFK'), summer)).toBe(-240);
    expect(offsetMinutes(airport('JFK'), winter)).toBe(-300);
    expect(offsetMinutes(airport('SYD'), winter)).toBe(660);
    expect(offsetMinutes(airport('SYD'), summer)).toBe(600);
    expect(offsetMinutes(airport('DEL'), summer)).toBe(330);
  });
  it('round-trips local time', () => {
    const utc = localToUtc(airport('JFK'), '2027-07-01', 14 * 60 + 35);
    expect(formatLocalTime(airport('JFK'), utc)).toBe('14:35');
    expect(utc).toBe(Date.UTC(2027, 6, 1, 18, 35));
  });
});

describe('flight engine', () => {
  const date = addDays(today, 40);

  it('is deterministic', () => {
    const a = searchFlights({ from: 'LHR', to: 'JFK', date }, 0, 'economy', ctx);
    const b = searchFlights({ from: 'LHR', to: 'JFK', date }, 0, 'economy', ctx);
    expect(a.map((o) => o.id)).toEqual(b.map((o) => o.id));
    expect(a.map((o) => o.fares.basic.total)).toEqual(b.map((o) => o.fares.basic.total));
  });

  it('returns realistic transatlantic offers', () => {
    const offers = searchFlights({ from: 'LHR', to: 'JFK', date }, 0, 'economy', ctx);
    expect(offers.length).toBeGreaterThan(5);
    for (const o of offers) {
      expect(o.arrUtc).toBeGreaterThan(o.depUtc);
      expect(o.durationMin).toBe(Math.round((o.arrUtc - o.depUtc) / 60000));
      expect(o.segments[0].from).toBe('LHR');
      expect(o.segments[o.segments.length - 1].to).toBe('JFK');
      expect(o.stops).toBe(o.segments.length - 1);
      expect(o.fares.basic.total).toBeGreaterThan(40);
      expect(o.fares.basic.total).toBeLessThan(3000);
      expect(o.fares.standard.total).toBeGreaterThan(o.fares.basic.total);
      expect(o.fares.flex.total).toBeGreaterThan(o.fares.standard.total);
      expect(o.seatsLeft).toBeGreaterThanOrEqual(1);
      for (let i = 1; i < o.segments.length; i++) expect(o.segments[i].depUtc).toBeGreaterThan(o.segments[i - 1].arrUtc);
    }
    const direct = offers.filter((o) => o.stops === 0);
    expect(direct.length).toBeGreaterThan(0);
    expect(Math.min(...direct.map((o) => o.durationMin))).toBeGreaterThan(6 * 60);
    expect(Math.max(...direct.map((o) => o.durationMin))).toBeLessThan(10 * 60);
  });

  it('connects ultra-long-haul routes', () => {
    const offers = searchFlights({ from: 'LHR', to: 'SYD', date }, 0, 'economy', ctx);
    expect(offers.length).toBeGreaterThan(3);
    expect(offers.every((o) => o.durationMin > 18 * 60)).toBe(true);
  });

  it('prices last-minute fares above advance fares', () => {
    const near = searchFlights({ from: 'LHR', to: 'DXB', date: addDays(today, 2) }, 0, 'economy', ctx);
    const far = searchFlights({ from: 'LHR', to: 'DXB', date: addDays(today, 70) }, 0, 'economy', ctx);
    const avg = (l: typeof near): number => l.reduce((s, o) => s + o.fares.basic.total, 0) / Math.max(1, l.length);
    expect(avg(near)).toBeGreaterThan(avg(far));
  });

  it('respects cabin availability and cabin pricing', () => {
    const eco = searchFlights({ from: 'LHR', to: 'JFK', date }, 0, 'economy', ctx);
    const biz = searchFlights({ from: 'LHR', to: 'JFK', date }, 0, 'business', ctx);
    const first = searchFlights({ from: 'LHR', to: 'JFK', date }, 0, 'first', ctx);
    expect(biz.length).toBeGreaterThan(0);
    expect(Math.min(...biz.map((o) => o.fares.basic.total))).toBeGreaterThan(Math.min(...eco.map((o) => o.fares.basic.total)) * 2);
    for (const o of first) expect(o.segments.every((s) => s.aircraft.widebody)).toBe(true);
    // low-cost carriers never sell business
    expect(biz.every((o) => !['6E', 'FZ', 'AK', 'TR'].includes(o.airlines[0]))).toBe(true);
  });

  it('never offers flights departing in the past', () => {
    const offers = searchFlights({ from: 'LHR', to: 'CDG', date: today }, 0, 'economy', ctx);
    for (const o of offers) expect(o.depUtc).toBeGreaterThan(ctx.nowMs + 3 * 3_600_000 - 1);
  });

  it('handles identical or unknown airports', () => {
    expect(searchFlights({ from: 'LHR', to: 'LHR', date }, 0, 'economy', ctx)).toEqual([]);
    expect(searchFlights({ from: 'XXX', to: 'LHR', date }, 0, 'economy', ctx)).toEqual([]);
  });

  it('fare rules grow more flexible with fare family', () => {
    const o = searchFlights({ from: 'LHR', to: 'JFK', date }, 0, 'economy', ctx)[0];
    expect(o.fares.basic.changeFeeUsd).toBeNull();
    expect(o.fares.standard.changeFeeUsd).toBeGreaterThan(0);
    expect(o.fares.flex.changeFeeUsd).toBe(0);
    expect(o.fares.basic.refund).toBe('none');
    expect(o.fares.flex.refund).toBe('full');
  });
});

describe('seat maps', () => {
  const offer = searchFlights({ from: 'LHR', to: 'JFK', date: addDays(today, 40) }, 0, 'economy', ctx)[0];
  const seg = offer.segments[0];

  it('is deterministic and respects exit rows', () => {
    const a = buildSeatMap(seg, 'economy', offer.seatsLeft);
    const b = buildSeatMap(seg, 'economy', offer.seatsLeft);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const exit = a.rows.flatMap((r) => r.cells).find((c) => c?.kind === 'exit');
    expect(exit).toBeTruthy();
    expect(seatAllowed(exit!, { ...blankPassenger('child') })).toBe(false);
    expect(seatAllowed(exit!, { ...blankPassenger('adult') })).toBe(true);
  });

  it('charges according to fare family', () => {
    const map = buildSeatMap(seg, 'economy', 5);
    const extra = map.rows.flatMap((r) => r.cells).find((c) => c?.kind === 'extra')!;
    expect(seatCharge(extra, offer.fares.basic, 'economy')).toBeGreaterThan(0);
    expect(seatCharge(extra, offer.fares.flex, 'economy')).toBe(0);
    expect(seatCharge(extra, offer.fares.basic, 'business')).toBe(0);
  });
});

describe('card utils', () => {
  it('validates with Luhn and detects brands', () => {
    expect(luhn('4242 4242 4242 4242')).toBe(true);
    expect(luhn('4242 4242 4242 4241')).toBe(false);
    expect(cardBrand('5555 5555 5555 4444')).toBe('Mastercard');
    expect(cardBrand('3782 822463 10005')).toBe('Amex');
    expect(formatCardNumber('4242424242424242')).toBe('4242 4242 4242 4242');
  });
  it('checks expiry', () => {
    expect(expiryValid('12/99')).toBe(true);
    expect(expiryValid('01/20')).toBe(false);
    expect(expiryValid('13/30')).toBe(false);
  });
  it('simulates authorisation outcomes', () => {
    expect(simulateAuthorization('4242424242424242', 100).kind).toBe('approved');
    expect(simulateAuthorization('4000000000000002', 100).kind).toBe('declined');
    expect(simulateAuthorization('4000000000003220', 100).kind).toBe('challenge');
    expect(simulateAuthorization('4242424242424242', 2000).kind).toBe('challenge');
  });
});

describe('passenger validation', () => {
  const good: Passenger = { type: 'adult', title: 'Mr', firstName: 'Alex', lastName: 'Rivera', dob: '1990-05-04', gender: 'M', nationality: 'GB', passportNo: 'AB123456', passportExpiry: addDays(today, 2000), passportCountry: 'GB' };
  const dep = addDays(today, 30);

  it('accepts valid adults', () => {
    expect(validatePassenger(good, dep, addDays(dep, 7))).toEqual({});
  });
  it('requires six months passport validity after return', () => {
    const p = { ...good, passportExpiry: addDays(dep, 100) };
    expect(validatePassenger(p, dep, addDays(dep, 7)).passportExpiry).toBeTruthy();
  });
  it('enforces age bands', () => {
    expect(validatePassenger({ ...good, type: 'child', dob: '1990-05-04' }, dep, dep).dob).toBeTruthy();
    expect(validatePassenger({ ...good, type: 'infant', dob: addDays(today, -400) }, dep, dep).dob).toBeFalsy();
    expect(validatePassenger({ ...good, dob: addDays(today, -365 * 5) }, dep, dep).dob).toBeTruthy();
  });
  it('rejects bad names', () => {
    expect(validatePassenger({ ...good, firstName: 'A1' }, dep, dep).firstName).toBeTruthy();
    expect(validatePassenger({ ...good, lastName: "O'Brien-Smith" }, dep, dep).lastName).toBeFalsy();
  });
});

describe('search query', () => {
  const base: SearchParams = { type: 'round', legs: [{ from: 'LHR', to: 'JFK', date: addDays(today, 20) }, { from: 'JFK', to: 'LHR', date: addDays(today, 27) }], adults: 2, children: 1, infants: 1, cabin: 'business' };

  it('round-trips through the URL', () => {
    const r = fromQuery(toQuery(base));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.params).toEqual(base);
  });
  it('rejects invalid searches', () => {
    expect(validateSearch({ ...base, legs: [{ ...base.legs[0], to: 'LHR' }, base.legs[1]] })).toBeTruthy();
    expect(validateSearch({ ...base, legs: [{ ...base.legs[0], date: addDays(today, -1) }, base.legs[1]] })).toBeTruthy();
    expect(validateSearch({ ...base, legs: [base.legs[0], { ...base.legs[1], date: addDays(today, 5) }] })).toBeTruthy();
    expect(validateSearch({ ...base, adults: 1, infants: 2 })).toBeTruthy();
    expect(validateSearch({ ...base, adults: 9, children: 1 })).toBeTruthy();
    expect(validateSearch({ ...base, legs: [{ ...base.legs[0], date: addDays(today, 500) }, base.legs[1]] })).toBeTruthy();
    expect(fromQuery({ legs: 'garbage' }).ok).toBe(false);
  });
});

describe('booking flow, bookings and fare rules', () => {
  let flow: BookingFlowService;
  let bookings: BookingsService;
  let search: FlightSearchService;
  const date = addDays(today, 60);
  const params: SearchParams = { type: 'oneway', legs: [{ from: 'LHR', to: 'JFK', date }], adults: 2, children: 1, infants: 1, cabin: 'economy' };

  async function setup(): Promise<void> {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    flow = TestBed.inject(BookingFlowService);
    bookings = TestBed.inject(BookingsService);
    search = TestBed.inject(FlightSearchService);
    const auth = TestBed.inject(AuthService);
    expect((await auth.signUp('Test User', 'test@example.com', 'password123')).ok).toBe(true);
    flow.begin(params);
  }

  function fill(): void {
    const dob = ['1990-01-01', '1991-02-02', addDays(today, -365 * 6), addDays(today, -300)];
    flow.setPassengers(
      flow.passengers().map((p, i) => ({ ...p, title: 'Mr', firstName: 'Pax' + String.fromCharCode(97 + i), lastName: 'Test', dob: dob[i], gender: 'M', nationality: 'GB', passportCountry: 'GB', passportNo: 'AB12345' + i, passportExpiry: addDays(today, 3000) })),
    );
    flow.setContact({ email: 'test@example.com', phone: '+447700900123' });
  }

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await setup();
  });

  it('prices passengers by type', () => {
    const o = search.searchSync(params.legs[0], 0, 'economy')[0];
    flow.select(0, o, 'standard');
    const f = o.fares.standard;
    const p = flow.pricing();
    expect(p.fare).toBeCloseTo(f.base * (2 + 0.75 + 0.1), 1);
    expect(p.taxes).toBeCloseTo(f.taxes * (2 + 1 + 0.4), 1);
    expect(p.totalUsd).toBeCloseTo(p.fare + p.taxes, 1);
  });

  it('adds extras and applies promo codes', () => {
    const o = search.searchSync(params.legs[0], 0, 'economy')[0];
    flow.select(0, o, 'basic');
    flow.setBags(0, 0, 2);
    flow.patchExtras({ insurance: 'basic', priority: true });
    const p = flow.pricing();
    expect(p.bags).toBeGreaterThan(0);
    expect(p.insurance).toBeGreaterThan(0);
    expect(p.priority).toBe(12 * 3);
    flow.setPromo('NOPE');
    expect(flow.promoResult()?.valid).toBe(false);
    const before = flow.pricing().totalUsd;
    flow.setPromo('wander10');
    expect(flow.promoResult()?.valid).toBe(true);
    expect(flow.pricing().totalUsd).toBeLessThan(before);
    flow.setPromo('FLYHIGH75');
    expect(flow.promoResult()?.valid).toBe(false);
  });

  it('creates, checks in, changes and cancels a booking', () => {
    const offers = search.searchSync(params.legs[0], 0, 'economy');
    const o = offers.find((x) => x.stops === 0) ?? offers[0];
    flow.select(0, o, 'flex');
    fill();
    const b = bookings.create({ brand: 'Visa', last4: '4242' })!;
    expect(b.ref).toMatch(/^[A-Z2-9]{6}$/);
    expect(b.tickets.length).toBe(4);
    expect(bookings.mine().length).toBe(1);

    // risk-free window: full refund
    expect(bookings.quoteCancel(b).riskFree).toBe(true);
    expect(bookings.quoteCancel(b).refundUsd).toBeCloseTo(b.pricing.totalUsd, 1);

    // check-in is closed this far ahead
    expect(bookings.checkInOpen(b, 0)).toBe('early');
    expect(bookings.checkIn(b.ref, 0)).toBe(false);
    const near = new Date(o.depUtc - 24 * 3_600_000).getTime();
    expect(bookings.checkInOpen(b, 0, near)).toBe('open');

    // change to another day (flex: free change, fare difference only)
    const other = search.searchSync({ ...params.legs[0], date: addDays(date, 2) }, 0, 'economy')[0];
    const q = bookings.quoteChange(b, 0, other);
    expect(q.allowed).toBe(true);
    expect(q.feeUsd).toBe(0);
    const applied = bookings.applyChange(b.ref, 0, other);
    expect(applied).not.toBeNull();
    expect(bookings.byRef(b.ref)!.legs[0].offer.id).toBe(other.id);

    // cancel
    const refund = bookings.cancel(b.ref);
    expect(refund).not.toBeNull();
    expect(bookings.byRef(b.ref)!.status).toBe('cancelled');
    expect(bookings.cancel(b.ref)).toBeNull();
  });

  it('basic fares cannot be changed and refund only taxes late in the window', () => {
    const o = search.searchSync(params.legs[0], 0, 'economy')[0];
    flow.select(0, o, 'basic');
    fill();
    const b = bookings.create({ brand: 'Visa', last4: '4242' })!;
    const other = search.searchSync({ ...params.legs[0], date: addDays(date, 1) }, 0, 'economy')[0];
    expect(bookings.quoteChange(b, 0, other).allowed).toBe(false);
    const late = Date.parse(b.createdAt) + 3 * 24 * 3_600_000;
    const q = bookings.quoteCancel(b, late);
    expect(q.riskFree).toBe(false);
    expect(q.refundUsd).toBeCloseTo(b.pricing.taxes, 0);
  });
});
