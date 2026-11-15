import { Component, computed, inject, output, signal } from '@angular/core';
import { BookingFlowService } from '../../core/services/booking-flow.service';
import { CardBrand, cardBrand, cvcValid, digitsOnly, expiryValid, formatCardNumber, formatExpiry, luhn, simulateAuthorization } from '../../core/util/card.util';
import { IconComponent } from '../../shared/components/icon.component';
import { ModalComponent } from '../../shared/components/modal.component';
import { MoneyPipe } from '../../shared/components/money.pipe';

export interface PaymentResult {
  brand: string;
  last4: string;
}

@Component({
  selector: 'app-payment-step',
  imports: [IconComponent, ModalComponent, MoneyPipe],
  template: `
    <form class="card p-5 sm:p-7" (submit)="pay($event)" novalidate aria-label="Payment">
      <h2 class="flex items-center gap-2 text-xl font-bold"><app-icon name="credit-card" [size]="21" /> Payment</h2>
      <p class="mt-1 flex items-center gap-2 text-sm text-muted"><app-icon name="lock" [size]="14" /> Secure demo checkout — no real charge is made and card details are never stored.</p>

      <div class="mt-6 grid gap-4 sm:grid-cols-2">
        <div class="sm:col-span-2">
          <label class="label" for="cc-name">Name on card</label>
          <input id="cc-name" class="input" autocomplete="cc-name" [value]="name()" [attr.aria-invalid]="show('name')" (input)="name.set($any($event.target).value)" (blur)="touch('name')" />
          @if (show('name')) { <p class="field-error">Enter the name shown on your card.</p> }
        </div>
        <div class="sm:col-span-2">
          <label class="label" for="cc-num">Card number</label>
          <div class="relative">
            <input id="cc-num" class="input !pr-24 tabular-nums" inputmode="numeric" autocomplete="cc-number" placeholder="4242 4242 4242 4242" [value]="number()" [attr.aria-invalid]="show('number')" [attr.aria-describedby]="show('number') ? 'cc-num-e' : null" (input)="onNumber($any($event.target))" (blur)="touch('number')" />
            <span class="badge absolute right-3 top-1/2 -translate-y-1/2">{{ brand() }}</span>
          </div>
          @if (show('number')) { <p class="field-error" id="cc-num-e">Enter a valid card number.</p> }
        </div>
        <div>
          <label class="label" for="cc-exp">Expiry (MM/YY)</label>
          <input id="cc-exp" class="input tabular-nums" inputmode="numeric" autocomplete="cc-exp" placeholder="MM/YY" [value]="expiry()" [attr.aria-invalid]="show('expiry')" (input)="onExpiry($any($event.target))" (blur)="touch('expiry')" />
          @if (show('expiry')) { <p class="field-error">Enter a valid future expiry date.</p> }
        </div>
        <div>
          <label class="label" for="cc-cvc">Security code</label>
          <input id="cc-cvc" class="input tabular-nums" inputmode="numeric" autocomplete="cc-csc" [placeholder]="brand() === 'Amex' ? '4 digits' : '3 digits'" [value]="cvc()" maxlength="4" [attr.aria-invalid]="show('cvc')" (input)="cvc.set(digits($any($event.target).value))" (blur)="touch('cvc')" />
          @if (show('cvc')) { <p class="field-error">Enter the {{ brand() === 'Amex' ? '4' : '3' }}-digit security code.</p> }
        </div>
        <div class="sm:col-span-2">
          <label class="label" for="cc-zip">Billing postal code</label>
          <input id="cc-zip" class="input" autocomplete="postal-code" [value]="zip()" [attr.aria-invalid]="show('zip')" (input)="zip.set($any($event.target).value)" (blur)="touch('zip')" />
          @if (show('zip')) { <p class="field-error">Enter your billing postal code.</p> }
        </div>
      </div>

      <details class="mt-4 text-sm text-muted">
        <summary class="cursor-pointer font-semibold text-accent">Demo test cards</summary>
        <ul class="mt-2 grid gap-1">
          <li><code>4242 4242 4242 4242</code> — approved</li>
          <li><code>4000 0000 0000 3220</code> — 3-D Secure challenge (code <code>123456</code>)</li>
          <li><code>4000 0000 0000 0002</code> — declined</li>
          <li><code>4000 0000 0000 9995</code> — insufficient funds</li>
          <li>Orders above $1,500 always trigger 3-D Secure. Use any future expiry and CVC.</li>
        </ul>
      </details>

      <label class="mt-6 flex cursor-pointer items-start gap-3 text-sm">
        <input type="checkbox" class="check mt-0.5" [checked]="agree()" [attr.aria-invalid]="show('agree')" (change)="agree.set($any($event.target).checked)" />
        <span>I have checked every traveler's name matches their passport, and I accept the fare rules, baggage allowance and <span class="text-accent">terms of carriage</span>.</span>
      </label>
      @if (show('agree')) { <p class="field-error">Please accept the terms to continue.</p> }

      @if (error()) { <p class="form-error mt-5" role="alert">{{ error() }}</p> }

      <div class="mt-6 flex flex-wrap items-center justify-between gap-3">
        <button type="button" class="btn btn-ghost" [disabled]="busy()" (click)="back.emit()"><app-icon name="arrow-left" [size]="17" /> Back</button>
        <button type="submit" class="btn btn-primary btn-lg" [disabled]="busy()">
          @if (busy()) { <span class="spinner" aria-hidden="true"></span> Processing… } @else { <app-icon name="lock" [size]="17" /> Pay {{ flow.pricing().totalUsd | money: 2 }} }
        </button>
      </div>
    </form>

    @if (challenge()) {
      <app-modal heading="Verify your payment" subtitle="Your bank requires 3-D Secure authentication." (closed)="cancelChallenge()">
        <form (submit)="verify($event)" novalidate>
          <p class="text-sm text-muted">We sent a 6-digit code to the phone linked to your card ending <strong class="text-[var(--text)]">{{ last4() }}</strong>. <span class="font-semibold text-accent">Demo: enter 123456.</span></p>
          <label class="label mt-4" for="otp">Verification code</label>
          <input id="otp" class="input text-center font-display text-2xl tracking-[0.5em]" inputmode="numeric" maxlength="6" autocomplete="one-time-code" [value]="otp()" [attr.aria-invalid]="otpError() !== ''" (input)="otp.set(digits($any($event.target).value))" />
          @if (otpError()) { <p class="field-error" role="alert">{{ otpError() }}</p> }
          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" (click)="cancelChallenge()">Cancel</button>
            <button type="submit" class="btn btn-primary" [disabled]="busy()">Verify &amp; pay</button>
          </div>
        </form>
      </app-modal>
    }
  `,
})
export class PaymentStepComponent {
  readonly back = output<void>();
  readonly paid = output<PaymentResult>();

