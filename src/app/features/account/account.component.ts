import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AlertsService } from '../../core/services/alerts.service';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { FlightSearchService } from '../../core/services/flight-search.service';
import { RatesService } from '../../core/services/rates.service';
import { SavedService } from '../../core/services/saved.service';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent } from '../../shared/components/icon.component';

@Component({
  selector: 'app-account',
  imports: [DecimalPipe, IconComponent, RouterLink],
  template: `
    <div class="page">
      <h1 class="rise text-4xl font-bold sm:text-5xl">Your <span class="gradient-text">account</span></h1>

      <div class="mt-8 grid items-start gap-6 lg:grid-cols-[1fr_1fr]">
        <section class="card rise p-6" aria-labelledby="prof-h">
          <h2 id="prof-h" class="text-xl font-bold">Profile</h2>
          <form class="mt-4 grid gap-4" (submit)="saveName($event)">
            <div>
              <label class="label" for="acc-name">Full name</label>
              <input id="acc-name" class="input" [value]="name()" maxlength="60" autocomplete="name" (input)="name.set($any($event.target).value)" />
            </div>
            <div>
              <label class="label" for="acc-email">Email</label>
              <input id="acc-email" class="input" [value]="auth.user()?.email" readonly />
            </div>
            <div><button type="submit" class="btn btn-primary btn-sm">Save profile</button></div>
          </form>
          <dl class="mt-6 grid grid-cols-2 gap-3 text-center">
            <div class="stat !p-3"><dt class="stat-label">Saved trips</dt><dd class="stat-value !text-xl"><a routerLink="/saved" class="hover:underline">{{ saved.mine().length }}</a></dd></div>
            <div class="stat !p-3"><dt class="stat-label">Price alerts</dt><dd class="stat-value !text-xl"><a routerLink="/alerts" class="hover:underline">{{ alerts.mine().length }}</a></dd></div>
          </dl>
        </section>

        <section class="card rise p-6 [animation-delay:60ms]" aria-labelledby="data-h">
          <div class="flex items-start justify-between gap-3">
            <h2 id="data-h" class="flex items-center gap-2 text-xl font-bold"><app-icon name="database" [size]="19" /> Live data</h2>
            <button type="button" class="btn btn-sm" [disabled]="checking()" (click)="recheck()"><app-icon name="refresh-cw" [size]="14" /> {{ checking() ? 'Checking…' : 'Refresh' }}</button>
          </div>

          <div class="mt-4" aria-live="polite">
            @if (state() === 'loading') {
              <p class="text-sm text-muted">Checking the flight data connection…</p>
            } @else if (state() === 'unreachable') {
              <p class="flex items-center gap-2 font-semibold text-danger"><app-icon name="circle-alert" [size]="17" /> API server not reachable</p>
              <p class="mt-1 text-sm text-muted">Start the app with <code>npm start</code> so the WanderGrid API server runs alongside it.</p>
            } @else if (state() === 'missing') {
              <p class="flex items-center gap-2 font-semibold text-warn"><app-icon name="key-round" [size]="17" /> No SerpApi key configured</p>
              <p class="mt-1 text-sm text-muted">Copy <code>.env.example</code> to <code>.env</code>, set <code>SERPAPI_KEY</code> and restart. A free key is available at serpapi.com.</p>
            } @else if (state() === 'invalid') {
              <p class="flex items-center gap-2 font-semibold text-danger"><app-icon name="circle-alert" [size]="17" /> SerpApi rejected the key</p>
              <p class="mt-1 text-sm text-muted">Check <code>SERPAPI_KEY</code> in <code>.env</code> and restart the server.</p>
            } @else {
              <p class="flex items-center gap-2 font-semibold text-ok"><app-icon name="circle-check" [size]="17" /> Connected to Google Flights via SerpApi</p>
              @if (api.status()?.account; as acc) {
                <dl class="mt-4 grid grid-cols-2 gap-3 text-center sm:grid-cols-3">
                  <div class="stat !p-3"><dt class="stat-label">Plan</dt><dd class="stat-value !text-base">{{ acc.plan ?? '—' }}</dd></div>
                  <div class="stat !p-3"><dt class="stat-label">Searches left</dt><dd class="stat-value !text-xl">{{ acc.searchesLeft === null ? '—' : (acc.searchesLeft | number) }}</dd></div>
                  <div class="stat !p-3"><dt class="stat-label">This hour</dt><dd class="stat-value !text-xl">{{ acc.usedThisHour ?? '—' }}@if (acc.hourlyLimit !== null) { <span class="text-sm font-normal text-muted">/ {{ acc.hourlyLimit }}</span> }</dd></div>
                </dl>
                @if (quotaPct(); as pct) {
                  <div class="mt-4">
                    <div class="h-2 overflow-hidden rounded-full bg-[var(--border)]" role="progressbar" aria-label="Monthly searches used" aria-valuemin="0" aria-valuemax="100" [attr.aria-valuenow]="pct.used"><div class="h-full rounded-full bg-[var(--accent)]" [style.width.%]="pct.used"></div></div>
                    <p class="mt-2 text-sm text-muted">{{ acc.usedThisMonth | number }} of {{ acc.searchesPerMonth | number }} monthly searches used. Repeating a search within the hour is free.</p>
                  </div>
                }
              } @else {
                <p class="mt-1 text-sm text-muted">Usage details aren't available right now.</p>
              }
            }
          </div>

          <p class="mt-5 border-t border-[var(--border)] pt-4 text-sm text-muted">
            <app-icon name="globe" [size]="14" />
            @if (ratesDate(); as d) { Exchange rates updated {{ d }}. } @else { Live exchange rates are unavailable — using built-in estimates. }
          </p>
        </section>

        <section class="card rise p-6 [animation-delay:120ms] lg:col-span-2" aria-labelledby="danger-h">
          <h2 id="danger-h" class="flex items-center gap-2 text-xl font-bold text-danger"><app-icon name="triangle-alert" [size]="19" /> Delete account</h2>
          <p class="mt-2 max-w-2xl text-sm text-muted">
            Permanently deletes your account, saved trips and price alerts. This can’t be undone. You’ll need to create a new account to sign in again.
          </p>
          @if (deleteError()) {
            <p class="form-error mt-3" role="alert">{{ deleteError() }}</p>
          }
          <button type="button" class="btn btn-danger btn-sm mt-4" [disabled]="deleting()" (click)="deleteAccount()">
            <app-icon name="trash-2" [size]="14" /> {{ deleting() ? 'Deleting…' : 'Delete my account' }}
          </button>
        </section>
      </div>
    </div>
  `,
})
export class AccountComponent {
  protected readonly auth = inject(AuthService);
  protected readonly api = inject(FlightSearchService);
  protected readonly saved = inject(SavedService);
  protected readonly alerts = inject(AlertsService);
  private readonly rates = inject(RatesService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  protected readonly deleting = signal(false);
  protected readonly deleteError = signal('');
  protected readonly name = signal(this.auth.user()?.name ?? '');
  protected readonly checking = signal(true);
  private readonly reachable = signal(true);

  protected readonly state = computed<'loading' | 'unreachable' | 'missing' | 'invalid' | 'ok'>(() => {
    const s = this.api.status();
    if (!this.reachable()) return 'unreachable';
    if (!s) return 'loading';
    if (!s.configured) return 'missing';
    return s.keyValid === false ? 'invalid' : 'ok';
  });

  protected readonly quotaPct = computed(() => {
    const a = this.api.status()?.account;
    if (!a || a.searchesPerMonth === null || a.usedThisMonth === null || a.searchesPerMonth <= 0) return null;
    return { used: Math.min(100, Math.round((a.usedThisMonth / a.searchesPerMonth) * 100)) };
  });

  protected readonly ratesDate = computed(() => {
    const at = this.rates.updatedAt();
    return at === null ? '' : new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(at));
  });

  constructor() {
    void this.recheck();
  }

  protected async recheck(): Promise<void> {
    this.checking.set(true);
    const s = await this.api.refreshStatus();
    this.reachable.set(s !== null);
    this.checking.set(false);
  }

  protected async deleteAccount(): Promise<void> {
    const u = this.auth.user();
    if (!u) return;
    const ok = await this.confirm.ask({
      title: 'Delete your account?',
      message: `This permanently deletes ${u.email}, along with your saved trips and price alerts. This can’t be undone.`,
      confirmLabel: 'Delete account',
      danger: true,
    });
    if (!ok) return;
    this.deleteError.set('');
    this.deleting.set(true);
    try {
      const res = await this.auth.deleteAccount();
      if (!res.ok) {
        this.deleteError.set(res.message);
        return;
      }
      this.saved.removeAllFor(u.id);
      this.alerts.removeAllFor(u.id);
      this.toast.success('Your account was deleted');
    } finally {
      this.deleting.set(false);
    }
  }

  protected saveName(e: Event): void {
    e.preventDefault();
    if (!this.name().trim()) {
      this.toast.error('Your name can’t be empty.');
      return;
    }
    this.auth.updateName(this.name());
    this.toast.success('Profile saved');
  }
}
