import { Component, ElementRef, OnDestroy, afterNextRender, inject, input, output, viewChild } from '@angular/core';
import { IconComponent } from './icon.component';

let openCount = 0;
let uid = 0;

/**
 * Accessible modal built on the native <dialog> element (focus trap, Escape, inert background).
 * Render it conditionally with `@if` — it opens itself on creation and emits `closed` when dismissed.
 */
@Component({
  selector: 'app-modal',
  imports: [IconComponent],
  template: `
    <dialog
      #dlg
      class="modal"
      [class.modal-wide]="wide()"
      [attr.aria-labelledby]="titleId"
      (close)="onClose()"
      (click)="onBackdrop($event)"
    >
      <div class="modal-panel">
        <header class="modal-head">
          <div class="min-w-0">
            <h2 class="modal-title" [id]="titleId">{{ heading() }}</h2>
            @if (subtitle()) {
              <p class="modal-sub">{{ subtitle() }}</p>
            }
          </div>
          <button type="button" class="icon-btn" aria-label="Close dialog" (click)="dlg.close()">
            <app-icon name="x" [size]="18" />
          </button>
        </header>
        <div class="modal-body">
          <ng-content />
        </div>
      </div>
    </dialog>
  `,
})
export class ModalComponent implements OnDestroy {
  readonly heading = input.required<string>();
  readonly subtitle = input<string>('');
  readonly wide = input(false);
  readonly closed = output<void>();

  protected readonly titleId = `modal-title-${++uid}`;
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');
  private previouslyFocused: HTMLElement | null = document.activeElement as HTMLElement | null;
  private locked = false;
  private destroyed = false;
  private dlgEl: HTMLDialogElement | null = null;

  constructor() {
    afterNextRender(() => {
      const el = this.dlg().nativeElement;
      this.dlgEl = el;
      if (!el.open) el.showModal();
      if (!this.locked) {
        this.locked = true;
        openCount++;
        document.documentElement.classList.add('modal-open');
      }
    });
  }

  protected onClose(): void {
    if (!this.destroyed) this.closed.emit();
  }

  protected onBackdrop(event: MouseEvent): void {
    // Clicks on the dialog box itself (outside the panel) are backdrop clicks.
    if (event.target === this.dlg().nativeElement) this.dlg().nativeElement.close();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    const el = this.dlgEl;
    if (el?.open) el.close();
    if (this.locked) {
      openCount = Math.max(0, openCount - 1);
      if (openCount === 0) document.documentElement.classList.remove('modal-open');
    }
    const back = this.previouslyFocused;
    if (back && document.contains(back)) setTimeout(() => back.focus(), 0);
  }
}
