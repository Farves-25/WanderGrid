import { Component, computed, model, signal } from '@angular/core';
import { MAX_PAX } from '../../core/util/search-query';
import { IconComponent } from './icon.component';

let uid = 0;

@Component({
  selector: 'app-passenger-picker',
  imports: [IconComponent],
  host: { class: 'relative block', '(document:click)': 'open.set(false)', '(document:keydown.escape)': 'open.set(false)' },
  template: `
    <span class="label" [id]="labelId">Travelers</span>
    <button
      type="button"
      class="input flex items-center gap-3 text-left"
      [attr.aria-labelledby]="labelId + ' ' + btnId"
      [id]="btnId"
      aria-haspopup="true"
      [attr.aria-expanded]="open()"
      [attr.aria-controls]="panelId"
      (click)="open.set(!open()); $event.stopPropagation()"
    >
      <app-icon name="users" [size]="18" />
      <span class="flex-1 truncate">{{ summary() }}</span>
      <app-icon name="chevron-down" [size]="16" />
    </button>
    @if (open()) {
      <div [id]="panelId" role="group" aria-label="Travelers" class="menu !left-0 !right-auto z-50 w-[min(20rem,calc(100vw-2rem))] !p-4" (click)="$event.stopPropagation()">
        @for (row of rows(); track row.key) {
          <div class="flex items-center justify-between gap-4 py-2.5">
            <div>
              <p class="text-sm font-semibold" [id]="panelId + '-' + row.key">{{ row.label }}</p>
              <p class="text-xs text-muted">{{ row.hint }}</p>
            </div>
            <div class="flex items-center gap-2.5">
              <button type="button" class="icon-btn icon-btn-sm !border-[var(--border)]" [attr.aria-label]="'Fewer ' + row.label.toLowerCase()" [disabled]="!row.canDec" (click)="change(row.key, -1)"><app-icon name="minus" [size]="15" /></button>
              <span class="w-5 text-center font-display text-lg font-bold tabular-nums" aria-live="polite">{{ row.value }}</span>
              <button type="button" class="icon-btn icon-btn-sm !border-[var(--border)]" [attr.aria-label]="'More ' + row.label.toLowerCase()" [disabled]="!row.canInc" (click)="change(row.key, 1)"><app-icon name="plus" [size]="15" /></button>
            </div>
          </div>
        }
        <p class="mt-1 border-t border-[var(--border)] pt-3 text-xs text-muted">Up to {{ max }} travelers. Each infant must travel with an adult.</p>
        <button type="button" class="btn btn-primary btn-sm mt-3 w-full" (click)="open.set(false)">Done</button>
      </div>
    }
  `,
})
export class PassengerPickerComponent {
  readonly adults = model(1);
  readonly children = model(0);
  readonly infants = model(0);

  protected readonly max = MAX_PAX;
  protected readonly open = signal(false);
  protected readonly labelId = `pp-label-${++uid}`;
  protected readonly btnId = `pp-btn-${uid}`;
  protected readonly panelId = `pp-panel-${uid}`;

  protected readonly total = computed(() => this.adults() + this.children() + this.infants());
  protected readonly summary = computed(() => {
    const n = this.total();
    const parts = [`${this.adults()} adult${this.adults() === 1 ? '' : 's'}`];
    if (this.children()) parts.push(`${this.children()} child${this.children() === 1 ? '' : 'ren'}`);
    if (this.infants()) parts.push(`${this.infants()} infant${this.infants() === 1 ? '' : 's'}`);
    return n === 1 ? '1 adult' : parts.join(', ');
  });

  protected readonly rows = computed(() => {
    const total = this.total();
    return [
      { key: 'adults' as const, label: 'Adults', hint: '12 years and over', value: this.adults(), canDec: this.adults() > 1 && this.adults() > this.infants(), canInc: total < MAX_PAX },
      { key: 'children' as const, label: 'Children', hint: '2–11 years', value: this.children(), canDec: this.children() > 0, canInc: total < MAX_PAX },
      { key: 'infants' as const, label: 'Infants', hint: 'Under 2, on lap', value: this.infants(), canDec: this.infants() > 0, canInc: total < MAX_PAX && this.infants() < this.adults() },
    ];
  });

  protected change(key: 'adults' | 'children' | 'infants', delta: number): void {
    const m = key === 'adults' ? this.adults : key === 'children' ? this.children : this.infants;
    m.set(m() + delta);
  }
}
