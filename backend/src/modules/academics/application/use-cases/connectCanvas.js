import { NotFoundError, UnauthorizedError, ValidationError } from '../../../../shared/errors.js';
import { lastDayOf } from '../../../../shared/term.js';
import { mapAssignments, mapCalendarEvents, mapCourses, suggestExams } from '../../domain/canvasMapping.js';

// Replace a student's courses, deadlines and classes with their real Canvas data for the term.
// The token comes from the request, or else from the server's own configuration (backend/.env); it is never kept. Exam dates found in course syllabi come back as suggestions: the student
// still confirms them, because a confirmed exam date is shared with the whole course.
export async function connectCanvas({ academics, canvas, canvasToken, term }, studentId, { token = canvasToken } = {}) {
  if (!academics.student(studentId)) throw new NotFoundError(`Student "${studentId}" not found`);
  if (typeof token !== 'string' || !token.trim()) throw new ValidationError('A Canvas access token is required');
  if (!canvas) throw new ValidationError('Canvas is not configured on this server');

  const accessToken = token.trim();
  const rawCourses = await canvas.courses(accessToken);
  const courses = mapCourses(rawCourses, term);
  if (!courses.length) throw new ValidationError('Canvas returned no active courses for that token');

  // A course can refuse access to its assignments (restricted or concluded); skip that course, keep the rest.
  const perCourse = await Promise.all(courses.map(async (c) => {
    try { return mapAssignments(await canvas.assignments(accessToken, c.id), c.id, term); }
    catch (err) { if (err instanceof UnauthorizedError) return []; throw err; }
  }));
  const assignments = perCourse.flat();
  const events = mapCalendarEvents(await canvas.calendarEvents(accessToken, courses.map((c) => c.id), { start: term.start, end: lastDayOf(term) }), term);

  academics.importCanvas(studentId, { courses, assignments, events });
  return { courses: courses.length, assignments: assignments.length, events: events.length, suggestions: suggestExams(rawCourses, courses, assignments) };
}

// Whether the server has its own Canvas token, so the app can offer a one-click import. Never reveals the token.
export const canvasStatus = ({ canvas, canvasToken }) => ({ configured: Boolean(canvas && canvasToken) });

// Go back to the demo data for a student.
export function disconnectCanvas({ academics }, studentId) {
  if (!academics.student(studentId)) throw new NotFoundError(`Student "${studentId}" not found`);
  academics.clearCanvasImport(studentId);
  return { connected: false };
}
