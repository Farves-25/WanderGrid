import { Component, computed, inject, input } from '@angular/core';
import { airline } from '../../core/data/airlines';
import { airport } from '../../core/data/airports';
import { hashString } from '../../core/engine/prng';
import { formatLocalDate, formatLocalTime } from '../../core/engine/time';
import { Booking, CABIN_LABEL, FAMILY_LABEL } from '../../core/models/flight.model';
import { boardingInfo } from '../../core/services/bookings.service';
import { AirlineChipComponent } from '../../shared/components/airline-chip.component';
import { IconComponent } from '../../shared/components/icon.component';
import { QrCodeComponent } from '../../shared/components/qr-code.component';

@Component({
  selector: 'app-boarding-pass',
  imports: [AirlineChipComponent, QrCodeComponent, IconComponent],
  host: { class: 'block' },
  template: `
    <article class="pass" [attr.aria-label]="'Boarding pass for ' + paxName() + ', ' + seg().flightNo + ' ' + seg().from + ' to ' + seg().to">
      <div class="pass-main">
        <header class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2.5"><app-airline-chip [code]="seg().airline" [size]="34" /><div><p class="text-sm font-bold leading-tight">{{ airlineName() }}</p><p class="text-xs text-muted">{{ cabin() }} · {{ family() }}</p></div></div>
          <p class="text-xs font-bold uppercase tracking-widest text-muted">Boarding pass</p>
        </header>

        <div class="my-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div>
            <p class="font-display text-5xl font-bold leading-none tracking-tight">{{ seg().from }}</p>
            <p class="mt-1 text-sm text-muted">{{ fromCity() }}</p>
          </div>
          <app-icon name="plane" [size]="26" />
          <div class="text-right">
            <p class="font-display text-5xl font-bold leading-none tracking-tight">{{ seg().to }}</p>
            <p class="mt-1 text-sm text-muted">{{ toCity() }}</p>
          </div>
        </div>

        <dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
          <div class="col-span-2"><dt class="pass-k">Passenger</dt><dd class="pass-v uppercase">{{ paxName() }}</dd></div>
          <div><dt class="pass-k">Flight</dt><dd class="pass-v">{{ seg().flightNo }}</dd></div>
          <div><dt class="pass-k">Date</dt><dd class="pass-v">{{ date() }}</dd></div>
          <div><dt class="pass-k">Departs</dt><dd class="pass-v">{{ dep() }}</dd></div>
          <div><dt class="pass-k">Boarding</dt><dd class="pass-v">{{ boarding() }}</dd></div>
          <div><dt class="pass-k">Gate</dt><dd class="pass-v">{{ info().gate }}</dd></div>
          <div><dt class="pass-k">Terminal</dt><dd class="pass-v">{{ info().terminal }}</dd></div>
          <div><dt class="pass-k">Seat</dt><dd class="pass-v">{{ seat() }}</dd></div>
          <div><dt class="pass-k">Group</dt><dd class="pass-v">{{ info().group }}</dd></div>
          <div class="col-span-2"><dt class="pass-k">E-ticket</dt><dd class="pass-v tabular-nums">{{ booking().tickets[paxIndex()] }}</dd></div>
        </dl>
      </div>
      <div class="pass-stub">
        <div class="h-28 w-28 overflow-hidden rounded-xl bg-white p-1.5"><app-qr-code [text]="payload()" [label]="'Boarding pass QR code for ' + paxName()" /></div>
        <p class="mt-2 text-center text-[0.68rem] font-semibold uppercase tracking-widest text-muted">Scan at gate</p>
        <p class="mt-1 text-center font-display text-lg font-bold tracking-wider">{{ booking().ref }}</p>
      </div>
    </article>
  `,
})
export class BoardingPassComponent {
  readonly booking = input.required<Booking>();
  readonly legIndex = input.required<number>();
  readonly segIndex = input.required<number>();
  readonly paxIndex = input.required<number>();

  private readonly leg = computed(() => this.booking().legs[this.legIndex()]);
  protected readonly seg = computed(() => this.leg().offer.segments[this.segIndex()]);
  protected readonly pax = computed(() => this.booking().passengers[this.paxIndex()]);
  protected readonly info = computed(() => boardingInfo(this.seg()));
  protected readonly airlineName = computed(() => airline(this.seg().airline).name);
  protected readonly fromCity = computed(() => airport(this.seg().from).city);
  protected readonly toCity = computed(() => airport(this.seg().to).city);
  protected readonly cabin = computed(() => CABIN_LABEL[this.leg().offer.cabin]);
  protected readonly family = computed(() => FAMILY_LABEL[this.leg().family]);
  protected readonly paxName = computed(() => `${this.pax().firstName} ${this.pax().lastName}`.trim());
  protected readonly seat = computed(() => (this.pax().type === 'infant' ? 'INF' : (this.booking().extras.seats[`${this.seg().id}|${this.paxIndex()}`] ?? '—')));
  protected readonly dep = computed(() => formatLocalTime(airport(this.seg().from), this.seg().depUtc));
  protected readonly boarding = computed(() => formatLocalTime(airport(this.seg().from), this.info().boardingUtc));
  protected readonly date = computed(() => formatLocalDate(airport(this.seg().from), this.seg().depUtc, { day: '2-digit', month: 'short' }));

  /** IATA BCBP-style payload. */
  protected readonly payload = computed(() => {
    const s = this.seg();
    const p = this.pax();
    const doy = Math.floor((s.depUtc - Date.UTC(new Date(s.depUtc).getUTCFullYear(), 0, 0)) / 86_400_000);
    const seq = String(hashString(this.booking().ref + this.paxIndex() + s.id) % 999).padStart(4, '0');
    const name = `${p.lastName}/${p.firstName}`.toUpperCase().replace(/[^A-Z/ ]/g, '').slice(0, 20).padEnd(20, ' ');
    return `M1${name}E${this.booking().ref} ${s.from}${s.to}${s.airline.padEnd(3, ' ')}${s.flightNo.slice(2).padStart(5, '0')} ${String(doy).padStart(3, '0')}Y${this.seat().padStart(4, '0')}${seq}100`;
  });
}
