import { Service, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { hashString } from '../engine/prng';
import { newId, nowIso } from '../util/id.util';
import { OfflineCacheService } from './offline-cache.service';

export interface AppUser {
  id: string;
  email: string;
  name: string;
}

interface StoredUser extends AppUser {
  salt: string;
  hash: string;
  createdAt: string;
}

export type AuthResult = { ok: true } | { ok: false; message: string };

const USERS_KEY = 'wg:users';
const SESSION_KEY = 'wg:session';

async function digest(salt: string, password: string): Promise<string> {
  const text = `${salt}:${password}`;
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return `f${hashString(text)}`; // insecure-context fallback (demo only)
  const buf = await subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Demo-grade local accounts: credentials are salted + hashed and kept in this browser only.
 * Swap this service for a real identity provider in production.
 */
@Service()
export class AuthService {
  private readonly cache = inject(OfflineCacheService);
  private readonly router = inject(Router);

  readonly user = signal<AppUser | null>(this.restore());
  readonly signedIn = computed(() => this.user() !== null);
  readonly initials = computed(() => {
    const name = this.user()?.name?.trim() || '?';
    const parts = name.split(/\s+/).filter(Boolean);
    return (parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase();
  });

  private users(): StoredUser[] {
    return this.cache.read<StoredUser[]>(USERS_KEY, []);
  }

  private restore(): AppUser | null {
    const id = this.cache.read<string | null>(SESSION_KEY, null);
    const u = id ? this.users().find((x) => x.id === id) : undefined;
    return u ? { id: u.id, email: u.email, name: u.name } : null;
  }

  async signUp(name: string, email: string, password: string): Promise<AuthResult> {
    const cleanEmail = email.trim().toLowerCase();
    if (!name.trim()) return { ok: false, message: 'Tell us your name.' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) return { ok: false, message: 'Enter a valid email address.' };
    if (password.length < 8) return { ok: false, message: 'Use at least 8 characters for your password.' };
    const users = this.users();
    if (users.some((u) => u.email === cleanEmail)) return { ok: false, message: 'An account with that email already exists. Try signing in.' };
    const salt = newId();
    const stored: StoredUser = { id: newId(), email: cleanEmail, name: name.trim().slice(0, 60), salt, hash: await digest(salt, password), createdAt: nowIso() };
    if (!this.cache.write(USERS_KEY, [...users, stored])) return { ok: false, message: 'Could not save your account — is browser storage disabled?' };
    this.startSession(stored);
    return { ok: true };
  }

  async signIn(email: string, password: string): Promise<AuthResult> {
    const cleanEmail = email.trim().toLowerCase();
    const u = this.users().find((x) => x.email === cleanEmail);
    if (!u || (await digest(u.salt, password)) !== u.hash) return { ok: false, message: 'Incorrect email or password.' };
    this.startSession(u);
    return { ok: true };
  }

  updateName(name: string): void {
    const u = this.user();
    if (!u || !name.trim()) return;
    const users = this.users().map((x) => (x.id === u.id ? { ...x, name: name.trim().slice(0, 60) } : x));
    this.cache.write(USERS_KEY, users);
    this.user.set({ ...u, name: name.trim().slice(0, 60) });
  }

  async signOut(): Promise<void> {
    this.cache.remove(SESSION_KEY);
    this.user.set(null);
    await this.router.navigateByUrl('/');
  }

  private startSession(u: StoredUser): void {
    this.cache.write(SESSION_KEY, u.id);
    this.user.set({ id: u.id, email: u.email, name: u.name });
  }
}
