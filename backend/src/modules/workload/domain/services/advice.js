import { addDays } from '../../../../shared/dateKeys.js';
import { dayItems, level } from './workloadCalculator.js';

const MAX_BREAK_SUGGESTIONS = 2;

// What to do about a burnout stretch. Returns data, never display text:
// the assignment driving the crunch, optional recruiting events inside it, relax events near it.
export function burnoutAdvice(student, assignments, events, allEvents, alert) {
  const inRun = new Set(alert.days);
  const drivers = {};
  alert.days.forEach((k) => dayItems(student, assignments, events, k).work.forEach((w) => {
    drivers[w.assignment.id] = (drivers[w.assignment.id] || 0) + w.hours;
  }));
  const biggest = assignments.find((a) => a.id === Number(Object.keys(drivers).sort((a, b) => drivers[b] - drivers[a])[0]));
  const optionalEvents = events.filter((e) => student.event_ids.includes(e.id) && e.host_type === 'recruiting' && inRun.has(e.start.dateTime.slice(0, 10)));
  const relaxEvents = allEvents.filter((e) => e.host_type === 'relax'
    && e.start.dateTime.slice(0, 10) >= addDays(alert.start, -3)
    && e.start.dateTime.slice(0, 10) <= alert.end)
    .slice(0, MAX_BREAK_SUGGESTIONS);
  return {
    startAssignment: biggest ? { assignment: biggest, hours: drivers[biggest.id] } : null,
    optionalEvents,
    relaxEvents,
  };
}

// A suggestion for one day: move prep to an earlier lighter day, admit there is no room, or call out a light day.
// `load` covers the whole term so lighter days can be searched backwards without leaving it.
export function dayTip(student, assignments, events, load, day, termStart) {
  const it = dayItems(student, assignments, events, day);
  const lv = level(load[day], student.daily_cap_h);
  if (lv === 2 && it.work.length) {
    const smallest = it.work.slice().sort((a, b) => a.hours - b.hours)[0];
    for (let i = 1; i <= 7; i++) {
      const d = addDays(day, -i);
      if (d < termStart) break;
      if (load[d] + smallest.hours < student.daily_cap_h * 0.8) {
        return { type: 'move', assignment: smallest.assignment, hours: smallest.hours, date: d };
      }
    }
    return { type: 'no-room' };
  }
  if (lv === 0) return { type: 'light' };
  return null;
}
