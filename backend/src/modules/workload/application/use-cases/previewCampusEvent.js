import { NotFoundError } from '../../../../shared/errors.js';
import { campusFeed } from '../../../academics/application/sources.js';
import { stressByDay } from '../../domain/services/stress.js';
import { dailyLoad, level } from '../../domain/services/workloadCalculator.js';
import { studentContext } from './studentContext.js';

// "What would this do to my day?" The student's day without the event and with it, without registering.
// `counted` is false when the event would not count toward their load, e.g. Google Calendar is not connected.
export function previewCampusEvent(deps, studentId, eventId, sources) {
  const { term } = deps;
  const event = campusFeed(deps).find((e) => e.id === eventId);
  if (!event) throw new NotFoundError(`Event "${eventId}" not found`);
  const { student, assignments, events } = studentContext(deps, studentId, sources);
  const date = event.start.dateTime.slice(0, 10);
  const withEvent = { ...student, event_ids: [...new Set(student.event_ids.concat(eventId))] };
  const without = { ...student, event_ids: student.event_ids.filter((id) => id !== eventId) };

  const before = dailyLoad(without, assignments, events, term.start, term.days);
  const after = dailyLoad(withEvent, assignments, events, term.start, term.days);
  const cap = student.daily_cap_h;
  return {
    event,
    date,
    registered: student.event_ids.includes(eventId),
    counted: events.some((e) => e.id === eventId),
    cap,
    hoursBefore: before[date],
    hoursAfter: after[date],
    addedHours: Math.round((after[date] - before[date]) * 10) / 10,
    levelBefore: level(before[date], cap),
    levelAfter: level(after[date], cap),
    stressBefore: stressByDay(before, without, assignments).byDay[date],
    stressAfter: stressByDay(after, withEvent, assignments).byDay[date],
  };
}
