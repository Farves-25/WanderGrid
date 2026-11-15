import { Cabin, Fare, Passenger, Segment } from '../models/flight.model';
import { hashString, rng } from './prng';

export type SeatKind = 'standard' | 'extra' | 'exit' | 'front';

export interface Seat {
  label: string;
  row: number;
  col: string;
  kind: SeatKind;
  taken: boolean;
  /** Price in USD before fare-family allowances. */
  priceUsd: number;
}

export interface SeatRow {
  row: number;
  /** One entry per column group; null marks the aisle. */
  cells: (Seat | null)[];
}

export interface SeatMap {
  cabin: Cabin;
  groups: string[];
  rows: SeatRow[];
  exitRows: number[];
}

interface Layout {
  groups: string[];
  startRow: number;
  rows: number;
  exits: number[];
}

function layoutFor(segment: Segment, cabin: Cabin): Layout {
  const wide = segment.aircraft.widebody;
  const big777 = segment.aircraft.name.includes('777') || segment.aircraft.name.includes('A380');
  switch (cabin) {
    case 'first':
      return { groups: ['A', 'K'], startRow: 1, rows: 4, exits: [] };
    case 'business':
      return wide ? { groups: ['A', 'DG', 'K'], startRow: 1, rows: 8, exits: [] } : { groups: ['AC', 'DF'], startRow: 1, rows: 5, exits: [] };
    case 'premium':
      return { groups: ['AC', 'DEFG', 'HK'], startRow: 20, rows: 6, exits: [] };
    default:
      return wide
        ? { groups: big777 ? ['ABC', 'DEFG', 'HJK'] : ['ABC', 'DEF', 'GHJ'], startRow: 30, rows: 22, exits: [38, 39] }
        : { groups: ['ABC', 'DEF'], startRow: 8, rows: 22, exits: [12, 13] };
  }
}

function basePrice(distance: number): number {
  return distance < 1500 ? 9 : distance < 4000 ? 18 : distance < 8000 ? 28 : 42;
}

/** Deterministic cabin seat map; fuller flights have fewer free seats. */
export function buildSeatMap(segment: Segment, cabin: Cabin, seatsLeft: number): SeatMap {
  const layout = layoutFor(segment, cabin);
  const r = rng(`seatmap|${segment.id}|${cabin}`);
  const premiumCabin = cabin === 'business' || cabin === 'first';
  const fill = Math.min(0.88, Math.max(0.3, 0.42 + (9 - seatsLeft) * 0.055 + (premiumCabin ? -0.12 : 0)));
  const price = premiumCabin || cabin === 'premium' ? 0 : basePrice(segment.distanceKm);
  const rows: SeatRow[] = [];
  for (let i = 0; i < layout.rows; i++) {
    const row = layout.startRow + i;
    const exit = layout.exits.includes(row);
    const bulkhead = i === 0;
    const kind: SeatKind = exit ? 'exit' : bulkhead ? 'extra' : i < 4 && !premiumCabin && cabin === 'economy' ? 'front' : 'standard';
    const mult = kind === 'extra' ? 2.4 : kind === 'exit' ? 1.9 : kind === 'front' ? 1.4 : 1;
    const cells: (Seat | null)[] = [];
    layout.groups.forEach((g, gi) => {
      if (gi > 0) cells.push(null);
      for (const col of g) {
        cells.push({
          label: `${row}${col}`,
          row,
          col,
          kind,
          taken: r.next() < fill,
          priceUsd: Math.round(price * mult),
        });
      }
    });
    rows.push({ row, cells });
  }
  return { cabin, groups: layout.groups, rows, exitRows: layout.exits };
}

/** What a passenger actually pays for a seat given their fare family. */
export function seatCharge(seat: Seat, fare: Fare, cabin: Cabin): number {
  if (cabin !== 'economy') return 0;
  if (fare.family === 'flex') return 0;
  if (fare.family === 'standard') return seat.kind === 'standard' ? 0 : seat.priceUsd;
  return seat.priceUsd;
}

export function seatAllowed(seat: Seat, pax: Passenger): boolean {
  return !(seat.kind === 'exit' && pax.type !== 'adult');
}

export function allSeats(map: SeatMap): Seat[] {
  return map.rows.flatMap((r) => r.cells.filter((c): c is Seat => c !== null));
}

/** First free, allowed seat (used by check-in auto-assignment). */
export function autoSeat(map: SeatMap, pax: Passenger, taken: Set<string>): string | null {
  const seats = allSeats(map).filter((s) => !s.taken && !taken.has(s.label) && seatAllowed(s, pax) && s.kind === 'standard');
  if (seats.length === 0) return null;
  const idx = hashString(pax.lastName + pax.firstName) % seats.length;
  return seats[idx].label;
}
