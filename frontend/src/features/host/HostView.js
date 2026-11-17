import { getCampusFeed } from '../../shared/api/catalogApi.js';
import { toast } from '../../shared/components/toast.js';
import { addDays, fmt } from '../../shared/utils/dates.js';
import { esc } from '../../shared/utils/html.js';
import { getAvailability, getEventFit, previewCrowding, recommendDate } from './api/hostApi.js';
import { renderHeatmap, renderTopSlots, slotLabel, TYPE_LABEL } from './components/heatmap.js';
import { bindHeatmap3d, colorsFor, HOST_THEMES, renderFitPicks, renderHeatDetail, renderHeatmap3d } from './components/heatmap3d.js';
import { renderMocks, renderPicks } from './components/mockEvents.js';
import { hostState as state } from './state.js';

const MAX_DAYS = 31;
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5) + 1;
const lastDay = (term) => addDays(term.start, term.days - 1);

// What to target: everyone, or by major, class year or course. Switching kind selects the first option of that kind.
function audienceOptions(a, kind) {
  if (kind === 'major') return a.majors.map((m) => ({ value: `major:${m.major}`, label: m.major, count: m.count }));
  if (kind === 'year') return a.years.map((y) => ({ value: `year:${y.year}`, label: `Class of year ${y.year}`, count: y.count }));
  if (kind === 'course') return a.courses.map((c) => ({ value: `course:${c.id}`, label: `${c.code} ${c.name}`, count: c.count }));
  return [{ value: 'all', label: 'All students', count: a.total }];
}

export async function load(ctx) {
  const { term } = ctx;
  if (state.audience === null) state.audience = audienceOptions(ctx.audiences, state.kind)[0].value;
  const mockEvents = state.mocks.map(({ type, date }) => ({ type, date }));
  const verdictsFor = () => (mockEvents.length ? previewCrowding(state.audience, mockEvents) : { events: [] });

  if (state.mode === '3d') {
    const [fit, crowding, campus] = await Promise.all([getEventFit({ type: state.hostType, audience: state.audience, mockEvents }), verdictsFor(), getCampusFeed()]);
    return { mode: '3d', fit, verdicts: crowding.events, campus };
  }

  state.from ??= term.start;
  state.to ??= addDays(state.from, 13) > lastDay(term) ? lastDay(term) : addDays(state.from, 13);
  if (state.to < state.from) return { mode: '2d', warning: 'The end date is before the start date.' };
  if (daysBetween(state.from, state.to) > MAX_DAYS) return { mode: '2d', warning: `Pick a range of at most ${MAX_DAYS} days.` };
  const [availability, picks, crowding] = await Promise.all([
    getAvailability({ audience: state.audience, from: state.from, to: state.to }),
    recommendDate(state.hostType, state.audience, mockEvents),
    verdictsFor(),
  ]);
  return { mode: '2d', availability, picks, verdicts: crowding.events };
}

function header() {
  return `<div class="page-head row spread"><div><h2>Event planner</h2>
      <p class="sub">Find the dates and time slots when your audience is most available. Mock events are for planning: they are never saved and students never see them.</p></div>
      <div class="seg mode-seg" role="group" aria-label="Heatmap mode"><button data-mode="2d" class="${state.mode === '2d' ? 'on' : ''}" aria-pressed="${state.mode === '2d'}">2D time slots</button><button data-mode="3d" class="${state.mode === '3d' ? 'on' : ''}" aria-pressed="${state.mode === '3d'}">3D month</button></div></div>
    <p class="banner">Aggregated data only. No student records, courses or deadlines are shown to hosts.</p>`;
}

