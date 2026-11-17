// Live check of the Canvas APIs with the real token from backend/.env (CANVA_TOKEN).
// Not part of `npm test` (the file name does not end in .test.js): run it with `npm run test:live`.
// It reads real data, so it prints counts and field checks only, never course names, titles or dates.
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { createInMemoryAcademicsRepository } from '../../src/modules/academics/infrastructure/persistence/inMemoryAcademicsRepository.js';
import { connectCanvas } from '../../src/modules/academics/application/use-cases/connectCanvas.js';
import { mapCourses } from '../../src/modules/academics/domain/canvasMapping.js';
import { createCanvasClient } from '../../src/modules/academics/infrastructure/canvas/canvasClient.js';
import { getStudentWorkload } from '../../src/modules/workload/application/use-cases/getStudentWorkload.js';
import { loadConfig } from '../../src/shared/config.js';
import { lastDayOf } from '../../src/shared/term.js';

try { process.loadEnvFile(new URL('../../.env', import.meta.url)); } catch (err) { if (err.code !== 'ENOENT') throw err; }
const config = loadConfig();
const token = config.canvasToken;
const skip = token ? false : 'no CANVA_TOKEN in backend/.env';

describe('live Canvas', { skip }, () => {
  const client = createCanvasClient({ baseUrl: config.canvasBaseUrl });
  const { term } = config;
  let rawCourses, courses;

  before(async () => {
    rawCourses = await client.courses(token);
    courses = mapCourses(rawCourses, term);
  });

  it('GET /api/v1/courses accepts the token and returns courses', (t) => {
    assert.ok(Array.isArray(rawCourses), 'courses is a list');
    assert.ok(rawCourses.length > 0, 'the token has at least one active course');
    t.diagnostic(`active courses: ${rawCourses.length}, in this term: ${courses.length}`);
  });

  it('the fields we read are there: id, name, course_code, term, syllabus_body', (t) => {
    assert.ok(rawCourses.every((c) => c && typeof c === 'object' && 'id' in c), 'every course has an id');
    const named = rawCourses.filter((c) => c.name && c.course_code).length;
    const withTerm = rawCourses.filter((c) => 'term' in c).length;
    const withSyllabusKey = rawCourses.filter((c) => 'syllabus_body' in c).length;
    const withSyllabus = rawCourses.filter((c) => c.syllabus_body).length;
    t.diagnostic(`named: ${named}, term included: ${withTerm}, syllabus_body key: ${withSyllabusKey}, with a syllabus: ${withSyllabus}`);
    assert.ok(named > 0, 'at least one course has a name and course code');
    assert.ok(withTerm > 0, 'include[]=term is honored');
    assert.ok(withSyllabusKey > 0, 'include[]=syllabus_body is honored');
  });

  it('GET /api/v1/courses/{id}/assignments returns assignments with the fields we read', async (t) => {
    const sample = courses.slice(0, 6);
    assert.ok(sample.length > 0, 'there is a course in this term to read');
    let total = 0, withDue = 0, withSubmissionKey = 0, shapeOk = true;
    for (const c of sample) {
      let list;
      try { list = await client.assignments(token, c.id); } catch (err) { if (err.status === 401) continue; throw err; } // a course may refuse access
      assert.ok(Array.isArray(list), 'assignments is a list');
      total += list.length;
      for (const a of list) {
        if (!('id' in a && 'name' in a && 'due_at' in a)) shapeOk = false;
        if (a.due_at) withDue++;
        if ('submission' in a) withSubmissionKey++;
      }
    }
    t.diagnostic(`courses read: ${sample.length}, assignments: ${total}, with a due date: ${withDue}, with a submission: ${withSubmissionKey}`);
    assert.ok(shapeOk, 'every assignment has id, name and due_at');
  });

  it('GET /api/v1/calendar_events returns a list of events with the fields we read', async (t) => {
    assert.ok(courses.length > 0, 'there is a course in this term');
    const list = await client.calendarEvents(token, courses.map((c) => c.id), { start: term.start, end: lastDayOf(term) });
    assert.ok(Array.isArray(list), 'events is a list');
    assert.ok(list.every((e) => 'id' in e && 'title' in e && 'start_at' in e), 'every event has id, title and start_at');
    t.diagnostic(`calendar events in the term: ${list.length}`);
  });

  it('a wrong token is rejected', async () => {
    const err = await client.courses('definitely-not-a-valid-token').catch((e) => e);
    assert.equal(err.status, 401);
  });

  it('end to end: importing into the app gives a workload for the whole term', async (t) => {
    const academics = createInMemoryAcademicsRepository();
    const deps = { academics, canvas: client, canvasToken: token, term };
    const r = await connectCanvas(deps, 's1', {});
    assert.ok(r.courses > 0, 'courses were imported');
    const w = getStudentWorkload({ ...deps, hostedEvents: { list: () => [] }, syllabusExams: { list: () => [] }, registrations: { forStudent: () => [] } }, 's1', { canvas: true, gcal: false });
    assert.equal(Object.keys(w.load).length, term.days);
    const busyDays = Object.values(w.load).filter((h) => h > 0).length;
    const peak = Math.max(...Object.values(w.load));
    t.diagnostic(`imported: ${r.courses} courses, ${r.assignments} assignments, ${r.events} events; syllabus exam suggestions: ${r.suggestions.length}`);
    t.diagnostic(`workload: ${busyDays} days with work, peak ${peak} h/day, burnout alert: ${w.alert ? w.alert.level : 'none'}`);
  });
});
