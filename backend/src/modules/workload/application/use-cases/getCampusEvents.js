import { campusFeed } from '../../../academics/application/sources.js';
import { burnoutAlert } from '../../domain/services/burnoutDetector.js';
import { campusEventNotes } from '../../domain/services/campusEventNotes.js';
import { dailyLoad } from '../../domain/services/workloadCalculator.js';
import { studentContext } from './studentContext.js';

// Upcoming campus events, each with how it fits this student's workload and whether they registered.
export function getCampusEvents(deps, studentId, sources) {
  const { term } = deps;
  const { student, assignments, events } = studentContext(deps, studentId, sources);
  const load = dailyLoad(student, assignments, events, term.start, term.days);
  const alert = burnoutAlert(load, student.daily_cap_h);
  return { events: campusEventNotes(student, campusFeed(deps), load, alert) };
}