function controls(ctx, showDates) {
  const { term, audiences } = ctx;
  const options = audienceOptions(audiences, state.kind);
  const kinds = [['everyone', 'Everyone'], ['major', 'Major'], ['year', 'Class year'], ['course', 'Course']];
  const selected = options.find((o) => o.value === state.audience) ?? options[0];
  return { selected, html: `
    <div class="card controls">
      <div class="field"><label>Audience by</label><div class="seg">${kinds.map(([id, label]) => `<button data-kind="${id}" class="${id === state.kind ? 'on' : ''}">${label}</button>`).join('')}</div></div>
      <div class="field"><label for="aud">Target audience</label>
        <select id="aud">${options.map((o) => `<option value="${esc(o.value)}" ${o.value === selected.value ? 'selected' : ''}>${esc(o.label)} (${o.count})</option>`).join('')}</select></div>
      ${showDates ? `<div class="field"><label for="from">From</label><input type="date" id="from" value="${state.from}" min="${term.start}" max="${lastDay(term)}" /></div>
      <div class="field"><label for="to">To</label><input type="date" id="to" value="${state.to}" min="${term.start}" max="${lastDay(term)}" /></div>
      <p class="status controls-note">Data covers ${fmt(term.start)} to ${fmt(lastDay(term))}.</p>` : `<p class="status controls-note">The 3D month covers all of December. Switch to 2D to choose dates and see hours.</p>`}
    </div>` };
}

export function render($app, data, { ctx, refresh, redraw }) {
  if (state.audience === null) state.audience = audienceOptions(ctx.audiences, state.kind)[0].value;
  const animate = state.animate;
  state.animate = false;
  if (data.mode === '3d') render3d($app, data, { ctx, refresh, redraw, animate });
  else render2d($app, data, { ctx, refresh, redraw });
  if (state.focus) { $app.querySelector(state.focus)?.focus(); state.focus = null; }
}

function render2d($app, data, { ctx, refresh, redraw }) {
  const { term } = ctx;
  const { selected, html: controlsHtml } = controls(ctx, true);
  if (data.warning) {
    $app.innerHTML = `${header()}${controlsHtml}<p class="warn-line" role="alert">${esc(data.warning)}</p>`;
    bindShared($app, { refresh, redraw });
    return;
  }
  const { availability: a, picks, verdicts } = data;
  const pinnedSlot = state.pinned && a.days.find((d) => d.date === state.pinned.split('|')[0])?.slots.find((s) => s.startHour === Number(state.pinned.split('|')[1]));
  const pinnedDate = state.pinned?.split('|')[0];
  const best = a.best;
  const tile = (label, big, small) => `<div class="tile"><span class="tile-k">${label}</span><b>${big}</b><span>${small}</span></div>`;

  $app.innerHTML = `${header()}${controlsHtml}
    <div class="tiles">
      ${tile('Audience', `${a.studentCount}`, esc(selected.label))}
      ${tile('Average availability', `${a.average}%`, `${a.slotCount} slots over ${a.days.length} days`)}
      ${best ? tile('Best slot', `~${best.turnout}`, `${fmt(best.date)}, ${slotLabel(best.startHour, best.endHour)}`) : tile('Best slot', 'None', 'No data in this range')}
    </div>
    <div class="grid-2 planner">
      <div class="card"><h2>Availability heatmap</h2>
        <p class="sub">Each tile has two numbers. The big percentage is the share of the audience that is free in that slot (10% means 1 in 10 are free). The small ~N is the number of people expected to show up to an optional event, which is why it can be below 1 for a small audience (~0.1 means roughly a 1 in 10 chance that one person comes). Click a tile to pin it.</p>
        ${renderHeatmap(a, { pinned: state.pinned, mocks: state.mocks, termEnd: term.end })}
        ${pinnedSlot ? `<div class="pinbar"><span><b>${fmt(pinnedDate)}, ${slotLabel(pinnedSlot.startHour, pinnedSlot.endHour)}</b>: ${pinnedSlot.availability}% available, about ${pinnedSlot.turnout} expected.</span>
          <span class="row"><select id="pin-type">${Object.entries(TYPE_LABEL).map(([t, l]) => `<option value="${t}" ${t === state.hostType ? 'selected' : ''}>${l}</option>`).join('')}</select>
          <button class="btn primary" id="mock-here">Try a mock event on this day</button></span></div>` : ''}</div>
      <div class="stack"><div class="card"><h2>Top time slots</h2><p class="sub">Ranked by expected turnout.</p>${renderTopSlots(a.top, state.pinned)}</div></div>
    </div>
    <div class="grid-2">
      <div class="card"><h2>Best dates for an event</h2>${renderPicks(picks, state.hostType)}</div>
      <div class="card"><h2>Your mock events</h2><p class="sub">A what-if. Nothing here is added to the real calendar.</p>${renderMocks(state.mocks, verdicts)}</div>
    </div>`;
  bindShared($app, { refresh, redraw });
  $app.querySelectorAll('[data-pin]').forEach((b) => (b.onclick = () => { state.pinned = state.pinned === b.dataset.pin ? null : b.dataset.pin; redraw(); }));
  $app.querySelectorAll('[data-type]').forEach((b) => (b.onclick = () => { state.hostType = b.dataset.type; refresh(); }));
  const here = document.getElementById('mock-here');
  if (here) here.onclick = () => addMock(document.getElementById('pin-type').value, pinnedDate, refresh);
  document.getElementById('try-top').onclick = () => addMock(state.hostType, picks[0].date, refresh);
}

