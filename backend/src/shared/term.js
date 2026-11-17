import { addDays, isDayKey } from './dateKeys.js';
import { ValidationError } from './errors.js';

export const lastDayOf = (term) => addDays(term.start, term.days - 1);

export function assertDayInTerm(date, term) {
  if (!isDayKey(date) || date < term.start || date > lastDayOf(term)) {
    throw new ValidationError(`date must be a YYYY-MM-DD day inside the term (${term.start} to ${lastDayOf(term)})`);
  }
}
