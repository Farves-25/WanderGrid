/**
 * Pure helpers for talking to SerpApi's Google Flights engine: request validation,
 * query building and normalising responses into WanderGrid's own shape.
 * No I/O here so everything can be unit-tested with `node --test`.
 */

const CABIN = { economy: '1', premium: '2', business: '3', first: '4' };
const TRIP = { round: '1', oneway: '2', multi: '3' };
const IATA = /^[A-Z]{3}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_PAX = 9;
const MAX_TOKEN = 8000;

function isInt(n, min, max) {
  return Number.isInteger(n) && n >= min && n <= max;
}

/** Returns an error message, or null when the search parameters are usable. */
export function validateParams(p) {
  if (!p || typeof p !== 'object') return 'Missing search parameters.';
  if (!Object.hasOwn(TRIP, p.type)) return 'Unknown trip type.';
  if (!Object.hasOwn(CABIN, p.cabin)) return 'Unknown cabin.';
  if (!Array.isArray(p.legs)) return 'Missing flights.';
  const expected = p.type === 'oneway' ? 1 : p.type === 'round' ? 2 : null;
  if (expected !== null ? p.legs.length !== expected : p.legs.length < 2 || p.legs.length > 5) return 'Wrong number of flights for this trip type.';
  for (const l of p.legs) {
    if (!l || !IATA.test(l.from ?? '') || !IATA.test(l.to ?? '') || l.from === l.to) return 'Invalid airport.';
    if (!DATE.test(l.date ?? '')) return 'Invalid date.';
  }
  if (!isInt(p.adults, 1, MAX_PAX) || !isInt(p.children, 0, MAX_PAX) || !isInt(p.infants, 0, MAX_PAX)) return 'Invalid passenger count.';
  if (p.adults + p.children + p.infants > MAX_PAX) return 'Too many travelers.';
  if (p.infants > p.adults) return 'Each infant must travel with an adult.';
  return null;
}

export function validToken(t) {
  return typeof t === 'string' && t.length > 0 && t.length <= MAX_TOKEN;
}

/**
 * Query for one step of a search. `token` is the previous leg's departure token
 * (next leg of a round trip / multi-city) or a booking token.
 * The original search parameters are always resent alongside a token.
 */
export function buildQuery(p, opts = {}) {
  const q = {
    engine: 'google_flights',
    type: TRIP[p.type],
    travel_class: CABIN[p.cabin],
    adults: String(p.adults),
    children: String(p.children),
    infants_on_lap: String(p.infants),
    currency: 'USD',
    hl: 'en',
  };
  if (opts.gl) q.gl = opts.gl;
  if (p.type === 'multi') {
    q.multi_city_json = JSON.stringify(p.legs.map((l) => ({ departure_id: l.from, arrival_id: l.to, date: l.date })));
  } else {
    q.departure_id = p.legs[0].from;
    q.arrival_id = p.legs[0].to;
    q.outbound_date = p.legs[0].date;
    if (p.type === 'round') q.return_date = p.legs[1].date;
  }
  if (opts.departureToken) q.departure_token = opts.departureToken;
  if (opts.bookingToken) {
    q.booking_token = opts.bookingToken;
    // Google Flights usually answers "no results" for a booking_token when `adults=1` is sent
    // explicitly (verified live), although 1 is the default. Larger parties still need the count.
    if (p.adults === 1) delete q.adults;
  }
  return q;
}

