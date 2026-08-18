import { format, parseISO } from 'date-fns';

// The whole system displays dates as dd-MMM-yyyy (e.g. 17-Aug-2026), per spec.
export const DATE_DISPLAY_FORMAT = 'dd-MMM-yyyy';

export function formatDate(value) {
  if (!value) return '';
  const date = typeof value === 'string' ? parseISO(value) : value;
  return format(date, DATE_DISPLAY_FORMAT);
}

// Convert a JS Date (from the datepicker) to the yyyy-MM-dd string the API expects.
export function toApiDate(date) {
  if (!date) return null;
  return format(date, 'yyyy-MM-dd');
}
