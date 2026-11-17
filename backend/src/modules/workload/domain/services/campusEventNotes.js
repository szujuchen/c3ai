import { addDays } from '../../../../shared/dateKeys.js';
import { eventHours, level } from './workloadCalculator.js';

// How an event fits a student's workload. Returns data; the UI words it.
//  - recommended-break: a relax event during or just before a crunch, or on an over-cap day
//  - heavy-day: any other event on a day already over their cap
//  - over-cap: registering would push that day to their cap
export function eventNote(student, event, load, alert) {
  const day = event.start.dateTime.slice(0, 10);
  const registered = student.event_ids.includes(event.id);
  const lv = level(load[day] || 0, student.daily_cap_h);
  const relax = event.host_type === 'relax';
  const inCrunch = alert && day >= addDays(alert.start, -2) && day <= alert.end;
  if (relax && (inCrunch || lv === 2)) return { type: 'recommended-break' };
  if (!relax && lv === 2) return { type: 'heavy-day', hours: load[day] };
  if (!relax && !registered && (load[day] || 0) + eventHours(event) >= student.daily_cap_h) return { type: 'over-cap' };
  return null;
}

export function campusEventNotes(student, feed, load, alert) {
  return feed
    .slice()
    .sort((a, b) => a.start.dateTime.localeCompare(b.start.dateTime))
    .map((event) => ({
      ...event,
      hours: eventHours(event),
      registered: student.event_ids.includes(event.id),
      note: eventNote(student, event, load, alert),
    }));
}
