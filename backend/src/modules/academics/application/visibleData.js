// The source data a session may see. A student sees only their own courses, assignments and calendar events.
export function visibleData({ academics }, session) {
  if (session.role === 'admin') {
    return { students: academics.students(), courses: academics.courses(), assignments: academics.assignments(), calendarEvents: academics.calendarEvents() };
  }
  const me = academics.student(session.studentId);
  const courseIds = new Set(me.course_ids);
  const eventIds = new Set(me.event_ids);
  return {
    students: [me],
    courses: academics.courses().filter((c) => courseIds.has(c.id)),
    assignments: academics.assignments().filter((a) => courseIds.has(a.course_id)),
    calendarEvents: academics.calendarEvents().filter((e) => eventIds.has(e.id)),
  };
}
