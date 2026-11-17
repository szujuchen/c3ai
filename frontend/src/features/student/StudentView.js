import { toast } from '../../shared/components/toast.js';
import { getCanvasAssignments } from '../../shared/api/catalogApi.js';
import { addDays } from '../../shared/utils/dates.js';
import { readText } from '../../shared/utils/files.js';
import { addExam, getCampusEvents, getDayDetail, getExamStatus, getWeek, getWorkload, importCanvas, parseSyllabus, previewEvent, setRegistration } from './api/studentApi.js';
import { renderAlert } from './components/alertBanner.js';
import { renderCalendarViews, weekOf } from './components/calendarViews.js';
import { connectCard, connectedButton, studentPicker } from './components/connectPanel.js';
import { renderDayPanel } from './components/dayPanel.js';
import { renderEventModal } from './components/eventModal.js';
import { renderEventsSidebar } from './components/eventsSidebar.js';
import { renderMissingExams } from './components/missingExams.js';
import { renderStressCard } from './components/stressCard.js';
import { renderBars } from './components/workloadBars.js';
import { studentState as state } from './state.js';

const clampToTerm = (day, term) => {
  const last = addDays(term.start, term.days - 1);
  return day < term.start ? term.start : day > last ? last : day;
};

// Fetch everything the view needs. Until Canvas is connected there is nothing to ask the server.
export async function load(ctx) {
  if (!state.canvas) return null;
  const sources = { canvas: true };
  const workload = await getWorkload(state.studentId, sources);
  if (!state.selectedDay) state.selectedDay = workload.alert ? workload.alert.start : ctx.term.start;
  state.selectedDay = clampToTerm(state.selectedDay, ctx.term);
  const weekStart = state.view === 'day' ? state.selectedDay : weekOf(state.selectedDay)[0];
  const [day, exams, campusEvents, week] = await Promise.all([
    getDayDetail(state.studentId, state.selectedDay, sources),
    getExamStatus(state.studentId, true),
    getCampusEvents(state.studentId, sources),
    state.view === 'month' ? null : getWeek(state.studentId, weekStart, state.view === 'day' ? 1 : 7, sources),
  ]);
  const openEvent = campusEvents.find((e) => e.id === state.openEventId) ?? null;
  if (!openEvent) state.openEventId = null;
  const preview = openEvent ? await previewEvent(state.studentId, openEvent.id, sources).catch(() => null) : null;
  return { workload, day, exams, campusEvents, week, openEvent, preview };
}

export function render($app, data, { ctx, refresh, redraw }) {
  const isAdmin = ctx.session.role === 'admin';
  const picker = studentPicker(ctx.students, state.studentId, isAdmin);

  if (!data) {
    $app.innerHTML = `${picker ? `<div class="row spread"><div class="row">${picker}</div></div>` : ''}
        ${connectCard({ configured: ctx.canvasConfigured, tokenFormOpen: state.tokenForm })}`;
    bind($app, { ctx, refresh, redraw });
    return;
  }

  const { workload, day, exams, campusEvents, week, openEvent, preview } = data;
  const { student: st, days } = workload;
  const keys = Object.keys(days);

  $app.innerHTML = `
      <div class="row spread">
        <div class="row">${picker}<span class="status">Daily cap ${st.daily_cap_h} h, ${st.course_ids.length} courses</span></div>
        <div class="row">${connectedButton(state.imported[state.studentId])}</div>
      </div>
      ${renderAlert(workload, { canvas: true, course: ctx.course })}
      ${renderMissingExams(exams, { pending: state.pending, course: ctx.course })}
      <div class="grid-2">
        <div class="stack">
          <div class="card cal-card">${renderCalendarViews({ view: state.view, days, week, selectedDay: state.selectedDay, cap: st.daily_cap_h, isAdmin, course: ctx.course })}</div>
          ${renderDayPanel(day, st, { done: state.done, course: ctx.course })}
          <div class="card">
            <h2>Workload until finals end</h2>
            <p class="sub">Hours of work per day against your ${st.daily_cap_h} h cap</p>
            ${renderBars(keys.filter((k) => k <= ctx.term.end), days, st.daily_cap_h)}
          </div>
        </div>
        <div class="stack rail">
          ${renderStressCard(days[state.selectedDay].stress, workload.stress, state.selectedDay)}
          ${renderEventsSidebar(campusEvents, state.filter)}
        </div>
      </div>
      ${renderEventModal(state.openEventId ? openEvent : null, preview)}`;
  bind($app, { ctx, refresh, redraw, data });
}

