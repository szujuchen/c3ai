import { NotFoundError } from '../../../../shared/errors.js';
import { allAssignments, allEvents, withRegistrations } from '../../../academics/application/sources.js';

// What the student has connected decides which sources count toward their load.
// `allEvents` (including campus events and events hosts scheduled) is still needed for break suggestions.
export function studentContext(deps, studentId, { canvas, gcal }) {
  const base = deps.academics.student(studentId);
  if (!base) throw new NotFoundError(`Student "${studentId}" not found`);
  const everything = allEvents(deps);
  return {
    student: withRegistrations(deps, base),
    assignments: canvas ? allAssignments(deps) : [],
    // Google Calendar events are behind their own connection and Canvas classes come with Canvas. Campus events count
    // whenever the student registered for them (the student's own event list decides), so they are always included.
    events: [...(gcal ? deps.academics.calendarEvents() : []), ...(canvas ? deps.academics.canvasEvents() : []), ...deps.academics.campusEvents()],
    allEvents: everything,
  };
}