const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const strings = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim()) : []);
const httpsUrl = (v) => (typeof v === 'string' && /^https:\/\//i.test(v) ? v : null);
const kg = (grams) => (num(grams) === null ? null : Math.round(grams / 1000));

function normalizeSegment(s) {
  const dep = s?.departure_airport ?? {};
  const arr = s?.arrival_airport ?? {};
  return {
    airline: str(s?.airline) ?? 'Unknown airline',
    airlineLogo: httpsUrl(s?.airline_logo),
    flightNo: str(s?.flight_number) ?? '',
    aircraft: str(s?.airplane),
    cabin: str(s?.travel_class),
    from: str(dep.id) ?? '',
    fromName: str(dep.name) ?? '',
    to: str(arr.id) ?? '',
    toName: str(arr.name) ?? '',
    dep: str(dep.time) ?? '',
    arr: str(arr.time) ?? '',
    durationMin: num(s?.duration) ?? 0,
    legroom: str(s?.legroom),
    extensions: strings(s?.extensions),
    overnight: s?.overnight === true,
    oftenDelayed: s?.often_delayed_by_over_30_min === true,
    operatedBy: str(s?.plane_and_crew_by),
    alsoSoldBy: strings(s?.ticket_also_sold_by),
  };
}

export function normalizeOffer(item, legIndex, best = false) {
  const segments = (Array.isArray(item?.flights) ? item.flights : []).map(normalizeSegment);
  if (segments.length === 0 || !segments[0].dep || !segments[segments.length - 1].arr) return null;
  const layovers = (Array.isArray(item.layovers) ? item.layovers : []).map((l) => ({
    airport: str(l?.id) ?? '',
    name: str(l?.name) ?? '',
    minutes: num(l?.duration) ?? 0,
    overnight: l?.overnight === true,
  }));
  const price = num(item.price);
  const co2 = item.carbon_emissions ?? {};
  const last = segments[segments.length - 1];
  return {
    id: `${legIndex}:${segments.map((s) => `${s.flightNo}@${s.dep}`).join('|')}:${price ?? 'na'}`,
    legIndex,
    best,
    segments,
    layovers,
    airlines: [...new Set(segments.map((s) => s.airline))],
    logo: httpsUrl(item.airline_logo) ?? segments[0].airlineLogo,
    dep: segments[0].dep,
    arr: last.arr,
    durationMin: num(item.total_duration) ?? segments.reduce((n, s) => n + s.durationMin, 0) + layovers.reduce((n, l) => n + l.minutes, 0),
    stops: segments.length - 1,
    priceUsd: price,
    tripType: str(item.type),
    co2Kg: kg(co2.this_flight),
    co2TypicalKg: kg(co2.typical_for_this_route),
    co2DiffPct: num(co2.difference_percent),
    extensions: strings(item.extensions),
    nextToken: str(item.departure_token),
    bookingToken: str(item.booking_token),
  };
}

export function normalizeInsights(pi) {
  if (!pi || typeof pi !== 'object') return null;
  const range = Array.isArray(pi.typical_price_range) ? pi.typical_price_range.filter((n) => num(n) !== null) : [];
  const history = (Array.isArray(pi.price_history) ? pi.price_history : [])
    .filter((row) => Array.isArray(row) && num(row[0]) !== null && num(row[1]) !== null)
    // timestamps are seconds since the epoch
    .map((row) => [row[0] < 1e11 ? row[0] * 1000 : row[0], row[1]]);
  const out = {
    lowestUsd: num(pi.lowest_price),
    level: str(pi.price_level),
    typicalRange: range.length >= 2 ? [range[0], range[1]] : null,
    history,
  };
  return out.lowestUsd === null && out.level === null && out.typicalRange === null && history.length === 0 ? null : out;
}

export function googleUrl(json) {
  return httpsUrl(json?.search_metadata?.google_flights_url);
}

export function normalizeSearch(json, legIndex) {
  const offers = [];
  const seen = new Set();
  for (const [list, best] of [[json?.best_flights, true], [json?.other_flights, false]]) {
    for (const item of Array.isArray(list) ? list : []) {
      const o = normalizeOffer(item, legIndex, best);
      if (o && !seen.has(o.id)) {
        seen.add(o.id);
        offers.push(o);
      }
    }
  }
  return { offers, insights: normalizeInsights(json?.price_insights), googleUrl: googleUrl(json) };
}

function normalizePart(scope, o) {
  if (!o || typeof o !== 'object') return null;
  const req = o.booking_request;
  const url = httpsUrl(req?.url);
  return {
    scope,
    seller: str(o.book_with) ?? 'Booking site',
    isAirline: o.airline === true,
    logos: strings(o.airline_logos).filter((u) => httpsUrl(u)),
    title: str(o.option_title),
    priceUsd: num(o.price),
    flightNos: strings(o.marketed_as),
    extensions: strings(o.extensions),
    baggage: strings(o.baggage_prices),
    request: url ? { url, postData: str(req.post_data) } : null,
    phone: str(o.booking_phone),
    phoneFeeUsd: num(o.estimated_phone_service_fee),
  };
}

export function normalizeBooking(json) {
  const options = [];
  for (const item of Array.isArray(json?.booking_options) ? json.booking_options : []) {
    const parts = [normalizePart('together', item?.together), normalizePart('departing', item?.departing), normalizePart('returning', item?.returning)].filter(Boolean);
    if (parts.length === 0) continue;
    const prices = parts.map((p) => p.priceUsd);
    options.push({
      separate: item.separate_tickets === true || parts.some((p) => p.scope !== 'together'),
      parts,
      totalUsd: prices.every((n) => n !== null) ? prices.reduce((a, b) => a + b, 0) : null,
    });
  }
  options.sort((a, b) => (a.totalUsd ?? Infinity) - (b.totalUsd ?? Infinity));
  const selected = (Array.isArray(json?.selected_flights) ? json.selected_flights : []).map((it, i) => normalizeOffer(it, i)).filter(Boolean);
  const bag = json?.baggage_prices ?? {};
  return {
    options,
    selected,
    baggage: [...strings(bag.together), ...strings(bag.departing), ...strings(bag.returning)],
    insights: normalizeInsights(json?.price_insights),
    googleUrl: googleUrl(json),
  };
}

/** True when SerpApi's `error` text only means "Google had nothing for this query". */
export function isEmptyResult(message) {
  return typeof message === 'string' && /(hasn't|has not|didn't|did not) return(ed)? any results|no results/i.test(message);
}

export function normalizeAccount(json) {
  if (!json || typeof json !== 'object' || json.error) return null;
  return {
    plan: str(json.plan_name),
    searchesPerMonth: num(json.searches_per_month),
    searchesLeft: num(json.total_searches_left) ?? num(json.plan_searches_left),
    usedThisMonth: num(json.this_month_usage),
    usedThisHour: num(json.this_hour_searches),
    hourlyLimit: num(json.account_rate_limit_per_hour),
  };
}
