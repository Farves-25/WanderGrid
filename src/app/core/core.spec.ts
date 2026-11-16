import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AIRPORTS, airport, distanceKm, searchAirports } from './data/airports';
import { FlightOffer, SearchParams, SearchResult, Segment } from './models/flight.model';
import { AlertsService, alertParams, trackedPrice } from './services/alerts.service';
import { AuthService } from './services/auth.service';
import { ApiError, FlightSearchService } from './services/flight-search.service';
import { PreferencesService } from './services/preferences.service';
import { SavedService } from './services/saved.service';
import { openBooking } from './util/booking-redirect';
import { addDays, todayIso } from './util/date.util';
import { cityOf, departureBand, formatDuration, lowestPrice, offerTimes, plusDays, routeCodes, searchKey, stopsLabel, tripDates } from './util/flight-format';
import { fromQuery, toQuery, validateSearch } from './util/search-query';

const today = todayIso();
const date = addDays(today, 60);

function segment(over: Partial<Segment> = {}): Segment {
  return {
    airline: 'British Airways', airlineLogo: null, flightNo: 'BA 117', aircraft: 'Boeing 777', cabin: 'Economy',
    from: 'LHR', fromName: 'Heathrow Airport', to: 'JFK', toName: 'John F. Kennedy International Airport',
    dep: `${date} 08:25`, arr: `${date} 11:20`, durationMin: 475, legroom: '31 in', extensions: [], overnight: false, oftenDelayed: false, operatedBy: null, alsoSoldBy: [],
    ...over,
  };
}

function offer(over: Partial<FlightOffer> = {}): FlightOffer {
  const segments = over.segments ?? [segment()];
  return {
    id: 'o1', legIndex: 0, best: false, segments, layovers: [], airlines: ['British Airways'], logo: null,
    dep: segments[0].dep, arr: segments[segments.length - 1].arr, durationMin: 475, stops: segments.length - 1, priceUsd: 520, tripType: 'One way',
    co2Kg: 400, co2TypicalKg: 420, co2DiffPct: -5, extensions: [], nextToken: null, bookingToken: 'BOOK',
    ...over,
  };
}

function result(over: Partial<SearchResult> = {}): SearchResult {
  return { offers: [offer()], insights: null, googleUrl: 'https://www.google.com/travel/flights', fetchedAt: Date.now(), cached: false, ...over };
}

