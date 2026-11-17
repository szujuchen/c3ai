import { addDays, isDayKey } from '../../../../shared/dateKeys.js';
import { ValidationError } from '../../../../shared/errors.js';
import { assertDayInTerm } from '../../../../shared/term.js';
import { leadDaysFor } from '../../domain/value-objects/leadDays.js';
import { classBlocks, deadlineItems, eventBlocks, examBlocks, placeStudyBlocks, startMarkers } from '../../domain/services/calendarItems.js';
import { dailyLoad, dayItems, level } from '../../domain/services/workloadCalculator.js';
import { studentContext } from './studentContext.js';

// A run of days (a week, or a single day) laid out on the hours: classes, events, study blocks, deadlines and
// "start studying" markers. Days outside the term come back empty.
export function getStudentWeek(deps, studentId, { start, days = 7 } = {}, sources) {
  const { term, academics } = deps;
  if (!isDayKey(start)) throw new ValidationError('start must be a valid YYYY-MM-DD day');
  if (![1, 7].includes(Number(days))) throw new ValidationError('days must be 1 or 7');
  const { student, assignments, events } = studentContext(deps, studentId, sources);
  const load = dailyLoad(student, assignments, events, term.start, term.days);
  const courses = academics.courses();
  const inTerm = (d) => { try { assertDayInTerm(d, term); return true; } catch { return false; } };

  const out = Array.from({ length: Number(days) }, (_, i) => addDays(start, i)).map((date) => {
    if (!inTerm(date)) return { date, inTerm: false, afterFinals: date > term.end, hours: 0, level: 0, items: [], unplacedHours: 0 };
    const classes = classBlocks(student, courses, date, term.end);
    const evs = eventBlocks(student, events, date);
    const it = dayItems(student, assignments, events, date);
    const { blocks, unplacedMin } = placeStudyBlocks(it.work, [...classes, ...evs.filter((e) => !e.relax), ...examBlocks(student, assignments, date)]);
    const items = [...classes, ...evs, ...blocks, ...deadlineItems(student, assignments, date), ...startMarkers(student, assignments, date, leadDaysFor, blocks)];
    return { date, inTerm: true, afterFinals: date > term.end, hours: load[date], level: level(load[date], student.daily_cap_h), items, unplacedHours: Math.round((unplacedMin / 60) * 10) / 10 };
  });
  return { student: { id: student.id, daily_cap_h: student.daily_cap_h }, days: out };
}
