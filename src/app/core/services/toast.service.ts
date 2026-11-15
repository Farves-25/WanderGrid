import { Service, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  actionLabel?: string;
  action?: () => void;
}

@Service()
export class ToastService {
  private nextId = 1;
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();
  readonly toasts = signal<Toast[]>([]);

  show(kind: ToastKind, message: string, opts: { actionLabel?: string; action?: () => void; ms?: number } = {}): number {
    const id = this.nextId++;
    this.toasts.update((list) => [...list.slice(-3), { id, kind, message, actionLabel: opts.actionLabel, action: opts.action }]);
    const ms = opts.ms ?? (kind === 'error' ? 7000 : opts.action ? 7000 : 4000);
    this.timers.set(id, setTimeout(() => this.dismiss(id), ms));
    return id;
  }

  success(message: string, opts?: { actionLabel?: string; action?: () => void }): number {
    return this.show('success', message, opts);
  }
  error(message: string): number {
    return this.show('error', message);
  }
  info(message: string): number {
    return this.show('info', message);
  }
  warning(message: string): number {
    return this.show('warning', message);
  }

  dismiss(id: number): void {
    const t = this.timers.get(id);
    if (t) clearTimeout(t);
    this.timers.delete(id);
    this.toasts.update((list) => list.filter((x) => x.id !== id));
  }
}
