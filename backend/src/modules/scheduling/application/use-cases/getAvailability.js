import { addDays, isDayKey, monthKeys } from '../../../../shared/dateKeys.js';
import { ValidationError } from '../../../../shared/errors.js';
import { assertDayInTerm } from '../../../../shared/term.js';
import { allAssignments, allEvents } from '../../../academics/application/sources.js';
import { classBlocks, eventBlocks, examBlocks } from '../../../workload/domain/services/calendarItems.js';
import { dailyLoad } from '../../../workload/domain/services/workloadCalculator.js';
import { campusIntensity } from '../../domain/services/campusIntensity.js';
import { freeChance, SLOTS, slotSummary } from '../../domain/services/availability.js';
import { resolveAudience } from './audience.js';

const MAX_DAYS = 31;

// When is the audience free? For each day in the range and each 2-hour slot: the share of the audience that is
// available and how many are expected to turn up. Aggregates only: no student, course or deadline is returned.
export function getAvailability(deps, { audience, from, to } = {}) {
  const { term, academics } = deps;
  const lastDay = addDays(term.start, term.days - 1);
  from = from ?? term.start;
  // Two weeks from the start, unless the term ends first.
  to = to ?? (isDayKey(from) && addDays(from, 13) < lastDay ? addDays(from, 13) : lastDay);
  if (!isDayKey(from) || !isDayKey(to)) throw new ValidationError('from and to must be YYYY-MM-DD days');
  assertDayInTerm(from, term);
  assertDayInTerm(to, term);
  if (to < from) throw new ValidationError('to must not be before from');
  const dates = monthKeys(from, Math.round((new Date(to) - new Date(from)) / 864e5) + 1);
  if (dates.length > MAX_DAYS) throw new ValidationError(`Pick at most ${MAX_DAYS} days`);

  const students = resolveAudience(deps, audience);
  const assignments = allAssignments(deps);
  const events = allEvents(deps);
  const courses = academics.courses();
  const loads = students.map((s) => dailyLoad(s, assignments, events, term.start, term.days));
  const heat = campusIntensity(students, assignments, events, term.start, term.days);

  const days = dates.map((date) => {
    const afterFinals = date > term.end;
    const perStudent = students.map((s, i) => {
      const blocks = [...classBlocks(s, courses, date, term.end), ...eventBlocks(s, events, date), ...examBlocks(s, assignments, date)];
      return SLOTS.map((_, slotIndex) => freeChance({ slotIndex, date, blocks, loadHours: loads[i][date] ?? 0, afterFinals }));
    });
    return { date, stress: heat[date], afterFinals, slots: SLOTS.map((_, slotIndex) => slotSummary(perStudent, slotIndex, date)) };
  });

  const flat = days.flatMap((d) => d.slots.map((s) => ({ date: d.date, ...s })));
  const ranked = flat.slice().sort((a, b) => b.turnout - a.turnout || b.availability - a.availability || a.date.localeCompare(b.date));
  const average = flat.length ? Math.round(flat.reduce((a, s) => a + s.availability, 0) / flat.length) : 0;
  return { studentCount: students.length, from, to, days, average, slotCount: flat.length, best: ranked[0] ?? null, top: ranked.slice(0, 10) };
}
