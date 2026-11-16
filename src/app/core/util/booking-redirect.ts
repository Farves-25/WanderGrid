import { BookingRequest } from '../models/flight.model';

/**
 * Sends the traveller to the seller's own site in a new tab.
 * Sellers reached through Google Flights expect a form POST; plain links are opened directly.
 * Must be called from a click handler so the browser allows the new tab.
 */
export function openBooking(req: BookingRequest, doc: Document = document): boolean {
  if (!/^https:\/\//i.test(req.url)) return false;
  if (!req.postData) {
    doc.defaultView?.open(req.url, '_blank', 'noopener');
    return true;
  }
  const form = doc.createElement('form');
  form.method = 'POST';
  form.action = req.url;
  form.target = '_blank';
  form.setAttribute('rel', 'noopener');
  form.hidden = true;
  for (const [name, value] of new URLSearchParams(req.postData)) {
    const input = doc.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  doc.body.appendChild(form);
  form.submit();
  form.remove();
  return true;
}
