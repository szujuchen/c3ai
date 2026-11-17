import { esc } from '../../../shared/utils/html.js';

// Only an admin chooses whose view to look at; a student is always themselves.
export function studentPicker(students, studentId, isAdmin) {
  if (!isAdmin) return '';
  return `<select id="student">${students
    .map((s) => `<option value="${s.id}" ${s.id === studentId ? 'selected' : ''}>${esc(s.name)} · ${s.major}, year ${s.year}</option>`)
    .join('')}</select>`;
}

export function connectedButton(imported) {
  return `<button class="btn connected" id="c-canvas" disabled>✓ ${imported ? 'Real Canvas synced' : 'Canvas synced (demo data)'}</button>`;
}

// The paste-a-token form, for when the server has no token of its own. The token is sent once and not kept.
function tokenForm() {
  return `<div class="exam-form" style="margin:16px auto 0;max-width:520px;text-align:left">
          <p class="sub">Paste a Canvas access token (Canvas → Account → Settings → New Access Token). It is sent to the server once to read your courses and deadlines, and is not stored.</p>
          <div class="row" style="margin-top:8px;justify-content:flex-start">
            <input type="password" id="canvas-token" autocomplete="off" placeholder="Canvas access token" style="flex:1" />
            <button class="btn primary" id="canvas-token-go">Import from Canvas</button>
          </div></div>`;
}

export function connectCard({ configured, tokenFormOpen }) {
  return `<div class="card connect" style="margin-top:20px">
          <h2>Connect Canvas</h2>
          <p class="sub">We read your Canvas courses, deadlines and classes, then show you where the crunch is.</p>
          <div class="row"><button class="btn primary" id="c-canvas">Connect Canvas</button></div>
          ${tokenFormOpen && !configured ? tokenForm() : ''}
          <p class="status" style="margin-top:14px">${configured
            ? 'Reads your real Canvas. The access token stays on the server.'
            : 'Click to paste a Canvas access token and read your real Canvas.'}
            <button class="linkbtn" id="c-demo">Use demo data instead</button></p>
        </div>`;
}
