import { addDays } from '../../../shared/dateKeys.js';
import { toEasternIso } from '../../../shared/campusTime.js';
import { courseHasExam } from './exams.js';
import { parseExam } from './syllabusParser.js';

// Default effort in hours by assignment type (from the design doc). Students can adjust later.
const EFFORT_H = { homework: 3, quiz: 2, lab: 4, midterm: 8, final: 12, project: 15 };

// Canvas has no "type" for assignments, so guess it from the title.
export function guessType(title, kind) {
  const t = String(title || '');
  if (/\bfinal exam\b/i.test(t) || /^\s*final\b(?!\s+(project|paper|essay|draft|report))/i.test(t)) return 'final';
  if (/\b(midterm|exam)\b/i.test(t)) return 'midterm';
  if (kind === 'quiz' || /\bquiz\b/i.test(t)) return 'quiz';
  if (/\b(project|portfolio)\b/i.test(t) || /\b(essay|paper)\b.*\bfinal\b/i.test(t)) return 'project';
  if (/\blab\b/i.test(t)) return 'lab';
  return 'homework';
}

const inWindow = (day, term) => day >= term.start && day <= addDays(term.start, term.days - 1);

// Courses the student is in this term. Canvas also returns restricted or nameless sites, and courses from
// terms that have already ended (or not begun); leave those out.
export function mapCourses(rawCourses, term) {
  const windowStart = new Date(term.start + 'T00:00:00Z');
  const windowEnd = new Date(addDays(term.start, term.days) + 'T00:00:00Z');
  return rawCourses
    .filter((c) => c && c.id != null && c.name && c.course_code)
    .filter((c) => !(c.term?.end_at && new Date(c.term.end_at) < windowStart) && !(c.term?.start_at && new Date(c.term.start_at) >= windowEnd))
    .map((c) => ({ id: Number(c.id), course_code: String(c.course_code), name: String(c.name) }));
}

const SUBMITTED = new Set(['submitted', 'graded', 'pending_review']);

// Canvas assignments -> assignments shaped like the app's own. Only work due inside the term counts, and work the
// student has already turned in does not add to their workload.
export function mapAssignments(rawAssignments, courseId, term) {
  const seen = new Map();
  for (const a of rawAssignments) {
    if (!a || a.published === false) continue;
    const id = Number(a.id);
    const due = toEasternIso(a.due_at);
    if (!Number.isFinite(id) || !due || !a.name || !inWindow(due.slice(0, 10), term)) continue;
    if (a.submission && (SUBMITTED.has(a.submission.workflow_state) || a.submission.submitted_at)) continue;
    const quiz = a.is_quiz_assignment || (a.submission_types ?? []).includes('online_quiz');
    const type = guessType(a.name, quiz ? 'quiz' : 'assignment');
    seen.set(id, { id, course_id: courseId, name: String(a.name), due_at: due, points_possible: Number(a.points_possible) || 0, type, effort_h: EFFORT_H[type], source: 'canvas' });
  }
  return [...seen.values()];
}

// Canvas calendar events (classes, office hours, ...) -> events shaped like Google Calendar's.
export function mapCalendarEvents(rawEvents, term) {
  const seen = new Map();
  for (const e of rawEvents) {
    const start = toEasternIso(e?.start_at);
    const end = toEasternIso(e?.end_at ?? e?.start_at);
    if (!e?.id || !e.title || !start || !end || !inWindow(start.slice(0, 10), term)) continue;
    const id = `canvas-${e.id}`;
    seen.set(id, { id, summary: String(e.title), start: { dateTime: start }, end: { dateTime: end }, host_type: 'class', source: 'canvas' });
  }
  return [...seen.values()];
}

// The syllabus Canvas keeps for a course is HTML. Turn it into lines of text the exam parser can read.
export function syllabusText(html) {
  return String(html || '')
    .replace(/<\/(p|div|li|tr|h[1-6]|ul|ol|table)>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ');
}

// Exam dates found in the Canvas syllabi of courses that have none yet. These are suggestions for the student
// to confirm: an exam date, once added, is shared with the whole course.
export function suggestExams(rawCourses, courses, assignments) {
  const keep = new Set(courses.map((c) => c.id));
  const out = [];
  for (const c of rawCourses) {
    if (!keep.has(Number(c?.id)) || !c.syllabus_body || courseHasExam(Number(c.id), assignments)) continue;
    const exam = parseExam(syllabusText(c.syllabus_body));
    if (exam) out.push({ courseId: Number(c.id), ...exam });
  }
  return out;
}
