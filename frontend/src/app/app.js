import { logout } from '../shared/api/authApi.js';
import { getAudiences, getCanvasStatus, getCourses, getStudents, getTerm } from '../shared/api/catalogApi.js';
import { setUnauthorizedHandler } from '../shared/api/client.js';
import { clearSession, getSession } from '../shared/session.js';
import { esc } from '../shared/utils/html.js';
import * as host from '../features/host/HostView.js';
import * as student from '../features/student/StudentView.js';
import { studentState } from '../features/student/state.js';
import { renderLogin } from './login.js';

const views = { student, host };

// Login, tabs and rendering. Each view loads its data from the API, then draws it. What a person can open depends on
// their role (an admin can open everything); the server enforces it as well.
export async function startApp() {
  const $app = document.getElementById('app');
  const $tabs = document.querySelector('.tabs');
  const $user = document.getElementById('user');
  const state = { view: null };
  let ctx;
  let latest = 0;

  const showError = () => {
    $app.innerHTML = `<div class="card connect" style="margin-top:20px">
        <h2>Can't reach the server</h2>
        <p class="sub">Start the backend with <code>npm run dev</code> and reload this page.</p></div>`;
  };

  function showLogin() {
    latest++;
    ctx = null;
    $tabs.hidden = true;
    $user.hidden = true;
    renderLogin($app, start);
  }

  async function refresh() {
    const request = ++latest;
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.role === state.view));
    const view = views[state.view];
    try {
      const data = await view.load(ctx);
      if (request !== latest) return; // a newer click already took over
      const redraw = () => view.render($app, data, { ctx, refresh, redraw });
      redraw();
    } catch (err) {
      if (request === latest && err.status !== 401) showError();
    }
  }

  async function start(session) {
    const canStudent = session.views.includes('student');
    const canHost = session.views.includes('host');
    try {
      const [term, students, courses, canvasConfigured, audiences] = await Promise.all([
        getTerm(),
        canStudent ? getStudents() : [],
        canStudent ? getCourses() : [],
        canStudent ? getCanvasStatus() : false,
        canHost ? getAudiences() : null,
      ]);
      ctx = { session, term, students, courses, canvasConfigured, audiences, course: (id) => ctx.courses.find((c) => c.id === id) };
      // After a Canvas import the roster and course list change.
      ctx.reload = async () => { [ctx.students, ctx.courses] = await Promise.all([getStudents(), getCourses()]); };
    } catch (err) {
      if (err.status !== 401) showError();
      return;
    }
    if (session.role === 'student') studentState.studentId = session.studentId;
    else if (!ctx.students.some((s) => s.id === studentState.studentId)) studentState.studentId = ctx.students[0]?.id ?? studentState.studentId;

    state.view = session.views[0];
    $tabs.hidden = session.views.length < 2;
    document.querySelectorAll('.tab').forEach((t) => (t.hidden = !session.views.includes(t.dataset.role)));
    $user.hidden = false;
    $user.innerHTML = `<span class="who">${esc(session.role === 'student' ? ctx.students.find((s) => s.id === session.studentId)?.name ?? 'Student' : session.role === 'host' ? 'Host' : 'Admin')}<small>${session.role}</small></span><button class="btn" id="logout">Log out</button>`;
    document.getElementById('logout').onclick = async () => { await logout(); clearSession(); showLogin(); };
    refresh();
  }

  document.querySelectorAll('.tab').forEach((t) => (t.onclick = () => { state.view = t.dataset.role; refresh(); }));
  setUnauthorizedHandler(() => { clearSession(); showLogin(); });

  const session = getSession();
  if (session) start(session); else showLogin();
}
