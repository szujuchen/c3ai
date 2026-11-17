import { esc } from '../../../shared/utils/html.js';
import { fmt, time } from '../../../shared/utils/dates.js';
import { renderNote, TAG } from './eventNote.js';

export const FILTERS = [['all', 'All'], ['recruiting', 'Recruiting'], ['relax', 'Relax'], ['general', 'Social'], ['registered', 'Registered']];

const matches = (e, filter) => filter === 'all' || (filter === 'registered' ? e.registered : e.host_type === filter);

// Upcoming campus events, soonest first, in a scrollable list that can be filtered. Click one for its details.
export function renderEventsSidebar(events, filter) {
  const shown = events.filter((e) => matches(e, filter));
  const rows = shown.map((e) => {
    const d = e.start.dateTime.slice(0, 10);
    return `<li><button class="evitem ${e.registered ? 'reg' : ''}" data-open="${e.id}">
          <span><span class="etag ${e.host_type}">${TAG[e.host_type] || 'Event'}</span><b>${esc(e.summary)}</b></span>
          <span class="meta">${fmt(d)} · ${time(e.start.dateTime)} · ${e.hours} h${e.location ? ' · ' + esc(e.location) : ''}</span>
          ${renderNote(e.note)}${e.registered ? '<span class="note good">✓ Registered</span>' : ''}</button></li>`;
  }).join('');
  return `<div class="card"><h2>Campus events</h2>
      <p class="sub">Click an event for details, to see what it would do to your day, and to register.</p>
      <div class="chips" role="group" aria-label="Filter events">${FILTERS.map(([id, label]) => `<button class="chip ${id === filter ? 'on' : ''}" data-filter="${id}">${label}</button>`).join('')}</div>
      <ul class="evlist">${rows || '<li class="sub" style="padding:12px 0">No events match this filter.</li>'}</ul></div>`;
}
