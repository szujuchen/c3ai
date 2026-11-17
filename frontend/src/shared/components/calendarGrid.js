import { dow } from '../utils/dates.js';

// A Monday-first month grid. `cell(dayKey)` returns the HTML for one day.
export function renderCalendar(keys, cell) {
  const lead = (dow(keys[0]) + 6) % 7;
  const head = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => `<div class="dow">${d}</div>`).join('');
  const blanks = Array.from({ length: lead }, () => '<div class="day empty"></div>').join('');
  return `<div class="cal">${head}${blanks}${keys.map(cell).join('')}</div>`;
}
