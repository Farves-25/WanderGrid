import { Component, ElementRef, effect, inject, input } from '@angular/core';
import {
  Armchair, ArrowLeft, ArrowRight, ArrowRightLeft, Award, Baby, BadgeCheck, Bell, BellRing, Briefcase, CalendarDays, CalendarPlus,
  Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, CircleAlert, CircleCheck, CircleHelp, Clock, Copy, CreditCard, Crown,
  Download, Flame, Gift, Globe, Heart, Info, Leaf, Lock, LogOut, Luggage, Mail, MapPin, Menu, Minus, Moon, Pencil, Phone, Plane,
  PlaneLanding, PlaneTakeoff, Plug, Plus, Printer, QrCode, Receipt, RefreshCw, Repeat, Search, ShieldCheck, SlidersHorizontal,
  Sparkles, Star, Sun, Tag, Ticket, Timer, Trash2, TrendingDown, TrendingUp, TriangleAlert, Tv, User, Users, Utensils, Wifi, X, Zap,
  createElement,
} from 'lucide';

type IconNode = Parameters<typeof createElement>[0];

const ICONS: Record<string, IconNode> = {
  armchair: Armchair, 'arrow-left': ArrowLeft, 'arrow-right': ArrowRight, 'arrow-right-left': ArrowRightLeft, award: Award, baby: Baby,
  'badge-check': BadgeCheck, bell: Bell, 'bell-ring': BellRing, briefcase: Briefcase, 'calendar-days': CalendarDays,
  'calendar-plus': CalendarPlus, check: Check, 'chevron-down': ChevronDown, 'chevron-left': ChevronLeft, 'chevron-right': ChevronRight,
  'chevron-up': ChevronUp, 'circle-alert': CircleAlert, 'circle-check': CircleCheck, 'circle-help': CircleHelp, clock: Clock, copy: Copy,
  'credit-card': CreditCard, crown: Crown, download: Download, flame: Flame, gift: Gift, globe: Globe, heart: Heart, info: Info,
  leaf: Leaf, lock: Lock, 'log-out': LogOut, luggage: Luggage, mail: Mail, 'map-pin': MapPin, menu: Menu, minus: Minus, moon: Moon,
  pencil: Pencil, phone: Phone, plane: Plane, 'plane-landing': PlaneLanding, 'plane-takeoff': PlaneTakeoff, plug: Plug, plus: Plus,
  printer: Printer, 'qr-code': QrCode, receipt: Receipt, 'refresh-cw': RefreshCw, repeat: Repeat, search: Search,
  'shield-check': ShieldCheck, 'sliders-horizontal': SlidersHorizontal, sparkles: Sparkles, star: Star, sun: Sun, tag: Tag,
  ticket: Ticket, timer: Timer, 'trash-2': Trash2, 'trending-down': TrendingDown, 'trending-up': TrendingUp,
  'triangle-alert': TriangleAlert, tv: Tv, user: User, users: Users, utensils: Utensils, wifi: Wifi, x: X, zap: Zap,
};

/** Decorative Lucide icon (always aria-hidden — pair with visible text or an aria-label on the control). */
@Component({
  selector: 'app-icon',
  template: '',
  host: { class: 'inline-flex shrink-0 items-center justify-center', 'aria-hidden': 'true' },
})
export class IconComponent {
  readonly name = input.required<string>();
  readonly size = input(18);
  readonly stroke = input(2);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    effect(() => {
      const node = ICONS[this.name()];
      const el = this.host.nativeElement;
      el.replaceChildren();
      if (!node) return;
      el.appendChild(
        createElement(node, { width: this.size(), height: this.size(), 'stroke-width': this.stroke(), 'aria-hidden': 'true', focusable: 'false' }),
      );
    });
  }
}