// The 3D month: a column per day, as tall and dark as its score. Colours follow the event category.
function render3d($app, data, { ctx, refresh, redraw, animate }) {
  const { term } = ctx;
  const { fit, verdicts, campus } = data;
  const { selected, html: controlsHtml } = controls(ctx, false);
  const keys = Object.keys(fit.days);
  const rank = {};
  fit.picks.forEach((p, i) => (rank[p.date] = i + 1));
  if (!keys.includes(state.day)) state.day = fit.picks[0]?.date ?? keys[0];
  // Hosts see campus events and their own mock events, never anyone's personal calendar.
  const eventsByDay = {};
  const mockAsEvents = state.mocks.map((m) => ({ summary: `${TYPE_LABEL[m.type]} event (mock)`, start: { dateTime: `${m.date}T18:00:00-05:00` } }));
  for (const e of [...campus, ...mockAsEvents]) (eventsByDay[e.start.dateTime.slice(0, 10)] ??= []).push(e);

  const isFit = state.metric === 'fit';
  const theme = HOST_THEMES[state.hostType];
  const colors = colorsFor(state.metric, state.hostType);
  const common = { keys, intensity: fit.intensity, fit: fit.days, rank, eventsByDay, rotation: state.rotation, metric: state.metric, hostType: state.hostType, termEnd: term.end };

  $app.innerHTML = `${header()}${controlsHtml}
    <div class="host-3d ${animate ? 'is-switching' : ''}" data-host-theme="${state.hostType}" style="--accent:${theme.accent};--accent-soft:${theme.soft};--chart-soft:${isFit ? theme.soft : '#f1f5f9'};--heat-gradient:linear-gradient(90deg,${colors.join(',')})">
      <div class="row" style="margin-top:16px"><div class="seg" role="group" aria-label="Event type">${Object.keys(TYPE_LABEL).map((t) => `<button data-type="${t}" style="--category-color:${HOST_THEMES[t].accent}" class="${t === state.hostType ? 'on' : ''}" aria-pressed="${t === state.hostType}">${TYPE_LABEL[t]}</button>`).join('')}</div>
        <span class="status">${fit.studentCount} students in ${esc(selected.label)} · weekdays up to ${fmt(term.end)} · only aggregates are shown</span></div>
      <div class="grid-2">
        <div class="card">
          <div class="row spread"><h2>${isFit ? 'Best days to host' : 'Campus workload'} · December 2026</h2><span class="heat-badge">3D heatmap</span></div>
          <p class="sub">${isFit ? 'Taller, darker columns mean a better fit for your event.' : 'Taller, darker columns mean heavier student workload.'}</p>
          <div class="row spread heat-controls">
            <div class="heat-view-switch" role="group" aria-label="Heatmap metric">
              <button data-heat-metric="fit" aria-pressed="${isFit}">Event fit</button>
              <button data-heat-metric="workload" aria-pressed="${!isFit}">Campus workload</button>
            </div>
          </div>
          <div class="heat-toolbar"><label for="heat-rotation">Rotate view</label><input id="heat-rotation" type="range" min="20" max="60" step="1" value="${state.rotation}" /><output id="heat-angle" for="heat-rotation">${state.rotation}°</output></div>
          <div id="heat-chart" class="heat-chart">${renderHeatmap3d({ ...common, selectedDay: state.day, animate })}</div>
          <p class="heat-hint">Select a column for details · Arrow keys move between dates</p>
          <div class="gradient"></div><div class="gradient-labels"><span>0 · ${isFit ? 'Less suitable' : 'Light workload'}</span><span>100 · ${isFit ? 'Best fit' : 'Heavy workload'}</span></div>
          <div class="heat-key"><span><i class="heat-key-rank">1</i> Recommended date</span><span><i class="heat-key-event"></i> Campus or mock event</span><span>${isFit ? 'Gray: weekends and outside Dec 1–18' : 'Faded: outside Dec 1–18'}</span></div>
          <div id="heat-detail" class="heat-detail" aria-live="polite">${renderHeatDetail({ day: state.day, fit: fit.days, intensity: fit.intensity, rank, eventsByDay })}</div>
        </div>
        <div class="stack">
          <div class="card"><h2>Best dates for a ${TYPE_LABEL[state.hostType].toLowerCase()} event</h2>${renderFitPicks(fit.picks, state.hostType, TYPE_LABEL[state.hostType])}</div>
          <div class="card"><h2>Your mock events</h2><p class="sub">A what-if. Nothing here is added to the real calendar.</p>${renderMocks(state.mocks, verdicts)}</div>
        </div>
      </div></div>`;

  bindShared($app, { refresh, redraw });
  bindHeatmap3d({
    chart: document.getElementById('heat-chart'),
    detail: document.getElementById('heat-detail'),
    keys,
    getSelected: () => state.day,
    onSelect: (k) => { state.day = k; },
    onRotate: (v) => { state.rotation = v; },
    redrawChart: () => renderHeatmap3d({ ...common, rotation: state.rotation, selectedDay: state.day, animate: false }),
    getDetail: (k) => renderHeatDetail({ day: k, fit: fit.days, intensity: fit.intensity, rank, eventsByDay }),
  });
  $app.querySelectorAll('[data-heat-metric]').forEach((b) => (b.onclick = () => {
    if (state.metric === b.dataset.heatMetric) return;
    state.metric = b.dataset.heatMetric;
    state.animate = true;
    state.focus = `[data-heat-metric="${state.metric}"]`;
    redraw(); // same data, different scale: no need to ask the server again
  }));
  $app.querySelectorAll('[data-type]').forEach((b) => (b.onclick = () => {
    if (state.hostType === b.dataset.type) return;
    state.hostType = b.dataset.type;
    state.animate = true;
    state.focus = `[data-type="${state.hostType}"]`;
    refresh();
  }));
  const top = document.getElementById('try-top');
  if (top && fit.picks.length) top.onclick = () => addMock(state.hostType, fit.picks[0].date, refresh);
}

