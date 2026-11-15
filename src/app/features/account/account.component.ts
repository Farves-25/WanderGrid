import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { BookingsService } from '../../core/services/bookings.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { ToastService } from '../../core/services/toast.service';
import { TravelersService } from '../../core/services/travelers.service';
import { countryName } from '../../core/util/passenger-validation';
import { IconComponent } from '../../shared/components/icon.component';

const TIERS = [
  { name: 'Explorer', min: 0, perk: 'Earn WanderMiles on every flight' },
  { name: 'Silver', min: 5_000, perk: 'Priority support' },
  { name: 'Gold', min: 20_000, perk: 'Free seat selection on Basic fares' },
  { name: 'Platinum', min: 50_000, perk: 'Lounge guide & bonus miles' },
];

@Component({
  selector: 'app-account',
  imports: [DecimalPipe, IconComponent],
  template: `
    <div class="page">
      <h1 class="rise text-4xl font-bold sm:text-5xl">Your <span class="gradient-text">account</span></h1>

      <div class="mt-8 grid items-start gap-6 lg:grid-cols-[1fr_1fr]">
        <section class="card rise p-6" aria-labelledby="prof-h">
          <h2 id="prof-h" class="text-xl font-bold">Profile</h2>
          <form class="mt-4 grid gap-4" (submit)="saveName($event)">
            <div>
              <label class="label" for="acc-name">Full name</label>
              <input id="acc-name" class="input" [value]="name()" maxlength="60" (input)="name.set($any($event.target).value)" />
            </div>
            <div>
              <label class="label" for="acc-email">Email</label>
              <input id="acc-email" class="input" [value]="auth.user()?.email" readonly />
            </div>
            <div><button type="submit" class="btn btn-primary btn-sm">Save profile</button></div>
          </form>
        </section>

        <section class="miles-card rise [animation-delay:60ms]" aria-labelledby="miles-h">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h2 id="miles-h" class="text-sm font-bold uppercase tracking-widest text-white/80">WanderMiles</h2>
              <p class="mt-1 font-display text-5xl font-bold">{{ bookings.miles() | number }}</p>
              <p class="mt-1 text-white/90">{{ tier().name }} member · {{ tier().perk }}</p>
            </div>
            <app-icon name="award" [size]="40" />
          </div>
          @if (next(); as n) {
            <div class="mt-5">
              <div class="h-2 overflow-hidden rounded-full bg-white/25" role="progressbar" aria-label="Progress to next tier" aria-valuemin="0" aria-valuemax="100" [attr.aria-valuenow]="progress()"><div class="h-full rounded-full bg-white" [style.width.%]="progress()"></div></div>
              <p class="mt-2 text-sm text-white/90">{{ n.min - bookings.miles() | number }} miles to {{ n.name }}</p>
            </div>
          }
        </section>

        <section class="card rise p-6 lg:col-span-2 [animation-delay:100ms]" aria-labelledby="trav-h">
          <div class="flex items-center justify-between gap-3">
            <h2 id="trav-h" class="text-xl font-bold">Saved travelers</h2>
            <span class="badge">{{ travelers.mine().length }}</span>
          </div>
          <p class="mt-1 text-sm text-muted">Saved automatically at checkout so you can autofill next time. Stored only on this device.</p>
          @if (travelers.mine().length > 0) {
            <ul class="mt-4 grid gap-3 sm:grid-cols-2">
              @for (t of travelers.mine(); track t.id) {
                <li class="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-solid-2)] p-4">
                  <div class="min-w-0">
                    <p class="truncate font-semibold">{{ t.title }} {{ t.firstName }} {{ t.lastName }}</p>
                    <p class="truncate text-xs text-muted">{{ countryName(t.nationality) }} · passport {{ mask(t.passportNo) }} · born {{ t.dob }}</p>
                  </div>
                  <button type="button" class="icon-btn icon-btn-danger" [attr.aria-label]="'Remove ' + t.firstName + ' ' + t.lastName" (click)="remove(t.id, t.firstName)"><app-icon name="trash-2" [size]="17" /></button>
                </li>
              }
            </ul>
          } @else {
            <p class="mt-4 rounded-2xl border border-dashed border-[var(--border-strong)] p-8 text-center text-muted">No saved travelers yet.</p>
          }
        </section>
      </div>
    </div>
  `,
})
export class AccountComponent {
  protected readonly auth = inject(AuthService);
  protected readonly bookings = inject(BookingsService);
  protected readonly travelers = inject(TravelersService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  protected readonly name = signal(this.auth.user()?.name ?? '');
  protected readonly countryName = countryName;

  protected readonly tier = computed(() => [...TIERS].reverse().find((t) => this.bookings.miles() >= t.min) ?? TIERS[0]);
  protected readonly next = computed(() => TIERS.find((t) => t.min > this.bookings.miles()) ?? null);
  protected readonly progress = computed(() => {
    const n = this.next();
    const cur = this.tier();
    return n ? Math.round(((this.bookings.miles() - cur.min) / (n.min - cur.min)) * 100) : 100;
  });

  protected mask(no: string): string {
    return no.length > 3 ? `••••${no.slice(-3)}` : no;
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

  protected async remove(id: string, first: string): Promise<void> {
    const ok = await this.confirm.ask({ title: `Remove ${first}?`, message: 'This traveler will no longer appear in autofill.', confirmLabel: 'Remove', danger: true });
    if (ok) this.travelers.remove(id);
  }
}
