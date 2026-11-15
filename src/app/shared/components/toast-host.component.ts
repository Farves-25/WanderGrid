import { Component, inject } from '@angular/core';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-toast-host',
  imports: [IconComponent],
  template: `
    <div class="toast-stack" role="region" aria-label="Notifications" aria-live="polite">
      @for (t of toasts.toasts(); track t.id) {
        <div class="toast" [class]="'toast toast-' + t.kind">
          <app-icon [name]="icon(t.kind)" [size]="18" />
          <p class="toast-msg">{{ t.message }}</p>
          @if (t.action; as act) {
            <button type="button" class="toast-action" (click)="act(); toasts.dismiss(t.id)">{{ t.actionLabel }}</button>
          }
          <button type="button" class="toast-close" aria-label="Dismiss notification" (click)="toasts.dismiss(t.id)">
            <app-icon name="x" [size]="14" />
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastHostComponent {
  protected readonly toasts = inject(ToastService);

  protected icon(kind: string): string {
    return kind === 'success' ? 'circle-check' : kind === 'error' || kind === 'warning' ? 'triangle-alert' : 'info';
  }
}