  protected readonly flow = inject(BookingFlowService);

  protected readonly name = signal('');
  protected readonly number = signal('');
  protected readonly expiry = signal('');
  protected readonly cvc = signal('');
  protected readonly zip = signal('');
  protected readonly agree = signal(false);
  protected readonly touched = signal<ReadonlySet<string>>(new Set());
  protected readonly submitted = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly challenge = signal(false);
  protected readonly otp = signal('');
  protected readonly otpError = signal('');
  private attempts = 0;

  protected readonly brand = computed<CardBrand>(() => cardBrand(this.number()));
  protected readonly last4 = computed(() => digitsOnly(this.number()).slice(-4));
  protected readonly errors = computed(() => {
    const e: Record<string, boolean> = {};
    if (this.name().trim().length < 2) e['name'] = true;
    if (!luhn(this.number()) || digitsOnly(this.number()).length < (this.brand() === 'Amex' ? 15 : 16)) e['number'] = true;
    if (!expiryValid(this.expiry())) e['expiry'] = true;
    if (!cvcValid(this.cvc(), this.brand())) e['cvc'] = true;
    if (this.zip().trim().length < 3) e['zip'] = true;
    if (!this.agree()) e['agree'] = true;
    return e;
  });

  protected digits = digitsOnly;

  protected show(k: string): boolean {
    return !!this.errors()[k] && (this.submitted() || (this.touched().has(k) && k !== 'agree'));
  }
  protected touch(k: string): void {
    this.touched.update((s) => new Set(s).add(k));
  }

  protected onNumber(el: HTMLInputElement): void {
    const f = formatCardNumber(el.value);
    el.value = f;
    this.number.set(f);
  }
  protected onExpiry(el: HTMLInputElement): void {
    const f = formatExpiry(el.value);
    el.value = f;
    this.expiry.set(f);
  }

  protected async pay(e: Event): Promise<void> {
    e.preventDefault();
    if (this.busy()) return;
    this.submitted.set(true);
    this.error.set('');
    if (Object.keys(this.errors()).length > 0) {
      queueMicrotask(() => document.querySelector<HTMLElement>('form[aria-label="Payment"] [aria-invalid="true"]')?.focus());
      return;
    }
    this.busy.set(true);
    await new Promise((r) => setTimeout(r, 1300));
    const outcome = simulateAuthorization(this.number(), this.flow.pricing().totalUsd);
    if (outcome.kind === 'declined') {
      this.busy.set(false);
      this.error.set(outcome.message);
      return;
    }
    if (outcome.kind === 'challenge') {
      this.busy.set(false);
      this.attempts = 0;
      this.otp.set('');
      this.otpError.set('');
      this.challenge.set(true);
      return;
    }
    this.complete();
  }

  protected async verify(e: Event): Promise<void> {
    e.preventDefault();
    if (this.busy()) return;
    if (this.otp().length !== 6) {
      this.otpError.set('Enter the 6-digit code.');
      return;
    }
    this.busy.set(true);
    await new Promise((r) => setTimeout(r, 900));
    if (this.otp() !== '123456') {
      this.attempts++;
      this.busy.set(false);
      if (this.attempts >= 3) {
        this.challenge.set(false);
        this.error.set('Too many incorrect codes — the payment was cancelled. No money was taken.');
        return;
      }
      this.otpError.set(`That code isn’t right. ${3 - this.attempts} attempt${3 - this.attempts === 1 ? '' : 's'} left.`);
      return;
    }
    this.challenge.set(false);
    this.complete();
  }

  protected cancelChallenge(): void {
    this.challenge.set(false);
    this.busy.set(false);
    this.error.set('Payment cancelled — you have not been charged.');
  }

  private complete(): void {
    const brand = this.brand();
    const last4 = this.last4();
    this.paid.emit({ brand, last4 });
  }
}
