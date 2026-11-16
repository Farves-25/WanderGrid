export interface PopoverPlacement {
  /** Open above the trigger instead of below. */
  up: boolean;
  /** Right-align the panel to the trigger instead of left-aligning it. */
  end: boolean;
  /** Tallest the panel may be so it stays inside the viewport. */
  maxHeight: number;
}

/** Picks the side with room for a popover of roughly `width` × `height` px anchored to `trigger`. */
export function placePopover(trigger: HTMLElement, width: number, height: number): PopoverPlacement {
  const r = trigger.getBoundingClientRect();
  const margin = 16;
  const below = window.innerHeight - r.bottom - margin;
  const above = r.top - margin;
  const up = below < height && above > below;
  const end = r.left + width > window.innerWidth - 8 && r.right - width >= 8;
  return { up, end, maxHeight: Math.max(160, Math.min(height, up ? above : below)) };
}
