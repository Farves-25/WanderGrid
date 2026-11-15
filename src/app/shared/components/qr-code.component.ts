import { Component, computed, input } from '@angular/core';
import { create } from 'qrcode';

/** Real, scannable QR code rendered as a single SVG path. */
@Component({
  selector: 'app-qr-code',
  template: `
    <svg [attr.viewBox]="viewBox()" role="img" [attr.aria-label]="label()" shape-rendering="crispEdges" class="block h-full w-full">
      <rect [attr.width]="size()" [attr.height]="size()" fill="#ffffff" />
      <path [attr.d]="path()" fill="#0b1024" />
    </svg>
  `,
  host: { class: 'block' },
})
export class QrCodeComponent {
  readonly text = input.required<string>();
  readonly label = input('QR code');

  private readonly qr = computed(() => create(this.text(), { errorCorrectionLevel: 'M' }));
  private readonly quiet = 2;
  protected readonly size = computed(() => this.qr().modules.size + this.quiet * 2);
  protected readonly viewBox = computed(() => `0 0 ${this.size()} ${this.size()}`);
  protected readonly path = computed(() => {
    const m = this.qr().modules;
    let d = '';
    for (let r = 0; r < m.size; r++) {
      for (let c = 0; c < m.size; c++) {
        if (m.get(r, c)) d += `M${c + this.quiet} ${r + this.quiet}h1v1h-1z`;
      }
    }
    return d;
  });
}
