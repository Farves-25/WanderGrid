import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CURRENCIES } from './core/models/flight.model';
import { AlertsService } from './core/services/alerts.service';
import { AuthService } from './core/services/auth.service';
import { PreferencesService } from './core/services/preferences.service';
import { ThemeService } from './core/services/theme.service';
import { ConfirmHostComponent } from './shared/components/confirm-host.component';
import { IconComponent } from './shared/components/icon.component';
import { OfflineBannerComponent } from './shared/components/offline-banner.component';
import { ToastHostComponent } from './shared/components/toast-host.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent, OfflineBannerComponent, ToastHostComponent, ConfirmHostComponent],
  host: {
    '(document:click)': 'menuOpen.set(false); mobileOpen.set(false)',
    '(document:keydown.escape)': 'menuOpen.set(false); mobileOpen.set(false)',
  },
  template: `
    <a class="skip-link" href="#main">Skip to content</a>
    <app-offline-banner />
    <header class="topbar no-print">
      <div class="mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between gap-3 px-4 md:px-8">
        <div class="flex items-center gap-8">
          <a routerLink="/" class="flex items-center gap-3" aria-label="WanderGrid home">
            <span class="brand-mark" aria-hidden="true"><app-icon name="plane" [size]="21" [stroke]="2.4" /></span>
            <span class="hidden font-display text-xl font-bold tracking-tight min-[460px]:inline">Wander<span class="gradient-text">Grid</span></span>
          </a>
          <nav class="hidden items-center gap-1 md:flex" aria-label="Main">
            <a class="nav-link" routerLink="/" routerLinkActive="is-active" [routerLinkActiveOptions]="{ exact: true }"><app-icon name="search" [size]="16" /> Flights</a>
            <a class="nav-link" routerLink="/bookings" routerLinkActive="is-active"><app-icon name="ticket" [size]="16" /> My trips</a>
            <a class="nav-link" routerLink="/alerts" routerLinkActive="is-active">
              <app-icon name="bell" [size]="16" /> Price alerts
              @if (alerts.triggeredCount() > 0) {
                <span class="badge badge-ok !px-1.5">{{ alerts.triggeredCount() }}<span class="sr-only"> alerts triggered</span></span>
              }
            </a>
          </nav>
        </div>

        <div class="flex items-center gap-1.5">
          <label class="sr-only" for="cur">Currency</label>
          <select id="cur" class="select input-sm !w-[5.4rem] !bg-transparent" [value]="prefs.currency()" (change)="prefs.setCurrency($any($event.target).value)">
            @for (c of currencies; track c.code) {
              <option [value]="c.code" [selected]="c.code === prefs.currency()">{{ c.code }}</option>
            }
          </select>
          <button type="button" class="icon-btn" (click)="theme.toggle()" [attr.aria-label]="theme.theme() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'">
            <app-icon [name]="theme.theme() === 'dark' ? 'sun' : 'moon'" [size]="19" />
          </button>

          @if (auth.user(); as user) {
            <div class="relative">
              <button type="button" class="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] py-1 pl-1 pr-3" aria-haspopup="menu" [attr.aria-expanded]="menuOpen()" (click)="menuOpen.set(!menuOpen()); mobileOpen.set(false); $event.stopPropagation()">
                <span class="brand-mark !h-8 !w-8 !rounded-xl text-xs font-bold text-white">{{ auth.initials() }}</span>
                <span class="hidden max-w-[9rem] truncate text-sm font-semibold sm:block">{{ user.name }}</span>
                <app-icon name="chevron-down" [size]="15" />
              </button>
              @if (menuOpen()) {
                <div class="menu" role="menu" (click)="$event.stopPropagation()">
                  <div class="px-3 pb-2 pt-1.5">
                    <p class="truncate text-sm font-semibold">{{ user.name }}</p>
                    <p class="truncate text-xs text-faint">{{ user.email }}</p>
                  </div>
                  <div class="menu-sep"></div>
                  <a class="menu-item" role="menuitem" routerLink="/account" (click)="menuOpen.set(false)"><app-icon name="user" [size]="16" /> Account &amp; travelers</a>
                  <a class="menu-item" role="menuitem" routerLink="/bookings" (click)="menuOpen.set(false)"><app-icon name="ticket" [size]="16" /> My trips</a>
                  <div class="menu-sep"></div>
                  <button type="button" class="menu-item" role="menuitem" (click)="signOut()"><app-icon name="log-out" [size]="16" /> Sign out</button>
                </div>
              }
            </div>
          } @else {
            <a routerLink="/login" class="btn btn-sm btn-primary">Sign in</a>
          }

          <div class="relative md:hidden">
            <button type="button" class="icon-btn" aria-label="Menu" aria-haspopup="menu" [attr.aria-expanded]="mobileOpen()" (click)="mobileOpen.set(!mobileOpen()); menuOpen.set(false); $event.stopPropagation()">
              <app-icon name="menu" [size]="21" />
            </button>
            @if (mobileOpen()) {
              <nav class="menu" aria-label="Mobile" (click)="$event.stopPropagation()">
                <a class="menu-item" routerLink="/" (click)="mobileOpen.set(false)"><app-icon name="search" [size]="16" /> Flights</a>
                <a class="menu-item" routerLink="/bookings" (click)="mobileOpen.set(false)"><app-icon name="ticket" [size]="16" /> My trips</a>
                <a class="menu-item" routerLink="/alerts" (click)="mobileOpen.set(false)"><app-icon name="bell" [size]="16" /> Price alerts</a>
              </nav>
            }
          </div>
        </div>
      </div>
    </header>

    <main id="main" tabindex="-1" class="outline-none">
      <router-outlet />
    </main>

    <footer class="no-print mx-auto max-w-[1440px] px-4 pb-10 pt-4 text-center text-xs text-faint md:px-8">
      WanderGrid is a demonstration booking platform. Flights, fares and payments are simulated — no real tickets are issued and no card is ever charged.
    </footer>

    <app-toast-host />
    <app-confirm-host />
  `,
})
export class App {
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  protected readonly prefs = inject(PreferencesService);
  protected readonly alerts = inject(AlertsService);
  private readonly router = inject(Router);

  protected readonly currencies = CURRENCIES;
  protected readonly menuOpen = signal(false);
  protected readonly mobileOpen = signal(false);

  protected async signOut(): Promise<void> {
    this.menuOpen.set(false);
    await this.auth.signOut();
    void this.router.navigateByUrl('/');
  }
}
