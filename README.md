# WanderGrid — Live flight search

Search real flight schedules and prices, see whether today's fare is a good one, and hand off to the airline or travel site that sells it. Built with Angular 22 (standalone components, signals, zoneless), Tailwind CSS 4, Lucide icons, a service-worker PWA and a small Node API server.

> **Real data, real sellers.** Flights and prices come live from Google Flights through [SerpApi](https://serpapi.com/google-flights-api). WanderGrid doesn't sell tickets or take payment: **Book now** opens the seller's own website, which confirms the final price.

## Setup

1. Create a free SerpApi account and copy your key from <https://serpapi.com/manage-api-key>.
2. Copy `.env.example` to `.env` and set `SERPAPI_KEY=...` (`.env` is git-ignored — the key never reaches the browser).
3. Install and run:

```bash
npm install
npm start          # API server on :8787 + Angular dev server on http://localhost:4200
```

Without a key the app still runs and shows setup instructions instead of results.

| Command | What it does |
| --- | --- |
| `npm start` | API server and Angular dev server together (the dev server proxies `/api`) |
| `npm run build` | Production build incl. service worker |
| `npm run serve` | Serves the production build **and** the API from one port (8787) |
| `npm test` | Angular unit tests (vitest) + server tests (`node --test`) |

## Search quota

SerpApi's free plan allows a limited number of searches per month (see **Account → Live data** in the app for your live usage). Each of these uses one search:

- every leg of a search (a round trip is two: outbound, then return)
- opening the booking sites for a chosen itinerary
- **Refresh**, **Track price** for a different passenger count, and **Check now** on an alert

Repeats are free: the server caches searches for 30 minutes, the browser for 20, and SerpApi itself for an hour.

## Features

**Search**
- Round trip, one way and multi-city (up to 5 flights); adults, children and infants; four cabin classes
- Accessible airport autocomplete (100+ international airports), swap button, validated dates
- Live results: airline logos, flight numbers, aircraft, legroom, amenities, layovers, overnight and "often delayed" warnings, CO₂ compared with the route's typical figure
- Filters (stops, price, duration, departure time, airlines) and sorting (Google's best / cheapest / fastest / earliest)
- Price insights from Google Flights: lowest price, low / typical / high level, usual range and price-history chart
- Leg-by-leg selection for round-trip and multi-city trips

**Booking**
- Every airline and travel site selling the chosen itinerary, with its price, fare name, baggage and fare conditions
- **Book now** hands off to the seller's site in a new tab; separate-ticket and phone-only options are labelled
- "View on Google Flights" fallback, copyable search link

**Keep track**
- Saved trips (itinerary and the price when saved) and recent searches with the lowest price seen
- Price alerts on live fares: target price, change since tracking, price chart, "Check now"
- Local accounts (salted + hashed password) — accounts, saved trips and alerts live in this browser's `localStorage`

**Platform**
- Display prices in 10 currencies using live exchange rates
- Installable PWA; saved trips and alerts are readable offline (live prices need a connection)
- Light / dark themes, WCAG AA, reduced-motion friendly, responsive down to phones

## How it fits together

```text
browser ──/api──▶ server/index.mjs ──▶ serpapi.com (Google Flights)
                        │
                        └──▶ open.er-api.com (exchange rates)
```

```text
server/
├── index.mjs         HTTP server: /api/flights/search, /api/flights/booking, /api/status, /api/rates, static files
├── serpapi.mjs       request validation, query building, response normalisation (pure)
└── serpapi.test.mjs
src/app/
├── core/
│   ├── data/        airports.ts
│   ├── models/      flight.model.ts
│   ├── services/    flight-search, alerts, saved, rates, preferences, auth …
│   └── util/        search-query, flight-format, booking-redirect, date
├── features/        home, results (flight card, price insights, booking options), saved, alerts, account, auth
└── shared/components/ icon, modal, airport-combobox, passenger-picker, search-form, airline-chip …
```

Environment variables (`.env`): `SERPAPI_KEY` (required), `PORT` (default 8787), `SERPAPI_GL` (optional country code that changes which sellers Google lists, e.g. `gb`, `in`, `ae`).

## Notes

- Prices are fetched in US dollars and cover the whole trip for all travelers in the search; other currencies are conversions at the day's rate.
- Deploying needs a Node host for `server/index.mjs` (the key must stay server-side); a static-only host won't work.
