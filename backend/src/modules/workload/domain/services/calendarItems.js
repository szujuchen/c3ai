import { addDays } from '../../../../shared/dateKeys.js';
import { parseMeetingTimes } from '../../../academics/domain/meetingTimes.js';

// Placing things on the hours of a day, in minutes from midnight. Dates and times are read straight off the strings,
// which already carry campus wall-clock time.
export const wallMinutes = (iso) => Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16));

// Study happens in the afternoon and evening, in blocks of at most 2 hours, at most 4 blocks a day.
export const STUDY = { windowStart: 13 * 60, windowEnd: 22 * 60, maxBlockMin: 120, minBlockMin: 30, maxBlocks: 4, step: 15 };

const dayOfWeek = (key) => new Date(key + 'T00:00:00Z').getUTCDay();

// The student's weekly class meetings that fall on this date (classes stop when finals end).
export function classBlocks(student, courses, date, lastClassDay) {
  if (date > lastClassDay) return [];
  const dow = dayOfWeek(date);
  return courses
    .filter((c) => student.course_ids.includes(c.id))
    .flatMap((c) => parseMeetingTimes(c.meeting_times).filter((m) => m.dow === dow).map((m) => ({ kind: 'class', id: `class-${c.id}-${date}`, courseId: c.id, title: c.course_code, subtitle: c.name, startMin: m.startMin, endMin: m.endMin })));
}

// The student's events (campus, Canvas, Google) that start on this date.
export function eventBlocks(student, events, date) {
  return events
    .filter((e) => student.event_ids.includes(e.id) && e.start.dateTime.slice(0, 10) === date)
    .map((e) => ({ kind: 'event', id: e.id, title: e.summary, relax: e.host_type === 'relax', startMin: wallMinutes(e.start.dateTime), endMin: Math.max(wallMinutes(e.end.dateTime), wallMinutes(e.start.dateTime) + 1) }));
}

// An exam keeps the student busy for the 3 hours before it ends up due.
export function examBlocks(student, assignments, date) {
  return assignments
    .filter((a) => student.course_ids.includes(a.course_id) && (a.type === 'final' || a.type === 'midterm') && a.due_at.slice(0, 10) === date)
    .map((a) => ({ kind: 'exam', startMin: Math.max(0, wallMinutes(a.due_at) - 180), endMin: wallMinutes(a.due_at) }));
}

// Greedy study plan for one day: biggest items first, each split into blocks, placed in the earliest free time in
// the study window. What does not fit is reported, not squeezed in.
export function placeStudyBlocks(workItems, busy) {
  const taken = busy.map((b) => [b.startMin, b.endMin]).sort((a, b) => a[0] - b[0]);
  const blocks = [];
  let unplacedMin = 0;
  const firstFit = (len) => {
    let t = STUDY.windowStart;
    for (const [s, e] of taken) {
      if (e <= t) continue;
      if (s - t >= Math.min(len, STUDY.minBlockMin)) return { start: t, room: s - t };
      t = Math.max(t, e);
    }
    return STUDY.windowEnd - t >= Math.min(len, STUDY.minBlockMin) ? { start: t, room: STUDY.windowEnd - t } : null;
  };
  for (const w of workItems.slice().sort((a, b) => b.hours - a.hours)) {
    let remaining = Math.round((w.hours * 60) / STUDY.step) * STUDY.step;
    while (remaining > 0) {
      const want = Math.min(STUDY.maxBlockMin, remaining);
      const slot = blocks.length < STUDY.maxBlocks ? firstFit(want) : null;
      if (!slot) { unplacedMin += remaining; break; }
      const len = Math.floor(Math.min(want, slot.room) / STUDY.step) * STUDY.step;
      if (len < STUDY.minBlockMin && len < remaining) { unplacedMin += remaining; break; }
      blocks.push({ kind: 'study', id: `study-${w.assignment.id}-${blocks.length}`, assignmentId: w.assignment.id, courseId: w.assignment.course_id, title: `Study: ${w.assignment.name}`, startMin: slot.start, endMin: slot.start + len });
      taken.push([slot.start, slot.start + len]);
      taken.sort((a, b) => a[0] - b[0]);
      remaining -= len;
    }
  }
  return { blocks: blocks.sort((a, b) => a.startMin - b.startMin), unplacedMin };
}

// "Start studying" markers: the first day of an assignment's study window.
export function startMarkers(student, assignments, date, leadDaysFor, studyBlocks) {
  return assignments
    .filter((a) => student.course_ids.includes(a.course_id) && addDays(a.due_at.slice(0, 10), -leadDaysFor(a.type)) === date)
    .map((a) => ({ kind: 'start', id: `start-${a.id}`, assignmentId: a.id, courseId: a.course_id, title: `Start studying: ${a.name}`, startMin: studyBlocks.find((b) => b.assignmentId === a.id)?.startMin ?? 9 * 60 }));
}

export const deadlineItems = (student, assignments, date) => assignments
  .filter((a) => student.course_ids.includes(a.course_id) && a.due_at.slice(0, 10) === date)
  .map((a) => ({ kind: 'deadline', id: `due-${a.id}`, assignmentId: a.id, courseId: a.course_id, title: a.name, startMin: wallMinutes(a.due_at) }));
