import { Airline } from '../models/flight.model';

type A = Airline['alliance'];
type Row = [code: string, name: string, country: string, hubs: string[], quality: number, price: number, color: string, alliance: A, flags: string];
// flags: l = low-cost, p = premium economy, f = first class

const ROWS: Row[] = [
  ['EK', 'Emirates', 'AE', ['DXB'], 5, 1.12, '#d71920', null, 'pf'],
  ['QR', 'Qatar Airways', 'QA', ['DOH'], 5, 1.1, '#7a1f45', 'oneworld', 'pf'],
  ['EY', 'Etihad Airways', 'AE', ['AUH'], 4.6, 1.06, '#b08d57', null, 'pf'],
  ['SQ', 'Singapore Airlines', 'SG', ['SIN'], 5, 1.15, '#f2a900', 'Star Alliance', 'pf'],
  ['TK', 'Turkish Airlines', 'TR', ['IST'], 4.3, 0.92, '#c8102e', 'Star Alliance', 'p'],
  ['LH', 'Lufthansa', 'DE', ['FRA', 'MUC'], 4.1, 1.05, '#05164d', 'Star Alliance', 'pf'],
  ['BA', 'British Airways', 'GB', ['LHR', 'LGW'], 4, 1.05, '#2e5c99', 'oneworld', 'pf'],
  ['AF', 'Air France', 'FR', ['CDG'], 4, 1.02, '#1f3a93', 'SkyTeam', 'pf'],
  ['KL', 'KLM', 'NL', ['AMS'], 4.1, 1, '#00a1de', 'SkyTeam', 'p'],
  ['IB', 'Iberia', 'ES', ['MAD'], 3.8, 0.95, '#d7192d', 'oneworld', 'p'],
  ['TP', 'TAP Air Portugal', 'PT', ['LIS'], 3.6, 0.9, '#2a7f62', 'Star Alliance', 'p'],
  ['LX', 'Swiss', 'CH', ['ZRH', 'GVA'], 4.4, 1.1, '#e30613', 'Star Alliance', 'pf'],
  ['OS', 'Austrian', 'AT', ['VIE'], 4, 1, '#c8102e', 'Star Alliance', 'p'],
  ['AY', 'Finnair', 'FI', ['HEL'], 4, 0.98, '#0b1560', 'oneworld', 'p'],
  ['SK', 'SAS', 'DK', ['CPH', 'ARN', 'OSL'], 3.8, 1, '#2b3a8c', 'SkyTeam', 'p'],
  ['EI', 'Aer Lingus', 'IE', ['DUB'], 3.7, 0.88, '#00836f', null, 'p'],
  ['AZ', 'ITA Airways', 'IT', ['FCO', 'MXP', 'VCE'], 3.7, 0.95, '#1c4f9c', 'SkyTeam', 'p'],
  ['A3', 'Aegean', 'GR', ['ATH'], 4, 0.95, '#0a4da2', 'Star Alliance', ''],
  ['FI', 'Icelandair', 'IS', ['KEF'], 3.6, 0.9, '#005da9', null, 'p'],
  ['LO', 'LOT Polish', 'PL', ['WAW'], 3.6, 0.88, '#11397e', 'Star Alliance', ''],
  ['OK', 'Czech Airlines', 'CZ', ['PRG'], 3.4, 0.85, '#d2232a', 'SkyTeam', ''],
  ['AA', 'American Airlines', 'US', ['DFW', 'ORD', 'MIA'], 3.5, 0.97, '#0078d2', 'oneworld', 'p'],
  ['DL', 'Delta Air Lines', 'US', ['ATL', 'JFK', 'LAX', 'SEA', 'BOS'], 3.9, 1, '#c01933', 'SkyTeam', 'p'],
  ['UA', 'United Airlines', 'US', ['ORD', 'EWR', 'IAD', 'SFO', 'IAH', 'DEN'], 3.6, 0.97, '#1d4f91', 'Star Alliance', 'p'],
  ['AC', 'Air Canada', 'CA', ['YYZ', 'YVR', 'YUL'], 3.8, 0.98, '#e2231a', 'Star Alliance', 'p'],
  ['AM', 'Aeroméxico', 'MX', ['MEX', 'CUN'], 3.6, 0.9, '#0b2265', 'SkyTeam', 'p'],
  ['LA', 'LATAM Airlines', 'CL', ['SCL', 'LIM', 'GRU'], 3.8, 0.95, '#e3173e', null, 'p'],
  ['AV', 'Avianca', 'CO', ['BOG'], 3.5, 0.85, '#da291c', 'Star Alliance', 'p'],
  ['AR', 'Aerolíneas Argentinas', 'AR', ['EZE'], 3.3, 0.85, '#0073b7', 'SkyTeam', ''],
  ['CX', 'Cathay Pacific', 'HK', ['HKG'], 4.5, 1.1, '#00645a', 'oneworld', 'pf'],
  ['JL', 'Japan Airlines', 'JP', ['HND', 'NRT', 'KIX'], 4.7, 1.08, '#c8102e', 'oneworld', 'pf'],
  ['NH', 'ANA', 'JP', ['HND', 'NRT', 'KIX'], 4.7, 1.08, '#1b3d8f', 'Star Alliance', 'pf'],
  ['KE', 'Korean Air', 'KR', ['ICN'], 4.4, 1.05, '#00a0e9', 'SkyTeam', 'pf'],
  ['CI', 'China Airlines', 'TW', ['TPE'], 4.2, 0.98, '#b5121b', 'SkyTeam', 'p'],
  ['BR', 'EVA Air', 'TW', ['TPE'], 4.5, 1, '#13805b', 'Star Alliance', 'p'],
  ['MU', 'China Eastern', 'CN', ['PVG'], 3.5, 0.85, '#1e4aa0', 'SkyTeam', 'p'],
  ['CA', 'Air China', 'CN', ['PEK'], 3.5, 0.87, '#c8102e', 'Star Alliance', 'p'],
  ['CZ', 'China Southern', 'CN', ['CAN'], 3.5, 0.85, '#1478c8', 'SkyTeam', 'p'],
  ['TG', 'Thai Airways', 'TH', ['BKK', 'HKT'], 4.1, 0.97, '#5f2a85', 'Star Alliance', 'p'],
  ['MH', 'Malaysia Airlines', 'MY', ['KUL'], 4, 0.92, '#1a3c8f', 'oneworld', 'p'],
  ['GA', 'Garuda Indonesia', 'ID', ['CGK', 'DPS'], 4.2, 0.9, '#0a7fa4', 'SkyTeam', 'p'],
  ['PR', 'Philippine Airlines', 'PH', ['MNL'], 3.6, 0.88, '#2a449b', null, 'p'],
  ['VN', 'Vietnam Airlines', 'VN', ['SGN', 'HAN'], 3.9, 0.88, '#0f6aa6', 'SkyTeam', 'p'],
  ['AI', 'Air India', 'IN', ['DEL', 'BOM', 'BLR'], 3.4, 0.85, '#d6322c', 'Star Alliance', 'p'],
  ['6E', 'IndiGo', 'IN', ['DEL', 'BOM', 'BLR', 'MAA', 'HYD', 'CCU', 'COK'], 3.6, 0.62, '#3a43c8', null, 'l'],
  ['UL', 'SriLankan Airlines', 'LK', ['CMB'], 3.4, 0.85, '#1f3d7a', 'oneworld', ''],
  ['BG', 'Biman Bangladesh', 'BD', ['DAC'], 3, 0.78, '#0a7a3f', null, ''],
  ['RA', 'Nepal Airlines', 'NP', ['KTM'], 3, 0.78, '#c1272d', null, ''],
  ['QF', 'Qantas', 'AU', ['SYD', 'MEL', 'BNE', 'PER'], 4.3, 1.05, '#e40000', 'oneworld', 'pf'],
  ['NZ', 'Air New Zealand', 'NZ', ['AKL'], 4.4, 1.05, '#1b1b1b', 'Star Alliance', 'p'],
  ['SA', 'South African Airways', 'ZA', ['JNB', 'CPT'], 3.6, 0.9, '#1d6a96', 'Star Alliance', 'p'],
  ['ET', 'Ethiopian Airlines', 'ET', ['ADD'], 3.8, 0.82, '#1a7f46', 'Star Alliance', 'p'],
  ['KQ', 'Kenya Airways', 'KE', ['NBO'], 3.5, 0.85, '#b5121b', 'SkyTeam', 'p'],
  ['MS', 'EgyptAir', 'EG', ['CAI'], 3.3, 0.8, '#1f4ea1', 'Star Alliance', ''],
  ['AT', 'Royal Air Maroc', 'MA', ['CMN'], 3.4, 0.82, '#c1272d', 'oneworld', ''],
  ['SV', 'Saudia', 'SA', ['RUH', 'JED'], 3.9, 0.9, '#0a6c4a', 'SkyTeam', 'p'],
  ['RJ', 'Royal Jordanian', 'JO', ['AMM'], 3.6, 0.85, '#8a1538', 'oneworld', ''],
  ['LY', 'El Al', 'IL', ['TLV'], 3.7, 1, '#1b3f94', null, 'p'],
  ['FZ', 'flydubai', 'AE', ['DXB'], 3.4, 0.7, '#e0592a', null, 'l'],
  ['AK', 'AirAsia', 'MY', ['KUL', 'BKK', 'CGK', 'DPS'], 3.2, 0.55, '#e4002b', null, 'l'],
  ['TR', 'Scoot', 'SG', ['SIN'], 3.3, 0.6, '#f5d300', null, 'l'],
];

export const AIRLINES: readonly Airline[] = ROWS.map(([code, name, country, hubs, quality, priceFactor, color, alliance, flags]) => ({
  code,
  name,
  country,
  hubs,
  quality,
  priceFactor,
  color,
  alliance,
  lcc: flags.includes('l'),
  premium: flags.includes('p'),
  first: flags.includes('f'),
}));

const BY_CODE = new Map(AIRLINES.map((a) => [a.code, a] as const));

export function airline(code: string): Airline {
  const a = BY_CODE.get(code);
  if (!a) throw new Error(`Unknown airline ${code}`);
  return a;
}
