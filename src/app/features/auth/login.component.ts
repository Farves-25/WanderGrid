import { Component, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { IconComponent } from '../../shared/components/icon.component';

type Mode = 'signin' | 'signup' | 'forgot' | 'reset';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, IconComponent],
  template: `
    <div class="page grid items-center gap-12 !pt-10 md:!pt-16 lg:grid-cols-2">
      <section class="rise">
        <span class="badge mb-5 !px-3.5 !py-1.5 text-[0.78rem]"><app-icon name="sparkles" [size]="14" /> Free account · No card needed</span>
        <h1 class="text-4xl font-bold leading-tight sm:text-5xl">Your trips,<br /><span class="gradient-text">all in one place.</span></h1>
        <ul class="mt-8 grid gap-4 text-muted">
          @for (p of perks; track p.text) {
            <li class="flex items-center gap-3.5"><span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-accent"><app-icon [name]="p.icon" [size]="19" /></span>{{ p.text }}</li>
          }
        </ul>
      </section>

      <section class="rise [animation-delay:100ms]" aria-labelledby="auth-title">
        <div class="glass mx-auto max-w-md p-7 sm:p-9">
          @if (mode() === 'forgot' || mode() === 'reset') {
            <h2 id="auth-title" class="text-2xl font-bold">{{ mode() === 'forgot' ? 'Reset your password' : 'Set a new password' }}</h2>
            <p class="mt-1.5 text-sm text-muted">
              {{ mode() === 'forgot' ? 'Enter your email and we’ll send a link. Works for Google accounts too — it lets you add a password.' : 'Choose a password for your account.' }}
            </p>
            <form class="mt-6 grid gap-4" [formGroup]="form" (ngSubmit)="submit()" novalidate>
              @if (mode() === 'forgot') {
                <div>
                  <label class="label" for="r-email">Email</label>
                  <input id="r-email" class="input" type="email" formControlName="email" autocomplete="email" placeholder="you@example.com" [attr.aria-invalid]="bad('email')" />
                  @if (bad('email')) {
                    <p class="field-error">Enter a valid email address.</p>
                  }
                </div>
              } @else {
                <div>
                  <label class="label" for="r-pass">New password</label>
                  <input id="r-pass" class="input" type="password" formControlName="password" autocomplete="new-password" placeholder="At least 8 characters" [attr.aria-invalid]="bad('password')" />
                  @if (bad('password')) {
                    <p class="field-error">Use at least 8 characters.</p>
                  }
                </div>
              }
              @if (error()) {
                <p class="form-error" role="alert">{{ error() }}</p>
              }
              @if (info()) {
                <p class="text-sm text-muted" role="status">{{ info() }}</p>
              }
              @if (mode() === 'forgot' && sent()) {
                <button type="submit" class="btn btn-primary btn-lg w-full" [disabled]="busy() || cooldown() > 0">
                  {{ busy() ? 'Sending…' : cooldown() > 0 ? 'Resend link in ' + cooldown() + 's' : 'Resend link' }}
                </button>
              } @else {
                <button type="submit" class="btn btn-primary btn-lg w-full" [disabled]="busy()">
                  {{ busy() ? 'Please wait…' : mode() === 'forgot' ? 'Send reset link' : 'Save password' }} <app-icon name="arrow-right" [size]="18" />
                </button>
              }
              @if (mode() === 'forgot') {
                <button type="button" class="btn w-full justify-center" (click)="setMode('signin')">Back to sign in</button>
              }
            </form>
          } @else {
          <div class="tabs mb-6 w-full" role="group" aria-label="Account">
            <button type="button" class="tab flex-1 justify-center" [attr.aria-pressed]="mode() === 'signin'" (click)="setMode('signin')">Sign in</button>
            <button type="button" class="tab flex-1 justify-center" [attr.aria-pressed]="mode() === 'signup'" (click)="setMode('signup')">Create account</button>
          </div>
          <h2 id="auth-title" class="text-2xl font-bold">{{ mode() === 'signin' ? 'Welcome back' : 'Join WanderGrid' }}</h2>
          <p class="mt-1.5 text-sm text-muted">{{ mode() === 'signin' ? 'Sign in to save trips and track prices.' : 'Create an account to save trips and set price alerts.' }}</p>

          @if (auth.googleEnabled) {
            <button type="button" class="btn btn-lg mt-6 w-full justify-center" [disabled]="busy()" (click)="google()">
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
                <path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.3.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z" />
                <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
              </svg>
              Continue with Google
            </button>
            <div class="mt-5 flex items-center gap-3 text-xs text-faint" aria-hidden="true">
              <span class="h-px flex-1 bg-[var(--border)]"></span>or<span class="h-px flex-1 bg-[var(--border)]"></span>
            </div>
          }

          <form class="mt-6 grid gap-4" [formGroup]="form" (ngSubmit)="submit()" novalidate>
            @if (mode() === 'signup') {
              <div>
                <label class="label" for="l-name">Full name</label>
                <input id="l-name" class="input" formControlName="name" autocomplete="name" placeholder="Alex Rivera" />
              </div>
            }
            <div>
              <label class="label" for="l-email">Email</label>
              <input id="l-email" class="input" type="email" formControlName="email" autocomplete="email" placeholder="you@example.com" [attr.aria-invalid]="bad('email')" />
              @if (bad('email')) {
                <p class="field-error">Enter a valid email address.</p>
              }
            </div>
            <div>
              <label class="label" for="l-pass">Password</label>
              <input id="l-pass" class="input" type="password" formControlName="password" [autocomplete]="mode() === 'signin' ? 'current-password' : 'new-password'" placeholder="At least 8 characters" [attr.aria-invalid]="bad('password')" />
              @if (bad('password')) {
                <p class="field-error">Use at least 8 characters.</p>
              }
              @if (mode() === 'signin' && auth.googleEnabled) {
                <button type="button" class="mt-2 text-sm text-accent underline-offset-2 hover:underline" (click)="setMode('forgot')">Forgot password?</button>
              }
            </div>
            @if (error()) {
              <p class="form-error" role="alert">{{ error() }}</p>
            }
            <button type="submit" class="btn btn-primary btn-lg w-full" [disabled]="busy()">
              {{ busy() ? 'Please wait…' : mode() === 'signin' ? 'Sign in' : 'Create account' }} <app-icon name="arrow-right" [size]="18" />
            </button>
          </form>
          }
          @if (!auth.googleEnabled) {
            <p class="mt-5 flex items-center gap-2 text-xs text-faint"><app-icon name="lock" [size]="13" /> Your account is stored only in this browser.</p>
          }
        </div>
      </section>
    </div>
  `,
})
export class LoginComponent {
  readonly redirect = input<string | undefined>();
  /** Set by Supabase when the Google round-trip fails (e.g. ?error_description=...). */
  readonly errorDescription = input<string | undefined>();
  /** `?mode=reset` is set on the link in the password-reset email. */
  readonly flow = input<string | undefined>(undefined, { alias: 'mode' });

  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly mode = signal<Mode>('signin');
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly info = signal('');
  protected readonly sent = signal(false);
  protected readonly cooldown = signal(0);
  private timer: ReturnType<typeof setInterval> | undefined;
  protected readonly perks = [
    { icon: 'bookmark', text: 'Save itineraries and come back to them later' },
    { icon: 'bell-ring', text: 'Price alerts that watch fares for you' },
    { icon: 'external-link', text: 'Book directly with airlines and travel sites' },
    { icon: 'chart-line', text: 'See live prices and price history' },
  ];

