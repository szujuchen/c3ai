import { addDays, monthKeys, round1 } from '../../../../shared/dateKeys.js';
import { leadDaysFor } from '../value-objects/leadDays.js';

export const eventHours = (e) => (new Date(e.end.dateTime) - new Date(e.start.dateTime)) / 36e5;

// Everything that adds hours to one day for one student.
export function dayItems(student, assignments, events, day) {
  const work = [];
  assignments
    .filter((a) => student.course_ids.includes(a.course_id))
    .forEach((a) => {
      const lead = leadDaysFor(a.type);
      const due = a.due_at.slice(0, 10);
      for (let i = 1; i <= lead; i++) {
        if (addDays(due, -i) === day) work.push({ assignment: a, hours: round1(a.effort_h / lead) });
      }
    });
  const evs = events.filter((e) => student.event_ids.includes(e.id) && e.start.dateTime.slice(0, 10) === day);
  const due = assignments.filter((a) => student.course_ids.includes(a.course_id) && a.due_at.slice(0, 10) === day);
  return { work, events: evs, due };
}

// Daily load in hours: assignment effort spread over its lead window + event hours.
// Relax events are breaks, so they add no workload.
export function dailyLoad(student, assignments, events, from, days) {
  const load = {};
  monthKeys(from, days).forEach((k) => {
    const it = dayItems(student, assignments, events, k);
    load[k] = round1(it.work.reduce((s, w) => s + w.hours, 0) + it.events.filter((e) => e.host_type !== 'relax').reduce((s, e) => s + eventHours(e), 0));
  });
  return load;
}

// The same load split in two: hours of coursework, and hours of events (relax events are breaks and add none).
// Admins see these as two colors.
export function dailyLoadBreakdown(student, assignments, events, from, days) {
  const out = {};
  monthKeys(from, days).forEach((k) => {
    const it = dayItems(student, assignments, events, k);
    out[k] = {
      work: round1(it.work.reduce((s, w) => s + w.hours, 0)),
      events: round1(it.events.filter((e) => e.host_type !== 'relax').reduce((s, e) => s + eventHours(e), 0)),
    };
  });
  return out;
}

// 0 = green, 1 = yellow, 2 = red.
export const level = (hours, cap) => (hours >= cap ? 2 : hours > cap * 0.6 ? 1 : 0);
