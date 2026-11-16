export type Cabin = 'economy' | 'premium' | 'business' | 'first';
export type TripType = 'oneway' | 'round' | 'multi';
export type DstRule = 'eu' | 'us' | 'au' | 'nz' | 'none';

export interface Airport {
  code: string;
  city: string;
  name: string;
  country: string;
  cc: string;
  lat: number;
  lon: number;
  /** Standard UTC offset in hours. */
  tz: number;
  dst: DstRule;
}

export interface SearchLeg {
  from: string;
  to: string;
  /** YYYY-MM-DD, local date at the origin. */
  date: string;
}

export interface SearchParams {
  type: TripType;
  legs: SearchLeg[];
  adults: number;
  children: number;
  infants: number;
  cabin: Cabin;
}

/** One flight of an itinerary, as published by the airline. Times are local to each airport: `YYYY-MM-DD HH:MM`. */
export interface Segment {
  airline: string;
  airlineLogo: string | null;
  /** e.g. "BA 117" */
  flightNo: string;
  aircraft: string | null;
  cabin: string | null;
  from: string;
  fromName: string;
  to: string;
  toName: string;
  dep: string;
  arr: string;
  durationMin: number;
  legroom: string | null;
  /** Amenity notes from the airline, e.g. "Wi-Fi for a fee", "In-seat power outlet". */
  extensions: string[];
  overnight: boolean;
  oftenDelayed: boolean;
  operatedBy: string | null;
  alsoSoldBy: string[];
}

export interface Layover {
  airport: string;
  name: string;
  minutes: number;
  overnight: boolean;
}

/** A live itinerary for one leg of the trip. */
export interface FlightOffer {
  id: string;
  legIndex: number;
  /** Listed by Google Flights among its "best" options. */
  best: boolean;
  segments: Segment[];
  layovers: Layover[];
  /** Airline names, in order of appearance. */
  airlines: string[];
  logo: string | null;
  dep: string;
  arr: string;
  durationMin: number;
  stops: number;
  /** Price in USD for the whole trip and all travelers, or null when the airline doesn't publish one. */
  priceUsd: number | null;
  /** "Round trip", "One way" … as labelled by the source. */
  tripType: string | null;
  co2Kg: number | null;
  co2TypicalKg: number | null;
  co2DiffPct: number | null;
  extensions: string[];
  /** Token that unlocks the next leg's flights (round trip / multi-city). */
  nextToken: string | null;
  /** Token that unlocks the list of booking sites. Present on the final leg. */
  bookingToken: string | null;
}

export interface PriceInsights {
  lowestUsd: number | null;
  /** "low" | "typical" | "high" */
  level: string | null;
  typicalRange: [number, number] | null;
  /** [epoch ms, USD] oldest → newest */
  history: [number, number][];
}

export interface SearchResult {
  offers: FlightOffer[];
  insights: PriceInsights | null;
  googleUrl: string | null;
  fetchedAt: number;
  cached: boolean;
}

export interface BookingRequest {
  url: string;
  /** URL-encoded form body to POST to `url`; null means a plain link. */
  postData: string | null;
}

export interface BookingPart {
  scope: 'together' | 'departing' | 'returning';
  seller: string;
  isAirline: boolean;
  logos: string[];
  /** Fare name, e.g. "Basic Economy". */
  title: string | null;
  priceUsd: number | null;
  flightNos: string[];
  extensions: string[];
  baggage: string[];
  request: BookingRequest | null;
  phone: string | null;
  phoneFeeUsd: number | null;
}

export interface BookingOption {
  /** True when outbound and return are sold as two separate tickets. */
  separate: boolean;
  parts: BookingPart[];
  totalUsd: number | null;
}

export interface BookingResult {
  options: BookingOption[];
  selected: FlightOffer[];
  baggage: string[];
  insights: PriceInsights | null;
  googleUrl: string | null;
  fetchedAt: number;
  cached: boolean;
}

export interface ApiAccount {
  plan: string | null;
  searchesPerMonth: number | null;
  searchesLeft: number | null;
  usedThisMonth: number | null;
  usedThisHour: number | null;
  hourlyLimit: number | null;
}

export interface ApiStatus {
  configured: boolean;
  keyValid?: boolean;
  account: ApiAccount | null;
}

export interface PricePoint {
  /** ISO timestamp of the observation. */
  at: string;
  usd: number;
}

export interface PriceAlert {
  id: string;
  userId: string;
  from: string;
  to: string;
  date: string;
  returnDate: string | null;
  cabin: Cabin;
  targetUsd: number;
  createdAt: string;
  createdPriceUsd: number;
  /** Lowest live price seen each time the route was checked (1 adult). */
  observations: PricePoint[];
  /** Google Flights' own price history for the route at the last check. */
  history: [number, number][];
  level: string | null;
  typicalRange: [number, number] | null;
  lastCheckedAt: string;
}

export interface SavedTrip {
  id: string;
  userId: string;
  savedAt: string;
  params: SearchParams;
  legs: FlightOffer[];
  priceUsd: number | null;
  googleUrl: string | null;
}

export interface RecentSearch {
  params: SearchParams;
  at: string;
  /** Lowest live price seen for this search, USD. */
  lowestUsd: number | null;
}

export const CABIN_LABEL: Record<Cabin, string> = {
  economy: 'Economy',
  premium: 'Premium Economy',
  business: 'Business',
  first: 'First',
};

/** Display currencies. `rate` is only a fallback for when live exchange rates can't be loaded. */
export const CURRENCIES: readonly { code: string; name: string; rate: number }[] = [
  { code: 'USD', name: 'US Dollar', rate: 1 },
  { code: 'EUR', name: 'Euro', rate: 0.92 },
  { code: 'GBP', name: 'British Pound', rate: 0.79 },
  { code: 'INR', name: 'Indian Rupee', rate: 83.5 },
  { code: 'AED', name: 'UAE Dirham', rate: 3.67 },
  { code: 'JPY', name: 'Japanese Yen', rate: 150 },
  { code: 'AUD', name: 'Australian Dollar', rate: 1.52 },
  { code: 'CAD', name: 'Canadian Dollar', rate: 1.36 },
  { code: 'SGD', name: 'Singapore Dollar', rate: 1.34 },
  { code: 'CHF', name: 'Swiss Franc', rate: 0.88 },
] as const;
