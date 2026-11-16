/**
 * WanderGrid API server.
 *
 * Keeps the SerpApi key off the browser, caches responses to protect the monthly quota,
 * and (in production) serves the built Angular app from dist/.
 *
 *   SERPAPI_KEY   required for live flight data (https://serpapi.com/manage-api-key)
 *   PORT          default 8787
 *   SERPAPI_GL    optional two-letter country code for Google Flights (affects which sellers are listed)
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildQuery, isEmptyResult, normalizeAccount, normalizeBooking, normalizeSearch, validToken, validateParams } from './serpapi.mjs';

const PORT = Number(process.env.PORT) || 8787;
const KEY = (process.env.SERPAPI_KEY ?? '').trim();
const GL = /^[a-z]{2}$/i.test(process.env.SERPAPI_GL ?? '') ? process.env.SERPAPI_GL.toLowerCase() : undefined;
const STATIC_DIR = resolve(fileURLToPath(new URL('../dist/WanderGrid/browser', import.meta.url)));

const SEARCH_TTL = 30 * 60_000;
const BOOKING_TTL = 10 * 60_000;
const RATES_TTL = 12 * 3_600_000;
const ACCOUNT_TTL = 60_000;
const UPSTREAM_TIMEOUT = 60_000;

// ---------- tiny TTL cache ----------
const cache = new Map();
function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expires < Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit;
}
function cacheSet(key, value, ttl) {
  if (cache.size > 500) {
    const now = Date.now();
    for (const [k, v] of cache) if (v.expires < now) cache.delete(k);
    if (cache.size > 500) cache.delete(cache.keys().next().value);
  }
  cache.set(key, { value, at: Date.now(), expires: Date.now() + ttl });
}

// ---------- per-client rate limit (protects the SerpApi quota) ----------
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  if (list.length >= 20) {
    hits.set(ip, list);
    return true;
  }
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return false;
}

class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function serpapi(query) {
  if (!KEY) throw new ApiError(503, 'not_configured', 'Live flight data is not set up yet. Add SERPAPI_KEY to the .env file and restart the server.');
  const url = new URL('https://serpapi.com/search.json');
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  url.searchParams.set('api_key', KEY);
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT), headers: { accept: 'application/json' } });
  } catch (e) {
    throw new ApiError(504, 'upstream_unreachable', e?.name === 'TimeoutError' ? 'The flight data provider took too long to answer. Please try again.' : 'Could not reach the flight data provider.');
  }
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* handled below */
  }
  const message = typeof json?.error === 'string' ? json.error : '';
  if (res.status === 401 || /invalid api key/i.test(message)) throw new ApiError(502, 'invalid_key', 'The SerpApi key was rejected. Check SERPAPI_KEY in .env.');
  if (res.status === 429) {
    throw new ApiError(429, 'quota', /run out of searches/i.test(message) ? 'The SerpApi account has used all of its searches for this month.' : 'Too many searches this hour on the SerpApi account. Try again a little later.');
  }
  if (isEmptyResult(message)) return { empty: true, json: json ?? {} };
  if (!res.ok || message || !json) throw new ApiError(502, 'upstream_error', message || `The flight data provider returned an error (HTTP ${res.status}).`);
  return { empty: false, json };
}

async function handleSearch(body) {
  const err = validateParams(body?.params);
  if (err) throw new ApiError(400, 'bad_request', err);
  const p = body.params;
  const legIndex = body.legIndex;
  if (!Number.isInteger(legIndex) || legIndex < 0 || legIndex >= p.legs.length) throw new ApiError(400, 'bad_request', 'Invalid flight index.');
  const token = body.token ?? null;
  if (legIndex > 0 && !validToken(token)) throw new ApiError(400, 'bad_request', 'Choose the previous flight first.');
  if (legIndex === 0 && token !== null) throw new ApiError(400, 'bad_request', 'Unexpected token.');
  const query = buildQuery(p, { gl: GL, departureToken: token ?? undefined });
  const key = `search:${JSON.stringify(query)}`;
  const hit = body.fresh === true ? null : cacheGet(key);
  if (hit) return { ...hit.value, fetchedAt: hit.at, cached: true };
  const { json } = await serpapi(query);
  const value = normalizeSearch(json, legIndex);
  cacheSet(key, value, SEARCH_TTL);
  return { ...value, fetchedAt: Date.now(), cached: false };
}

