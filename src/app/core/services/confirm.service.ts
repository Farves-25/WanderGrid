import { Service, signal } from '@angular/core';

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  danger: boolean;
  resolve: (value: boolean) => void;
}

@Service()
export class ConfirmService {
  readonly request = signal<ConfirmRequest | null>(null);

  ask(opts: { title: string; message: string; confirmLabel?: string; danger?: boolean }): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      // If something is already pending, cancel it so its promise never hangs.
      this.request()?.resolve(false);
      this.request.set({
        title: opts.title,
        message: opts.message,
        confirmLabel: opts.confirmLabel ?? 'Confirm',
        danger: opts.danger ?? false,
        resolve,
      });
    });
  }

  answer(value: boolean): void {
    const r = this.request();
    if (!r) return;
    this.request.set(null);
    r.resolve(value);
  }
}
