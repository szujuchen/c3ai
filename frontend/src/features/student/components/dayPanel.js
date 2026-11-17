import { esc } from '../../../shared/utils/html.js';
import { fmt, time } from '../../../shared/utils/dates.js';

function renderTip(tip, course) {
  if (!tip) return '';
  if (tip.type === 'move') {
    return `<div class="tip">Over your cap. Move <b>${esc(course(tip.assignment.course_id).course_code)} ${esc(tip.assignment.name)}</b> prep (${tip.hours} h) to ${fmt(tip.date)}, which has room.</div>`;
  }
  if (tip.type === 'no-room') {
    return `<div class="tip">Over your cap with no lighter day nearby. Ask for an extension or drop an optional event.</div>`;
  }
  return `<div class="tip good">Light day. A good time to get ahead on the next deadline.</div>`;
}

export function renderDayPanel(day, student, { done, course }) {
  const k = day.date;
  const due = day.due.map((a) => `<li><span>${esc(course(a.course_id).course_code)} ${esc(a.name)}${a.source === 'syllabus' ? ' <span class="meta">(syllabus)</span>' : ''}</span><span class="meta">${time(a.due_at)}</span></li>`).join('');
  const work = day.work
    .slice()
    .sort((a, b) => b.hours - a.hours)
    .map((w) => {
      const id = `${k}-${w.assignment.id}`;
      return `<li><label><input type="checkbox" class="chk" data-done="${id}" ${done[id] ? 'checked' : ''}/>
          <span style="${done[id] ? 'text-decoration:line-through;color:#999' : ''}">${esc(course(w.assignment.course_id).course_code)} ${esc(w.assignment.name)}</span></label>
          <span class="meta">${w.hours} h</span></li>`;
    })
    .join('');
  const evs = day.events.map((e) => `<li><span>${esc(e.summary)}</span><span class="meta">${time(e.start.dateTime)}</span></li>`).join('');

  return `<div class="card panel">
      <h2>${fmt(k)}</h2>
      <p class="sub">About ${day.hours} h of work · cap ${student.daily_cap_h} h · stress ${day.stress.score} (${day.stress.level})</p>
      <h3>Due (Canvas)</h3>${due ? `<ul class="list">${due}</ul>` : '<p class="sub">Nothing due.</p>'}
      <h3>Study plan</h3>${work ? `<ul class="list">${work}</ul>` : '<p class="sub">No study blocks planned.</p>'}
      <h3>Events</h3>${evs ? `<ul class="list">${evs}</ul>` : '<p class="sub">No events.</p>'}
      ${renderTip(day.tip, course)}
    </div>`;
}
