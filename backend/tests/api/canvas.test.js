import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createCanvasClient } from '../../src/modules/academics/infrastructure/canvas/canvasClient.js';
import { createInMemoryAcademicsRepository } from '../../src/modules/academics/infrastructure/persistence/inMemoryAcademicsRepository.js';
import { startFakeCanvas } from '../fakeCanvas.js';
import { startServer } from '../helpers.js';

const TOKEN = 'good-token';
const connect = (api, id, token) => api.call(`/api/students/${id}/canvas/connect`, { method: 'POST', body: token === undefined ? {} : { token } });
const serverFor = (canvas, extra = {}) => startServer('base', { academics: createInMemoryAcademicsRepository(), canvas: createCanvasClient({ baseUrl: canvas.url }), ...extra });

describe('Canvas client: which endpoints it calls, and how', () => {
  let canvas, client;
  before(async () => { canvas = await startFakeCanvas({ token: TOKEN }); client = createCanvasClient({ baseUrl: canvas.url }); });
  after(() => canvas.close());

  it('GET /api/v1/courses asks for active courses with term and syllabus, and follows the Link header', async () => {
    const courses = await client.courses(TOKEN);
    assert.equal(courses.length, 5);
    const calls = canvas.requests.filter((r) => r.path === '/api/v1/courses');
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[0].query['include[]'], ['term', 'syllabus_body']);
    assert.equal(calls[0].query.enrollment_state, 'active');
    assert.equal(calls[0].query.per_page, '100');
    assert.ok(calls.every((c) => c.auth === `Bearer ${TOKEN}`));
  });

  it('GET /api/v1/courses/{id}/assignments includes the submission and pages through results', async () => {
    const list = await client.assignments(TOKEN, 7001);
    assert.equal(list.length, 8);
    const calls = canvas.requests.filter((r) => r.path === '/api/v1/courses/7001/assignments');
    assert.equal(calls.length, 2);
    assert.deepEqual([calls[0].query['include[]'], calls[0].query.per_page], [['submission'], '100']);
  });

  it('GET /api/v1/calendar_events asks for course contexts, events only, inside the date window', async () => {
    const list = await client.calendarEvents(TOKEN, [7001, 7002], { start: '2026-12-01', end: '2026-12-31' });
    assert.equal(list.length, 3);
    const call = canvas.requests.find((r) => r.path === '/api/v1/calendar_events');
    assert.deepEqual(call.query['context_codes[]'], ['course_7001', 'course_7002']);
    assert.deepEqual([call.query.type, call.query.start_date, call.query.end_date, call.query.per_page], ['event', '2026-12-01', '2026-12-31', '100']);
  });

  it('turns Canvas errors into clear ones that never contain the token', async () => {
    const wrong = await client.courses('wrong-token').catch((e) => e);
    assert.equal(wrong.status, 401);
    assert.ok(!wrong.message.includes('wrong-token'));
    const dead = await createCanvasClient({ baseUrl: 'http://localhost:1' }).courses(TOKEN).catch((e) => e);
    assert.equal(dead.status, 502);
    assert.equal(dead.message, 'Could not reach Canvas');
  });

  it('stops after a page limit instead of looping forever', async () => {
    const endless = createCanvasClient({ baseUrl: canvas.url, maxPages: 1 });
    assert.equal((await endless.courses(TOKEN)).length, 2);
  });
});

describe('POST /api/students/:id/canvas/connect', () => {
  let canvas, api;
  before(async () => { canvas = await startFakeCanvas({ token: TOKEN }); api = await serverFor(canvas); });
  after(async () => { await api.close(); await canvas.close(); });

  it('imports courses, assignments and classes, and suggests the exam found in a syllabus', async () => {
    const { status, body } = await connect(api, 's1', TOKEN);
    assert.equal(status, 200);
    assert.equal(body.courses, 3);       // 7003 is restricted and 7005 is from a past term
    assert.equal(body.assignments, 5);   // 501, 506, 505, 502, 511 (undated, old, submitted, unpublished and duplicate left out)
    assert.equal(body.events, 2);        // the 2027 event is outside the term
    assert.equal(body.suggestions.length, 1);
    assert.deepEqual([body.suggestions[0].courseId, body.suggestions[0].type, body.suggestions[0].date, body.suggestions[0].time], [7004, 'final', '2026-12-15', '10:00']);
  });

  it('never sends the token back, in any response', async () => {
    const all = await Promise.all(['/api/students', '/api/canvas/courses', '/api/canvas/assignments', '/api/canvas/status', '/api/students/s1/workload?canvas=1&gcal=1', '/api/students/s1/exams?canvas=1'].map((p) => api.call(p)));
    for (const r of all) assert.ok(!JSON.stringify(r.body).includes(TOKEN));
    const bad = await fetch(`${api.base}/api/students/s1/canvas/connect`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: `{"token":"${TOKEN}"` });
    assert.equal(bad.status, 400);
    assert.ok(!(await bad.text()).includes(TOKEN));
  });

  it("replaces the student's demo courses with real ones and leaves other students alone", async () => {
    const { body: { students } } = await api.call('/api/students');
    assert.deepEqual(students.find((s) => s.id === 's1').course_ids, [7001, 7002, 7004]);
    assert.deepEqual(students.find((s) => s.id === 's2').course_ids, [101, 102, 104]);
    assert.deepEqual((await api.call('/api/canvas/courses')).body.courses.filter((c) => c.id > 7000).map((c) => c.course_code), ['15-122', '21-241', '33-141']);
  });

  it('puts deadlines on the right Eastern-time day, and work builds up before them', async () => {
    const lab = (await api.call('/api/students/s1/days/2026-12-15?canvas=1')).body;
    assert.deepEqual(lab.due.map((a) => [a.id, a.name, a.due_at]), [[511, 'Lab Report 9', '2026-12-15T23:59:00-05:00']]);
    const final = (await api.call('/api/students/s1/days/2026-12-14?canvas=1')).body;
    assert.deepEqual(final.due.map((a) => [a.name, a.type, a.effort_h]), [['Final Exam', 'final', 12]]);
    assert.ok((await api.call('/api/students/s1/workload?canvas=1')).body.load['2026-12-13'] > 0);
    const days = (await api.call('/api/students/s1/workload?canvas=1')).body.days;
    assert.deepEqual([days['2026-12-03'].dueCount, days['2026-12-04'].dueCount], [1, 1]); // essay at 11:59 PM Dec 3 (not Dec 4 UTC), quiz at 10 AM Dec 4
  });

  it('classes from Canvas add hours once Canvas is connected, without needing Google Calendar', async () => {
    const withCanvas = (await api.call('/api/students/s1/days/2026-12-08?canvas=1')).body;
    assert.deepEqual(withCanvas.events.map((e) => e.summary), ['Recitation']);
    assert.equal((await api.call('/api/students/s1/days/2026-12-08')).body.events.length, 0);
  });

  it('counts the real student in the campus intensity', async () => {
    const { body } = await api.call('/api/intensity?audience=CS');
    assert.equal(body.studentCount, 3);
    assert.ok(body.intensity['2026-12-13'] > 0);
  });

  it('can go back to the demo data', async () => {
    assert.equal((await api.call('/api/students/s1/canvas', { method: 'DELETE' })).status, 200);
    assert.deepEqual((await api.call('/api/students')).body.students[0].course_ids, [101, 102, 103, 104]);
    assert.equal((await api.call('/api/canvas/courses')).body.courses.length, 4);
  });
});

