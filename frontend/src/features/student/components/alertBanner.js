import { esc } from '../../../shared/utils/html.js';
import { fmt, short, time } from '../../../shared/utils/dates.js';

const dateOf = (e) => e.start.dateTime.slice(0, 10);

// The backend decides what to recommend (`advice`); this only words it.
export function renderAlert({ student, alert, advice }, { canvas, course }) {
  if (!canvas) return '';
  if (!alert) {
    return `<div class="card alert ok" style="margin-top:20px"><span class="pill">On track</span><strong>No burnout risk this month</strong>
        <p class="sub" style="margin-top:6px">No stretch of 3+ days over your ${student.daily_cap_h} h cap.</p></div>`;
  }
  const fixes = [];
  if (advice.startAssignment) {
    const { assignment, hours } = advice.startAssignment;
    fixes.push(`Start <b>${esc(course(assignment.course_id).course_code)} ${esc(assignment.name)}</b> now. It is the biggest driver (${Math.round(hours)} h in this stretch).`);
  }
  advice.optionalEvents.forEach((e) => fixes.push(`Consider skipping <b>${esc(e.summary)}</b> on ${short(dateOf(e))} (optional).`));
  advice.relaxEvents.forEach((e) => fixes.push(`Take a break: <b>${esc(e.summary)}</b>, ${fmt(dateOf(e))} ${time(e.start.dateTime)}.`));
  return `<div class="card alert" style="margin-top:20px">
      <span class="pill">${alert.level} burnout risk</span><strong>${short(alert.start)} – ${short(alert.end)}: ${alert.days.length} days over your ${student.daily_cap_h} h cap</strong>
      <p class="sub" style="margin-top:6px">Peak day needs about ${alert.peak} h of work.</p>
      <ul>${fixes.map((f) => `<li>${f}</li>`).join('')}</ul></div>`;
}
