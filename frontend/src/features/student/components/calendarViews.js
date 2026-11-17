import { esc } from '../../../shared/utils/html.js';
import { addDays, dayOfMonth, dow, fmt, short } from '../../../shared/utils/dates.js';
import { renderCalendar } from '../../../shared/components/calendarGrid.js';

const VIEWS = [['day', 'Day'], ['week', 'Week'], ['month', 'Month']];

// The time grid runs 7 AM to midnight so an 11:59 PM deadline fits.
export const GRID = { startHour: 7, endHour: 24, hourPx: 48, chipPx: 24, minBlockPx: 24 };

export function weekOf(day) {
  const start = addDays(day, -((dow(day) + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

const clock = (min) => { const h = Math.floor(min / 60), m = min % 60; return `${((h + 11) % 12) + 1}${m ? ':' + String(m).padStart(2, '0') : ''} ${h < 12 || h === 24 ? 'AM' : 'PM'}`; };
const range = (a, b) => `${clock(a)} – ${clock(b)}`;
const topPx = (min) => ((Math.max(min, GRID.startHour * 60) - GRID.startHour * 60) / 60) * GRID.hourPx;

// Blocks (classes, events, study) that overlap share the column's width; chips (deadlines, start markers) stack.
function layoutBlocks(blocks) {
  const sorted = blocks.slice().sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  const lanes = [];
  const placed = sorted.map((b) => {
    let lane = lanes.findIndex((end) => end <= b.startMin);
    if (lane < 0) { lane = lanes.length; lanes.push(0); }
    lanes[lane] = b.endMin;
    return { ...b, lane };
  });
  // Every block in an overlapping cluster shares the cluster's lane count.
  return placed.map((b) => ({ ...b, lanes: Math.max(...placed.filter((o) => o.startMin < b.endMin && o.endMin > b.startMin).map((o) => o.lane + 1)) }));
}

function renderColumn(day, { selectedDay, course, isAdmin, cap }) {
  if (!day.inTerm) return `<div class="tg-col out"><span class="tg-note">${day.afterFinals ? 'Break' : 'Outside term'}</span></div>`;
  const blocks = layoutBlocks(day.items.filter((i) => ['class', 'event', 'study'].includes(i.kind)));
  const chips = day.items.filter((i) => i.kind === 'deadline' || i.kind === 'start').sort((a, b) => a.startMin - b.startMin);
  const code = (i) => (i.courseId ? course(i.courseId)?.course_code ?? '' : '');
  const blockHtml = blocks.map((b) => {
    const top = topPx(b.startMin);
    const height = Math.max(GRID.minBlockPx, ((b.endMin - Math.max(b.startMin, GRID.startHour * 60)) / 60) * GRID.hourPx);
    const tall = height >= 40;
    const label = b.kind === 'class' ? `${esc(b.title)} ${esc(b.subtitle ?? '')}` : b.kind === 'study' ? `${esc(code(b))} ${esc(b.title)}` : esc(b.title);
    const tag = b.kind === 'study' ? 'button' : 'div';
    const attrs = b.kind === 'study' ? ` data-day="${day.date}" type="button"` : b.kind === 'event' ? ` data-open="${esc(b.id)}" role="button" tabindex="0"` : '';
    return `<${tag} class="tg-block ${b.kind}${b.relax ? ' relax' : ''}" style="top:${top}px;height:${height}px;left:${(b.lane / b.lanes) * 100}%;width:${100 / b.lanes}%"${attrs} title="${esc(b.title)} · ${range(b.startMin, b.endMin)}">
        <b>${label}</b>${tall ? `<span>${range(b.startMin, b.endMin)}</span>` : ''}</${tag}>`;
  }).join('');
  // Chips at the same time stack downward; near midnight they stack upward so they do not fall off the grid.
  let lastTop = -Infinity;
  const chipHtml = chips.map((c) => {
    let top = topPx(c.startMin);
    if (top < lastTop + GRID.chipPx) top = lastTop + GRID.chipPx;
    const max = (GRID.endHour - GRID.startHour) * GRID.hourPx - GRID.chipPx;
    if (top > max) top = max;
    lastTop = top;
    return `<button class="tg-chip ${c.kind}" type="button" style="top:${top}px" data-day="${day.date}" title="${esc(c.title)} · ${clock(c.startMin)}">
        <i aria-hidden="true">${c.kind === 'deadline' ? '⚑' : '✦'}</i>${esc(code(c))} ${esc(c.title)}</button>`;
  }).join('');
  const lines = Array.from({ length: GRID.endHour - GRID.startHour }, (_, i) => `<i class="tg-line" style="top:${i * GRID.hourPx}px"></i>`).join('');
  return `<div class="tg-col lv${day.level} ${day.date === selectedDay ? 'selected' : ''}" data-col="${day.date}">${lines}${blockHtml}${chipHtml}</div>`;
}

// The week (or a single day) as a timetable: hours down the side, days across, items placed at their time.
function timeGrid(week, { selectedDay, course, isAdmin, cap, loading }) {
  const hours = Array.from({ length: GRID.endHour - GRID.startHour }, (_, i) => GRID.startHour + i);
  const single = week.days.length === 1;
  const heads = week.days.map((d) => `<button class="tg-head ${d.date === selectedDay ? 'selected' : ''}" data-day="${d.date}" type="button"><span>${fmt(d.date).slice(0, 3)}</span><b>${dayOfMonth(d.date)}</b>
      ${d.inTerm && d.hours ? `<em class="${d.level === 2 ? 'over' : ''}">${d.hours} h</em>` : ''}</button>`).join('');
  return `<div class="tg ${single ? 'single' : ''} ${loading ? 'loading' : ''}" style="--cols:${week.days.length}">
      <div class="tg-headrow"><div class="tg-corner"></div>${heads}</div>
      <div class="tg-scroll"><div class="tg-body" style="height:${(GRID.endHour - GRID.startHour) * GRID.hourPx}px">
        <div class="tg-gutter">${hours.map((h) => `<span style="top:${(h - GRID.startHour) * GRID.hourPx}px">${h === 12 ? 'Noon' : ((h + 11) % 12) + 1 + (h < 12 ? ' AM' : ' PM')}</span>`).join('')}</div>
        ${week.days.map((d) => renderColumn(d, { selectedDay, course, isAdmin, cap })).join('')}
        ${nowLine(week)}
      </div></div></div>`;
}

// A red line across today's column. The demo term is in the future, so it only appears if "today" is inside the week.
function nowLine(week) {
  const now = new Date();
  const today = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const i = week.days.findIndex((d) => d.date === today);
  if (i < 0) return '';
  const min = now.getHours() * 60 + now.getMinutes();
  return `<i class="tg-now" style="top:${topPx(min)}px;left:calc(var(--gutter) + ${i} * (100% - var(--gutter)) / ${week.days.length});width:calc((100% - var(--gutter)) / ${week.days.length})"></i>`;
}

// Two thin bars for an admin: coursework hours and event hours, against the daily cap.
const split = (d, cap) => `<span class="split"><i class="sw" style="height:${Math.min(100, (d.workHours / cap) * 100)}%"></i><i class="se" style="height:${Math.min(100, (d.eventHours / cap) * 100)}%"></i></span>`;

function monthGrid(days, selectedDay, cap, isAdmin) {
  return renderCalendar(Object.keys(days), (k) => {
    const d = days[k];
    const dots = Array.from({ length: Math.min(d.dueCount, 3) }, () => '<i class="dot"></i>').join('');
    return `<button class="day l${d.level} ${k === selectedDay ? 'selected' : ''}" data-day="${k}">
                ${dayOfMonth(k)}${d.eventCount ? '<i class="ev"></i>' : ''}
                ${d.hours ? `<span class="hrs">${d.hours} h</span>` : ''}<span class="dots">${dots}</span>${isAdmin ? split(d, cap) : ''}</button>`;
  });
}

// The calendar: a Day / Week / Month switcher, previous / next, and the chosen view.
export function renderCalendarViews({ view, days, week, selectedDay, cap, isAdmin, course, loading }) {
  const wk = weekOf(selectedDay);
  const label = view === 'week' ? `${short(wk[0])} – ${short(wk[6])}, 2026` : view === 'day' ? `${fmt(selectedDay)}, 2026` : 'December 2026';
  const breakWeek = view === 'week' && week && week.days.every((d) => d.afterFinals);
  const nav = view === 'month' ? '' : `<div class="row" style="gap:6px"><button class="btn" data-nav="-1" aria-label="Previous ${view}">‹</button><button class="btn" data-nav="1" aria-label="Next ${view}">›</button></div>`;
  const body = view === 'month' ? monthGrid(days, selectedDay, cap, isAdmin) : timeGrid(week, { selectedDay, course, isAdmin, cap, loading });
  const legend = `<div class="legend">${view === 'month'
    ? `<span class="g">Light</span><span class="y">Busy</span><span class="r">Over your cap</span><span class="d">Deadline</span><span class="e">Event</span>${isAdmin ? '<span class="sw">Coursework</span><span class="se">Events</span>' : ''}`
    : '<span class="k-class">Classes</span><span class="k-study">Study blocks</span><span class="k-event">Events</span><span class="k-due">Deadlines</span><span class="k-start">Start studying</span>'}</div>`;
  return `<div class="row spread cal-bar"><div class="row"><h2>${label}</h2>${breakWeek ? '<span class="badge">Break week</span>' : ''}</div>
      <div class="row"><div class="seg">${VIEWS.map(([id, text]) => `<button data-view="${id}" class="${id === view ? 'on' : ''}">${text}</button>`).join('')}</div>${nav}</div></div>
      ${body}${legend}`;
}
