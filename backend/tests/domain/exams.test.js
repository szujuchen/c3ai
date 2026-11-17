import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { addSyllabusExam } from '../../src/modules/academics/application/use-cases/addSyllabusExam.js';
import { getExamStatus } from '../../src/modules/academics/application/use-cases/getExamStatus.js';
import { parseSyllabus } from '../../src/modules/academics/application/use-cases/parseSyllabus.js';
import { setRegistration } from '../../src/modules/academics/application/use-cases/setRegistration.js';
import { parseExam } from '../../src/modules/academics/domain/syllabusParser.js';
import { getStudentWorkload } from '../../src/modules/workload/application/use-cases/getStudentWorkload.js';
import { golden, makeDeps } from '../helpers.js';

const both = { canvas: true, gcal: true };

describe('syllabus parsing (matches the original implementation)', () => {
  golden.parseCases.forEach(({ text, expected }, i) => {
    it(`case ${i}: ${JSON.stringify(text.slice(0, 40))}`, () => assert.deepEqual(parseExam(text), expected));
  });

  it('reads 12 AM / 12 PM correctly and defaults to 9:00 AM in 2026', () => {
    assert.equal(parseExam('Final Exam Dec 9 12 PM').time, '12:00');
    assert.equal(parseExam('Final Exam Dec 9 12 AM').time, '00:00');
    assert.deepEqual([parseExam('Final Exam Dec 9').date, parseExam('Final Exam Dec 9').time], ['2026-12-09', '09:00']);
  });

  it('the use case rejects non-text input', () => {
    assert.throws(() => parseSyllabus({ text: 5 }), { status: 400 });
  });
});

describe('missing exam dates', () => {
  it('lists courses with no final or midterm, but only once Canvas is connected', () => {
    const deps = makeDeps('base');
    assert.deepEqual(getExamStatus(deps, 's1', { canvas: true }).missingCourseIds, golden.variants.base.students.s1['canvas+gcal'].exams.missing);
    assert.deepEqual(getExamStatus(deps, 's1', { canvas: false }).missingCourseIds, []);
  });

  it('adding the exam shares it with the whole course and ends up in everyone\'s load', () => {
    const deps = makeDeps('base');
    assert.equal(getStudentWorkload(deps, 's1', both).alert, null);

    const { exam, sharedWith } = addSyllabusExam(deps, 103, { studentId: 's1', type: 'final', date: '2026-12-15', time: '10:00' });
    assert.deepEqual(exam, { ...golden.syllabusExamSample[0], id: 9000 });
    assert.equal(sharedWith, 4);

    assert.equal(getStudentWorkload(deps, 's1', both).alert.level, 'Critical');
    assert.ok(getStudentWorkload(deps, 's3', both).load['2026-12-14'] > 0);
    assert.deepEqual(getExamStatus(deps, 's1', { canvas: true }).missingCourseIds, [104]);
    assert.deepEqual(getExamStatus(deps, 's5', { canvas: true }).added.map((e) => [e.id, e.sharedWith]), [[9000, 4]]);
    assert.deepEqual(getExamStatus(deps, 's2', { canvas: true }).added, []);
  });

  it('gives a midterm 8 hours of effort and ids that keep counting up', () => {
    const deps = makeDeps('base');
    const a = addSyllabusExam(deps, 103, { studentId: 's1', type: 'midterm', date: '2026-12-05' }).exam;
    const b = addSyllabusExam(deps, 104, { studentId: 's1', date: '2026-12-16' }).exam;
    assert.deepEqual([a.id, a.name, a.effort_h, a.due_at, b.id, b.name, b.effort_h], [9000, 'Midterm', 8, '2026-12-05T09:00:00-05:00', 9001, 'Final Exam', 12]);
  });

  it('only enrolled students can add exam dates', () => {
    assert.throws(() => addSyllabusExam(makeDeps('base'), 103, { studentId: 's2', date: '2026-12-15' }), { status: 403 });
  });

  it('refuses a second exam for a course that already has one', () => {
    const deps = makeDeps('base');
    assert.throws(() => addSyllabusExam(deps, 101, { studentId: 's1', date: '2026-12-15' }), { status: 409 });
    addSyllabusExam(deps, 103, { studentId: 's1', date: '2026-12-15' });
    assert.throws(() => addSyllabusExam(deps, 103, { studentId: 's5', date: '2026-12-16' }), { status: 409 });
  });

  it('validates the input', () => {
    const deps = makeDeps('base');
    const bad = (course, body, status) => assert.throws(() => addSyllabusExam(deps, course, body), { status });
    bad(999, { studentId: 's1', date: '2026-12-15' }, 404);
    bad(103, { studentId: 'nobody', date: '2026-12-15' }, 404);
    bad(103, { studentId: 's1' }, 400);
    bad(103, { studentId: 's1', date: '12/15/2026' }, 400);
    bad(103, { studentId: 's1', date: '2026-12-15', time: '25:00' }, 400);
    bad(103, { studentId: 's1', date: '2026-12-15', type: 'quiz' }, 400);
  });
});

describe('campus event registration', () => {
  it('registering adds the event\'s hours to the student\'s load, and unregistering takes it back', () => {
    const deps = makeDeps('base');
    const before = getStudentWorkload(deps, 's1', both).load['2026-12-03'];
    assert.deepEqual(setRegistration(deps, 's1', 'ce1', true), { eventId: 'ce1', registered: true, date: '2026-12-03' });
    assert.equal(getStudentWorkload(deps, 's1', both).load['2026-12-03'], Math.round((before + 4) * 10) / 10);
    setRegistration(deps, 's1', 'ce1', false);
    assert.equal(getStudentWorkload(deps, 's1', both).load['2026-12-03'], before);
  });

  it('is safe to repeat, and relax events add no load', () => {
    const deps = makeDeps('base');
    setRegistration(deps, 's1', 'ce4', true);
    setRegistration(deps, 's1', 'ce4', true);
    assert.deepEqual(deps.registrations.forStudent('s1'), ['ce4']);
    assert.equal(getStudentWorkload(deps, 's1', both).load['2026-12-13'], makeDeps('base') && getStudentWorkload(makeDeps('base'), 's1', both).load['2026-12-13']);
  });

  it('can register for campus events only, not Google Calendar events or mock events', () => {
    const deps = makeDeps('full');
    assert.equal(setRegistration(deps, 's1', 'ce5', true).registered, true);
    assert.throws(() => setRegistration(deps, 's1', 'ev1', true), { status: 404 });
    assert.throws(() => setRegistration(deps, 's1', 'mock-1', true), { status: 404 });
    assert.throws(() => setRegistration(deps, 'nobody', 'ce1', true), { status: 404 });
  });
});
