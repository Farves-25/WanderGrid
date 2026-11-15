export type CardBrand = 'Visa' | 'Mastercard' | 'Amex' | 'Discover' | 'Card';

export function digitsOnly(s: string): string {
  return s.replace(/\D/g, '');
}

export function cardBrand(number: string): CardBrand {
  const n = digitsOnly(number);
  if (/^4/.test(n)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(n)) return 'Mastercard';
  if (/^3[47]/.test(n)) return 'Amex';
  if (/^(6011|65|64[4-9])/.test(n)) return 'Discover';
  return 'Card';
}

export function luhn(number: string): boolean {
  const n = digitsOnly(number);
  if (n.length < 12) return false;
  let sum = 0;
  let alt = false;
  for (let i = n.length - 1; i >= 0; i--) {
    let d = +n[i];
    if (alt) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
}

/** Groups digits as 4-4-4-4 (or 4-6-5 for Amex). */
export function formatCardNumber(raw: string): string {
  const n = digitsOnly(raw).slice(0, cardBrand(raw) === 'Amex' ? 15 : 16);
  if (cardBrand(raw) === 'Amex') return [n.slice(0, 4), n.slice(4, 10), n.slice(10)].filter(Boolean).join(' ');
  return n.replace(/(.{4})/g, '$1 ').trim();
}

export function formatExpiry(raw: string): string {
  const n = digitsOnly(raw).slice(0, 4);
  return n.length > 2 ? `${n.slice(0, 2)}/${n.slice(2)}` : n;
}

export function expiryValid(exp: string, now = new Date()): boolean {
  const m = /^(\d{2})\/(\d{2})$/.exec(exp);
  if (!m) return false;
  const month = +m[1];
  const year = 2000 + +m[2];
  if (month < 1 || month > 12) return false;
  // valid through the last day of the expiry month
  return year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1);
}

export function cvcValid(cvc: string, brand: CardBrand): boolean {
  return new RegExp(brand === 'Amex' ? '^\\d{4}$' : '^\\d{3}$').test(cvc);
}

export type ChargeOutcome = { kind: 'approved' } | { kind: 'challenge' } | { kind: 'declined'; message: string };

/** Simulated card network responses driven by well-known test numbers. */
export function simulateAuthorization(number: string, totalUsd: number): ChargeOutcome {
  const n = digitsOnly(number);
  if (n === '4000000000000002') return { kind: 'declined', message: 'Your card was declined. Try a different card.' };
  if (n === '4000000000009995') return { kind: 'declined', message: 'Your card has insufficient funds.' };
  if (n === '4000000000000069') return { kind: 'declined', message: 'Your card has expired.' };
  if (n === '4000000000003220' || totalUsd > 1500) return { kind: 'challenge' };
  return { kind: 'approved' };
}
