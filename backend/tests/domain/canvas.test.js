import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { toEasternIso } from '../../src/shared/campusTime.js';
import { guessType, mapAssignments, mapCalendarEvents, mapCourses, suggestExams, syllabusText } from '../../src/modules/academics/domain/canvasMapping.js';
import { createCanvasClient } from '../../src/modules/academics/infrastructure/canvas/canvasClient.js';
import { createInMemoryAcademicsRepository } from '../../src/modules/academics/infrastructure/persistence/inMemoryAcademicsRepository.js';

describe('campus time', () => {
  it('turns UTC into Eastern wall-clock time, with the right offset for winter and summer', () => {
    assert.equal(toEasternIso('2026-12-16T04:59:00Z'), '2026-12-15T23:59:00-05:00');
    assert.equal(toEasternIso('2026-12-14T13:30:00Z'), '2026-12-14T08:30:00-05:00');
    assert.equal(toEasternIso('2026-07-01T03:59:00Z'), '2026-06-30T23:59:00-04:00');
    assert.equal(toEasternIso('2026-12-15T00:00:00Z'), '2026-12-14T19:00:00-05:00');
  });
  it('returns null for garbage', () => {
    assert.equal(toEasternIso('nope'), null);
    assert.equal(toEasternIso(undefined), null);
  });
});

describe('Canvas mapping', () => {
  const term = { start: '2026-12-01', days: 31, end: '2026-12-18' };

  it('guesses the assignment type from the title', () => {
    const cases = [['Final Exam', 'final'], ['Final', 'final'], ['Midterm 2', 'midterm'], ['Exam 1', 'midterm'], ['Reading quiz 10', 'quiz'], ['Programming Project: Text editor', 'project'],
      ['Essay 3 draft', 'homework'], ['Essay 3 final', 'project'], ['Lab Report 8', 'lab'], ['HW 9: Hash tables', 'homework'], ['Final project proposal', 'project'], ['Reflection portfolio', 'project']];
    for (const [title, type] of cases) assert.equal(guessType(title, 'assignment'), type, title);
    assert.equal(guessType('Weekly check-in', 'quiz'), 'quiz');
  });

  it('keeps real, named courses from this term', () => {
    const raw = [
      { id: 1, name: 'A', course_code: 'X-1', term: { end_at: '2027-01-02T04:59:00Z' } },
      { id: 2, access_restricted_by_date: true },
      null,
      { id: 3, name: 'B' },
      { id: 4, name: 'Old', course_code: 'O-1', term: { start_at: '2026-01-12T05:00:00Z', end_at: '2026-05-10T04:00:00Z' } },
      { id: 5, name: 'Next', course_code: 'N-1', term: { start_at: '2027-01-12T05:00:00Z' } },
      { id: 6, name: 'No term dates', course_code: 'T-1', term: {} },
    ];
    assert.deepEqual(mapCourses(raw, term).map((c) => c.id), [1, 6]);
  });

  const a = (id, name, due_at, over = {}) => ({ id, name, due_at, points_possible: 20, published: true, submission: { workflow_state: 'unsubmitted' }, ...over });

  it('maps assignments, converting due dates to Eastern time and guessing type and effort', () => {
    const out = mapAssignments([a(10, 'HW', '2026-12-11T04:59:00Z'), a(14, 'Final Exam', '2026-12-14T13:30:00Z', { points_possible: 200 })], 7, term);
    assert.deepEqual(out.map((x) => [x.id, x.course_id, x.type, x.effort_h, x.due_at, x.points_possible, x.source]), [
      [10, 7, 'homework', 3, '2026-12-10T23:59:00-05:00', 20, 'canvas'],
      [14, 7, 'final', 12, '2026-12-14T08:30:00-05:00', 200, 'canvas'],
    ]);
  });

  it('leaves out undated, unpublished, already-submitted and out-of-term work, and merges duplicates', () => {
    const out = mapAssignments([
      a(1, 'Keep', '2026-12-05T15:00:00Z'),
      a(2, 'Undated', null),
      a(3, 'Unpublished', '2026-12-05T15:00:00Z', { published: false }),
      a(4, 'Submitted', '2026-12-05T15:00:00Z', { submission: { workflow_state: 'submitted' } }),
      a(5, 'Graded', '2026-12-05T15:00:00Z', { submission: { workflow_state: 'graded' } }),
      a(6, 'Turned in late', '2026-12-05T15:00:00Z', { submission: { workflow_state: 'unsubmitted', submitted_at: '2026-12-06T00:00:00Z' } }),
      a(7, 'Before the term', '2026-11-30T04:59:00Z'),
      a(8, 'After the term', '2027-01-05T04:59:00Z'),
      a(1, 'Keep (again)', '2026-12-05T15:00:00Z'),
      a(9, 'No submission info', '2026-12-05T15:00:00Z', { submission: undefined }),
    ], 7, term);
    assert.deepEqual(out.map((x) => [x.id, x.name]), [[1, 'Keep (again)'], [9, 'No submission info']]);
  });

  it('treats quizzes by their submission type', () => {
    assert.equal(mapAssignments([a(1, 'Check 4', '2026-12-05T15:00:00Z', { submission_types: ['online_quiz'] })], 7, term)[0].type, 'quiz');
    assert.equal(mapAssignments([a(2, 'Check 5', '2026-12-05T15:00:00Z', { is_quiz_assignment: true })], 7, term)[0].effort_h, 2);
  });

  it('maps calendar events like Google Calendar events, inside the term only', () => {
    const out = mapCalendarEvents([
      { id: 1, title: 'Recitation', start_at: '2026-12-08T15:30:00Z', end_at: '2026-12-08T16:20:00Z' },
      { id: 2, title: 'No end time', start_at: '2026-12-09T15:30:00Z', end_at: null },
      { id: 3, title: 'Next year', start_at: '2027-02-01T20:00:00Z', end_at: '2027-02-01T21:00:00Z' },
      { id: 4, title: '', start_at: '2026-12-09T15:30:00Z' },
      { id: 5, title: 'Bad time', start_at: 'soon' },
    ], term);
    assert.deepEqual(out, [
      { id: 'canvas-1', summary: 'Recitation', start: { dateTime: '2026-12-08T10:30:00-05:00' }, end: { dateTime: '2026-12-08T11:20:00-05:00' }, host_type: 'class', source: 'canvas' },
      { id: 'canvas-2', summary: 'No end time', start: { dateTime: '2026-12-09T10:30:00-05:00' }, end: { dateTime: '2026-12-09T10:30:00-05:00' }, host_type: 'class', source: 'canvas' },
    ]);
  });

  it('reads the syllabus HTML and suggests exam dates only for courses without one', () => {
    const html = '<p>Grading</p><ul><li>Final Exam: Tuesday, December 15, 2026, 10:00 AM &amp; Wean Hall</li></ul>';
    assert.match(syllabusText(html), /Final Exam: Tuesday, December 15, 2026, 10:00 AM & Wean Hall/);
    const raw = [{ id: 1, syllabus_body: html }, { id: 2, syllabus_body: html }, { id: 3, syllabus_body: '<p>No exams.</p>' }, { id: 4, syllabus_body: null }];
    const courses = [1, 2, 3, 4].map((id) => ({ id }));
    const assignments = [{ course_id: 2, type: 'final' }];
    assert.deepEqual(suggestExams(raw, courses, assignments).map((s) => [s.courseId, s.type, s.date, s.time]), [[1, 'final', '2026-12-15', '10:00']]);
  });
});

