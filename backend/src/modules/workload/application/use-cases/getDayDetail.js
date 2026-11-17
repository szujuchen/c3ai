import { assertDayInTerm } from '../../../../shared/term.js';
import { dayTip } from '../../domain/services/advice.js';
import { stressByDay } from '../../domain/services/stress.js';
import { dailyLoad, dailyLoadBreakdown, dayItems, level } from '../../domain/services/workloadCalculator.js';
import { studentContext } from './studentContext.js';

export function getDayDetail(deps, studentId, date, sources) {
  const { term } = deps;
  assertDayInTerm(date, term);
  const { student, assignments, events } = studentContext(deps, studentId, sources);
  const load = dailyLoad(student, assignments, events, term.start, term.days);
  const it = dayItems(student, assignments, events, date);
  const parts = dailyLoadBreakdown(student, assignments, events, term.start, term.days)[date];
  return {
    date,
    hours: load[date],
    workHours: parts.work,
    eventHours: parts.events,
    stress: stressByDay(load, student, assignments).byDay[date],
    level: level(load[date], student.daily_cap_h),
    due: it.due,
    work: it.work,
    events: it.events,
    tip: dayTip(student, assignments, events, load, date, term.start),
  };
}
