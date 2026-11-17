import { burnoutAdvice } from '../../domain/services/advice.js';
import { burnoutAlert } from '../../domain/services/burnoutDetector.js';
import { stressByDay } from '../../domain/services/stress.js';
import { dailyLoad, dailyLoadBreakdown, dayItems, level } from '../../domain/services/workloadCalculator.js';
import { studentContext } from './studentContext.js';

export function getStudentWorkload(deps, studentId, sources) {
  const { term } = deps;
  const { student, assignments, events, allEvents } = studentContext(deps, studentId, sources);
  const load = dailyLoad(student, assignments, events, term.start, term.days);
  const parts = dailyLoadBreakdown(student, assignments, events, term.start, term.days);
  const alert = burnoutAlert(load, student.daily_cap_h);
  const stress = stressByDay(load, student, assignments);

  const days = {};
  for (const k of Object.keys(load)) {
    const it = dayItems(student, assignments, events, k);
    days[k] = { hours: load[k], level: level(load[k], student.daily_cap_h), dueCount: it.due.length, eventCount: it.events.length, workHours: parts[k].work, eventHours: parts[k].events, stress: stress.byDay[k],
      // The day's items, so week and day views need no further requests.
      due: it.due, work: it.work, events: it.events };
  }

  return {
    student,
    load,
    days,
    alert,
    stress: stress.peak,
    advice: alert ? burnoutAdvice(student, assignments, events, allEvents, alert) : null,
  };
}
