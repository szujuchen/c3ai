import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createInMemorySessionRepository } from '../../src/modules/access/infrastructure/persistence/inMemorySessionRepository.js';
import { golden, startServer } from '../helpers.js';

const login = (api, body) => api.anon('/api/auth/login', { method: 'POST', body });

describe('login', () => {
  let api;
  before(async () => { api = await startServer('base'); });
  after(() => api.close());

  it('logs in as a student (who), a host, or an admin, and says which views each may open', async () => {
    const student = await login(api, { role: 'student', studentId: 's2' });
    assert.equal(student.status, 200);
    assert.deepEqual([student.body.role, student.body.studentId, student.body.views], ['student', 's2', ['student']]);
    assert.equal(typeof student.body.token, 'string');
    assert.deepEqual((await login(api, { role: 'host' })).body.views, ['host']);
    assert.deepEqual((await login(api, { role: 'admin' })).body.views, ['student', 'host']);
  });

  it('offers the student names to choose from before logging in, and nothing else about them', async () => {
    const { status, body } = await api.anon('/api/auth/students');
    assert.equal(status, 200);
    assert.deepEqual(body.students.map((s) => s.name), ['Maya', 'Leo', 'Aisha', 'Daniel', 'Sofia']);
    assert.deepEqual(Object.keys(body.students[0]).sort(), ['id', 'major', 'name', 'year']);
  });

  it('rejects an unknown role, and a student without a valid student', async () => {
    assert.equal((await login(api, { role: 'wizard' })).status, 400);
    assert.equal((await login(api, { role: 'student' })).status, 400);
    assert.equal((await login(api, { role: 'student', studentId: 'nobody' })).status, 400);
    assert.equal((await login(api, {})).status, 400);
  });

  it('knows who you are, and logging out ends the session', async () => {
    const { body: { token } } = await login(api, { role: 'host' });
    const me = (path, init) => fetch(api.base + path, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }).then(async (r) => ({ status: r.status, body: await r.json() }));
    assert.deepEqual((await me('/api/auth/me')).body, { role: 'host', studentId: null, views: ['host'] });
    assert.equal((await me('/api/auth/logout', { method: 'POST' })).status, 200);
    assert.equal((await me('/api/auth/me')).status, 401);
  });

  it('every other endpoint needs a session', async () => {
    for (const path of ['/api/term', '/api/students', '/api/intensity', '/api/campus/events', '/api/students/s1/workload']) {
      const r = await api.anon(path);
      assert.equal(r.status, 401, path);
      assert.equal(r.body.error.message, 'Log in first');
    }
    assert.equal((await api.anon('/api/term', { headers: {} })).status, 401);
    assert.equal((await fetch(`${api.base}/api/term`, { headers: { Authorization: 'Bearer not-a-real-token' } })).status, 401);
    assert.equal((await api.anon('/api/health')).status, 200);
  });
});

describe('role passwords', () => {
  let api;
  before(async () => { api = await startServer('base', { rolePasswords: { admin: 'open-sesame' } }); });
  after(() => api.close());

  it('a role with a password needs it; the others stay open', async () => {
    assert.equal((await login(api, { role: 'admin' })).status, 401);
    assert.equal((await login(api, { role: 'admin', password: 'nope' })).status, 401);
    assert.match((await login(api, { role: 'admin', password: 'wrong' })).body.error.message, /Wrong password/);
    assert.equal((await login(api, { role: 'admin', password: 'open-sesame' })).status, 200);
    assert.equal((await login(api, { role: 'host' })).status, 200);
  });
});

describe('sessions expire', () => {
  it('after their lifetime', () => {
    let now = 1000;
    const sessions = createInMemorySessionRepository({ ttlMs: 500, now: () => now });
    const { token } = sessions.create({ role: 'host' });
    assert.equal(sessions.get(token).role, 'host');
    now = 1499; assert.ok(sessions.get(token));
    now = 1500; assert.equal(sessions.get(token), null);
  });
});

