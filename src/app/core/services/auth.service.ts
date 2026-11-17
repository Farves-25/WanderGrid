import { Service, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { SupabaseClient, User as SupabaseUser } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigured } from '../supabase.config';
import { hashString } from '../util/hash';
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
const REDIRECT_KEY = 'wg:oauth-redirect';

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

  // With Supabase configured, the session is restored asynchronously (see whenReady).
  readonly user = signal<AppUser | null>(supabaseConfigured ? null : this.restore());
  readonly signedIn = computed(() => this.user() !== null);
  readonly initials = computed(() => {
    const name = this.user()?.name?.trim() || '?';
    const parts = name.split(/\s+/).filter(Boolean);
    return (parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase();
  });

  private supabase: SupabaseClient | null = null;

  constructor() {
    if (supabaseConfigured) void this.ready();
  }

  readonly googleEnabled = supabaseConfigured;

  private init: Promise<void> | null = null;

  private ready(): Promise<void> {
    return (this.init ??= this.initSupabase());
  }

  /** Resolves once any stored/returning Supabase session has been restored. Route guards await this. */
  whenReady(): Promise<void> {
    return supabaseConfigured ? this.ready() : Promise.resolve();
  }

  private async initSupabase(): Promise<void> {
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    this.supabase = client;
    let firstEvent!: () => void;
    const restored = new Promise<void>((r) => (firstEvent = r));
    client.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') firstEvent();
      if (session) {
        const m = session.user.user_metadata ?? {};
        const email = session.user.email ?? '';
        this.user.set({ id: session.user.id, email, name: String(m['full_name'] ?? m['name'] ?? email.split('@')[0]).slice(0, 60) });
        // Finished a Google round-trip (possibly landing on a page other than /login): continue to the target.
        if (event === 'SIGNED_IN') {
          const target = this.takeSavedRedirect();
          if (target) void this.router.navigateByUrl(target.startsWith('/') && !target.startsWith('//') ? target : '/saved');
        }
      } else if (this.supabaseUser) {
        this.supabaseUser = false;
        this.user.set(null);
      }
      this.supabaseUser = session !== null;
    });
    await Promise.race([restored, new Promise<void>((r) => setTimeout(r, 5000))]);
  }

  private setFromSupabase(u: SupabaseUser, fallbackName = ''): void {
    const m = u.user_metadata ?? {};
    const email = u.email ?? '';
    this.user.set({ id: u.id, email, name: String(m['full_name'] ?? m['name'] ?? (fallbackName || email.split('@')[0])).slice(0, 60) });
    this.supabaseUser = true;
  }

  private friendly(message: string): string {
    if (/invalid login credentials/i.test(message)) return 'Incorrect email or password. Signed up with Google? Use Continue with Google, or reset your password.';
    if (/already registered|already been registered/i.test(message)) return 'This email is already registered — possibly with Google. Use Continue with Google, or choose “Forgot password?” to set a password.';
    if (/email not confirmed/i.test(message)) return 'Confirm your email first — check your inbox for the link.';
    if (/rate limit/i.test(message)) return 'Too many attempts. Please wait a moment and try again.';
    return message;
  }

  private supabaseUser = false;

  async signInWithGoogle(redirect?: string): Promise<AuthResult> {
    if (!supabaseConfigured) return { ok: false, message: 'Google sign-in is not configured yet.' };
    await this.ready();
    this.cache.write(REDIRECT_KEY, redirect ?? '/saved');
    const { error } = await this.supabase!.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/login` },
    });
    return error ? { ok: false, message: error.message } : { ok: true };
  }

  /** Emails a reset link. Also lets a Google-only user add a password to the same account. */
  async requestPasswordReset(email: string): Promise<AuthResult> {
    if (!supabaseConfigured) return { ok: false, message: 'Password reset needs Supabase to be configured.' };
    await this.ready();
    this.cache.remove(REDIRECT_KEY);
    const { error } = await this.supabase!.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${location.origin}/login?mode=reset`,
    });
    return error ? { ok: false, message: this.friendly(error.message) } : { ok: true };
  }

  /** Sets a new password for the current (recovery) session. */
  async setPassword(password: string): Promise<AuthResult> {
    if (!this.supabase || !this.user()) return { ok: false, message: 'This reset link has expired. Request a new one.' };
    if (password.length < 8) return { ok: false, message: 'Use at least 8 characters for your password.' };
    const { error } = await this.supabase.auth.updateUser({ password });
    return error ? { ok: false, message: this.friendly(error.message) } : { ok: true };
  }

  /** Redirect target saved before leaving for Google; consumed once. */
  takeSavedRedirect(): string | null {
    const r = this.cache.read<string | null>(REDIRECT_KEY, null);
    this.cache.remove(REDIRECT_KEY);
    return r;
  }

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
    if (supabaseConfigured) {
      await this.ready();
      const fullName = name.trim().slice(0, 60);
      const { data, error } = await this.supabase!.auth.signUp({
        email: cleanEmail,
        password,
        options: { data: { full_name: fullName }, emailRedirectTo: `${location.origin}/login` },
      });
      if (error) return { ok: false, message: this.friendly(error.message) };
      // Existing confirmed email: Supabase returns a user with no identities instead of an error.
      if (data.user && data.user.identities?.length === 0) return { ok: false, message: this.friendly('User already registered') };
      if (!data.session) return { ok: false, message: 'Account created! Check your email to confirm it, then sign in.' };
      this.setFromSupabase(data.user!, fullName);
      return { ok: true };
    }
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
    if (supabaseConfigured) {
      await this.ready();
      const { data, error } = await this.supabase!.auth.signInWithPassword({ email: cleanEmail, password });
      if (error) return { ok: false, message: this.friendly(error.message) };
      this.setFromSupabase(data.user);
      return { ok: true };
    }
    const u = this.users().find((x) => x.email === cleanEmail);
    if (!u || (await digest(u.salt, password)) !== u.hash) return { ok: false, message: 'Incorrect email or password.' };
    this.startSession(u);
    return { ok: true };
  }

  updateName(name: string): void {
    const u = this.user();
    if (!u || !name.trim()) return;
    if (supabaseConfigured) {
      this.user.set({ ...u, name: name.trim().slice(0, 60) });
      void this.supabase?.auth.updateUser({ data: { full_name: name.trim().slice(0, 60) } });
      return;
    }
    const users = this.users().map((x) => (x.id === u.id ? { ...x, name: name.trim().slice(0, 60) } : x));
    this.cache.write(USERS_KEY, users);
    this.user.set({ ...u, name: name.trim().slice(0, 60) });
  }

  /**
   * Permanently deletes the signed-in account. With Supabase this calls the `delete_user()` database
   * function (see supabase/delete_user.sql), since browsers can't use the admin API.
   */
  async deleteAccount(): Promise<AuthResult> {
    const u = this.user();
    if (!u) return { ok: false, message: 'You’re not signed in.' };
    if (supabaseConfigured) {
      await this.ready();
      const { error } = await this.supabase!.rpc('delete_user');
      if (error) {
        const missing = /could not find the function|does not exist|PGRST202/i.test(`${error.message} ${error.code ?? ''}`);
        return { ok: false, message: missing ? 'Account deletion isn’t set up yet — run supabase/delete_user.sql in the Supabase SQL editor.' : error.message };
      }
    } else {
      this.cache.write(USERS_KEY, this.users().filter((x) => x.id !== u.id));
    }
    await this.signOut();
    return { ok: true };
  }

  async signOut(): Promise<void> {
    this.cache.remove(SESSION_KEY);
    this.user.set(null);
    this.supabaseUser = false;
    await this.supabase?.auth.signOut();
    await this.router.navigateByUrl('/login');
  }

  private startSession(u: StoredUser): void {
    this.cache.write(SESSION_KEY, u.id);
    this.user.set({ id: u.id, email: u.email, name: u.name });
  }
}
