import { Component, computed, input } from '@angular/core';
import { airline } from '../../core/data/airlines';

function textColor(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.35 ? '#10143a' : '#ffffff';
}

/** Monogram badge in the airline's brand color (decorative — the airline name is always shown nearby). */
@Component({
  selector: 'app-airline-chip',
  template: `<span class="grid place-items-center rounded-xl font-display text-[0.8rem] font-bold tracking-tight" [style.width.px]="size()" [style.height.px]="size()" [style.background]="bg()" [style.color]="fg()" aria-hidden="true">{{ code() }}</span>`,
  host: { class: 'inline-flex' },
})
export class AirlineChipComponent {
  readonly code = input.required<string>();
  readonly size = input(38);
  protected readonly bg = computed(() => airline(this.code()).color);
  protected readonly fg = computed(() => textColor(this.bg()));
}
