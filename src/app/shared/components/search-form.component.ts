import { Component, effect, inject, input, output, signal } from '@angular/core';
import { CABIN_LABEL, Cabin, SearchLeg, SearchParams, TripType } from '../../core/models/flight.model';
import { PreferencesService } from '../../core/services/preferences.service';
import { addDays, formatDate, todayIso } from '../../core/util/date.util';
import { MAX_ADVANCE_DAYS, validateSearch } from '../../core/util/search-query';
import { AirportComboboxComponent } from './airport-combobox.component';
import { IconComponent } from './icon.component';
import { PassengerPickerComponent } from './passenger-picker.component';

const TYPES: { id: TripType; label: string }[] = [
  { id: 'round', label: 'Round trip' },
  { id: 'oneway', label: 'One way' },
  { id: 'multi', label: 'Multi-city' },
];

@Component({
  selector: 'app-search-form',
  imports: [AirportComboboxComponent, PassengerPickerComponent, IconComponent],
  template: `
    <form class="glass p-4 sm:p-6" (submit)="submit($event)" novalidate aria-label="Flight search">
      <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div class="tabs" role="group" aria-label="Trip type">
          @for (t of types; track t.id) {
            <button type="button" class="tab !min-h-[36px] !px-3 text-[0.82rem] whitespace-nowrap sm:!px-4 sm:text-[0.9rem]" [attr.aria-pressed]="type() === t.id" [class.is-on]="type() === t.id" (click)="setType(t.id)">{{ t.label }}</button>
          }
        </div>
        <div class="flex items-center gap-2">
          <label class="sr-only" for="sf-cabin">Cabin class</label>
          <select id="sf-cabin" class="select input-sm !w-auto" [value]="cabin()" (change)="cabin.set($any($event.target).value)">
            @for (c of cabins; track c.id) {
              <option [value]="c.id" [selected]="c.id === cabin()">{{ c.label }}</option>
            }
          </select>
        </div>
      </div>

      @if (type() !== 'multi') {
        <div class="grid items-end gap-3 md:grid-cols-2 xl:grid-cols-[1.25fr_auto_1.25fr_1fr_1fr_1fr]">
          <app-airport-combobox [(code)]="from" label="From" icon="plane-takeoff" [invalid]="bad() === 'from'" />
          <button type="button" class="icon-btn mx-auto !h-11 !w-11 !border-[var(--border)] max-md:hidden" aria-label="Swap origin and destination" (click)="swap()">
            <app-icon name="arrow-right-left" [size]="18" />
          </button>
          <app-airport-combobox [(code)]="to" label="To" icon="plane-landing" [invalid]="bad() === 'to'" />
          <div>
            <label class="label" for="sf-dep">Depart</label>
            <input id="sf-dep" class="input" type="date" [min]="today" [max]="maxDate" [value]="depart()" [attr.aria-invalid]="bad() === 'depart'" (input)="onDepart($any($event.target).value)" />
            <p class="mt-1 text-xs text-faint">{{ weekday(depart()) }}</p>
          </div>
          @if (type() === 'round') {
            <div>
              <label class="label" for="sf-ret">Return</label>
              <input id="sf-ret" class="input" type="date" [min]="depart() || today" [max]="maxDate" [value]="ret()" [attr.aria-invalid]="bad() === 'ret'" (input)="ret.set($any($event.target).value)" />
              <p class="mt-1 text-xs text-faint">{{ weekday(ret()) }}</p>
            </div>
          } @else {
            <div class="hidden xl:block"></div>
          }
          <app-passenger-picker [(adults)]="adults" [(children)]="children" [(infants)]="infants" />
        </div>
      } @else {
        <div class="grid gap-3">
          @for (leg of multi(); track $index; let i = $index) {
            <div class="grid items-end gap-3 md:grid-cols-[1fr_1fr_12rem_auto]">
              <app-airport-combobox [code]="leg.from" (codeChange)="patchLeg(i, 'from', $event)" [label]="'Flight ' + (i + 1) + ' from'" icon="plane-takeoff" />
              <app-airport-combobox [code]="leg.to" (codeChange)="patchLeg(i, 'to', $event)" [label]="'Flight ' + (i + 1) + ' to'" icon="plane-landing" />
              <div>
                <label class="label" [for]="'sf-d' + i">Date</label>
                <input [id]="'sf-d' + i" class="input" type="date" [min]="i > 0 ? multi()[i - 1].date || today : today" [max]="maxDate" [value]="leg.date" (input)="patchLeg(i, 'date', $any($event.target).value)" />
              </div>
              <button type="button" class="icon-btn !h-11 !w-11 !border-[var(--border)]" [attr.aria-label]="'Remove flight ' + (i + 1)" [disabled]="multi().length <= 2" (click)="removeLeg(i)">
                <app-icon name="x" [size]="16" />
              </button>
            </div>
          }
          <div class="flex flex-wrap items-end justify-between gap-3">
            <button type="button" class="btn btn-sm" [disabled]="multi().length >= 5" (click)="addLeg()"><app-icon name="plus" [size]="15" /> Add another flight</button>
            <div class="w-full max-w-xs"><app-passenger-picker [(adults)]="adults" [(children)]="children" [(infants)]="infants" /></div>
          </div>
        </div>
      }

      @if (error()) {
        <p class="form-error mt-4" role="alert">{{ error() }}</p>
      }

      <div class="mt-5 flex justify-end">
        <button type="submit" class="btn btn-primary btn-lg w-full sm:w-auto"><app-icon name="search" [size]="19" /> Search flights</button>
      </div>
    </form>
  `,
})
export class SearchFormComponent {
  readonly initial = input<SearchParams | null>(null);
  readonly search = output<SearchParams>();

