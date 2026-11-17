// What counts as "everything" for scoring: Canvas assignments plus exams added from syllabi, and
// Google Calendar events plus classes imported from Canvas plus campus events.
export const allAssignments = ({ academics, syllabusExams }) => academics.assignments().concat(syllabusExams.list());

export const allEvents = ({ academics }) => academics.calendarEvents().concat(academics.canvasEvents(), academics.campusEvents());

// Events a student can register for.
export const campusFeed = ({ academics }) => academics.campusEvents();

// A student plus the campus events they registered for. Registered events count toward their load.
export const withRegistrations = ({ registrations }, student) => ({ ...student, event_ids: student.event_ids.concat(registrations.forStudent(student.id)) });
