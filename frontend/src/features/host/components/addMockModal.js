import { esc } from '../../../shared/utils/html.js';
import { addDays } from '../../../shared/utils/dates.js';
import { SLOT_START_HOURS, slotLabel, TYPE_LABEL } from './heatmap.js';

export const MAX_NAME_LENGTH = 80;
export const lastTermDay = (term) => addDays(term.start, term.days - 1);

// A form to add a mock event: its name, date and type. It is a what-if kept in this browser only: never saved,
// and students never see it.
export function renderAddMockModal(adding, term) {
  if (!adding) return '';
  return `<div class="modal-back" data-add-close></div>
    <form class="modal" id="add-mock-form" role="dialog" aria-modal="true" aria-labelledby="add-mock-title" novalidate>
      <button type="button" class="modal-x" data-add-close aria-label="Close">×</button>
      <h2 id="add-mock-title">Add a mock event</h2>
      <p class="sub">A what-if for planning. It stays in this browser: it is never saved and students never see it.</p>
      <div class="field"><label for="mock-name">Event name</label>
        <input id="mock-name" type="text" maxlength="${MAX_NAME_LENGTH}" autocomplete="off" placeholder="For example, Jane Street info session" value="${esc(adding.name)}" /></div>
      <div class="field"><label for="mock-date">Date</label>
        <input id="mock-date" type="date" min="${term.start}" max="${lastTermDay(term)}" value="${esc(adding.date)}" /></div>
      <div class="field"><label for="mock-slot">Time slot</label>
        <select id="mock-slot">${SLOT_START_HOURS.map((h) => `<option value="${h}" ${h === adding.startHour ? 'selected' : ''}>${slotLabel(h, h + 2)}</option>`).join('')}</select></div>
      <div class="field"><label for="mock-type">Type</label>
        <select id="mock-type">${Object.entries(TYPE_LABEL).map(([t, label]) => `<option value="${t}" ${t === adding.type ? 'selected' : ''}>${label}</option>`).join('')}</select></div>
      <p class="warn-line" id="mock-error" role="alert">${esc(adding.error)}</p>
      <div class="row" style="justify-content:flex-end">
        <button type="button" class="btn" data-add-close>Cancel</button>
        <button type="submit" class="btn primary">Add mock event</button>
      </div>
    </form>`;
}

// Checks what the host entered and returns the mock event, or the message to show.
export function readMockForm(form, term) {
  const name = form.querySelector('#mock-name').value.trim();
  const date = form.querySelector('#mock-date').value;
  const type = form.querySelector('#mock-type').value;
  const startHour = Number(form.querySelector('#mock-slot').value);
  if (!name) return { error: 'Give the event a name.' };
  if (name.length > MAX_NAME_LENGTH) return { error: `Keep the name under ${MAX_NAME_LENGTH} characters.` };
  if (!date || date < term.start || date > lastTermDay(term)) return { error: `Pick a date between ${term.start} and ${lastTermDay(term)}.` };
  if (!SLOT_START_HOURS.includes(startHour)) return { error: 'Pick one of the time slots.' };
  return { event: { type, date, name, startHour } };
}
