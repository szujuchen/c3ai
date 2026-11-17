import { esc } from '../../../shared/utils/html.js';
import { fmt, time } from '../../../shared/utils/dates.js';

export function renderMissingExams({ missingCourseIds, added }, { pending, course }) {
  if (!missingCourseIds.length && !added.length) return '';
  const rows = missingCourseIds.map((cid) => {
    const c = course(cid);
    const p = pending[cid];
    const form = p ? `
        <div class="exam-form">
          <p class="sub">${p.quote ? `Found in <b>${esc(p.file)}</b>: “${esc(p.quote)}”` : p.file ? `Couldn't find an exam date in <b>${esc(p.file)}</b>. Enter it below.` : 'Enter the exam date from your syllabus.'}</p>
          <div class="row" style="margin-top:8px">
            <select data-f="type" data-c="${cid}"><option value="final" ${p.type !== 'midterm' ? 'selected' : ''}>Final exam</option><option value="midterm" ${p.type === 'midterm' ? 'selected' : ''}>Midterm</option></select>
            <input type="date" data-f="date" data-c="${cid}" value="${p.date || ''}" />
            <input type="time" data-f="time" data-c="${cid}" value="${p.time || '09:00'}" />
            <button class="btn primary" data-confirm="${cid}">Add for the class</button>
          </div>
        </div>` : '';
    return `<li class="miss"><div class="row spread" style="width:100%">
          <span><b>${esc(c.course_code)}</b> ${esc(c.name)} <span class="meta">· no exam date in Canvas</span></span>
          <span class="row"><label class="btn">Upload syllabus<input type="file" accept=".txt,.pdf,.md,.html" data-up="${cid}" hidden /></label>
          <button class="btn" data-manual="${cid}">Enter date</button></span>
        </div>${form}</li>`;
  }).join('');
  const done = added.map((a) => `<li><span>✓ <b>${esc(course(a.course_id).course_code)}</b> ${esc(a.name)}, ${fmt(a.due_at.slice(0, 10))} ${time(a.due_at)}</span>
      <span class="meta">from syllabus · ${esc(a.added_by)} · shared with all ${a.sharedWith} students in the course</span></li>`).join('');
  return `<div class="card" style="margin-top:20px">
      <h2>${missingCourseIds.length ? 'Exam dates missing from Canvas' : 'Exam dates added from syllabi'}</h2>
      <p class="sub">Canvas confirms you're enrolled, so an exam date you add is shared with everyone in that course and counts toward campus intensity.</p>
      <ul class="list" style="margin-top:8px">${rows}${done}</ul></div>`;
}
