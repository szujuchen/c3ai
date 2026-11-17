import { addDays } from '../../../../shared/dateKeys.js';

// The fit of one day for an event type, before any rounding. Recruiting wants a quiet stretch, relax wants the
// day just before a crunch, general wants a moderate day. Each similar event already that day costs 15 points.
export function scoreDay(intensity, type, day, events) {
  const nextMax = Math.max(...[addDays(day, 1), addDays(day, 2)].map((x) => intensity[x] || 0));
  const clashes = events.filter((e) => e.start.dateTime.slice(0, 10) === day && e.host_type === type).length;
  const I = intensity[day];
  const base = type === 'relax' ? nextMax - Math.abs(I - 60) : type === 'general' ? 100 - Math.abs(I - 40) : 100 - I - 0.5 * nextMax;
  return { I, nextMax, clashes, score: base - 15 * clashes };
}

export const isWeekday = (day) => { const d = new Date(day + 'T00:00:00Z').getUTCDay(); return d >= 1 && d <= 5; };

// Top N weekday slots for an event type inside a window.
export function bestDates(intensity, type, opts) {
  const { n = 3, from, to, hosted = [] } = opts || {};
  return Object.keys(intensity)
    .filter((k) => isWeekday(k) && (!from || k >= from) && (!to || k <= to))
    .map((k) => {
      const { I, nextMax, clashes, score } = scoreDay(intensity, type, k, hosted);
      const reason = type === 'relax' ? `Crunch peaks right after (${nextMax}). Students need a break now.`
        : type === 'general' ? `Moderate load (${I}), people are free but not checked out.`
        : `Low load (${I}) and no crunch in the next 2 days.`;
      return { date: k, score: Math.max(0, Math.round(score)), intensity: I, reason: reason + (clashes ? ` ${clashes} similar event${clashes > 1 ? 's' : ''} already that day.` : '') };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
}
