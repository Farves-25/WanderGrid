import { Airport, DstRule } from '../models/flight.model';

type Row = [code: string, city: string, name: string, country: string, cc: string, lat: number, lon: number, tz: number, dst: DstRule];

const ROWS: Row[] = [
  // North America
  ['JFK', 'New York', 'John F. Kennedy Intl', 'United States', 'US', 40.64, -73.78, -5, 'us'],
  ['EWR', 'New York', 'Newark Liberty Intl', 'United States', 'US', 40.69, -74.17, -5, 'us'],
  ['LAX', 'Los Angeles', 'Los Angeles Intl', 'United States', 'US', 33.94, -118.41, -8, 'us'],
  ['SFO', 'San Francisco', 'San Francisco Intl', 'United States', 'US', 37.62, -122.38, -8, 'us'],
  ['ORD', 'Chicago', "O'Hare Intl", 'United States', 'US', 41.98, -87.9, -6, 'us'],
  ['ATL', 'Atlanta', 'Hartsfield-Jackson Intl', 'United States', 'US', 33.64, -84.43, -5, 'us'],
  ['DFW', 'Dallas', 'Dallas/Fort Worth Intl', 'United States', 'US', 32.9, -97.04, -6, 'us'],
  ['MIA', 'Miami', 'Miami Intl', 'United States', 'US', 25.79, -80.29, -5, 'us'],
  ['BOS', 'Boston', 'Logan Intl', 'United States', 'US', 42.36, -71.01, -5, 'us'],
  ['SEA', 'Seattle', 'Seattle-Tacoma Intl', 'United States', 'US', 47.45, -122.31, -8, 'us'],
  ['IAD', 'Washington', 'Dulles Intl', 'United States', 'US', 38.95, -77.46, -5, 'us'],
  ['DEN', 'Denver', 'Denver Intl', 'United States', 'US', 39.86, -104.67, -7, 'us'],
  ['LAS', 'Las Vegas', 'Harry Reid Intl', 'United States', 'US', 36.08, -115.15, -8, 'us'],
  ['IAH', 'Houston', 'George Bush Intercontinental', 'United States', 'US', 29.98, -95.34, -6, 'us'],
  ['HNL', 'Honolulu', 'Daniel K. Inouye Intl', 'United States', 'US', 21.32, -157.92, -10, 'none'],
  ['YYZ', 'Toronto', 'Pearson Intl', 'Canada', 'CA', 43.68, -79.63, -5, 'us'],
  ['YVR', 'Vancouver', 'Vancouver Intl', 'Canada', 'CA', 49.19, -123.18, -8, 'us'],
  ['YUL', 'Montréal', 'Trudeau Intl', 'Canada', 'CA', 45.47, -73.74, -5, 'us'],
  ['MEX', 'Mexico City', 'Benito Juárez Intl', 'Mexico', 'MX', 19.44, -99.07, -6, 'none'],
  ['CUN', 'Cancún', 'Cancún Intl', 'Mexico', 'MX', 21.04, -86.87, -5, 'none'],
  // South America
  ['GRU', 'São Paulo', 'Guarulhos Intl', 'Brazil', 'BR', -23.43, -46.47, -3, 'none'],
  ['GIG', 'Rio de Janeiro', 'Galeão Intl', 'Brazil', 'BR', -22.81, -43.25, -3, 'none'],
  ['EZE', 'Buenos Aires', 'Ministro Pistarini Intl', 'Argentina', 'AR', -34.82, -58.54, -3, 'none'],
  ['SCL', 'Santiago', 'Arturo Merino Benítez Intl', 'Chile', 'CL', -33.39, -70.79, -4, 'none'],
  ['BOG', 'Bogotá', 'El Dorado Intl', 'Colombia', 'CO', 4.7, -74.15, -5, 'none'],
  ['LIM', 'Lima', 'Jorge Chávez Intl', 'Peru', 'PE', -12.02, -77.11, -5, 'none'],
  // Europe
  ['LHR', 'London', 'Heathrow', 'United Kingdom', 'GB', 51.47, -0.45, 0, 'eu'],
  ['LGW', 'London', 'Gatwick', 'United Kingdom', 'GB', 51.15, -0.18, 0, 'eu'],
  ['CDG', 'Paris', 'Charles de Gaulle', 'France', 'FR', 49.01, 2.55, 1, 'eu'],
  ['AMS', 'Amsterdam', 'Schiphol', 'Netherlands', 'NL', 52.31, 4.76, 1, 'eu'],
  ['FRA', 'Frankfurt', 'Frankfurt Airport', 'Germany', 'DE', 50.03, 8.57, 1, 'eu'],
  ['MUC', 'Munich', 'Munich Airport', 'Germany', 'DE', 48.35, 11.79, 1, 'eu'],
  ['BER', 'Berlin', 'Brandenburg', 'Germany', 'DE', 52.36, 13.5, 1, 'eu'],
  ['MAD', 'Madrid', 'Barajas', 'Spain', 'ES', 40.49, -3.57, 1, 'eu'],
  ['BCN', 'Barcelona', 'El Prat', 'Spain', 'ES', 41.3, 2.08, 1, 'eu'],
  ['LIS', 'Lisbon', 'Humberto Delgado', 'Portugal', 'PT', 38.78, -9.14, 0, 'eu'],
  ['FCO', 'Rome', 'Fiumicino', 'Italy', 'IT', 41.8, 12.25, 1, 'eu'],
  ['MXP', 'Milan', 'Malpensa', 'Italy', 'IT', 45.63, 8.72, 1, 'eu'],
  ['VCE', 'Venice', 'Marco Polo', 'Italy', 'IT', 45.51, 12.35, 1, 'eu'],
  ['ZRH', 'Zurich', 'Zurich Airport', 'Switzerland', 'CH', 47.46, 8.55, 1, 'eu'],
  ['GVA', 'Geneva', 'Geneva Airport', 'Switzerland', 'CH', 46.24, 6.11, 1, 'eu'],
  ['VIE', 'Vienna', 'Schwechat', 'Austria', 'AT', 48.11, 16.57, 1, 'eu'],
  ['CPH', 'Copenhagen', 'Kastrup', 'Denmark', 'DK', 55.62, 12.66, 1, 'eu'],
  ['ARN', 'Stockholm', 'Arlanda', 'Sweden', 'SE', 59.65, 17.92, 1, 'eu'],
  ['OSL', 'Oslo', 'Gardermoen', 'Norway', 'NO', 60.19, 11.1, 1, 'eu'],
  ['HEL', 'Helsinki', 'Vantaa', 'Finland', 'FI', 60.32, 24.96, 2, 'eu'],
  ['KEF', 'Reykjavík', 'Keflavík Intl', 'Iceland', 'IS', 63.99, -22.62, 0, 'none'],
  ['DUB', 'Dublin', 'Dublin Airport', 'Ireland', 'IE', 53.43, -6.27, 0, 'eu'],
  ['ATH', 'Athens', 'Eleftherios Venizelos', 'Greece', 'GR', 37.94, 23.95, 2, 'eu'],
  ['IST', 'Istanbul', 'Istanbul Airport', 'Türkiye', 'TR', 41.26, 28.74, 3, 'none'],
  ['WAW', 'Warsaw', 'Chopin', 'Poland', 'PL', 52.17, 20.97, 1, 'eu'],
  ['PRG', 'Prague', 'Václav Havel', 'Czechia', 'CZ', 50.1, 14.26, 1, 'eu'],
  ['BUD', 'Budapest', 'Ferenc Liszt', 'Hungary', 'HU', 47.44, 19.26, 1, 'eu'],
  // Middle East & Africa
  ['DXB', 'Dubai', 'Dubai Intl', 'United Arab Emirates', 'AE', 25.25, 55.36, 4, 'none'],
  ['AUH', 'Abu Dhabi', 'Zayed Intl', 'United Arab Emirates', 'AE', 24.43, 54.65, 4, 'none'],
  ['DOH', 'Doha', 'Hamad Intl', 'Qatar', 'QA', 25.27, 51.61, 3, 'none'],
  ['RUH', 'Riyadh', 'King Khalid Intl', 'Saudi Arabia', 'SA', 24.96, 46.7, 3, 'none'],
  ['JED', 'Jeddah', 'King Abdulaziz Intl', 'Saudi Arabia', 'SA', 21.68, 39.16, 3, 'none'],
  ['TLV', 'Tel Aviv', 'Ben Gurion', 'Israel', 'IL', 32.01, 34.89, 2, 'none'],
  ['AMM', 'Amman', 'Queen Alia Intl', 'Jordan', 'JO', 31.72, 35.99, 3, 'none'],
  ['CAI', 'Cairo', 'Cairo Intl', 'Egypt', 'EG', 30.12, 31.41, 2, 'none'],
  ['CMN', 'Casablanca', 'Mohammed V Intl', 'Morocco', 'MA', 33.37, -7.59, 1, 'none'],
  ['JNB', 'Johannesburg', 'O. R. Tambo Intl', 'South Africa', 'ZA', -26.14, 28.25, 2, 'none'],
  ['CPT', 'Cape Town', 'Cape Town Intl', 'South Africa', 'ZA', -33.97, 18.6, 2, 'none'],
  ['NBO', 'Nairobi', 'Jomo Kenyatta Intl', 'Kenya', 'KE', -1.32, 36.93, 3, 'none'],
  ['ADD', 'Addis Ababa', 'Bole Intl', 'Ethiopia', 'ET', 8.98, 38.8, 3, 'none'],
  ['LOS', 'Lagos', 'Murtala Muhammed Intl', 'Nigeria', 'NG', 6.58, 3.32, 1, 'none'],
  // Asia
  ['DEL', 'Delhi', 'Indira Gandhi Intl', 'India', 'IN', 28.56, 77.1, 5.5, 'none'],
  ['BOM', 'Mumbai', 'Chhatrapati Shivaji Intl', 'India', 'IN', 19.09, 72.87, 5.5, 'none'],
  ['BLR', 'Bengaluru', 'Kempegowda Intl', 'India', 'IN', 13.2, 77.71, 5.5, 'none'],
  ['MAA', 'Chennai', 'Chennai Intl', 'India', 'IN', 12.99, 80.17, 5.5, 'none'],
  ['HYD', 'Hyderabad', 'Rajiv Gandhi Intl', 'India', 'IN', 17.24, 78.43, 5.5, 'none'],
  ['CCU', 'Kolkata', 'Netaji Subhas Chandra Bose Intl', 'India', 'IN', 22.65, 88.45, 5.5, 'none'],
  ['COK', 'Kochi', 'Cochin Intl', 'India', 'IN', 10.15, 76.4, 5.5, 'none'],
  ['CMB', 'Colombo', 'Bandaranaike Intl', 'Sri Lanka', 'LK', 7.18, 79.88, 5.5, 'none'],
  ['DAC', 'Dhaka', 'Hazrat Shahjalal Intl', 'Bangladesh', 'BD', 23.84, 90.4, 6, 'none'],
  ['KTM', 'Kathmandu', 'Tribhuvan Intl', 'Nepal', 'NP', 27.7, 85.36, 5.75, 'none'],
  ['MLE', 'Malé', 'Velana Intl', 'Maldives', 'MV', 4.19, 73.53, 5, 'none'],
  ['BKK', 'Bangkok', 'Suvarnabhumi', 'Thailand', 'TH', 13.69, 100.75, 7, 'none'],
  ['HKT', 'Phuket', 'Phuket Intl', 'Thailand', 'TH', 8.11, 98.32, 7, 'none'],
  ['SIN', 'Singapore', 'Changi', 'Singapore', 'SG', 1.36, 103.99, 8, 'none'],
  ['KUL', 'Kuala Lumpur', 'Kuala Lumpur Intl', 'Malaysia', 'MY', 2.75, 101.71, 8, 'none'],
  ['CGK', 'Jakarta', 'Soekarno-Hatta', 'Indonesia', 'ID', -6.13, 106.66, 7, 'none'],
  ['DPS', 'Bali', 'Ngurah Rai Intl', 'Indonesia', 'ID', -8.75, 115.17, 8, 'none'],
  ['MNL', 'Manila', 'Ninoy Aquino Intl', 'Philippines', 'PH', 14.51, 121.02, 8, 'none'],
  ['SGN', 'Ho Chi Minh City', 'Tan Son Nhat Intl', 'Vietnam', 'VN', 10.82, 106.66, 7, 'none'],
  ['HAN', 'Hanoi', 'Noi Bai Intl', 'Vietnam', 'VN', 21.22, 105.81, 7, 'none'],
  ['HKG', 'Hong Kong', 'Hong Kong Intl', 'Hong Kong SAR', 'HK', 22.31, 113.91, 8, 'none'],
  ['TPE', 'Taipei', 'Taoyuan Intl', 'Taiwan', 'TW', 25.08, 121.23, 8, 'none'],
  ['PEK', 'Beijing', 'Capital Intl', 'China', 'CN', 40.08, 116.59, 8, 'none'],
  ['PVG', 'Shanghai', 'Pudong Intl', 'China', 'CN', 31.14, 121.81, 8, 'none'],
  ['CAN', 'Guangzhou', 'Baiyun Intl', 'China', 'CN', 23.39, 113.3, 8, 'none'],
  ['ICN', 'Seoul', 'Incheon Intl', 'South Korea', 'KR', 37.46, 126.44, 9, 'none'],
  ['NRT', 'Tokyo', 'Narita Intl', 'Japan', 'JP', 35.77, 140.39, 9, 'none'],
  ['HND', 'Tokyo', 'Haneda', 'Japan', 'JP', 35.55, 139.78, 9, 'none'],
  ['KIX', 'Osaka', 'Kansai Intl', 'Japan', 'JP', 34.43, 135.24, 9, 'none'],
  // Oceania
  ['SYD', 'Sydney', 'Kingsford Smith', 'Australia', 'AU', -33.94, 151.18, 10, 'au'],
  ['MEL', 'Melbourne', 'Tullamarine', 'Australia', 'AU', -37.67, 144.84, 10, 'au'],
  ['BNE', 'Brisbane', 'Brisbane Airport', 'Australia', 'AU', -27.38, 153.12, 10, 'none'],
  ['PER', 'Perth', 'Perth Airport', 'Australia', 'AU', -31.94, 115.97, 8, 'none'],
  ['AKL', 'Auckland', 'Auckland Airport', 'New Zealand', 'NZ', -37.01, 174.79, 12, 'nz'],
];