describe('Canvas connect: server token and failures', () => {
  let canvas;
  before(async () => { canvas = await startFakeCanvas({ token: TOKEN }); });
  after(() => canvas.close());

  it('uses the token from the server config when the request has none, and reports that it is configured', async () => {
    const api = await serverFor(canvas, { canvasToken: TOKEN });
    assert.deepEqual((await api.call('/api/canvas/status')).body, { configured: true });
    const { status, body } = await connect(api, 's1');
    await api.close();
    assert.equal(status, 200);
    assert.equal(body.courses, 3);
  });

  it('a token in the request wins over the server token', async () => {
    const api = await serverFor(canvas, { canvasToken: 'wrong-server-token' });
    const { status } = await connect(api, 's1', TOKEN);
    await api.close();
    assert.equal(status, 200);
  });

  it('with no token anywhere it asks for one', async () => {
    const api = await serverFor(canvas);
    assert.deepEqual((await api.call('/api/canvas/status')).body, { configured: false });
    const { status, body } = await connect(api, 's1');
    await api.close();
    assert.equal(status, 400);
    assert.match(body.error.message, /token is required/);
  });

  it('says so when Canvas rejects the token, and changes nothing', async () => {
    const api = await serverFor(canvas);
    const { status, body } = await connect(api, 's1', 'wrong-token');
    const students = (await api.call('/api/students')).body.students;
    await api.close();
    assert.equal(status, 401);
    assert.match(body.error.message, /rejected/);
    assert.ok(!JSON.stringify(body).includes('wrong-token'));
    assert.deepEqual(students[0].course_ids, [101, 102, 103, 104]);
  });

  it('validates the request', async () => {
    const api = await serverFor(canvas);
    assert.equal((await connect(api, 's1', '')).status, 400);
    assert.equal((await connect(api, 's1', '   ')).status, 400);
    assert.equal((await connect(api, 'nobody', TOKEN)).status, 404);
    assert.equal((await api.call('/api/students/nobody/canvas', { method: 'DELETE' })).status, 404);
    await api.close();
  });

  it('reports 502 when Canvas cannot be reached', async () => {
    const dead = await startServer('base', { academics: createInMemoryAcademicsRepository(), canvas: createCanvasClient({ baseUrl: 'http://localhost:1' }) });
    const { status, body } = await connect(dead, 's1', TOKEN);
    await dead.close();
    assert.equal(status, 502);
    assert.equal(body.error.message, 'Could not reach Canvas');
  });

  it('says so when no Canvas client is configured', async () => {
    const none = await startServer('base', { canvas: null });
    const { status } = await connect(none, 's1', TOKEN);
    await none.close();
    assert.equal(status, 400);
  });

  it('skips a course that refuses access to its assignments and imports the rest', async () => {
    const restricted = await startFakeCanvas({ token: TOKEN, forbidAssignmentsFor: [7004] });
    const api = await serverFor(restricted);
    const { status, body } = await connect(api, 's1', TOKEN);
    await api.close(); await restricted.close();
    assert.equal(status, 200);
    assert.deepEqual([body.courses, body.assignments], [3, 4]);
  });

  it('never follows a paging link to another host, so the token cannot leak', async () => {
    const elsewhere = await startFakeCanvas({ token: TOKEN });
    const evil = await startFakeCanvas({ token: TOKEN, evilNext: `${elsewhere.url}/api/v1/courses?page=2` });
    const api = await serverFor(evil);
    const { status } = await connect(api, 's1', TOKEN);
    await api.close(); await evil.close(); await elsewhere.close();
    assert.equal(status, 200);
    assert.equal(elsewhere.requests.length, 0);
  });
});