async function handleBooking(body) {
  const err = validateParams(body?.params);
  if (err) throw new ApiError(400, 'bad_request', err);
  if (!validToken(body.token)) throw new ApiError(400, 'bad_request', 'Missing booking token.');
  const query = buildQuery(body.params, { gl: GL, bookingToken: body.token });
  const key = `booking:${JSON.stringify(query)}`;
  const hit = cacheGet(key);
  if (hit) return { ...hit.value, fetchedAt: hit.at, cached: true };
  const { json } = await serpapi(query);
  const value = normalizeBooking(json);
  cacheSet(key, value, BOOKING_TTL);
  return { ...value, fetchedAt: Date.now(), cached: false };
}

async function handleStatus() {
  if (!KEY) return { configured: false, account: null };
  const hit = cacheGet('account');
  if (hit) return hit.value;
  let account = null;
  let keyValid = true;
  try {
    // The account endpoint is free and does not use a search credit.
    const res = await fetch(`https://serpapi.com/account.json?api_key=${encodeURIComponent(KEY)}`, { signal: AbortSignal.timeout(15_000) });
    if (res.status === 401) keyValid = false;
    else account = normalizeAccount(await res.json());
  } catch {
    /* status stays "configured" with unknown usage */
  }
  const value = { configured: true, keyValid, account };
  cacheSet('account', value, ACCOUNT_TTL);
  return value;
}

async function handleRates() {
  const hit = cacheGet('rates');
  if (hit) return hit.value;
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(15_000) });
    const json = await res.json();
    if (json?.result !== 'success' || typeof json.rates !== 'object') throw new Error('bad payload');
    const value = { base: 'USD', rates: json.rates, updatedAt: typeof json.time_last_update_unix === 'number' ? json.time_last_update_unix * 1000 : Date.now() };
    cacheSet('rates', value, RATES_TTL);
    return value;
  } catch {
    throw new ApiError(502, 'rates_unavailable', 'Live exchange rates are unavailable right now.');
  }
}

// ---------- http plumbing ----------
function send(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  res.end(body);
}

function readJson(req) {
  return new Promise((ok, fail) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 64_000) {
        fail(new ApiError(413, 'bad_request', 'Request too large.'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      try {
        ok(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        fail(new ApiError(400, 'bad_request', 'Invalid JSON.'));
      }
    });
    req.on('error', () => fail(new ApiError(400, 'bad_request', 'Request aborted.')));
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
};

function serveStatic(req, res, pathname) {
  if (!existsSync(STATIC_DIR)) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('WanderGrid API is running. Build the app (npm run build) to serve it from here, or use npm start for development.');
    return;
  }
  let rel;
  try {
    rel = normalize(decodeURIComponent(pathname));
  } catch {
    rel = '/';
  }
  let file = join(STATIC_DIR, rel);
  const inside = file === STATIC_DIR || file.startsWith(STATIC_DIR + sep);
  if (!inside || !existsSync(file) || !statSync(file).isFile()) {
    // unknown asset → 404, anything else → SPA entry point
    if (inside && extname(rel)) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    file = join(STATIC_DIR, 'index.html');
  }
  const ext = extname(file).toLowerCase();
  const hashed = /[.-][A-Za-z0-9_-]{8,}\.(js|css)$/.test(file);
  res.writeHead(200, {
    'content-type': MIME[ext] ?? 'application/octet-stream',
    'cache-control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache',
    'x-content-type-options': 'nosniff',
  });
  if (req.method === 'HEAD') res.end();
  else createReadStream(file).pipe(res);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = url.pathname;
  if (!path.startsWith('/api/')) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405).end();
      return;
    }
    serveStatic(req, res, path);
    return;
  }
  try {
    if (req.method === 'GET' && path === '/api/status') return send(res, 200, await handleStatus());
    if (req.method === 'GET' && path === '/api/rates') return send(res, 200, await handleRates());
    if (req.method === 'POST' && (path === '/api/flights/search' || path === '/api/flights/booking')) {
      if (limited(req.socket.remoteAddress ?? 'unknown')) throw new ApiError(429, 'rate_limited', 'Too many searches in a short time. Wait a minute and try again.');
      const body = await readJson(req);
      return send(res, 200, path.endsWith('search') ? await handleSearch(body) : await handleBooking(body));
    }
    throw new ApiError(404, 'not_found', 'Unknown endpoint.');
  } catch (e) {
    if (e instanceof ApiError) return send(res, e.status, { error: { code: e.code, message: e.message } });
    console.error('[api] unexpected error', e);
    return send(res, 500, { error: { code: 'server_error', message: 'Something went wrong on the server.' } });
  }
});

server.listen(PORT, () => {
  console.log(`[api] WanderGrid API on http://localhost:${PORT}`);
  if (!KEY) console.warn('[api] SERPAPI_KEY is not set — flight searches will return a setup message. Copy .env.example to .env and add your key.');
});
