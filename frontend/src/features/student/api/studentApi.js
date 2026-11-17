import { request } from '../../../shared/api/client.js';

export const getWorkload = (studentId, sources) => request(`/students/${studentId}/workload`, { query: sources });
// A week (days=7) or a single day (days=1) laid out on the hours.
export const getWeek = (studentId, start, days, sources) => request(`/students/${studentId}/week`, { query: { ...sources, start, days } });
export const getDayDetail = (studentId, date, sources) => request(`/students/${studentId}/days/${date}`, { query: sources });
export const getCampusEvents = (studentId, sources) => request(`/students/${studentId}/campus-events`, { query: sources }).then((r) => r.events);
// What the day would look like with this event added: without registering.
export const previewEvent = (studentId, eventId, sources) => request(`/students/${studentId}/campus-events/${eventId}/preview`, { query: sources });
export const setRegistration = (studentId, eventId, registered) => request(`/students/${studentId}/registrations/${eventId}`, { method: registered ? 'PUT' : 'DELETE' });

// Exam dates Canvas is missing, and the ones students added from syllabi.
export const getExamStatus = (studentId, canvas) => request(`/students/${studentId}/exams`, { query: { canvas } });
export const parseSyllabus = (text) => request('/syllabus/parse', { method: 'POST', body: { text } }).then((r) => r.exam);
export const addExam = (courseId, exam) => request(`/courses/${courseId}/exams`, { method: 'POST', body: exam });

// Import the student's real courses, deadlines and classes from Canvas. Without a token the server uses its own.
export const importCanvas = (studentId, token) => request(`/students/${studentId}/canvas/connect`, { method: 'POST', body: token ? { token } : {} });