  protected readonly form = this.fb.group({
    name: [''],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => clearInterval(this.timer));
    // Returning from Google: the session arrives asynchronously after the page loads.
    effect(() => {
      if (this.flow() === 'reset') this.mode.set('reset');
    });
    effect(() => {
      if (this.auth.signedIn() && this.mode() !== 'reset') void this.goAfterAuth();
    });
    effect(() => {
      const e = this.errorDescription();
      if (e) this.error.set(`Google sign-in failed: ${e}`);
    });
  }

  private async goAfterAuth(): Promise<void> {
    const r = this.redirect() ?? this.auth.takeSavedRedirect() ?? undefined;
    await this.router.navigateByUrl(r && r.startsWith('/') && !r.startsWith('//') ? r : '/saved');
  }

  protected async google(): Promise<void> {
    this.error.set('');
    this.busy.set(true);
    const res = await this.auth.signInWithGoogle(this.redirect());
    if (!res.ok) {
      this.error.set(res.message);
      this.busy.set(false);
    }
  }

  private startCooldown(seconds = 60): void {
    clearInterval(this.timer);
    this.cooldown.set(seconds);
    this.timer = setInterval(() => {
      this.cooldown.update((s) => s - 1);
      if (this.cooldown() <= 0) clearInterval(this.timer);
    }, 1000);
  }

  protected setMode(m: Mode): void {
    clearInterval(this.timer);
    this.cooldown.set(0);
    this.sent.set(false);
    this.mode.set(m);
    this.error.set('');
    this.info.set('');
  }

  protected bad(name: 'email' | 'password'): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || c.dirty);
  }

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    this.error.set('');
    this.info.set('');
    const { name, email, password } = this.form.getRawValue();
    const m = this.mode();
    if (m === 'forgot' ? this.form.controls.email.invalid : m === 'reset' ? this.form.controls.password.invalid : this.form.controls.email.invalid || this.form.controls.password.invalid) return;
    this.busy.set(true);
    try {
      if (m === 'forgot') {
        const res = await this.auth.requestPasswordReset(email);
        if (res.ok) {
          this.info.set(this.sent() ? 'We sent the link again. Check your inbox and spam folder.' : 'If that email has an account, a reset link is on its way. Check your inbox.');
          this.sent.set(true);
          this.startCooldown();
        } else this.error.set(res.message);
        return;
      }
      if (m === 'reset') {
        const res = await this.auth.setPassword(password);
        if (!res.ok) {
          this.error.set(res.message);
          return;
        }
        this.mode.set('signin');
        await this.router.navigateByUrl('/saved');
        return;
      }
      const res = this.mode() === 'signin' ? await this.auth.signIn(email, password) : await this.auth.signUp(name, email, password);
      if (!res.ok) {
        this.error.set(res.message);
        return;
      }
      const r = this.redirect();
      await this.router.navigateByUrl(r && r.startsWith('/') && !r.startsWith('//') ? r : '/saved');
    } finally {
      this.busy.set(false);
    }
  }
}
