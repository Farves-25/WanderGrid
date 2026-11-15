export type Cabin = 'economy' | 'premium' | 'business' | 'first';
export type FareFamily = 'basic' | 'standard' | 'flex';
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

export interface Airline {
  code: string;
  name: string;
  country: string;
  hubs: string[];
  /** 1–5 service rating. */
  quality: number;
  priceFactor: number;
  color: string;
  alliance: 'Star Alliance' | 'oneworld' | 'SkyTeam' | null;
  lcc: boolean;
  premium: boolean;
  first: boolean;
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

export interface AircraftInfo {
  name: string;
  widebody: boolean;
  wifi: boolean;
  power: boolean;
  entertainment: boolean;
}

export interface Segment {
  id: string;
  airline: string;
  flightNo: string;
  aircraft: AircraftInfo;
  from: string;
  to: string;
  depUtc: number;
  arrUtc: number;
  durationMin: number;
  distanceKm: number;
}

export interface Layover {
  airport: string;
  minutes: number;
  overnight: boolean;
}

export interface Fare {
  family: FareFamily;
  /** Per adult, USD, base fare. */
  base: number;
  /** Per adult, USD, taxes & carrier charges. */
  taxes: number;
  /** Per adult, USD, total. */
  total: number;
  checkedBags: number;
  bagKg: number;
  cabinBag: boolean;
  seatSelection: 'paid' | 'free';
  changeFeeUsd: number | null;
  refund: 'none' | 'partial' | 'full';
  cancelFeeUsd: number;
  milesPct: number;
  priorityBoarding: boolean;
}

export interface FlightOffer {
  id: string;
  legIndex: number;
  cabin: Cabin;
  segments: Segment[];
  airlines: string[];
  depUtc: number;
  arrUtc: number;
  durationMin: number;
  stops: number;
  layovers: Layover[];
  seatsLeft: number;
  co2Kg: number;
  onTimePct: number;
  distanceKm: number;
  fares: Record<FareFamily, Fare>;
}

export interface SelectedFlight {
  offer: FlightOffer;
  family: FareFamily;
}

export type PaxType = 'adult' | 'child' | 'infant';

export interface Passenger {
  type: PaxType;
  title: 'Mr' | 'Ms' | 'Mrs' | 'Mx' | '';
  firstName: string;
  lastName: string;
  dob: string;
  gender: 'M' | 'F' | 'X' | '';
  nationality: string;
  passportNo: string;
  passportExpiry: string;
  passportCountry: string;
}

export interface Contact {
  email: string;
  phone: string;
}

export type MealCode = 'standard' | 'vegetarian' | 'vegan' | 'halal' | 'kosher' | 'gluten-free' | 'child';
export type InsurancePlan = 'none' | 'basic' | 'plus';

export interface Extras {
  /** key: `${legIndex}|${paxIndex}` → extra checked bags */
  bags: Record<string, number>;
  /** key: `${segmentId}|${paxIndex}` → seat label */
  seats: Record<string, string>;
  /** key: `${segmentId}|${paxIndex}` → meal */
  meals: Record<string, MealCode>;
  insurance: InsurancePlan;
  priority: boolean;
  offset: boolean;
}

export interface PriceLine {
  label: string;
  usd: number;
}

export interface Pricing {
  fare: number;
  taxes: number;
  seats: number;
  bags: number;
  insurance: number;
  priority: number;
  offset: number;
  discount: number;
  totalUsd: number;
}

export interface BookingEvent {
  at: string;
  text: string;
}

export interface Booking {
  id: string;
  userId: string;
  ref: string;
  status: 'confirmed' | 'cancelled';
  createdAt: string;
  params: SearchParams;
  legs: SelectedFlight[];
  passengers: Passenger[];
  contact: Contact;
  extras: Extras;
  pricing: Pricing;
  currency: string;
  rate: number;
  promo: string | null;
  payment: { brand: string; last4: string };
  tickets: string[];
  checkedIn: Record<number, boolean>;
  events: BookingEvent[];
  milesEarned: number;
  refundedUsd: number;
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
}

export interface SavedTraveler extends Passenger {
  id: string;
}

export const CABIN_LABEL: Record<Cabin, string> = {
  economy: 'Economy',
  premium: 'Premium Economy',
  business: 'Business',
  first: 'First',
};

export const FAMILY_LABEL: Record<FareFamily, string> = {
  basic: 'Basic',
  standard: 'Standard',
  flex: 'Flex',
};

export const MEAL_LABEL: Record<MealCode, string> = {
  standard: 'Regular meal',
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  halal: 'Halal',
  kosher: 'Kosher',
  'gluten-free': 'Gluten-free',
  child: "Child's meal",
};

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
