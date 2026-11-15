import { Component, inject } from '@angular/core';
import { ConfirmService } from '../../core/services/confirm.service';
import { ModalComponent } from './modal.component';

@Component({
  selector: 'app-confirm-host',
  imports: [ModalComponent],
  template: `
    @if (confirm.request(); as r) {
      <app-modal [heading]="r.title" (closed)="confirm.answer(false)">
        <p class="text-muted">{{ r.message }}</p>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" (click)="confirm.answer(false)">Cancel</button>
          <button type="button" class="btn" [class.btn-danger]="r.danger" [class.btn-primary]="!r.danger" (click)="confirm.answer(true)">
            {{ r.confirmLabel }}
          </button>
        </div>
      </app-modal>
    }
  `,
})
export class ConfirmHostComponent {
  protected readonly confirm = inject(ConfirmService);
}
