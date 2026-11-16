import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildQuery, isEmptyResult, normalizeAccount, normalizeBooking, normalizeInsights, normalizeSearch, validateParams } from './serpapi.mjs';

const oneway = { type: 'oneway', legs: [{ from: 'LHR', to: 'JFK', date: '2027-03-10' }], adults: 1, children: 0, infants: 0, cabin: 'economy' };
const round = { ...oneway, type: 'round', legs: [oneway.legs[0], { from: 'JFK', to: 'LHR', date: '2027-03-17' }], adults: 2, infants: 1, cabin: 'business' };
const multi = { ...oneway, type: 'multi', legs: [oneway.legs[0], { from: 'JFK', to: 'LAX', date: '2027-03-14' }, { from: 'LAX', to: 'LHR', date: '2027-03-20' }] };

const item = {
  flights: [
    {
      departure_airport: { name: 'Heathrow Airport', id: 'LHR', time: '2027-03-10 21:40' },
      arrival_airport: { name: 'Keflavík International Airport', id: 'KEF', time: '2027-03-10 23:55' },
      duration: 195, airplane: 'Boeing 737MAX 8', airline: 'Icelandair', airline_logo: 'https://www.gstatic.com/flights/airline_logos/70px/FI.png',
      travel_class: 'Economy', flight_number: 'FI 455', legroom: '31 in', extensions: ['Average legroom (31 in)', 'Wi-Fi for a fee'], overnight: true,
      often_delayed_by_over_30_min: true,
    },
    {
      departure_airport: { name: 'Keflavík International Airport', id: 'KEF', time: '2027-03-11 17:00' },
      arrival_airport: { name: 'John F. Kennedy International Airport', id: 'JFK', time: '2027-03-11 19:05' },
      duration: 365, airplane: 'Boeing 757', airline: 'Icelandair', airline_logo: 'https://www.gstatic.com/flights/airline_logos/70px/FI.png',
      travel_class: 'Economy', flight_number: 'FI 615', ticket_also_sold_by: ['JetBlue'], plane_and_crew_by: 'Icelandair Cargo',
    },
  ],
  layovers: [{ duration: 1025, name: 'Keflavík International Airport', id: 'KEF', overnight: true }],
  total_duration: 1585,
  carbon_emissions: { this_flight: 412500, typical_for_this_route: 450000, difference_percent: -8 },
  price: 389, type: 'One way', airline_logo: 'https://www.gstatic.com/flights/airline_logos/70px/FI.png', booking_token: 'BOOK',
};

test('validateParams accepts good searches and rejects bad ones', () => {
  assert.equal(validateParams(oneway), null);
  assert.equal(validateParams(round), null);
  assert.equal(validateParams(multi), null);
  assert.ok(validateParams(null));
  assert.ok(validateParams({ ...oneway, type: 'teleport' }));
  assert.ok(validateParams({ ...oneway, type: 'constructor' }));
  assert.ok(validateParams({ ...oneway, legs: [{ from: 'LHR', to: 'LHR', date: '2027-03-10' }] }));
  assert.ok(validateParams({ ...oneway, legs: [{ from: 'lhr&x=1', to: 'JFK', date: '2027-03-10' }] }));
  assert.ok(validateParams({ ...oneway, legs: [{ from: 'LHR', to: 'JFK', date: 'tomorrow' }] }));
  assert.ok(validateParams({ ...round, legs: [round.legs[0]] }));
  assert.ok(validateParams({ ...oneway, adults: 0 }));
  assert.ok(validateParams({ ...oneway, adults: 1, infants: 2 }));
  assert.ok(validateParams({ ...oneway, adults: 6, children: 4 }));
});

test('buildQuery maps trip types, cabins and passengers', () => {
  const q1 = buildQuery(oneway);
  assert.deepEqual(
    { type: q1.type, d: q1.departure_id, a: q1.arrival_id, o: q1.outbound_date, r: q1.return_date, c: q1.travel_class, cur: q1.currency },
    { type: '2', d: 'LHR', a: 'JFK', o: '2027-03-10', r: undefined, c: '1', cur: 'USD' },
  );
  const q2 = buildQuery(round, { departureToken: 'TOK', gl: 'gb' });
  assert.equal(q2.type, '1');
  assert.equal(q2.return_date, '2027-03-17');
  assert.equal(q2.travel_class, '3');
  assert.equal(q2.adults, '2');
  assert.equal(q2.infants_on_lap, '1');
  assert.equal(q2.departure_token, 'TOK');
  assert.equal(q2.booking_token, undefined);
  assert.equal(q2.gl, 'gb');
  const q3 = buildQuery(multi, { bookingToken: 'B' });
  assert.equal(q3.type, '3');
  assert.equal(q3.outbound_date, undefined);
  assert.deepEqual(JSON.parse(q3.multi_city_json)[1], { departure_id: 'JFK', arrival_id: 'LAX', date: '2027-03-14' });
  assert.equal(q3.booking_token, 'B');
});

test('buildQuery omits adults=1 for booking tokens only', () => {
  assert.equal(buildQuery(oneway, { bookingToken: 'B' }).adults, undefined);
  assert.equal(buildQuery(oneway).adults, '1');
  assert.equal(buildQuery({ ...oneway, adults: 2 }, { bookingToken: 'B' }).adults, '2');
});

