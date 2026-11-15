import { Component, inject } from '@angular/core';
import { OfflineCacheService } from '../../core/services/offline-cache.service';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-offline-banner',
  imports: [IconComponent],
  template: `
    @if (!cache.online()) {
      <div class="offline-banner offline-banner-warn" role="status" aria-live="polite">
        <app-icon name="triangle-alert" [size]="16" />
        <span>You're offline — your bookings, e-tickets and boarding passes are still available.</span>
      </div>
    }
  `,
})
export class OfflineBannerComponent {
  protected readonly cache = inject(OfflineCacheService);
}
