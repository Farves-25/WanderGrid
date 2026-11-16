import { Component, ElementRef, Injector, afterNextRender, computed, inject, input, model, signal } from '@angular/core';
import { addDays, formatDate, todayIso } from '../../core/util/date.util';
import { placePopover } from '../../core/util/popover';
import { IconComponent } from './icon.component';

let uid = 0;

interface Cell {
  iso: string;
  n: number;
}

const pad = (n: number) => String(n).padStart(2, '0');
const monthStartOf = (ms: number) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-01`;
};
const parse = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d };
};

/** Calendar popover used in place of a native date input. Dates are `YYYY-MM-DD` strings. */
@Component({
  selector: 'app-date-picker',
  imports: [IconComponent],
  host: {
    class: 'block',
    '(document:pointerdown)': 'onOutside($event)',
    '(focusout)': 'onFocusOut($event)',
    '(window:resize)': 'place()',
    '(window:scroll)': 'place()',
  },
  template: `
    <label class="label" [for]="btnId">{{ label() }}</label>
    <div class="relative">
      <button
        type="button"
        class="input flex items-center gap-2.5 text-left"
        [id]="btnId"
        aria-haspopup="dialog"
        [attr.aria-expanded]="open()"
        [attr.aria-controls]="open() ? panelId : null"
        [attr.aria-invalid]="invalid()"
        (click)="toggle()"
        (keydown.arrowdown)="openFromKey($event)"
      >
        <span class="inline-grid shrink-0 text-faint"><app-icon name="calendar-days" [size]="18" /></span>
        <span class="flex-1 truncate" [class.text-faint]="!value()">{{ display() }}</span>
      </button>

      @if (open()) {
        <div
          [id]="panelId"
          role="dialog"
          [attr.aria-label]="'Choose ' + label().toLowerCase() + ' date'"
          class="menu z-50 w-[min(20rem,calc(100vw-2rem))] overflow-y-auto !p-4"
          [style.left]="end() ? 'auto' : '0'"
          [style.right]="end() ? '0' : 'auto'"
          [style.top]="up() ? 'auto' : 'calc(100% + 8px)'"
          [style.bottom]="up() ? 'calc(100% + 8px)' : 'auto'"
          [style.max-height.px]="maxHeight()"
          (mousedown)="$event.preventDefault()"
          (keydown)="onPanelKey($event)"
        >
          <div class="mb-3 flex items-center justify-between">
            <button type="button" class="icon-btn icon-btn-sm !border-[var(--border)]" aria-label="Previous month" [disabled]="prevOff()" (click)="shift(-1)"><app-icon name="chevron-left" [size]="16" /></button>
            <p class="font-display text-base font-semibold" aria-live="polite">{{ monthLabel() }}</p>
            <button type="button" class="icon-btn icon-btn-sm !border-[var(--border)]" aria-label="Next month" [disabled]="nextOff()" (click)="shift(1)"><app-icon name="chevron-right" [size]="16" /></button>
          </div>

          <div class="grid grid-cols-7 text-center" aria-hidden="true">
            @for (w of weekdays; track $index) {
              <span class="py-1 text-[0.68rem] font-bold uppercase tracking-wider text-faint">{{ w }}</span>
            }
          </div>

          <div class="grid grid-cols-7 gap-y-1" role="group" [attr.aria-label]="monthLabel()">
            @for (c of cells(); track $index) {
              @if (c) {
                <button
                  type="button"
                  [attr.data-iso]="c.iso"
                  [class]="dayClass(c.iso)"
                  [disabled]="isOff(c.iso)"
                  [tabindex]="c.iso === focusIso() ? 0 : -1"
                  [attr.aria-label]="longLabel(c.iso)"
                  [attr.aria-pressed]="c.iso === value()"
                  [attr.aria-current]="c.iso === today ? 'date' : null"
                  (click)="pick(c.iso)"
                >{{ c.n }}</button>
              } @else {
                <span></span>
              }
            }
          </div>

          <div class="mt-3 flex items-center justify-between border-t border-[var(--border)] pt-3">
            <button type="button" class="btn btn-sm btn-ghost" [disabled]="isOff(today)" (click)="pick(today)">Today</button>
            <button type="button" class="btn btn-sm" (click)="closeAndFocus()">Close</button>
          </div>
        </div>
      }
    </div>
  `,
})
export class DatePickerComponent {
  readonly value = model('');
  readonly label = input.required<string>();
  readonly min = input('');
  readonly max = input('');
  readonly invalid = input(false);
  /** Optional trip range, highlighted in the grid (e.g. depart → return). */
  readonly rangeStart = input('');
  readonly rangeEnd = input('');

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  protected readonly btnId = `dp-btn-${++uid}`;
  protected readonly panelId = `dp-panel-${uid}`;
  protected readonly today = todayIso();
  protected readonly weekdays = Array.from({ length: 7 }, (_, i) => formatDate(addDays('2024-01-01', i), { weekday: 'narrow' }));

  protected readonly open = signal(false);
  protected readonly view = signal(`${this.today.slice(0, 7)}-01`);
  protected readonly focusIso = signal(this.today);
  protected readonly up = signal(false);
  protected readonly end = signal(false);
  protected readonly maxHeight = signal(420);

  protected readonly display = computed(() =>
    this.value() ? formatDate(this.value(), { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : 'Select date',
  );
  protected readonly monthLabel = computed(() => formatDate(this.view(), { month: 'long', year: 'numeric' }));

  protected readonly cells = computed<(Cell | null)[]>(() => {
    const { y, m } = parse(this.view());
    const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // weeks start on Monday
    const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const out: (Cell | null)[] = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= count; d++) out.push({ iso: `${y}-${pad(m)}-${pad(d)}`, n: d });
    return out;
  });

  protected readonly prevOff = computed(() => !!this.min() && this.view() <= `${this.min().slice(0, 7)}-01`);
  protected readonly nextOff = computed(() => !!this.max() && this.view() >= `${this.max().slice(0, 7)}-01`);

  protected isOff(iso: string): boolean {
    return (!!this.min() && iso < this.min()) || (!!this.max() && iso > this.max());
  }

  private clamp(iso: string): string {
    if (this.min() && iso < this.min()) return this.min();
    if (this.max() && iso > this.max()) return this.max();
    return iso;
  }

  protected longLabel(iso: string): string {
    return formatDate(iso, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  protected dayClass(iso: string): string {
    const base = 'relative h-10 w-full text-sm font-medium tabular-nums outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus)] ';
    if (this.isOff(iso)) return base + 'rounded-full cursor-not-allowed text-faint opacity-40';
    if (iso === this.value()) return base + 'rounded-full bg-[var(--btn-bg)] font-bold text-[var(--btn-fg)]';
    const a = this.rangeStart();
    const b = this.rangeEnd();
    if (iso === a || iso === b) return base + 'rounded-full bg-[var(--accent-soft)] font-bold text-accent';
    if (a && b && iso > a && iso < b) return base + 'bg-[var(--accent-soft)]';
    if (iso === this.today) return base + 'rounded-full ring-1 ring-inset ring-[var(--border-strong)] hover:bg-[var(--surface-2)]';
    return base + 'rounded-full hover:bg-[var(--surface-2)]';
  }

  protected place(): void {
    if (!this.open()) return;
    const btn = this.host.nativeElement.querySelector('button');
    if (!btn) return;
    const p = placePopover(btn, 320, 420);
    this.up.set(p.up);
    this.end.set(p.end);
    this.maxHeight.set(p.maxHeight);
  }

  protected toggle(): void {
    if (this.open()) this.open.set(false);
    else this.show();
  }

  protected openFromKey(e: Event): void {
    e.preventDefault();
    if (!this.open()) this.show();
  }

  private show(): void {
    const start = this.clamp(this.value() || this.today);
    this.focusIso.set(start);
    this.view.set(`${start.slice(0, 7)}-01`);
    this.open.set(true);
    this.place();
    this.focusDay();
  }

  private focusDay(): void {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(`[data-iso="${this.focusIso()}"]`)?.focus(), { injector: this.injector });
  }

  protected shift(delta: number): void {
    const { y, m } = parse(this.view());
    this.view.set(monthStartOf(Date.UTC(y, m - 1 + delta, 1)));
    const f = parse(this.focusIso());
    const days = new Date(Date.UTC(y, m + delta, 0)).getUTCDate();
    const next = this.clamp(`${this.view().slice(0, 8)}${pad(Math.min(f.d, days))}`);
    this.focusIso.set(next);
  }

  protected onPanelKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.stopPropagation();
      this.closeAndFocus();
      return;
    }
    const target = e.target as HTMLElement;
    if (!target.hasAttribute('data-iso')) return;
    const cur = this.focusIso();
    const weekday = (new Date(`${cur}T00:00:00Z`).getUTCDay() + 6) % 7;
    let next: string | null = null;
    switch (e.key) {
      case 'ArrowLeft': next = addDays(cur, -1); break;
      case 'ArrowRight': next = addDays(cur, 1); break;
      case 'ArrowUp': next = addDays(cur, -7); break;
      case 'ArrowDown': next = addDays(cur, 7); break;
      case 'Home': next = addDays(cur, -weekday); break;
      case 'End': next = addDays(cur, 6 - weekday); break;
      case 'PageUp':
      case 'PageDown': {
        const { y, m, d } = parse(cur);
        const delta = e.key === 'PageUp' ? -1 : 1;
        const days = new Date(Date.UTC(y, m + delta, 0)).getUTCDate();
        next = monthStartOf(Date.UTC(y, m - 1 + delta, 1)).slice(0, 8) + pad(Math.min(d, days));
        break;
      }
    }
    if (!next) return;
    e.preventDefault();
    next = this.clamp(next);
    this.focusIso.set(next);
    this.view.set(`${next.slice(0, 7)}-01`);
    this.focusDay();
  }

  protected pick(iso: string): void {
    if (this.isOff(iso)) return;
    this.value.set(iso);
    this.closeAndFocus();
  }

  protected closeAndFocus(): void {
    this.open.set(false);
    this.host.nativeElement.querySelector<HTMLElement>(`#${this.btnId}`)?.focus();
  }

  protected onOutside(e: Event): void {
    if (this.open() && !this.host.nativeElement.contains(e.target as Node)) this.open.set(false);
  }

  protected onFocusOut(e: FocusEvent): void {
    const next = e.relatedTarget as Node | null;
    if (this.open() && next && !this.host.nativeElement.contains(next)) this.open.set(false);
  }
}
