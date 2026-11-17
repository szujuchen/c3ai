import { addDays } from '../../../../shared/dateKeys.js';

// Stress level 0-100 per day, from the design doc:
//   R = 100 * sigmoid( 2.0*avgLoad3d/cap + 0.5*streak + 0.3*deadlines3d + 0.4*(5 - mood) - 3.0 )
// avgLoad3d: average load over this day and the 2 before it, in units of the daily cap.
// streak: consecutive days up to this one with more than the cap of work.
// deadlines3d: items due today or in the next 2 days.
// mood: 1-5, the student's own check-in. There is no check-in yet, so a neutral 3.
export const WEIGHTS = { load: 2.0, streak: 0.5, deadlines: 0.3, mood: 0.4, bias: 3.0 };
export const DEFAULT_MOOD = 3;

// Watch 60+, High 75+, Critical 90+.
export const stressLevel = (score) => (score >= 90 ? 'critical' : score >= 75 ? 'high' : score >= 60 ? 'watch' : 'low');

// How many of the student's items are due on each day.
function courseDueDays(student, assignments) {
  const out = {};
  for (const a of assignments) {
    if (!student.course_ids.includes(a.course_id)) continue;
    const day = a.due_at.slice(0, 10);
    out[day] = (out[day] || 0) + 1;
  }
  return out;
}

export function stressByDay(load, student, assignments, mood = DEFAULT_MOOD) {
  const keys = Object.keys(load);
  const cap = student.daily_cap_h;
  const due = courseDueDays(student, assignments);
  const byDay = {};
  let streak = 0;
  keys.forEach((k, i) => {
    streak = load[k] > cap ? streak + 1 : 0;
    const recent = keys.slice(Math.max(0, i - 2), i + 1).map((d) => load[d]);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const deadlines = [0, 1, 2].reduce((n, off) => n + (due[addDays(k, off)] || 0), 0);
    const x = WEIGHTS.load * (avg / cap) + WEIGHTS.streak * streak + WEIGHTS.deadlines * deadlines + WEIGHTS.mood * (5 - mood) - WEIGHTS.bias;
    const score = Math.round(100 / (1 + Math.exp(-x)));
    byDay[k] = { score, level: stressLevel(score) };
  });
  const peakDay = keys.reduce((best, k) => (byDay[k].score > byDay[best].score ? k : best), keys[0]);
  return { byDay, peak: { date: peakDay, ...byDay[peakDay] } };
}
