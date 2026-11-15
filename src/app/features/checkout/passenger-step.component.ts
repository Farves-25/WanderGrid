import { Component, OnInit, computed, inject, output, signal } from '@angular/core';
import { Passenger } from '../../core/models/flight.model';
import { AuthService } from '../../core/services/auth.service';
import { BookingFlowService } from '../../core/services/booking-flow.service';
import { TravelersService } from '../../core/services/travelers.service';
import { addDays } from '../../core/util/date.util';
import { COUNTRIES, PassengerErrors, validateContact, validatePassenger } from '../../core/util/passenger-validation';
import { IconComponent } from '../../shared/components/icon.component';

type PKey = keyof Passenger;

@Component({
  selector: 'app-passenger-step',
  imports: [IconComponent],
  template: `
    <form (submit)="next($event)" novalidate aria-label="Traveler details">
      <div class="mb-5 flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--accent-soft)] p-4 text-sm">
        <app-icon name="info" [size]="18" />
        <p>Enter names <strong>exactly as shown on each passport</strong>. Your passport must be valid for at least 6 months after your last flight ({{ minExpiry() }}). Visa requirements depend on your nationality — check before you travel.</p>
      </div>

      <div class="grid gap-5">
        @for (p of list(); track $index; let i = $index) {
          <fieldset class="card p-5 sm:p-6">
            <legend class="sr-only">Traveler {{ i + 1 }}</legend>
            <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 class="flex items-center gap-2.5 text-lg font-bold">
                <span class="grid h-8 w-8 place-items-center rounded-full bg-[var(--accent-soft)] text-sm text-accent">{{ i + 1 }}</span>
                Traveler {{ i + 1 }} <span class="badge">{{ typeLabel(p.type) }}</span>
              </h2>
              @if (travelers.mine().length > 0) {
                <div>
                  <label class="sr-only" [for]="'saved-' + i">Autofill traveler {{ i + 1 }} from a saved traveler</label>
                  <select [id]="'saved-' + i" class="select input-sm !w-auto" (change)="autofill(i, $any($event.target).value); $any($event.target).value = ''">
                    <option value="">Autofill from saved…</option>
                    @for (t of travelers.mine(); track t.id) { <option [value]="t.id">{{ t.firstName }} {{ t.lastName }}</option> }
                  </select>
                </div>
              }
            </div>

            <div class="grid gap-4 sm:grid-cols-6">
              @if (p.type === 'adult') {
                <div class="sm:col-span-1">
                  <label class="label" [for]="f('title', i)">Title</label>
                  <select [id]="f('title', i)" class="select" [value]="p.title" [attr.aria-invalid]="bad(i, 'title')" (change)="set(i, 'title', $any($event.target).value)" (blur)="touch(i, 'title')">
                    <option value="">—</option>
                    @for (t of titles; track t) { <option [value]="t" [selected]="p.title === t">{{ t }}</option> }
                  </select>
                  @if (bad(i, 'title')) { <p class="field-error">{{ err(i, 'title') }}</p> }
                </div>
              }
              <div [class]="p.type === 'adult' ? 'sm:col-span-2' : 'sm:col-span-3'">
                <label class="label" [for]="f('first', i)">First &amp; middle names</label>
                <input [id]="f('first', i)" class="input" [value]="p.firstName" autocomplete="given-name" maxlength="30" [attr.aria-invalid]="bad(i, 'firstName')" [attr.aria-describedby]="bad(i, 'firstName') ? f('first', i) + '-e' : null" (input)="set(i, 'firstName', $any($event.target).value)" (blur)="touch(i, 'firstName')" />
                @if (bad(i, 'firstName')) { <p class="field-error" [id]="f('first', i) + '-e'">{{ err(i, 'firstName') }}</p> }
              </div>
              <div [class]="p.type === 'adult' ? 'sm:col-span-3' : 'sm:col-span-3'">
                <label class="label" [for]="f('last', i)">Last name</label>
                <input [id]="f('last', i)" class="input" [value]="p.lastName" autocomplete="family-name" maxlength="30" [attr.aria-invalid]="bad(i, 'lastName')" [attr.aria-describedby]="bad(i, 'lastName') ? f('last', i) + '-e' : null" (input)="set(i, 'lastName', $any($event.target).value)" (blur)="touch(i, 'lastName')" />
                @if (bad(i, 'lastName')) { <p class="field-error" [id]="f('last', i) + '-e'">{{ err(i, 'lastName') }}</p> }
              </div>

              <div class="sm:col-span-3">
                <label class="label" [for]="f('dob', i)">Date of birth</label>
                <input [id]="f('dob', i)" class="input" type="date" [value]="p.dob" [max]="firstDate()" [attr.aria-invalid]="bad(i, 'dob')" [attr.aria-describedby]="bad(i, 'dob') ? f('dob', i) + '-e' : null" (input)="set(i, 'dob', $any($event.target).value)" (blur)="touch(i, 'dob')" />
                @if (bad(i, 'dob')) { <p class="field-error" [id]="f('dob', i) + '-e'">{{ err(i, 'dob') }}</p> }
              </div>
              <div class="sm:col-span-3">
                <label class="label" [for]="f('gender', i)">Gender (as on passport)</label>
                <select [id]="f('gender', i)" class="select" [value]="p.gender" [attr.aria-invalid]="bad(i, 'gender')" (change)="set(i, 'gender', $any($event.target).value)" (blur)="touch(i, 'gender')">
                  <option value="">Select…</option>
                  <option value="F" [selected]="p.gender === 'F'">Female</option>
                  <option value="M" [selected]="p.gender === 'M'">Male</option>
                  <option value="X" [selected]="p.gender === 'X'">Unspecified (X)</option>
                </select>
                @if (bad(i, 'gender')) { <p class="field-error">{{ err(i, 'gender') }}</p> }
              </div>

              <div class="sm:col-span-3">
                <label class="label" [for]="f('nat', i)">Nationality</label>
                <select [id]="f('nat', i)" class="select" [value]="p.nationality" [attr.aria-invalid]="bad(i, 'nationality')" (change)="set(i, 'nationality', $any($event.target).value)" (blur)="touch(i, 'nationality')">
                  <option value="">Select…</option>
                  @for (c of countries; track c.cc) { <option [value]="c.cc" [selected]="p.nationality === c.cc">{{ c.name }}</option> }
                </select>
                @if (bad(i, 'nationality')) { <p class="field-error">{{ err(i, 'nationality') }}</p> }
              </div>
              <div class="sm:col-span-3">
                <label class="label" [for]="f('pc', i)">Passport issued by</label>
                <select [id]="f('pc', i)" class="select" [value]="p.passportCountry" [attr.aria-invalid]="bad(i, 'passportCountry')" (change)="set(i, 'passportCountry', $any($event.target).value)" (blur)="touch(i, 'passportCountry')">
                  <option value="">Select…</option>
                  @for (c of countries; track c.cc) { <option [value]="c.cc" [selected]="p.passportCountry === c.cc">{{ c.name }}</option> }
                </select>
                @if (bad(i, 'passportCountry')) { <p class="field-error">{{ err(i, 'passportCountry') }}</p> }
              </div>

              <div class="sm:col-span-3">
                <label class="label" [for]="f('pn', i)">Passport number</label>
                <input [id]="f('pn', i)" class="input uppercase" [value]="p.passportNo" maxlength="9" autocomplete="off" [attr.aria-invalid]="bad(i, 'passportNo')" [attr.aria-describedby]="bad(i, 'passportNo') ? f('pn', i) + '-e' : null" (input)="set(i, 'passportNo', $any($event.target).value)" (blur)="touch(i, 'passportNo')" />
                @if (bad(i, 'passportNo')) { <p class="field-error" [id]="f('pn', i) + '-e'">{{ err(i, 'passportNo') }}</p> }
              </div>
              <div class="sm:col-span-3">
                <label class="label" [for]="f('pe', i)">Passport expiry</label>
                <input [id]="f('pe', i)" class="input" type="date" [value]="p.passportExpiry" [attr.aria-invalid]="bad(i, 'passportExpiry')" [attr.aria-describedby]="bad(i, 'passportExpiry') ? f('pe', i) + '-e' : null" (input)="set(i, 'passportExpiry', $any($event.target).value)" (blur)="touch(i, 'passportExpiry')" />
                @if (bad(i, 'passportExpiry')) { <p class="field-error" [id]="f('pe', i) + '-e'">{{ err(i, 'passportExpiry') }}</p> }
              </div>
            </div>
          </fieldset>
        }

        <fieldset class="card p-5 sm:p-6">
          <legend class="sr-only">Contact details</legend>
          <h2 class="mb-1 text-lg font-bold">Contact details</h2>
          <p class="mb-4 text-sm text-muted">We’ll send your e-ticket and any schedule changes here.</p>
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label class="label" for="c-email">Email</label>
              <input id="c-email" class="input" type="email" [value]="contact().email" autocomplete="email" [attr.aria-invalid]="cBad('email')" (input)="setContact('email', $any($event.target).value)" (blur)="cTouched.set(true)" />
              @if (cBad('email')) { <p class="field-error">{{ cErr().email }}</p> }
            </div>
            <div>
              <label class="label" for="c-phone">Mobile phone</label>
              <input id="c-phone" class="input" type="tel" [value]="contact().phone" autocomplete="tel" placeholder="+44 7700 900123" [attr.aria-invalid]="cBad('phone')" (input)="setContact('phone', $any($event.target).value)" (blur)="cTouched.set(true)" />
              @if (cBad('phone')) { <p class="field-error">{{ cErr().phone }}</p> }
            </div>
          </div>
          <label class="mt-5 flex cursor-pointer items-center gap-3 text-sm">
            <input type="checkbox" class="check" [checked]="saveTravelers()" (change)="saveTravelers.set($any($event.target).checked)" /> Save these travelers to my account for next time
          </label>
        </fieldset>
      </div>

      @if (showAll() && !allValid()) {
        <p class="form-error mt-5" role="alert">Please fix the highlighted fields to continue.</p>
      }
      <div class="mt-6 flex justify-end">
        <button type="submit" class="btn btn-primary btn-lg">Continue to extras <app-icon name="arrow-right" [size]="18" /></button>
      </div>
    </form>
  `,
})
export class PassengerStepComponent implements OnInit {
  readonly done = output<void>();