export const AIRPORTS: readonly Airport[] = ROWS.map(([code, city, name, country, cc, lat, lon, tz, dst]) => ({
  code,
  city,
  name,
  country,
  cc,
  lat,
  lon,
  tz,
  dst,
}));

const BY_CODE = new Map(AIRPORTS.map((a) => [a.code, a] as const));

export function airport(code: string): Airport {
  const a = BY_CODE.get(code);
  if (!a) throw new Error(`Unknown airport ${code}`);
  return a;
}

export function findAirport(code: string | null | undefined): Airport | undefined {
  return code ? BY_CODE.get(code.toUpperCase()) : undefined;
}

export function distanceKm(a: Airport, b: Airport): number {
  const R = 6371;
  const toRad = (d: number): number => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(h))));
}

function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Ranks airports for an autocomplete query: exact code, city prefix, then any substring. */
export function searchAirports(query: string, limit = 8): Airport[] {
  const q = norm(query.trim());
  if (!q) return [];
  const scored: { a: Airport; s: number }[] = [];
  for (const a of AIRPORTS) {
    const code = a.code.toLowerCase();
    const city = norm(a.city);
    const name = norm(a.name);
    const country = norm(a.country);
    let s = 0;
    if (code === q) s = 100;
    else if (city === q) s = 90;
    else if (city.startsWith(q)) s = 80;
    else if (code.startsWith(q)) s = 70;
    else if (name.startsWith(q)) s = 60;
    else if (city.includes(q) || name.includes(q)) s = 40;
    else if (country.startsWith(q)) s = 30;
    else if (country.includes(q)) s = 20;
    if (s > 0) scored.push({ a, s });
  }
  return scored.sort((x, y) => y.s - x.s || x.a.city.localeCompare(y.a.city)).slice(0, limit).map((x) => x.a);
}

/** Airports popular enough to pre-suggest when the field is empty. */
export const POPULAR_CODES = ['LHR', 'JFK', 'DXB', 'SIN', 'CDG', 'LAX', 'HND', 'SYD'] as const;