function addMock(type, date, refresh) {
  if (state.mocks.length >= 20) { toast('That is plenty of mock events. Remove some first.'); return; }
  state.mocks.push({ type, date });
  toast(`Mock ${TYPE_LABEL[type].toLowerCase()} event on ${fmt(date)}. Not saved.`);
  refresh();
}

// Controls and mock-event buttons are the same in both modes.
function bindShared($app, { refresh }) {
  $app.querySelectorAll('[data-mode]').forEach((b) => (b.onclick = () => {
    if (state.mode === b.dataset.mode) return;
    state.mode = b.dataset.mode;
    state.animate = state.mode === '3d';
    state.focus = `[data-mode="${state.mode}"]`;
    refresh();
  }));
  $app.querySelectorAll('[data-kind]').forEach((b) => (b.onclick = () => {
    state.kind = b.dataset.kind;
    state.audience = state.kind === 'everyone' ? 'all' : null; // the first option of that kind, chosen when drawn
    state.pinned = null;
    refresh();
  }));
  document.getElementById('aud').onchange = (e) => { state.audience = e.target.value; state.pinned = null; refresh(); };
  const from = document.getElementById('from');
  if (from) {
    from.onchange = (e) => { state.from = e.target.value || state.from; refresh(); };
    document.getElementById('to').onchange = (e) => { state.to = e.target.value || state.to; refresh(); };
  }
  $app.querySelectorAll('[data-unmock]').forEach((b) => (b.onclick = () => { state.mocks.splice(Number(b.dataset.unmock), 1); refresh(); }));
  const clear = document.getElementById('clear-mocks');
  if (clear) clear.onclick = () => { state.mocks = []; refresh(); };
}
