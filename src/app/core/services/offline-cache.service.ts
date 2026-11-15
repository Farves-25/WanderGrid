import { Service, signal } from '@angular/core';

/** Connectivity signal plus safe JSON access to localStorage. */
@Service()
export class OfflineCacheService {
  readonly online = signal(typeof navigator === 'undefined' ? true : navigator.onLine);

  constructor() {
    window.addEventListener('online', () => this.online.set(true));
    window.addEventListener('offline', () => this.online.set(false));
  }

  read<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  }

  /** Returns false when the browser refused the write (quota / private mode). */
  write(key: string, value: unknown): boolean {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}
