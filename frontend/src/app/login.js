import { esc } from '../shared/utils/html.js';
import { getLoginStudents, login } from '../shared/api/authApi.js';
import { setSession } from '../shared/session.js';

const ROLES = [
  { role: 'student', title: 'Student', text: 'Your own calendar, workload and stress level, and campus events you can preview and join.' },
  { role: 'host', title: 'Recruiter / Host', text: 'Campus-wide stress heat and the best dates. Try mock events: nothing is added to the real calendar.' },
  { role: 'admin', title: 'Admin', text: 'Everything: every student, and the heat split into coursework and events.' },
];

// The login screen. Demo login: pick who you are. A role the server protects with a password asks for it.
export async function renderLogin($app, onLoggedIn) {
  let students = [];
  try { students = await getLoginStudents(); } catch {
    $app.innerHTML = `<div class="card connect" style="margin-top:20px"><h2>Can't reach the server</h2>
      <p class="sub">Start the backend with <code>npm run dev</code> and reload this page.</p></div>`;
    return;
  }
  $app.innerHTML = `
    <div class="login">
      <h2>Log in</h2>
      <p class="sub">Demo login: choose who you are. Your role decides what the server lets you see.</p>
      <div class="login-grid">
        ${ROLES.map((r) => `<div class="card role-card">
          <h3>${r.title}</h3><p class="sub">${r.text}</p>
          ${r.role === 'student' ? `<select id="login-student">${students.map((s) => `<option value="${s.id}">${esc(s.name)} · ${esc(s.major)}, year ${s.year}</option>`).join('')}</select>` : ''}
          <button class="btn primary" data-login="${r.role}">Log in as ${r.title.toLowerCase()}</button></div>`).join('')}
      </div>
      <div class="row" style="margin-top:14px"><input type="password" id="login-password" autocomplete="off" placeholder="Password (only if the server asks for one)" />
        <span class="status" id="login-error" role="alert"></span></div>
    </div>`;
  $app.querySelectorAll('[data-login]').forEach((b) => (b.onclick = async () => {
    const role = b.dataset.login;
    const err = document.getElementById('login-error');
    err.textContent = '';
    try {
      const session = await login({ role, studentId: role === 'student' ? document.getElementById('login-student').value : undefined, password: document.getElementById('login-password').value || undefined });
      setSession(session);
      onLoggedIn(session);
    } catch (e) {
      err.textContent = e.message;
    }
  }));
}
