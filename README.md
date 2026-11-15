# WanderGrid — International flight booking

A complete flight-booking platform built with Angular 22 (standalone components, signals, zoneless), Tailwind CSS 4, Lucide icons and a service-worker PWA.

> **Simulated, not real.** Flights, fares, availability and payments come from a realistic built-in simulation engine. No real tickets are issued and no card is ever charged. The engine sits behind `FlightSearchService`, so a live provider (Duffel, Amadeus…) can be swapped in later.

## Features

**Search**
- Round trip, one way and multi-city (up to 5 flights); adults, children and infants; four cabin classes
- Accessible airport autocomplete (100+ international airports, ARIA combobox), swap button, validated dates
- ~60 airlines with believable networks, hubs, aircraft, connections (layovers), time zones **with daylight saving**, durations and CO₂
- Prices that react to lead time, weekday, season, cabin, airline and fare family; stable per day so results are repeatable
- Results with filters (stops, price, duration, departure time, airlines), sorting (best / cheapest / fastest / earliest), a ±3-day fare calendar and "Best / Cheapest / Fastest" badges
- Leg-by-leg selection for round-trip and multi-city; Basic / Standard / Flex fare families with clear baggage, change and refund rules
- Price alerts with a 14-day price chart and "target reached" status

**Checkout**
- Passenger forms with international-travel validation: name rules, age bands (adult / child / infant), passport expiry ≥ 6 months after the last flight
- Saved travelers with autofill; contact details
- Interactive seat maps per flight segment (extra legroom, exit rows restricted to adults, occupied seats, fare-based pricing)
- Extra checked bags, special meals, travel insurance (incl. cancel-for-any-reason), priority boarding, carbon offset
- Promo codes (`WANDER10`, `WELCOME25`, `FLYHIGH75`, `EARLYBIRD`) with rule validation
- Payment: Luhn / expiry / CVC validation, brand detection, simulated 3-D Secure challenge, declines and insufficient-funds cases

**After booking**
- Instant confirmation, PNR, e-ticket numbers, payment summary, WanderMiles & tiers
- Online check-in (opens 48 h before, closes 1 h before) with real, scannable **QR boarding passes** (gate, terminal, boarding time, seat)
- Change a flight (fare difference + change fee, or refund) and cancel (24-hour risk-free cancellation, otherwise fare-rule refunds)
- Add to calendar (`.ics`), print e-ticket, activity timeline

**Platform**
- Installable offline PWA — bookings, e-tickets and boarding passes work without a connection
- Light / dark themes, 10 display currencies, WCAG AA, AXE-clean, reduced-motion friendly, responsive down to phones

## Demo payment cards

| Card | Result |
| --- | --- |
| `4242 4242 4242 4242` | Approved |
| `4000 0000 0000 3220` | 3-D Secure challenge (code `123456`) |
| `4000 0000 0000 0002` | Declined |
| `4000 0000 0000 9995` | Insufficient funds |

Any future expiry and CVC. Orders over $1,500 always trigger 3-D Secure.

## Running

```bash
npm install
npm start          # http://localhost:4200
npm test           # unit tests (vitest)
npm run build      # production build incl. service worker
```

The service worker only runs in production builds — serve `dist/WanderGrid/browser` to try offline mode.

## Accounts & data

Demo accounts (salted + hashed password) and all bookings live in the browser's `localStorage`; nothing leaves the device. Replace `AuthService` / `BookingsService` with a real backend for production.

## Structure

```text
src/app/
├── core/
│   ├── data/        airports.ts, airlines.ts
│   ├── engine/      flight-engine.ts, seatmap.ts, time.ts (tz + DST), prng.ts
│   ├── models/      flight.model.ts
│   ├── services/    flight-search, booking-flow, bookings, alerts, travelers, auth, preferences …
│   └── util/        search-query, passenger-validation, card, ics, flight-format
├── features/        home, results, checkout, bookings, alerts, account, auth
└── shared/components/ icon, modal, airport-combobox, passenger-picker, search-form, qr-code, airline-chip …
```
