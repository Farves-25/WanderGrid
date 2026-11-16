import { NgOptimizedImage } from '@angular/common';
import { Component, computed, input, signal } from '@angular/core';

/** Airline logo as published by the data provider, with a monogram fallback (decorative — the airline name is always shown nearby). */
@Component({
  selector: 'app-airline-chip',
  imports: [NgOptimizedImage],
  template: `
    <span class="grid place-items-center overflow-hidden rounded-xl bg-white font-display text-[0.7rem] font-bold tracking-tight text-[#10143a]" [style.width.px]="size()" [style.height.px]="size()" aria-hidden="true">
      @if (logo() && !failed()) {
        <img [ngSrc]="logo()!" [width]="size()" [height]="size()" alt="" class="h-full w-full object-contain p-0.5" (error)="failed.set(true)" />
      } @else {
        {{ monogram() }}
      }
    </span>
  `,
  host: { class: 'inline-flex shrink-0' },
})
export class AirlineChipComponent {
  readonly name = input.required<string>();
  readonly logo = input<string | null>(null);
  readonly size = input(38);
  protected readonly failed = signal(false);
  protected readonly monogram = computed(() =>
    this.name()
      .split(/\s+/)
      .map((w) => w[0] ?? '')
      .join('')
      .slice(0, 2)
      .toUpperCase(),
  );
}