describe('Canvas client guards', () => {
  it('refuses to send a token over plain http to a non-local host', () => {
    assert.throws(() => createCanvasClient({ baseUrl: 'http://canvas.example.com' }), /https/);
    assert.doesNotThrow(() => createCanvasClient({ baseUrl: 'https://canvas.example.com' }));
  });
});

describe('academics repository with a Canvas import', () => {
  const repo = () => createInMemoryAcademicsRepository();
  const imported = { courses: [{ id: 7001, course_code: '15-122', name: 'X' }], assignments: [{ id: 501, course_id: 7001, name: 'HW', due_at: '2026-12-10T23:59:00-05:00', type: 'homework', effort_h: 3 }] };

  it('replaces the student\'s courses, adds the data, and leaves everyone else alone', () => {
    const r = repo();
    const before = r.student('s2').course_ids;
    r.importCanvas('s1', imported);
    assert.deepEqual(r.student('s1').course_ids, [7001]);
    assert.deepEqual(r.student('s2').course_ids, before);
    assert.ok(r.courses().some((c) => c.id === 7001) && r.assignments().some((a) => a.id === 501));
  });

  it('does not change the seed data, and clearing restores the demo data', () => {
    const r = repo();
    const seed = [r.courses().length, r.assignments().length];
    r.importCanvas('s1', imported);
    r.clearCanvasImport('s1');
    assert.deepEqual([r.courses().length, r.assignments().length], seed);
    assert.deepEqual(r.student('s1').course_ids, [101, 102, 103, 104]);
    assert.deepEqual([repo().courses().length, repo().assignments().length], seed);
  });
});