  private readonly prefs = inject(PreferencesService);

  protected readonly types = TYPES;
  protected readonly cabins = (Object.keys(CABIN_LABEL) as Cabin[]).map((id) => ({ id, label: CABIN_LABEL[id] }));
  protected readonly today = todayIso();
  protected readonly maxDate = addDays(todayIso(), MAX_ADVANCE_DAYS);

  protected readonly type = signal<TripType>('round');
  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly depart = signal(addDays(todayIso(), 21));
  protected readonly ret = signal(addDays(todayIso(), 28));
  protected readonly multi = signal<SearchLeg[]>([]);
  protected readonly adults = signal(1);
  protected readonly children = signal(0);
  protected readonly infants = signal(0);
  protected readonly cabin = signal<Cabin>('economy');
  protected readonly error = signal('');
  protected readonly bad = signal<'' | 'from' | 'to' | 'depart' | 'ret'>('');

  constructor() {
    this.from.set(this.prefs.lastFrom());
    this.multi.set(this.defaultMulti());
    effect(() => {
      const p = this.initial();
      if (!p) return;
      this.type.set(p.type);
      this.adults.set(p.adults);
      this.children.set(p.children);
      this.infants.set(p.infants);
      this.cabin.set(p.cabin);
      if (p.type === 'multi') this.multi.set(p.legs.map((l) => ({ ...l })));
      else {
        this.from.set(p.legs[0].from);
        this.to.set(p.legs[0].to);
        this.depart.set(p.legs[0].date);
        if (p.type === 'round' && p.legs[1]) this.ret.set(p.legs[1].date);
      }
    });
  }

  private defaultMulti(): SearchLeg[] {
    const d = addDays(todayIso(), 21);
    return [
      { from: this.prefs.lastFrom(), to: '', date: d },
      { from: '', to: '', date: addDays(d, 5) },
    ];
  }

  protected weekday(iso: string): string {
    return iso ? formatDate(iso, { weekday: 'long' }) : '';
  }

  protected setType(t: TripType): void {
    this.type.set(t);
    this.error.set('');
    if (t === 'multi' && this.multi()[0].to === '' && this.to()) {
      this.multi.set([{ from: this.from(), to: this.to(), date: this.depart() }, { from: this.to(), to: '', date: this.ret() || addDays(this.depart(), 5) }]);
    }
  }

  protected swap(): void {
    const f = this.from();
    this.from.set(this.to());
    this.to.set(f);
  }

  protected onDepart(v: string): void {
    this.depart.set(v);
    if (this.type() === 'round' && v && this.ret() && this.ret() < v) this.ret.set(v);
  }

  protected patchLeg(i: number, key: keyof SearchLeg, value: string): void {
    this.multi.update((list) => {
      const next = list.map((l) => ({ ...l }));
      next[i][key] = value;
      if (key === 'to' && next[i + 1] && !next[i + 1].from) next[i + 1].from = value;
      if (key === 'date') for (let j = i + 1; j < next.length; j++) if (next[j].date && next[j].date < value) next[j].date = value;
      return next;
    });
  }

  protected addLeg(): void {
    this.multi.update((list) => {
      const last = list[list.length - 1];
      return [...list, { from: last.to, to: '', date: last.date ? addDays(last.date, 4) : '' }];
    });
  }

  protected removeLeg(i: number): void {
    this.multi.update((list) => list.filter((_, idx) => idx !== i));
  }

  protected submit(e: Event): void {
    e.preventDefault();
    this.bad.set('');
    const type = this.type();
    let legs: SearchLeg[];
    if (type === 'multi') legs = this.multi().map((l) => ({ ...l }));
    else {
      legs = [{ from: this.from(), to: this.to(), date: this.depart() }];
      if (type === 'round') legs.push({ from: this.to(), to: this.from(), date: this.ret() });
    }
    const params: SearchParams = { type, legs, adults: this.adults(), children: this.children(), infants: this.infants(), cabin: this.cabin() };
    const err = validateSearch(params);
    if (err) {
      this.error.set(err);
      if (type !== 'multi') {
        this.bad.set(!this.from() ? 'from' : !this.to() ? 'to' : !this.depart() ? 'depart' : type === 'round' && !this.ret() ? 'ret' : '');
      }
      return;
    }
    this.error.set('');
    this.prefs.rememberFrom(legs[0].from);
    this.search.emit(params);
  }
}
