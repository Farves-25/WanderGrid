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
      <div class="mx-auto flex h-16 w-full max-w-[1280px] items-center justify-between gap-3 px-4 md:px-8">
        <div class="flex items-center gap-8">
          <a routerLink="/" class="flex items-center gap-3" aria-label="WanderGrid home">
            <span class="brand-mark" aria-hidden="true"><app-icon name="plane" [size]="19" [stroke]="2.2" /></span>
            <span class="brand-word hidden min-[460px]:inline">Wander<em>Grid</em></span>
          </a>
          <nav class="hidden items-center gap-1 md:flex" aria-label="Main">
            <a class="nav-link" routerLink="/" routerLinkActive="is-active" [routerLinkActiveOptions]="{ exact: true }"><app-icon name="search" [size]="16" /> Flights</a>
            <a class="nav-link" routerLink="/saved" routerLinkActive="is-active"><app-icon name="bookmark" [size]="16" /> Saved trips</a>
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
          <select id="cur" class="select input-sm !w-[5.4rem] !border-transparent !bg-transparent font-semibold" [value]="prefs.currency()" (change)="prefs.setCurrency($any($event.target).value)">
            @for (c of currencies; track c.code) {
              <option [value]="c.code" [selected]="c.code === prefs.currency()">{{ c.code }}</option>
            }
          </select>
          <button type="button" class="icon-btn" (click)="theme.toggle()" [attr.aria-label]="theme.theme() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'">
            <app-icon [name]="theme.theme() === 'dark' ? 'sun' : 'moon'" [size]="19" />
          </button>

          @if (auth.user(); as user) {
            <div class="relative">
              <button type="button" class="flex items-center gap-2 rounded-full border border-[var(--border-strong)] py-1 pl-1 pr-3" aria-haspopup="menu" [attr.aria-expanded]="menuOpen()" (click)="menuOpen.set(!menuOpen()); mobileOpen.set(false); $event.stopPropagation()">
                <span class="brand-mark !h-8 !w-8 text-xs font-bold">{{ auth.initials() }}</span>
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
                  <a class="menu-item" role="menuitem" routerLink="/account" (click)="menuOpen.set(false)"><app-icon name="user" [size]="16" /> Account</a>
                  <a class="menu-item" role="menuitem" routerLink="/saved" (click)="menuOpen.set(false)"><app-icon name="bookmark" [size]="16" /> Saved trips</a>
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
                <a class="menu-item" routerLink="/saved" (click)="mobileOpen.set(false)"><app-icon name="bookmark" [size]="16" /> Saved trips</a>
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

    <footer class="site-footer no-print">
      <div class="mx-auto grid max-w-[1280px] gap-4 px-5 py-10 text-sm text-muted md:grid-cols-[auto_1fr] md:items-center md:gap-10 md:px-8">
        <p class="brand-word">Wander<em>Grid</em></p>
        <p class="max-w-3xl md:justify-self-end md:text-right">
      Flight schedules and prices are live from Google Flights. WanderGrid doesn’t sell tickets — you book and pay on the airline’s or travel agency’s own website, which confirms the final price.</p>
      </div>
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