function bind($app, { ctx, refresh, redraw, data }) {
  const pick = document.getElementById('student');
  if (pick) pick.onchange = (e) => { state.studentId = e.target.value; state.selectedDay = null; state.openEventId = null; refresh(); };

  // Connect Canvas: the real Canvas. With a token on the server it is one click; otherwise the student pastes one.
  const connect = document.getElementById('c-canvas');
  if (connect && !state.canvas) connect.onclick = ctx.canvasConfigured ? () => importReal(ctx, refresh) : () => { state.tokenForm = !state.tokenForm; redraw(); };
  const go = document.getElementById('canvas-token-go');
  if (go) go.onclick = () => {
    const token = document.getElementById('canvas-token').value.trim();
    if (!token) { toast('Paste your token first'); return; }
    importReal(ctx, refresh, token);
  };
  const demo = document.getElementById('c-demo');
  if (demo) demo.onclick = async () => {
    try {
      const items = await getCanvasAssignments();
      state.canvas = true;
      state.selectedDay = null;
      toast(`Synced ${items.length} assignments from Canvas (demo data)`);
      refresh();
    } catch (err) { toast(err.message); }
  };

  $app.querySelectorAll('[data-view]').forEach((b) => (b.onclick = () => { state.view = b.dataset.view; refresh(); }));
  $app.querySelectorAll('[data-nav]').forEach((b) => (b.onclick = () => {
    const step = (state.view === 'week' ? 7 : 1) * Number(b.dataset.nav);
    state.selectedDay = clampToTerm(addDays(state.selectedDay, step), ctx.term);
    refresh();
  }));
  $app.querySelectorAll('[data-day]').forEach((b) => (b.onclick = () => { state.selectedDay = b.dataset.day; refresh(); }));
  $app.querySelectorAll('[data-done]').forEach((c) => (c.onchange = () => { state.done[c.dataset.done] = c.checked; redraw(); }));

  if (!data) return;
  $app.querySelectorAll('[data-filter]').forEach((b) => (b.onclick = () => { state.filter = b.dataset.filter; redraw(); }));
  bindEvents($app, { refresh, redraw, data });
  bindMissingExams($app, { ctx, refresh, redraw });
}

// Opening an event shows its details and what it would do to the day, before the student decides.
function bindEvents($app, { refresh, redraw, data }) {
  const close = () => { state.openEventId = null; redraw(); };
  $app.querySelectorAll('[data-open]').forEach((b) => {
    const open = () => {
      const event = data.campusEvents.find((e) => e.id === b.dataset.open);
      if (!event) return; // a class or personal event: nothing to join
      state.openEventId = event.id;
      state.selectedDay = event.start.dateTime.slice(0, 10);
      refresh();
    };
    b.onclick = open;
    b.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } };
  });
  $app.querySelectorAll('[data-close]').forEach((b) => (b.onclick = close));
  document.onkeydown = (e) => { if (e.key === 'Escape' && state.openEventId) close(); };
  $app.querySelectorAll('.modal [data-reg]').forEach((b) => (b.onclick = async () => {
    const event = data.campusEvents.find((e) => e.id === b.dataset.reg);
    const registering = !event.registered;
    b.disabled = true;
    try {
      await setRegistration(state.studentId, event.id, registering);
      toast(registering ? `Registered for ${event.summary}` : `Unregistered from ${event.summary}`);
      refresh();
    } catch (err) {
      b.disabled = false;
      toast(err.message);
    }
  }));
}

// Real Canvas data replaces the student's demo courses. Exam dates found in course syllabi are offered, pre-filled,
// for the student to confirm; nothing is shared with the class until they do.
async function importReal(ctx, refresh, token) {
  const studentId = state.studentId;
  try {
    const r = await importCanvas(studentId, token);
    await ctx.reload();
    state.imported[studentId] = true;
    state.canvas = true;
    state.tokenForm = false;
    state.selectedDay = null;
    for (const sug of r.suggestions) state.pending[sug.courseId] = { file: 'Canvas syllabus', type: sug.type, date: sug.date, time: sug.time, quote: sug.quote };
    toast(`Imported ${r.assignments} assignments and ${r.events} events from ${r.courses} Canvas courses`);
    refresh();
  } catch (err) {
    toast(err.message);
  }
}

// Exam dates Canvas is missing: read the syllabus, let the student confirm, then share it with the class.
function bindMissingExams($app, { ctx, refresh, redraw }) {
  $app.querySelectorAll('[data-up]').forEach((inp) => (inp.onchange = async () => {
    const file = inp.files[0];
    if (!file) return;
    try {
      const found = await parseSyllabus(await readText(file));
      state.pending[Number(inp.dataset.up)] = { file: file.name, ...(found || {}) };
      redraw();
    } catch {
      toast('Could not read that file');
    }
  }));
  $app.querySelectorAll('[data-manual]').forEach((b) => (b.onclick = () => { state.pending[Number(b.dataset.manual)] = {}; redraw(); }));
  $app.querySelectorAll('[data-f]').forEach((el) => (el.onchange = () => { state.pending[Number(el.dataset.c)][el.dataset.f] = el.value; }));
  $app.querySelectorAll('[data-confirm]').forEach((b) => (b.onclick = async () => {
    const courseId = Number(b.dataset.confirm);
    const p = state.pending[courseId];
    if (!p.date) { toast('Pick a date first'); return; }
    try {
      const { sharedWith } = await addExam(courseId, { studentId: state.studentId, type: p.type || 'final', date: p.date, time: p.time || '09:00' });
      delete state.pending[courseId];
      state.selectedDay = null;
      toast(`Exam added for all ${sharedWith} students in ${ctx.course(courseId).course_code}`);
      refresh();
    } catch (err) {
      toast(err.message);
    }
  }));
}