describe('what each role may do', () => {
  let api, student, host, admin;
  before(async () => {
    api = await startServer('full');
    student = await api.as('student', 's1');
    host = await api.as('host');
    admin = await api.as('admin');
  });
  after(() => api.close());
  const post = (who, path, body) => who(path, { method: 'POST', body });
  const put = (who, path) => who(path, { method: 'PUT' });

  it('a student sees only their own data', async () => {
    assert.deepEqual((await student('/api/students')).body.students.map((s) => s.id), ['s1']);
    assert.deepEqual((await student('/api/canvas/courses')).body.courses.map((c) => c.id), [101, 102, 103, 104]);
    assert.ok((await student('/api/canvas/assignments')).body.assignments.every((a) => [101, 102, 103, 104].includes(a.course_id)));
    assert.deepEqual((await student('/api/calendar/events')).body.events.map((e) => e.id), ['ev1', 'ev3', 'ev5', 'ev6', 'ev7']);
    assert.equal((await student('/api/students/s1/workload?canvas=1')).status, 200);
    assert.equal((await student('/api/students/s2/workload?canvas=1')).status, 403);
    for (const path of ['/exams', '/days/2026-12-10', '/week?start=2026-12-14', '/campus-events', '/campus-events/ce1/preview']) assert.equal((await student(`/api/students/s2${path}`)).status, 403, path);
    assert.equal((await put(student, '/api/students/s2/registrations/ce1')).status, 403);
    assert.equal((await post(student, '/api/students/s2/canvas/connect', {})).status, 403);
    assert.equal((await student('/api/students/s2/canvas', { method: 'DELETE' })).status, 403);
  });

  it('a student cannot see campus-wide data or act for someone else', async () => {
    for (const path of ['/api/intensity', '/api/audiences', '/api/availability']) assert.equal((await student(path)).status, 403, path);
    assert.equal((await post(student, '/api/recommend-date', { type: 'relax' })).status, 403);
    assert.equal((await post(student, '/api/preview/crowding', {})).status, 403);
    assert.equal((await post(student, '/api/event-fit', { type: 'relax' })).status, 403);
    // Exam dates are always added as the logged-in student, whatever the request claims.
    const { status, body } = await post(student, '/api/courses/103/exams', { studentId: 's2', date: '2026-12-15' });
    assert.equal(status, 409, 'Physics already has its final in the `full` data; checked as Maya, not as Leo');
    assert.match(body.error.message, /already has an exam/);
    const leo = await post(student, '/api/courses/101/exams', { studentId: 's1', date: '2026-12-15' });
    assert.equal(leo.status, 409);
  });

  it('a host sees only campus-wide aggregates and mock events, never a student', async () => {
    assert.equal((await host('/api/intensity')).status, 200);
    assert.equal((await host('/api/audiences')).status, 200);
    assert.equal((await host('/api/availability')).status, 200);
    assert.equal((await post(host, '/api/event-fit', { type: 'relax' })).status, 200);
    assert.equal((await post(host, '/api/recommend-date', { type: 'relax' })).status, 200);
    assert.equal((await post(host, '/api/preview/crowding', { mockEvents: [] })).status, 200);
    assert.equal((await host('/api/campus/events')).status, 200);
    assert.equal((await host('/api/term')).status, 200);
    for (const path of ['/api/students', '/api/canvas/courses', '/api/canvas/assignments', '/api/calendar/events', '/api/canvas/status', '/api/students/s1/workload', '/api/students/s1/week?start=2026-12-14', '/api/students/s1/exams', '/api/students/s1/campus-events']) {
      assert.equal((await host(path)).status, 403, path);
    }
    assert.equal((await put(host, '/api/students/s1/registrations/ce1')).status, 403);
    assert.equal((await post(host, '/api/syllabus/parse', { text: 'x' })).status, 403);
    assert.equal((await post(host, '/api/courses/103/exams', { studentId: 's1', date: '2026-12-15' })).status, 403);
    const intensity = (await host('/api/intensity')).body;
    assert.deepEqual(Object.keys(intensity).sort(), ['intensity', 'studentCount']);
  });

  it('an admin can use everything', async () => {
    assert.equal((await admin('/api/students')).body.students.length, 5);
    assert.equal((await admin('/api/students/s4/workload?canvas=1')).status, 200);
    assert.equal((await admin('/api/intensity')).status, 200);
    assert.equal((await post(admin, '/api/preview/crowding', { mockEvents: [] })).status, 200);
    assert.equal((await put(admin, '/api/students/s3/registrations/ce1')).status, 200);
    assert.equal((await admin('/api/students/nobody/workload')).status, 404);
  });

  it('a student registering only affects themselves, and a host never sees who registered', async () => {
    await put(student, '/api/students/s1/registrations/ce5');
    assert.equal((await student('/api/students/s1/campus-events?canvas=1')).body.events.find((e) => e.id === 'ce5').registered, true);
    assert.ok(!JSON.stringify((await host('/api/intensity')).body).includes('s1'));
  });

  it('403 and 401 are JSON errors with a code', async () => {
    const r = await host('/api/students');
    assert.deepEqual([r.status, r.body.error.code], [403, 'forbidden']);
    assert.deepEqual([(await api.anon('/api/students')).body.error.code], ['unauthorized']);
    assert.ok(golden);
  });
});