  protected readonly flow = inject(BookingFlowService);
  private readonly auth = inject(AuthService);
  protected readonly travelers = inject(TravelersService);

  protected readonly countries = COUNTRIES;
  protected readonly titles = ['Mr', 'Ms', 'Mrs', 'Mx'] as const;

  protected readonly list = signal<Passenger[]>([]);
  protected readonly contact = signal({ email: '', phone: '' });
  protected readonly touched = signal<ReadonlySet<string>>(new Set());
  protected readonly cTouched = signal(false);
  protected readonly showAll = signal(false);
  protected readonly saveTravelers = signal(true);

  protected readonly firstDate = computed(() => this.flow.travelDates()?.first ?? '');
  protected readonly minExpiry = computed(() => {
    const last = this.flow.travelDates()?.last;
    return last ? addDays(last, 183) : '';
  });
  protected readonly errors = computed<PassengerErrors[]>(() => {
    const d = this.flow.travelDates();
    return d ? this.list().map((p) => validatePassenger(p, d.first, d.last)) : [];
  });
  protected readonly cErr = computed(() => validateContact(this.contact()));
  protected readonly allValid = computed(() => this.errors().every((e) => Object.keys(e).length === 0) && Object.keys(this.cErr()).length === 0);

  ngOnInit(): void {
    this.list.set(this.flow.passengers().map((p) => ({ ...p })));
    const c = this.flow.contact();
    this.contact.set({ email: c.email || this.auth.user()?.email || '', phone: c.phone });
  }

