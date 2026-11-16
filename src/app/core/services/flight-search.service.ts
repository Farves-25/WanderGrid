import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Service, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiStatus, BookingResult, SearchParams, SearchResult } from '../models/flight.model';
import { searchKey } from '../util/flight-format';

export type ApiErrorCode = 'not_configured' | 'invalid_key' | 'quota' | 'rate_limited' | 'offline' | 'bad_request' | 'upstream_error' | 'upstream_unreachable' | 'server_error';

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode | string,
    message: string,
  ) {
    super(message);
  }
}

/** Results stay reusable in the tab for this long, so going back and forth costs no extra searches. */
const SESSION_TTL = 20 * 60_000;

function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  if (e instanceof HttpErrorResponse) {
    const body = e.error as { error?: { code?: unknown; message?: unknown } } | null;
    if (body && typeof body === 'object' && body.error && typeof body.error.message === 'string') {
      return new ApiError(typeof body.error.code === 'string' ? body.error.code : 'server_error', body.error.message);
    }
    if (e.status === 0) return new ApiError('offline', 'Can’t reach the WanderGrid server. Check your connection and that the API server is running.');
    if (e.status === 504 || e.status === 502) return new ApiError('upstream_unreachable', 'The WanderGrid API server isn’t responding. Start it with “npm start”.');
  }
  return new ApiError('server_error', 'Something went wrong while loading live flight data.');
}

/** Live flight data (Google Flights via the WanderGrid API server). */
@Service()
export class FlightSearchService {
  private readonly http = inject(HttpClient);
  private readonly cache = new Map<string, { at: number; value: SearchResult | BookingResult }>();
  private readonly pending = new Map<string, Promise<unknown>>();

  /** Provider configuration and remaining search quota; null until first loaded. */
  readonly status = signal<ApiStatus | null>(null);

  /**
   * Flights for one leg. Leg 0 needs no token; each later leg needs the `nextToken`
   * of the flight chosen for the leg before it. `fresh` bypasses every cache.
   */
  async search(params: SearchParams, legIndex: number, token: string | null, fresh = false): Promise<SearchResult> {
    const key = `s|${searchKey(params)}|${legIndex}|${token ?? ''}`;
    const hit = fresh ? undefined : this.hit<SearchResult>(key);
    if (hit) return hit;
    const value = await this.post<SearchResult>('/api/flights/search', { params, legIndex, token, fresh });
    this.cache.set(key, { at: Date.now(), value });
    return value;
  }

  /** Booking sites and their prices for a fully chosen itinerary. */
  async booking(params: SearchParams, token: string): Promise<BookingResult> {
    const key = `b|${searchKey(params)}|${token}`;
    const hit = this.hit<BookingResult>(key);
    if (hit) return hit;
    // A prefetch that is still running is reused instead of starting a second request.
    const running = this.pending.get(key) as Promise<BookingResult> | undefined;
    if (running) return running;
    const task = this.post<BookingResult>('/api/flights/booking', { params, token })
      .then((value) => {
        this.cache.set(key, { at: Date.now(), value });
        return value;
      })
      .finally(() => this.pending.delete(key));
    this.pending.set(key, task);
    return task;
  }

  /** Starts the (slow) booking lookup early, e.g. while the user hovers "Book now". Errors are ignored. */
  prefetchBooking(params: SearchParams, token: string): void {
    this.booking(params, token).catch(() => undefined);
  }

  async refreshStatus(): Promise<ApiStatus | null> {
    try {
      const s = await firstValueFrom(this.http.get<ApiStatus>('/api/status'));
      this.status.set(s);
      return s;
    } catch {
      return null;
    }
  }

  private hit<T extends SearchResult | BookingResult>(key: string): T | undefined {
    const e = this.cache.get(key);
    if (!e) return undefined;
    if (Date.now() - e.at > SESSION_TTL) {
      this.cache.delete(key);
      return undefined;
    }
    return { ...(e.value as T), cached: true };
  }

  private async post<T>(url: string, body: unknown): Promise<T> {
    try {
      const res = await firstValueFrom(this.http.post<T>(url, body));
      void this.refreshStatus();
      return res;
    } catch (e) {
      throw toApiError(e);
    }
  }
}
