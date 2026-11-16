import { Component, ElementRef, computed, inject, input, model, signal } from '@angular/core';
import { placePopover } from '../../core/util/popover';
import { IconComponent } from './icon.component';

export interface SelectOption {
  value: string;
  label: string;
  /** Compact text shown on the trigger instead of the full label. */
  short?: string;
}

let uid = 0;

/** Styled single-select (ARIA select-only combobox) used in place of a native <select>. */
@Component({
  selector: 'app-select',
  imports: [IconComponent],
  host: {
    class: 'relative inline-block',
    '(document:pointerdown)': 'onOutside($event)',
    '(focusout)': 'onFocusOut($event)',
    '(window:resize)': 'place()',
    '(window:scroll)': 'place()',
  },
  template: `
    <button
      type="button"
      role="combobox"
      class="input flex items-center justify-between gap-2 text-left"
      [class.input-sm]="size() === 'sm'"
      [class.!border-transparent]="ghost()"
      [class.!bg-transparent]="ghost()"
      [class.font-semibold]="ghost()"
      [id]="btnId"
      aria-haspopup="listbox"
      [attr.aria-label]="label()"
      [attr.aria-expanded]="open()"
      [attr.aria-controls]="open() ? listId : null"
      [attr.aria-activedescendant]="open() ? listId + '-' + active() : null"
      (click)="toggle()"
      (keydown)="onKey($event)"
    >
      <span class="truncate">{{ triggerText() }}</span>
      <span class="inline-grid shrink-0 text-faint transition-transform" [class.rotate-180]="open()"><app-icon name="chevron-down" [size]="16" /></span>
    </button>
    @if (open()) {
      <ul
        [id]="listId"
        role="listbox"
        [attr.aria-label]="label()"
        class="menu z-50 overflow-y-auto"
        [style.min-width]="'max(100%, 11rem)'"
        [style.left]="end() ? 'auto' : '0'"
        [style.right]="end() ? '0' : 'auto'"
        [style.top]="up() ? 'auto' : 'calc(100% + 8px)'"
        [style.bottom]="up() ? 'calc(100% + 8px)' : 'auto'"
        [style.max-height.px]="maxHeight()"
        (mousedown)="$event.preventDefault()"
      >
        @for (o of options(); track o.value; let i = $index) {
          <li
            role="option"
            [id]="listId + '-' + i"
            [attr.aria-selected]="o.value === value()"
            class="flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm"
            [class.bg-[var(--surface-2)]]="i === active()"
            [class.font-semibold]="o.value === value()"
            (click)="choose(o)"
            (mousemove)="active.set(i)"
          >
            <span class="truncate">{{ o.label }}</span>
            @if (o.value === value()) {
              <span class="inline-grid shrink-0 text-accent"><app-icon name="check" [size]="16" /></span>
            }
          </li>
        }
      </ul>
    }
  `,
})
export class SelectComponent {
  readonly options = input.required<readonly SelectOption[]>();
  readonly value = model('');
  readonly label = input.required<string>();
  readonly size = input<'md' | 'sm'>('md');
  readonly ghost = input(false);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly btnId = `sel-${++uid}`;
  protected readonly listId = `sel-list-${uid}`;
  protected readonly open = signal(false);
  protected readonly active = signal(0);
  protected readonly up = signal(false);
  protected readonly end = signal(false);
  protected readonly maxHeight = signal(320);

  protected readonly triggerText = computed(() => {
    const o = this.options().find((x) => x.value === this.value());
    return o ? (o.short ?? o.label) : '';
  });

  protected place(): void {
    if (!this.open()) return;
    const btn = this.host.nativeElement.querySelector('button');
    if (!btn) return;
    const p = placePopover(btn, 240, this.options().length * 44 + 14);
    this.up.set(p.up);
    this.end.set(p.end);
    this.maxHeight.set(p.maxHeight);
  }

  protected toggle(): void {
    if (this.open()) this.open.set(false);
    else this.show();
  }

  private show(): void {
    const i = this.options().findIndex((o) => o.value === this.value());
    this.active.set(Math.max(0, i));
    this.open.set(true);
    this.place();
  }

  protected onKey(e: KeyboardEvent): void {
    const n = this.options().length;
    const move = (to: number) => {
      e.preventDefault();
      if (!this.open()) this.show();
      else this.active.set(((to % n) + n) % n);
    };
    switch (e.key) {
      case 'ArrowDown': return move(this.active() + 1);
      case 'ArrowUp': return move(this.active() - 1);
      case 'Home': return move(0);
      case 'End': return move(n - 1);
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (this.open()) this.choose(this.options()[this.active()]);
        else this.show();
        return;
      case 'Escape':
        if (this.open()) {
          e.stopPropagation();
          this.open.set(false);
        }
        return;
    }
    // Type-ahead: jump to the next option starting with the pressed letter.
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const opts = this.options();
      const ch = e.key.toLowerCase();
      for (let k = 1; k <= n; k++) {
        const i = (this.active() + k) % n;
        if (opts[i].label.toLowerCase().startsWith(ch)) {
          if (!this.open()) this.show();
          this.active.set(i);
          break;
        }
      }
    }
  }

  protected choose(o: SelectOption | undefined): void {
    if (o) this.value.set(o.value);
    this.open.set(false);
    this.host.nativeElement.querySelector('button')?.focus();
  }

  protected onOutside(e: Event): void {
    if (this.open() && !this.host.nativeElement.contains(e.target as Node)) this.open.set(false);
  }

  protected onFocusOut(e: FocusEvent): void {
    const next = e.relatedTarget as Node | null;
    if (this.open() && next && !this.host.nativeElement.contains(next)) this.open.set(false);
  }
}
