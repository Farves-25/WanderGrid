import { Component, computed, effect, input, model, signal } from '@angular/core';
import { AIRPORTS, POPULAR_CODES, findAirport, searchAirports } from '../../core/data/airports';
import { Airport } from '../../core/models/flight.model';
import { IconComponent } from './icon.component';

let uid = 0;

/** Accessible airport autocomplete (ARIA 1.2 combobox with listbox popup). */
@Component({
  selector: 'app-airport-combobox',
  imports: [IconComponent],
  host: { class: 'relative block' },
  template: `
    <label class="label" [for]="inputId">{{ label() }}</label>
    <div class="relative">
      <span class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint"><app-icon [name]="icon()" [size]="18" /></span>
      <input
        [id]="inputId"
        class="input !pl-11 !pr-9"
        type="text"
        role="combobox"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        aria-autocomplete="list"
        [attr.aria-expanded]="open()"
        [attr.aria-controls]="listId"
        [attr.aria-activedescendant]="open() && options().length ? listId + '-' + active() : null"
        [attr.aria-invalid]="invalid()"
        [placeholder]="placeholder()"
        [value]="query()"
        (focus)="onFocus($event)"
        (input)="onInput($event)"
        (keydown)="onKey($event)"
        (blur)="onBlur()"
      />
      @if (query()) {
        <button type="button" class="icon-btn icon-btn-sm absolute right-1.5 top-1/2 -translate-y-1/2" [attr.aria-label]="'Clear ' + label()" (mousedown)="$event.preventDefault()" (click)="clear()">
          <app-icon name="x" [size]="14" />
        </button>
      }
    </div>
    @if (open()) {
      <ul [id]="listId" role="listbox" [attr.aria-label]="label() + ' suggestions'" class="menu !left-0 !right-auto !top-[calc(100%+6px)] z-50 max-h-[22rem] w-[min(26rem,calc(100vw-2rem))] overflow-y-auto">
        @if (!showingSearch()) {
          <li role="presentation" class="px-3 pb-1 pt-1.5 text-[0.7rem] font-bold uppercase tracking-wider text-faint">Popular airports</li>
        }
        @for (a of options(); track a.code; let i = $index) {
          <li
            role="option"
            [id]="listId + '-' + i"
            [attr.aria-selected]="i === active()"
            class="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5"
            [class.bg-[var(--surface-2)]]="i === active()"
            (mousedown)="$event.preventDefault()"
            (click)="choose(a)"
            (mousemove)="active.set(i)"
          >
            <span class="grid h-9 w-12 shrink-0 place-items-center rounded-lg bg-[var(--accent-soft)] font-display text-sm font-bold text-accent">{{ a.code }}</span>
            <span class="min-w-0">
              <span class="block truncate text-sm font-semibold">{{ a.city }} <span class="font-normal text-muted">· {{ a.country }}</span></span>
              <span class="block truncate text-xs text-faint">{{ a.name }}</span>
            </span>
          </li>
        } @empty {
          <li role="option" aria-disabled="true" aria-selected="false" class="px-3 py-4 text-sm text-muted">No airports match “{{ query() }}”.</li>
        }
      </ul>
    }
  `,
})
export class AirportComboboxComponent {
  readonly code = model<string>('');
  readonly label = input.required<string>();
  readonly icon = input('plane-takeoff');
  readonly placeholder = input('City or airport');
  readonly invalid = input(false);

  protected readonly inputId = `apc-${++uid}`;
  protected readonly listId = `apc-list-${uid}`;
  protected readonly query = signal('');
  protected readonly open = signal(false);
  protected readonly active = signal(0);
  private typing = false;

  protected readonly showingSearch = computed(() => this.typing && this.query().trim().length > 0 && this.open());
  protected readonly options = computed<Airport[]>(() => {
    const q = this.query().trim();
    if (!this.typing || !q) return POPULAR_CODES.map((c) => findAirport(c)).filter((a): a is Airport => !!a);
    return searchAirports(q);
  });

  constructor() {
    // Keep the visible text in sync with the selected code (initial value, swap button, URL restore).
    effect(() => {
      const a = findAirport(this.code());
      this.query.set(a ? this.display(a) : '');
      this.typing = false;
    });
  }

  private display(a: Airport): string {
    return `${a.city} (${a.code})`;
  }

  protected onFocus(e: FocusEvent): void {
    (e.target as HTMLInputElement).select();
    this.typing = false;
    this.active.set(0);
    this.open.set(true);
  }

  protected onInput(e: Event): void {
    this.typing = true;
    this.query.set((e.target as HTMLInputElement).value);
    this.active.set(0);
    this.open.set(true);
  }

  protected onKey(e: KeyboardEvent): void {
    const opts = this.options();
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!this.open()) this.open.set(true);
        else this.active.set((this.active() + 1) % Math.max(1, opts.length));
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.active.set((this.active() - 1 + Math.max(1, opts.length)) % Math.max(1, opts.length));
        break;
      case 'Enter':
        if (this.open() && opts[this.active()]) {
          e.preventDefault();
          this.choose(opts[this.active()]);
        }
        break;
      case 'Escape':
        if (this.open()) {
          e.stopPropagation();
          this.open.set(false);
        }
        break;
    }
  }

  protected onBlur(): void {
    this.open.set(false);
    const q = this.query().trim();
    // Typing an exact code ("jfk") or a unique match selects it; otherwise revert.
    if (this.typing && q) {
      const exact = findAirport(q);
      const matches = searchAirports(q, 2);
      const pick = exact ?? (matches.length === 1 ? matches[0] : undefined);
      if (pick) {
        this.code.set(pick.code);
        this.query.set(this.display(pick));
        this.typing = false;
        return;
      }
    }
    const cur = findAirport(this.code());
    this.query.set(cur ? this.display(cur) : '');
    this.typing = false;
  }

  protected choose(a: Airport): void {
    this.code.set(a.code);
    this.query.set(this.display(a));
    this.typing = false;
    this.open.set(false);
  }

  protected clear(): void {
    this.code.set('');
    this.query.set('');
    this.typing = true;
    this.open.set(true);
  }
}

export const AIRPORT_COUNT = AIRPORTS.length;
