import { MOCK } from './seed.js';

// Source data shaped like the Canvas REST API, Google Calendar API and a campus events feed.
// A student can replace their demo courses and deadlines with their real Canvas data (importCanvas).
// Imports sit beside the seed data and never change it. Held in memory.
export function createInMemoryAcademicsRepository(data = MOCK) {
  const imports = new Map(); // studentId -> { courses, assignments }

  const merged = (base, key) => {
    const byId = new Map(base.map((x) => [x.id, x]));
    for (const imp of imports.values()) for (const x of imp[key]) byId.set(x.id, x);
    return [...byId.values()];
  };
  // An imported student takes their real courses, and their Canvas calendar events join their own events.
  const students = () => data.students.map((s) => {
    const imp = imports.get(s.id);
    return imp ? { ...s, course_ids: imp.courses.map((c) => c.id), event_ids: s.event_ids.concat(imp.events.map((e) => e.id)) } : s;
  });
  const courses = () => merged(data.canvasCourses, 'courses');

  return {
    students,
    student: (id) => students().find((s) => s.id === id) ?? null,
    courses,
    course: (id) => courses().find((c) => c.id === id) ?? null,
    assignments: () => merged(data.canvasAssignments, 'assignments'),
    calendarEvents: () => data.gcalEvents.items,
    // Classes and events imported from Canvas. Empty until a student connects.
    canvasEvents: () => merged([], 'events'),
    campusEvents: () => data.campusEvents,
    importCanvas: (studentId, imported) => { imports.set(studentId, { events: [], ...imported }); },
    clearCanvasImport: (studentId) => { imports.delete(studentId); },
    hasCanvasImport: (studentId) => imports.has(studentId),
  };
}