test('normalizeSearch turns Google Flights items into offers', () => {
  const res = normalizeSearch(
    {
      search_metadata: { google_flights_url: 'https://www.google.com/travel/flights?tfs=abc' },
      best_flights: [item],
      other_flights: [item, { ...item, price: 512, booking_token: undefined, departure_token: 'NEXT' }, { flights: [] }],
      price_insights: { lowest_price: 389, price_level: 'low', typical_price_range: [420, 700], price_history: [[1790000000, 450], [1790086400, 389], ['x', 1]] },
    },
    0,
  );
  assert.equal(res.offers.length, 2, 'duplicates and empty items are dropped');
  const o = res.offers[0];
  assert.equal(o.best, true);
  assert.equal(o.priceUsd, 389);
  assert.equal(o.stops, 1);
  assert.equal(o.dep, '2027-03-10 21:40');
  assert.equal(o.arr, '2027-03-11 19:05');
  assert.equal(o.durationMin, 1585);
  assert.equal(o.co2Kg, 413);
  assert.equal(o.co2DiffPct, -8);
  assert.deepEqual(o.airlines, ['Icelandair']);
  assert.equal(o.bookingToken, 'BOOK');
  assert.equal(o.nextToken, null);
  assert.equal(o.segments[0].oftenDelayed, true);
  assert.equal(o.segments[0].legroom, '31 in');
  assert.deepEqual(o.segments[1].alsoSoldBy, ['JetBlue']);
  assert.equal(o.layovers[0].overnight, true);
  assert.equal(res.offers[1].nextToken, 'NEXT');
  assert.equal(res.offers[1].bookingToken, null);
  assert.equal(res.googleUrl, 'https://www.google.com/travel/flights?tfs=abc');
  assert.deepEqual(res.insights.typicalRange, [420, 700]);
  assert.deepEqual(res.insights.history, [[1790000000000, 450], [1790086400000, 389]]);
});

test('normalizeSearch copes with missing sections', () => {
  const res = normalizeSearch({}, 0);
  assert.deepEqual(res, { offers: [], insights: null, googleUrl: null });
  assert.equal(normalizeInsights({ typical_price_range: [300] }), null);
  const noPrice = normalizeSearch({ other_flights: [{ ...item, price: undefined, total_duration: undefined }] }, 1).offers[0];
  assert.equal(noPrice.priceUsd, null);
  assert.equal(noPrice.durationMin, 195 + 365 + 1025);
  assert.equal(noPrice.legIndex, 1);
});

test('normalizeBooking flattens sellers and only keeps https booking links', () => {
  const res = normalizeBooking({
    selected_flights: [item],
    baggage_prices: { together: ['1 free carry-on'] },
    booking_options: [
      { together: { book_with: 'Expensive Travel', price: 450, booking_request: { url: 'https://www.google.com/travel/clk/f', post_data: 'u=abc' } } },
      {
        together: {
          book_with: 'Icelandair', airline: true, airline_logos: ['https://www.gstatic.com/flights/airline_logos/70px/FI.png'], marketed_as: ['FI 455', 'FI 615'], price: 389,
          option_title: 'Economy Light', extensions: ['No refunds'], baggage_prices: ['1st checked bag: 60'], booking_request: { url: 'https://www.google.com/travel/clk/f', post_data: 'u=xyz' },
        },
      },
      { separate_tickets: true, departing: { book_with: 'A', price: 100, booking_request: { url: 'javascript:alert(1)' } }, returning: { book_with: 'B', price: 150, booking_phone: '+1 800 555 0100', estimated_phone_service_fee: 25 } },
      {},
    ],
  });
  assert.equal(res.options.length, 3);
  assert.deepEqual(res.options.map((o) => o.totalUsd), [250, 389, 450], 'sorted by total price');
  const sep = res.options[0];
  assert.equal(sep.separate, true);
  assert.equal(sep.parts[0].request, null, 'non-https links are dropped');
  assert.equal(sep.parts[1].phone, '+1 800 555 0100');
  assert.equal(sep.parts[1].phoneFeeUsd, 25);
  const airline = res.options[1].parts[0];
  assert.equal(airline.isAirline, true);
  assert.deepEqual(airline.request, { url: 'https://www.google.com/travel/clk/f', postData: 'u=xyz' });
  assert.equal(airline.title, 'Economy Light');
  assert.equal(res.selected.length, 1);
  assert.deepEqual(res.baggage, ['1 free carry-on']);
});

test('isEmptyResult and normalizeAccount', () => {
  assert.equal(isEmptyResult("Google Flights hasn't returned any results for this query."), true);
  assert.equal(isEmptyResult('Invalid API key.'), false);
  assert.equal(isEmptyResult(undefined), false);
  assert.equal(normalizeAccount({ error: 'Invalid API key' }), null);
  assert.deepEqual(normalizeAccount({ plan_name: 'Free Plan', searches_per_month: 250, plan_searches_left: 240, total_searches_left: 241, this_month_usage: 10, this_hour_searches: 2, account_rate_limit_per_hour: 50 }), {
    plan: 'Free Plan', searchesPerMonth: 250, searchesLeft: 241, usedThisMonth: 10, usedThisHour: 2, hourlyLimit: 50,
  });
});