describe('airports', () => {
  it('computes great-circle distances', () => {
    expect(distanceKm(airport('LHR'), airport('JFK'))).toBeGreaterThan(5400);
    expect(distanceKm(airport('LHR'), airport('JFK'))).toBeLessThan(5700);
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

describe('flight formatting', () => {
  const overnight = offer({
    segments: [segment({ to: 'KEF', toName: 'Keflavík', dep: '2027-03-10 21:40', arr: '2027-03-10 23:55' }), segment({ from: 'KEF', dep: '2027-03-11 17:00', arr: '2027-03-11 19:05' })],
    layovers: [{ airport: 'KEF', name: 'Keflavík International Airport', minutes: 1025, overnight: true }],
  });

  it('reads local times without shifting them', () => {
    const t = offerTimes(overnight);
    expect(t).toMatchObject({ from: 'LHR', to: 'JFK', depTime: '21:40', arrTime: '19:05', plusDays: 1 });
    expect(plusDays('2027-03-10 23:00', '2027-03-10 23:50')).toBe(0);
    // crossing the date line westbound can land the day before
    expect(plusDays('2027-03-11 00:30', '2027-03-10 18:00')).toBe(-1);
    expect(departureBand(overnight)).toBe('evening');
    expect(departureBand(offer({ dep: '2027-03-10 05:59' }))).toBe('night');
  });
  it('labels stops, durations and routes', () => {
    expect(stopsLabel(offer())).toBe('Nonstop');
    expect(stopsLabel(overnight)).toBe('1 stop · KEF');
    expect(formatDuration(475)).toBe('7h 55m');
    expect(formatDuration(45)).toBe('45m');
    expect(cityOf('LHR')).toBe('London');
    expect(cityOf('QQQ', 'Some Regional Airport')).toBe('Some Regional Airport');
    expect(cityOf('ZZZ')).toBe('ZZZ');
    const round: SearchParams = { type: 'round', legs: [{ from: 'LHR', to: 'JFK', date }, { from: 'JFK', to: 'LHR', date: addDays(date, 7) }], adults: 1, children: 0, infants: 0, cabin: 'economy' };
    expect(routeCodes(round)).toBe('LHR ⇄ JFK');
    expect(routeCodes({ ...round, type: 'multi', legs: [round.legs[0], { from: 'JFK', to: 'LAX', date: addDays(date, 3) }] })).toBe('LHR → JFK → LAX');
    expect(tripDates(round)).toContain('–');
    expect(searchKey(round)).not.toBe(searchKey({ ...round, adults: 2 }));
  });
  it('finds the lowest published price', () => {
    expect(lowestPrice([offer({ priceUsd: null }), offer({ priceUsd: 610 }), offer({ priceUsd: 480 })])).toBe(480);
    expect(lowestPrice([offer({ priceUsd: null })])).toBeNull();
    expect(lowestPrice([])).toBeNull();
  });
});

describe('booking redirect', () => {
  it('posts the seller form in a new tab', () => {
    const submit = vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(function (this: HTMLFormElement) {
      expect(this.method.toUpperCase()).toBe('POST');
      expect(this.action).toBe('https://www.google.com/travel/clk/f');
      expect(this.target).toBe('_blank');
      const fields = Array.from(this.querySelectorAll('input')).map((i) => [i.name, i.value]);
      expect(fields).toEqual([['u', 'a b/c=='], ['x', '1']]);
    });
    expect(openBooking({ url: 'https://www.google.com/travel/clk/f', postData: 'u=a%20b%2Fc%3D%3D&x=1' })).toBe(true);
    expect(submit).toHaveBeenCalledOnce();
    expect(document.querySelector('form')).toBeNull();
    submit.mockRestore();
  });
  it('opens plain links and refuses anything that is not https', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    expect(openBooking({ url: 'https://www.example-airline.com/book?x=1', postData: null })).toBe(true);
    expect(open).toHaveBeenCalledWith('https://www.example-airline.com/book?x=1', '_blank', 'noopener');
    expect(openBooking({ url: 'javascript:alert(1)', postData: null })).toBe(false);
    expect(openBooking({ url: 'http://insecure.example.com', postData: 'u=1' })).toBe(false);
    expect(open).toHaveBeenCalledOnce();
    open.mockRestore();
  });
});

describe('live services', () => {
  let http: HttpTestingController;
  let api: FlightSearchService;
  const params: SearchParams = { type: 'oneway', legs: [{ from: 'LHR', to: 'JFK', date }], adults: 1, children: 0, infants: 0, cabin: 'economy' };

  /** Answers the background requests every service makes, so each test only deals with its own. */
  function flushBackground(): void {
    for (const r of http.match((req) => req.url === '/api/rates' || req.url === '/api/status')) {
      if (!r.cancelled) r.flush(r.request.url === '/api/rates' ? { base: 'USD', rates: { USD: 1, EUR: 0.5 }, updatedAt: 1 } : { configured: true, keyValid: true, account: null });
    }
  }
  const settle = (): Promise<void> => new Promise((r) => setTimeout(r));

  beforeEach(async () => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(FlightSearchService);
    expect((await TestBed.inject(AuthService).signUp('Test User', 'test@example.com', 'password123')).ok).toBe(true);
  });

  it('searches once and reuses the result until a refresh is forced', async () => {
    const first = api.search(params, 0, null);
    const req = http.expectOne('/api/flights/search');
    expect(req.request.body).toEqual({ params, legIndex: 0, token: null, fresh: false });
    req.flush(result());
    expect((await first).cached).toBe(false);
    flushBackground();

    expect((await api.search(params, 0, null)).cached).toBe(true);
    http.expectNone('/api/flights/search');

    const forced = api.search(params, 0, null, true);
    http.expectOne('/api/flights/search').flush(result({ offers: [] }));
    expect((await forced).offers).toEqual([]);
  });

  it('keeps each leg and token separate', async () => {
    const round: SearchParams = { ...params, type: 'round', legs: [params.legs[0], { from: 'JFK', to: 'LHR', date: addDays(date, 7) }] };
    const a = api.search(round, 1, 'TOKEN-A');
    http.expectOne((r) => r.body?.token === 'TOKEN-A' && r.body.legIndex === 1).flush(result());
    await a;
    const b = api.search(round, 1, 'TOKEN-B');
    http.expectOne((r) => r.body?.token === 'TOKEN-B').flush(result());
    await b;
  });

  it('turns server errors into readable ApiErrors', async () => {
    const p = api.search(params, 0, null);
    http.expectOne('/api/flights/search').flush({ error: { code: 'not_configured', message: 'Add SERPAPI_KEY.' } }, { status: 503, statusText: 'Service Unavailable' });
    await expect(p).rejects.toMatchObject({ code: 'not_configured', message: 'Add SERPAPI_KEY.' });

    const q = api.booking(params, 'BOOK');
    http.expectOne('/api/flights/booking').error(new ProgressEvent('error'));
    const err = await q.catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe('offline');
  });

  it('converts prices with live exchange rates', async () => {
    const prefs = TestBed.inject(PreferencesService);
    prefs.setCurrency('EUR');
    const builtIn = prefs.rate();
    flushBackground();
    await settle();
    expect(prefs.rate()).toBe(0.5);
    expect(builtIn).not.toBe(0.5);
  });

  it('tracks a price alert from live results', async () => {
    const alerts = TestBed.inject(AlertsService);
    const route = { from: 'LHR', to: 'JFK', date, returnDate: null, cabin: 'economy' as const };
    const seed = result({ insights: { lowestUsd: 500, level: 'typical', typicalRange: [450, 700], history: [[1, 560], [2, 500]] }, fetchedAt: Date.now() - 60_000 });
    expect(trackedPrice(seed)).toBe(500);
    expect(alertParams(route)).toEqual(params);

    const alert = alerts.create({ ...route, targetUsd: 450 }, seed)!;
    expect(alert.createdPriceUsd).toBe(500);
    expect(alerts.statuses()[0]).toMatchObject({ currentUsd: 500, triggered: false, seriesSource: 'google' });
    expect(alerts.create({ ...route, targetUsd: 440 }, seed)!.id).toBe(alert.id);
    expect(alerts.mine().length).toBe(1);
    expect(alerts.mine()[0].targetUsd).toBe(440);

    // a matching search feeds the alert; other passenger counts don't
    alerts.record({ ...params, adults: 2 }, result({ offers: [offer({ priceUsd: 100 })] }));
    expect(alerts.statuses()[0].currentUsd).toBe(500);
    alerts.record(params, result({ offers: [offer({ priceUsd: 430 })] }));
    expect(alerts.statuses()[0]).toMatchObject({ currentUsd: 430, triggered: true, changePct: -14 });
    expect(alerts.triggeredCount()).toBe(1);

    const check = alerts.check(alert.id);
    http.expectOne((r) => r.url === '/api/flights/search' && r.body.fresh === true).flush(result({ offers: [offer({ priceUsd: 470 })], fetchedAt: Date.now() + 1000 }));
    expect(await check).toBe(470);
    expect(alerts.statuses()[0]).toMatchObject({ currentUsd: 470, triggered: false });
    expect(alerts.mine()[0].observations.map((o) => o.usd)).toEqual([500, 430, 470]);

    const removed = alerts.remove(alert.id)!;
    expect(alerts.mine()).toEqual([]);
    alerts.restore(removed);
    expect(alerts.mine().length).toBe(1);
  });

  it('saves trips per account and remembers recent searches', () => {
    const saved = TestBed.inject(SavedService);
    const legs = [offer()];
    const trip = saved.save(params, legs, 520, null)!;
    expect(saved.save(params, legs, 999, null)!.id).toBe(trip.id);
    expect(saved.mine().length).toBe(1);
    expect(saved.findSaved(params, legs)?.priceUsd).toBe(520);
    expect(saved.findSaved(params, [offer({ id: 'other' })])).toBeUndefined();
    saved.remove(trip.id);
    expect(saved.mine()).toEqual([]);
    saved.restore(trip);
    saved.restore(trip);
    expect(saved.mine().length).toBe(1);

    saved.rememberSearch(params, 520);
    saved.rememberSearch({ ...params, cabin: 'business' }, 2100);
    saved.rememberSearch(params, 480);
    expect(saved.recent().map((r) => r.lowestUsd)).toEqual([480, 2100]);
    for (let i = 0; i < 12; i++) saved.rememberSearch({ ...params, legs: [{ ...params.legs[0], date: addDays(date, i + 1) }] }, i);
    expect(saved.recent().length).toBe(8);
    saved.clearRecent();
    expect(saved.recent()).toEqual([]);
  });
});
