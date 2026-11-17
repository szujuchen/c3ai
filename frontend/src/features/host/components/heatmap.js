import { dayOfMonth, fmt, short } from '../../../shared/utils/dates.js';
import { esc } from '../../../shared/utils/html.js';

export const TYPE_LABEL = { recruiting: 'Recruiting', relax: 'Relax / wellness', general: 'General' };

// The 2-hour slots a mock event can fill: the same ones the heatmap shows. Quick adds default to 6 to 8 PM.
export const SLOT_START_HOURS = [8, 10, 12, 14, 16, 18, 20];
export const DEFAULT_START_HOUR = 18;

const hour = (h) => `${((h + 11) % 12) + 1}`;
const ampm = (h) => (h < 12 || h === 24 ? 'AM' : 'PM');
export const slotLabel = (start, end) => (ampm(start) === ampm(end) ? `${hour(start)}–${hour(end)} ${ampm(end)}` : `${hour(start)} ${ampm(start)}–${hour(end)} ${ampm(end)}`);

// Five bands, from most available (0) to least (4). The number is always printed too, so colour is not the only cue.
export const band = (availability) => (availability >= 80 ? 0 : availability >= 65 ? 1 : availability >= 50 ? 2 : availability >= 35 ? 3 : 4);
const BAND_TEXT = ['80%+', '65–79%', '50–64%', '35–49%', 'under 35%'];

const isWeekend = (date) => [0, 6].includes(new Date(date + 'T00:00:00Z').getUTCDay());
const turnoutText = (t) => `~${t >= 10 ? Math.round(t) : t}`;
const stressColor = (i) => `hsl(${140 - 1.35 * i},62%,${88 - i * 0.12}%)`;

// Days down the side, the seven 2-hour slots across. Click a tile to pin it; the ranked list shares the selection.
export function renderHeatmap(availability, { pinned, mocks, termEnd }) {
  const { days } = availability;
  const head = days[0].slots.map((s) => `<div class="hm-col">${slotLabel(s.startHour, s.endHour)}</div>`).join('');
  let lastMonth = '';
  const rows = days.map((d) => {
    const month = short(d.date).split(' ')[0];
    const showMonth = month !== lastMonth;
    lastMonth = month;
    const mocked = mocks.filter((m) => m.date === d.date);
    const tiles = d.slots.map((s) => {
      const key = `${d.date}|${s.startHour}`;
      const label = `${fmt(d.date)}, ${slotLabel(s.startHour, s.endHour)}: ${s.availability}% available, ${turnoutText(s.turnout)} expected`;
      const here = mocked.filter((m) => (m.startHour ?? DEFAULT_START_HOUR) === s.startHour);
      const full = here.length ? `${label}. Mock event here: ${here.map((m) => m.name || TYPE_LABEL[m.type]).join(', ')}` : label;
      return `<button class="hm-tile b${band(s.availability)} ${pinned === key ? 'pinned' : ''} ${here.length ? 'has-mock' : ''}" data-pin="${key}" title="${esc(full)}" aria-label="${esc(full)}" aria-pressed="${pinned === key}">
          <b>${s.availability}%</b><span>${turnoutText(s.turnout)}</span>${here.length ? '<i class="tile-mock"></i>' : ''}</button>`;
    }).join('');
    return `<div class="hm-row ${d.afterFinals ? 'break' : ''}">
        <div class="hm-day"><span class="hm-wd">${fmt(d.date).slice(0, 3)}</span><span class="hm-num ${isWeekend(d.date) ? 'weekend' : ''}">${dayOfMonth(d.date)}</span>
          <span class="hm-mo">${showMonth ? month : ''}</span>${mocked.length ? `<i class="hm-mock" title="Mock: ${esc(mocked.map((m) => m.name || TYPE_LABEL[m.type]).join(', '))}"></i>` : ''}</div>
        ${tiles}
        <div class="hm-stress" style="background:${stressColor(d.stress)}" title="Campus stress ${d.stress} of 100">${d.stress}</div></div>`;
  }).join('');
  return `<div class="hm-wrap"><div class="hm" role="group" aria-label="Availability by day and time slot">
      <div class="hm-row hm-headrow"><div class="hm-day"></div>${head}<div class="hm-col">Stress</div></div>${rows}</div></div>
    <div class="legend hm-legend">${BAND_TEXT.map((t, i) => `<span class="hb${i}">${t}</span>`).join('')}<span class="note-inline">In each tile, the big % is how much of the audience is free, and ~N is how many people are expected to show up. Stress is campus-wide, 0 to 100. Finals end ${short(termEnd)}.</span></div>`;
}

export function renderTopSlots(top, pinned) {
  if (!top.length) return '<p class="sub" style="margin-top:12px">No availability data for this audience and date range.</p>';
  return `<ol class="top-slots">${top.map((s, i) => {
    const key = `${s.date}|${s.startHour}`;
    return `<li><button class="top-slot ${pinned === key ? 'pinned' : ''}" data-pin="${key}"><span class="rk">${i + 1}</span>
        <span class="ts-when"><b>${fmt(s.date)}</b><span>${slotLabel(s.startHour, s.endHour)}</span></span>
        <span class="ts-n"><b>${turnoutText(s.turnout)}</b><span>${s.availability}% free</span></span></button></li>`;
  }).join('')}</ol>`;
}
