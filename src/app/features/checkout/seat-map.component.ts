import { Component, computed, input, output, signal } from '@angular/core';
import { Seat, SeatMap, seatAllowed, seatCharge } from '../../core/engine/seatmap';
import { Fare, Passenger } from '../../core/models/flight.model';

const KIND_LABEL: Record<string, string> = { standard: 'Standard seat', extra: 'Extra legroom', exit: 'Exit row', front: 'Front section' };

@Component({
  selector: 'app-seat-map',
  template: `
    <div class="grid gap-5 lg:grid-cols-[14rem_1fr]">
      <div>
        <p class="label">Seating for</p>
        <div role="radiogroup" aria-label="Choose traveler to seat" class="grid gap-2">
          @for (p of seated(); track p.index) {
            <button type="button" role="radio" class="pax-pick" [attr.aria-checked]="active() === p.index" [class.is-on]="active() === p.index" (click)="active.set(p.index)">
              <span class="grid h-8 w-8 place-items-center rounded-full bg-[var(--accent-soft)] text-xs font-bold text-accent">{{ p.index + 1 }}</span>
              <span class="min-w-0 flex-1 text-left">
                <span class="block truncate text-sm font-semibold">{{ p.name }}</span>
                <span class="block text-xs text-muted">{{ seats()[p.index] ? 'Seat ' + seats()[p.index] : 'No seat chosen' }}</span>
              </span>
              @if (seats()[p.index]) {
                <span class="text-xs font-semibold text-ok">✓</span>
              }
            </button>
          }
        </div>
        <ul class="mt-5 grid gap-2 text-xs text-muted" aria-label="Seat legend">
          <li class="flex items-center gap-2"><span class="seat-key"></span> Available</li>
          <li class="flex items-center gap-2"><span class="seat-key is-extra"></span> Extra legroom</li>
          <li class="flex items-center gap-2"><span class="seat-key is-exit"></span> Exit row (adults only)</li>
          <li class="flex items-center gap-2"><span class="seat-key is-picked"></span> Your selection</li>
          <li class="flex items-center gap-2"><span class="seat-key is-taken"></span> Occupied</li>
        </ul>
        @if (fare().seatSelection === 'free' && cabin() === 'economy') {
          <p class="mt-4 rounded-xl bg-[var(--ok-bg)] p-3 text-xs font-semibold text-ok">Your fare includes free standard seats.</p>
        }
      </div>

      <div class="cabin-shell" role="group" [attr.aria-label]="'Seat map, ' + map().cabin + ' cabin'">
        <div class="cabin-nose" aria-hidden="true"></div>
        <div class="overflow-x-auto pb-2">
          <div class="mx-auto w-max">
            <div class="seat-row" aria-hidden="true">
              <span class="row-no"></span>
              @for (c of header(); track $index) { <span class="seat-col">{{ c }}</span> }
              <span class="row-no"></span>
            </div>
            @for (row of map().rows; track row.row) {
              <div class="seat-row" [class.is-exit-row]="map().exitRows.includes(row.row)">
                <span class="row-no">{{ row.row }}</span>
                @for (cell of row.cells; track $index) {
                  @if (cell; as s) {
                    <button
                      type="button"
                      class="seat"
                      [class.is-extra]="s.kind === 'extra'"
                      [class.is-exit]="s.kind === 'exit'"
                      [class.is-taken]="s.taken"
                      [class.is-picked]="pickedBy(s) === active()"
                      [class.is-other]="pickedBy(s) !== null && pickedBy(s) !== active()"
                      [disabled]="s.taken || !allowed(s) || (pickedBy(s) !== null && pickedBy(s) !== active())"
                      [attr.aria-pressed]="pickedBy(s) === active()"
                      [attr.aria-label]="label(s)"
                      [attr.title]="label(s)"
                      (click)="toggle(s)"
                    >{{ pickedBy(s) !== null ? pickedBy(s)! + 1 : s.col }}</button>
                  } @else {
                    <span class="seat-aisle" aria-hidden="true"></span>
                  }
                }
                <span class="row-no">{{ row.row }}</span>
              </div>
            }
          </div>
        </div>
      </div>
    </div>
    @if (message()) {
      <p class="form-error mt-3" role="alert">{{ message() }}</p>
    }
  `,
})
export class SeatMapComponent {
  readonly map = input.required<SeatMap>();
  readonly passengers = input.required<Passenger[]>();
  /** paxIndex → seat label for this segment */
  readonly seats = input.required<Record<number, string>>();
  readonly fare = input.required<Fare>();
  readonly cabin = input.required<string>();
  readonly pick = output<{ pax: number; seat: string | null }>();

  protected readonly active = signal(0);
  protected readonly message = signal('');

  protected readonly seated = computed(() =>
    this.passengers()
      .map((p, index) => ({ index, p, name: `${p.firstName} ${p.lastName}`.trim() || `Traveler ${index + 1}` }))
      .filter((x) => x.p.type !== 'infant'),
  );

  protected readonly header = computed(() => {
    const out: string[] = [];
    this.map().groups.forEach((g, gi) => {
      if (gi > 0) out.push('');
      for (const c of g) out.push(c);
    });
    return out;
  });

  protected pickedBy(s: Seat): number | null {
    for (const [pax, label] of Object.entries(this.seats())) if (label === s.label) return Number(pax);
    return null;
  }

  protected allowed(s: Seat): boolean {
    const p = this.passengers()[this.active()];
    return p ? seatAllowed(s, p) : true;
  }

  protected charge(s: Seat): number {
    return seatCharge(s, this.fare(), this.map().cabin);
  }

  protected label(s: Seat): string {
    const by = this.pickedBy(s);
    const kind = KIND_LABEL[s.kind];
    if (s.taken) return `Seat ${s.label}, occupied`;
    if (by !== null && by !== this.active()) return `Seat ${s.label}, selected for traveler ${by + 1}`;
    const price = this.charge(s);
    const restricted = !this.allowed(s) ? ', adults only' : '';
    return `Seat ${s.label}, ${kind}${restricted}, ${price > 0 ? '$' + price + ' USD' : 'included'}${by === this.active() ? ', selected' : ''}`;
  }

  protected toggle(s: Seat): void {
    this.message.set('');
    const p = this.passengers()[this.active()];
    if (p && !seatAllowed(s, p)) {
      this.message.set('Exit-row seats are only available to adult passengers.');
      return;
    }
    const idx = this.active();
    const cur = this.pickedBy(s);
    this.pick.emit({ pax: idx, seat: cur === idx ? null : s.label });
    // advance to the next traveler without a seat
    if (cur !== idx) {
      const next = this.seated().find((x) => x.index !== idx && !this.seats()[x.index]);
      if (next) this.active.set(next.index);
    }
  }
}
