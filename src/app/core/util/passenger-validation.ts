import { Contact, Passenger, PaxType } from '../models/flight.model';
import { addDays, isIsoDate } from './date.util';

export function ageOn(dob: string, onIso: string): number {
  const [by, bm, bd] = dob.split('-').map(Number);
  const [y, m, d] = onIso.split('-').map(Number);
  let age = y - by;
  if (m < bm || (m === bm && d < bd)) age--;
  return age;
}

export function blankPassenger(type: PaxType): Passenger {
  return { type, title: '', firstName: '', lastName: '', dob: '', gender: '', nationality: '', passportNo: '', passportExpiry: '', passportCountry: '' };
}

const NAME_RE = /^[\p{L}][\p{L} '’-]{0,28}[\p{L}]$|^[\p{L}]{2}$/u;

export type PassengerErrors = Partial<Record<keyof Passenger, string>>;

/**
 * Validates a passenger for international travel.
 * @param firstDepartIso date of the first flight (age rules)
 * @param lastDepartIso date of the last flight (passport must stay valid ≥ 6 months after it)
 */
export function validatePassenger(p: Passenger, firstDepartIso: string, lastDepartIso: string): PassengerErrors {
  const e: PassengerErrors = {};
  if (!NAME_RE.test(p.firstName.trim())) e.firstName = 'Enter your first name as on your passport (letters only).';
  if (!NAME_RE.test(p.lastName.trim())) e.lastName = 'Enter your last name as on your passport (letters only).';
  if (!p.gender) e.gender = 'Select a gender.';
  if (p.type === 'adult' && !p.title) e.title = 'Select a title.';
  if (!isIsoDate(p.dob)) e.dob = 'Enter a valid date of birth.';
  else {
    const age = ageOn(p.dob, firstDepartIso);
    if (p.dob > firstDepartIso) e.dob = 'Date of birth cannot be in the future.';
    else if (p.type === 'adult' && age < 12) e.dob = 'Adult passengers must be 12 or older on the travel date.';
    else if (p.type === 'child' && (age < 2 || age > 11)) e.dob = 'Child passengers must be aged 2–11 on the travel date.';
    else if (p.type === 'infant' && age >= 2) e.dob = 'Infants must be under 2 on the travel date.';
    else if (age > 120) e.dob = 'Check the date of birth.';
  }
  if (!p.nationality) e.nationality = 'Select a nationality.';
  if (!p.passportCountry) e.passportCountry = 'Select the issuing country.';
  if (!/^[A-Za-z0-9]{6,9}$/.test(p.passportNo.trim())) e.passportNo = 'Passport numbers are 6–9 letters or digits.';
  if (!isIsoDate(p.passportExpiry)) e.passportExpiry = 'Enter the passport expiry date.';
  else if (p.passportExpiry <= firstDepartIso) e.passportExpiry = 'This passport expires before you travel.';
  else if (p.passportExpiry < addDays(lastDepartIso, 183)) e.passportExpiry = 'Most countries require 6 months validity after your return — renew your passport first.';
  return e;
}

export type ContactErrors = Partial<Record<keyof Contact, string>>;

export function validateContact(c: Contact): ContactErrors {
  const e: ContactErrors = {};
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c.email.trim())) e.email = 'Enter a valid email address.';
  const digits = c.phone.replace(/[\s()-]/g, '');
  if (!/^\+?\d{7,15}$/.test(digits)) e.phone = 'Enter a phone number with country code, e.g. +44 7700 900123.';
  return e;
}

export interface Country {
  cc: string;
  name: string;
}

export const COUNTRIES: readonly Country[] = [
  ['AE', 'United Arab Emirates'], ['AR', 'Argentina'], ['AT', 'Austria'], ['AU', 'Australia'], ['BD', 'Bangladesh'], ['BE', 'Belgium'],
  ['BR', 'Brazil'], ['CA', 'Canada'], ['CH', 'Switzerland'], ['CL', 'Chile'], ['CN', 'China'], ['CO', 'Colombia'], ['CZ', 'Czechia'],
  ['DE', 'Germany'], ['DK', 'Denmark'], ['EG', 'Egypt'], ['ES', 'Spain'], ['ET', 'Ethiopia'], ['FI', 'Finland'], ['FR', 'France'],
  ['GB', 'United Kingdom'], ['GR', 'Greece'], ['HK', 'Hong Kong SAR'], ['HU', 'Hungary'], ['ID', 'Indonesia'], ['IE', 'Ireland'],
  ['IL', 'Israel'], ['IN', 'India'], ['IS', 'Iceland'], ['IT', 'Italy'], ['JO', 'Jordan'], ['JP', 'Japan'], ['KE', 'Kenya'],
  ['KR', 'South Korea'], ['LK', 'Sri Lanka'], ['MA', 'Morocco'], ['MX', 'Mexico'], ['MY', 'Malaysia'], ['NG', 'Nigeria'],
  ['NL', 'Netherlands'], ['NO', 'Norway'], ['NP', 'Nepal'], ['NZ', 'New Zealand'], ['PE', 'Peru'], ['PH', 'Philippines'],
  ['PK', 'Pakistan'], ['PL', 'Poland'], ['PT', 'Portugal'], ['QA', 'Qatar'], ['SA', 'Saudi Arabia'], ['SE', 'Sweden'],
  ['SG', 'Singapore'], ['TH', 'Thailand'], ['TR', 'Türkiye'], ['TW', 'Taiwan'], ['US', 'United States'], ['VN', 'Vietnam'],
  ['ZA', 'South Africa'],
].map(([cc, name]) => ({ cc, name }));

export function countryName(cc: string): string {
  return COUNTRIES.find((c) => c.cc === cc)?.name ?? cc;
}
