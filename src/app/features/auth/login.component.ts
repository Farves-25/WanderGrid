import { Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { IconComponent } from '../../shared/components/icon.component';

type Mode = 'signin' | 'signup';

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
          <div class="tabs mb-6 w-full" role="group" aria-label="Account">
            <button type="button" class="tab flex-1 justify-center" [attr.aria-pressed]="mode() === 'signin'" (click)="setMode('signin')">Sign in</button>
            <button type="button" class="tab flex-1 justify-center" [attr.aria-pressed]="mode() === 'signup'" (click)="setMode('signup')">Create account</button>
          </div>
          <h2 id="auth-title" class="text-2xl font-bold">{{ mode() === 'signin' ? 'Welcome back' : 'Join WanderGrid' }}</h2>
          <p class="mt-1.5 text-sm text-muted">{{ mode() === 'signin' ? 'Sign in to save trips and track prices.' : 'Create an account to save trips and set price alerts.' }}</p>

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
            </div>
            @if (error()) {
              <p class="form-error" role="alert">{{ error() }}</p>
            }
            <button type="submit" class="btn btn-primary btn-lg w-full" [disabled]="busy()">
              {{ busy() ? 'Please wait…' : mode() === 'signin' ? 'Sign in' : 'Create account' }} <app-icon name="arrow-right" [size]="18" />
            </button>
          </form>
          <p class="mt-5 flex items-center gap-2 text-xs text-faint"><app-icon name="lock" [size]="13" /> Your account is stored only in this browser.</p>
        </div>
      </section>
    </div>
  `,
})
export class LoginComponent {
  readonly redirect = input<string | undefined>();

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly mode = signal<Mode>('signin');
  protected readonly busy = signal(false);
  protected readonly error = signal('');
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

  protected setMode(m: Mode): void {
    this.mode.set(m);
    this.error.set('');
  }

  protected bad(name: 'email' | 'password'): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || c.dirty);
  }

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    this.error.set('');
    const { name, email, password } = this.form.getRawValue();
    if (this.form.controls.email.invalid || this.form.controls.password.invalid) return;
    this.busy.set(true);
    try {
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