  protected f(kind: string, i: number): string {
    return `p${i}-${kind}`;
  }

  protected typeLabel(t: Passenger['type']): string {
    return t === 'adult' ? 'Adult' : t === 'child' ? 'Child (2–11)' : 'Infant (under 2)';
  }

  protected set<K extends PKey>(i: number, key: K, value: Passenger[K]): void {
    const v = key === 'passportNo' ? (String(value).toUpperCase() as Passenger[K]) : value;
    this.list.update((l) => l.map((p, idx) => (idx === i ? { ...p, [key]: v } : p)));
    this.flow.setPassengers(this.list());
  }

  protected touch(i: number, key: PKey): void {
    this.touched.update((s) => new Set(s).add(`${i}.${key}`));
  }

  protected bad(i: number, key: PKey): boolean {
    return !!this.errors()[i]?.[key] && (this.showAll() || this.touched().has(`${i}.${key}`));
  }

  protected err(i: number, key: PKey): string {
    return this.errors()[i]?.[key] ?? '';
  }

  protected setContact(key: 'email' | 'phone', v: string): void {
    this.contact.update((c) => ({ ...c, [key]: v }));
    this.flow.setContact(this.contact());
  }

  protected cBad(key: 'email' | 'phone'): boolean {
    return !!this.cErr()[key] && (this.showAll() || this.cTouched());
  }

  protected autofill(i: number, id: string): void {
    const t = this.travelers.mine().find((x) => x.id === id);
    if (!t) return;
    this.list.update((l) => l.map((p, idx) => (idx === i ? this.fromSaved(t, p.type) : p)));
    this.flow.setPassengers(this.list());
  }

  private fromSaved(t: Passenger, type: Passenger['type']): Passenger {
    return {
      type,
      title: type === 'adult' ? t.title : '',
      firstName: t.firstName,
      lastName: t.lastName,
      dob: t.dob,
      gender: t.gender,
      nationality: t.nationality,
      passportNo: t.passportNo,
      passportExpiry: t.passportExpiry,
      passportCountry: t.passportCountry,
    };
  }

  protected next(e: Event): void {
    e.preventDefault();
    this.showAll.set(true);
    if (!this.allValid()) {
      queueMicrotask(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    if (this.saveTravelers()) for (const p of this.list()) this.travelers.save(p);
    this.flow.setPassengers(this.list());
    this.flow.setContact(this.contact());
    this.done.emit();
  }
}
