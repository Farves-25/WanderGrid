import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { BookingFlowService } from '../../core/services/booking-flow.service';
import { BookingsService } from '../../core/services/bookings.service';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent } from '../../shared/components/icon.component';
import { ExtrasStepComponent } from './extras-step.component';
import { PassengerStepComponent } from './passenger-step.component';
import { PaymentResult, PaymentStepComponent } from './payment-step.component';
import { PriceSummaryComponent } from './price-summary.component';

const STEPS = [
  { n: 1, label: 'Travelers', icon: 'users' },
  { n: 2, label: 'Extras & seats', icon: 'armchair' },
  { n: 3, label: 'Payment', icon: 'credit-card' },
];

@Component({
  selector: 'app-checkout',
  imports: [RouterLink, IconComponent, PassengerStepComponent, ExtrasStepComponent, PaymentStepComponent, PriceSummaryComponent],
  template: `
    @if (flow.allSelected()) {
      <div class="page">
        <a [routerLink]="['/flights']" [queryParams]="backQuery()" class="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-[var(--text)]"><app-icon name="chevron-left" [size]="16" /> Back to flights</a>

        <ol class="mb-8 flex items-center gap-2 sm:gap-4" aria-label="Checkout progress">
          @for (s of steps; track s.n) {
            <li class="flex flex-1 items-center gap-2 sm:gap-3" [attr.aria-current]="step() === s.n ? 'step' : null">
              <span class="step-dot" [class.is-active]="step() === s.n" [class.is-done]="step() > s.n">
                @if (step() > s.n) { <app-icon name="check" [size]="14" [stroke]="3" /> } @else { {{ s.n }} }
              </span>
              <span class="hidden text-sm font-semibold sm:block" [class.text-muted]="step() < s.n">{{ s.label }}</span>
              @if (s.n < 3) { <span class="h-px flex-1 bg-[var(--border-strong)]" aria-hidden="true"></span> }
            </li>
          }
        </ol>

        <div class="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <section [attr.aria-label]="steps[step() - 1].label" class="min-w-0">
            <h1 class="mb-5 text-3xl font-bold">{{ heading() }}</h1>
            @switch (step()) {
              @case (1) { <app-passenger-step (done)="go(2)" /> }
              @case (2) { <app-extras-step (done)="go(3)" (back)="go(1)" /> }
              @case (3) { <app-payment-step (back)="go(2)" (paid)="onPaid($event)" /> }
            }
          </section>
          <aside class="lg:sticky lg:top-24" aria-label="Order summary"><app-price-summary /></aside>
        </div>
      </div>
    } @else {
      <div class="page"><div class="glass mx-auto mt-10 max-w-lg p-10 text-center">
        <app-icon name="plane" [size]="34" />
        <h1 class="mt-3 text-2xl font-bold">Nothing to check out yet</h1>
        <p class="mt-2 text-muted">Search for flights and pick your fares first.</p>
        <a routerLink="/" class="btn btn-primary mt-6">Search flights</a>
      </div></div>
    }
  `,
})
export class CheckoutComponent implements OnInit {
  protected readonly flow = inject(BookingFlowService);
  private readonly bookings = inject(BookingsService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly steps = STEPS;
  protected readonly step = signal(1);
  protected readonly heading = computed(() => ['Who’s travelling?', 'Make it yours', 'Pay securely'][this.step() - 1]);

  protected readonly backQuery = computed(() => {
    const p = this.flow.params();
    return p
      ? { type: p.type, legs: p.legs.map((l) => `${l.from}.${l.to}.${l.date}`).join('~'), adt: p.adults, chd: p.children, inf: p.infants, cabin: p.cabin }
      : {};
  });

  ngOnInit(): void {
    window.scrollTo({ top: 0 });
  }

  protected go(n: number): void {
    this.step.set(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected async onPaid(p: PaymentResult): Promise<void> {
    const booking = this.bookings.create(p);
    if (!booking) {
      this.toast.error('We couldn’t complete your booking. Please try again.');
      return;
    }
    this.toast.success(`Booking confirmed — reference ${booking.ref}`);
    await this.router.navigate(['/booking', booking.ref], { queryParams: { new: 1 } });
    this.flow.reset();
  }
}
