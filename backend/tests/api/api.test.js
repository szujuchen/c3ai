import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { academics, golden, startServer } from '../helpers.js';

const put = (api, path) => api.call(path, { method: 'PUT' });
const del = (api, path) => api.call(path, { method: 'DELETE' });
const post = (api, path, body) => api.call(path, { method: 'POST', body });

describe('reference data', () => {
  let api;
  before(async () => { api = await startServer(); });
  after(() => api.close());

  it('serves the term, roster and Canvas / Google Calendar / campus shaped data', async () => {
    assert.deepEqual((await api.call('/api/term')).body, { start: '2026-12-01', days: 31, end: '2026-12-18' });
    assert.equal((await api.call('/api/students')).body.students.length, 5);
    assert.equal((await api.call('/api/canvas/courses')).body.courses.length, 4);
    assert.equal((await api.call('/api/canvas/assignments')).body.assignments.length, 13);
    assert.equal((await api.call('/api/calendar/events')).body.events.length, 8);
    assert.equal((await api.call('/api/campus/events')).body.events.length, 6);
  });

  it('reports health and unknown endpoints as JSON', async () => {
    assert.deepEqual((await api.call('/api/health')).body, { status: 'ok' });
    const res = await api.call('/api/nope');
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'not_found');
  });
});

describe('student workload', () => {
  let api;
  before(async () => { api = await startServer('full'); });
  after(() => api.close());
  const qs = '?canvas=1&gcal=1';

  it("returns Maya's Critical Dec 11-15 stretch with structured advice (at most 2 breaks)", async () => {
    const { status, body } = await api.call(`/api/students/s1/workload${qs}`);
    assert.equal(status, 200);
    assert.equal(body.alert.level, 'Critical');
    assert.deepEqual([body.alert.start, body.alert.end, body.alert.peak], ['2026-12-11', '2026-12-15', golden.variants.full.students.s1['canvas+gcal'].alert.peak]);
    assert.equal(body.advice.startAssignment.assignment.id, 5004);
    assert.deepEqual(body.advice.optionalEvents.map((e) => e.id), ['ev6', 'ce3']);
    assert.deepEqual(body.advice.relaxEvents.map((e) => e.id), ['ev5', 'ce4']);
    assert.equal(Object.keys(body.days).length, 31);
  });

  it('matches the original implementation for every student and source combination', async () => {
    for (const s of academics.students()) {
      // Registered campus events now count without Google Calendar, so the canvas-only case differs from the original.
      for (const [name, q] of [['canvas+gcal', '?canvas=1&gcal=1'], ['gcal', '?gcal=1']]) {
        const { body } = await api.call(`/api/students/${s.id}/workload${q}`);
        const expected = golden.variants.full.students[s.id][name];
        assert.deepEqual(body.load, expected.load, `${s.id} ${name}`);
        assert.deepEqual(body.alert, expected.alert, `${s.id} ${name}`);
      }
    }
  });

  it('returns a day with its due items, study plan and a tip', async () => {
    const { status, body } = await api.call(`/api/students/s1/days/2026-12-15${qs}`);
    assert.equal(status, 200);
    assert.equal(body.level, 2);
    assert.deepEqual(body.due.map((a) => a.id).sort(), golden.variants.full.students.s1['canvas+gcal'].days['2026-12-15'].dueIds.sort());
    assert.equal(body.tip.type, golden.variants.full.students.s1['canvas+gcal'].days['2026-12-15'].tip.type);
  });

  it('lists campus events with how each fits the student, and whether they registered', async () => {
    const { body } = await api.call(`/api/students/s1/campus-events${qs}`);
    assert.deepEqual(body.events.map((e) => [e.id, e.registered, e.note?.type ?? null]), golden.variants.full.students.s1['canvas+gcal'].campusEvents.map((e) => [e.id, e.registered, e.note?.type ?? null]));
    assert.equal(body.events.find((e) => e.id === 'ce3').host, 'Jane Street');
  });

  it('rejects unknown students and bad dates', async () => {
    assert.equal((await api.call('/api/students/nobody/workload')).status, 404);
    assert.equal((await api.call('/api/students/nobody/campus-events')).status, 404);
    assert.equal((await api.call('/api/students/s1/days/2026-12-15x')).status, 400);
    assert.equal((await api.call('/api/students/s1/days/2027-01-05')).status, 400);
  });
});

describe('missing exam dates and syllabus upload', () => {
  let api;
  before(async () => { api = await startServer('base'); });
  after(() => api.close());
  const sample = golden.parseCases[0].text;

  it('Maya is "On track" until the Physics final is added', async () => {
    assert.equal((await api.call('/api/students/s1/workload?canvas=1&gcal=1')).body.alert, null);
    assert.deepEqual((await api.call('/api/students/s1/exams?canvas=1')).body, { missingCourseIds: [103, 104], added: [] });
    assert.deepEqual((await api.call('/api/students/s1/exams')).body.missingCourseIds, []);
  });

  it('parses the sample syllabus, then shares the confirmed exam with the whole course', async () => {
    const parsed = (await post(api, '/api/syllabus/parse', { text: sample })).body.exam;
    assert.deepEqual([parsed.type, parsed.date, parsed.time], ['final', '2026-12-15', '10:00']);
    assert.equal((await post(api, '/api/syllabus/parse', { text: 'no dates here' })).body.exam, null);

    const created = await post(api, '/api/courses/103/exams', { studentId: 's1', type: parsed.type, date: parsed.date, time: parsed.time });
    assert.equal(created.status, 201);
    assert.equal(created.body.sharedWith, 4);
    assert.equal(created.body.exam.added_by, 'Maya');

    const maya = (await api.call('/api/students/s1/workload?canvas=1&gcal=1')).body;
    assert.equal(maya.alert.level, 'Critical');
    assert.deepEqual((await api.call('/api/students/s5/exams?canvas=1')).body.added.map((e) => e.id), [9000]);
    assert.deepEqual((await api.call('/api/students/s1/exams?canvas=1')).body.missingCourseIds, [104]);
    assert.ok((await api.call('/api/intensity')).body.intensity['2026-12-14'] > golden.variants.base.campus.all.intensity['2026-12-14']);
  });

  it('refuses outsiders, duplicates and bad input', async () => {
    assert.equal((await post(api, '/api/courses/103/exams', { studentId: 's2', date: '2026-12-15' })).status, 403);
    assert.equal((await post(api, '/api/courses/103/exams', { studentId: 's1', date: '2026-12-16' })).status, 409);
    assert.equal((await post(api, '/api/courses/104/exams', { studentId: 's1' })).status, 400);
    assert.equal((await post(api, '/api/courses/999/exams', { studentId: 's1', date: '2026-12-16' })).status, 404);
    assert.equal((await post(api, '/api/syllabus/parse', { text: 7 })).status, 400);
  });
});

describe('campus event registration', () => {
  let api;
  before(async () => { api = await startServer('base'); });
  after(() => api.close());

  it('registers, shows up in the student\'s calendar and the host heatmap, and unregisters', async () => {
    const before = (await api.call('/api/students/s1/workload?canvas=1&gcal=1')).body.load['2026-12-12'];
    const intensityBefore = (await api.call('/api/intensity')).body.intensity['2026-12-12'];

    assert.deepEqual((await put(api, '/api/students/s1/registrations/ce3')).body, { eventId: 'ce3', registered: true, date: '2026-12-12' });
    const after = (await api.call('/api/students/s1/workload?canvas=1&gcal=1')).body;
    assert.equal(after.load['2026-12-12'], Math.round((before + 1) * 10) / 10);
    assert.equal(after.days['2026-12-12'].eventCount, 1);
    assert.ok((await api.call('/api/intensity')).body.intensity['2026-12-12'] > intensityBefore);
    assert.equal((await api.call('/api/students/s1/campus-events?canvas=1&gcal=1')).body.events.find((e) => e.id === 'ce3').registered, true);

    assert.equal((await del(api, '/api/students/s1/registrations/ce3')).body.registered, false);
    assert.equal((await api.call('/api/students/s1/workload?canvas=1&gcal=1')).body.load['2026-12-12'], before);
  });

  it('rejects unknown events and students', async () => {
    assert.equal((await put(api, '/api/students/s1/registrations/nope')).status, 404);
    assert.equal((await put(api, '/api/students/nobody/registrations/ce3')).status, 404);
  });
});

describe('campus intensity and date recommendations', () => {
  let api;
  before(async () => { api = await startServer('full'); });
  after(() => api.close());

  it('returns aggregates only, for everyone or one major', async () => {
    const all = (await api.call('/api/intensity')).body;
    assert.equal(all.studentCount, 5);
    assert.deepEqual(all.intensity, golden.variants.full.campus.all.intensity);
    assert.equal((await api.call('/api/intensity?audience=ECE')).body.studentCount, 1);
    assert.equal((await api.call('/api/intensity?audience=Art')).status, 400);
    assert.ok(!JSON.stringify(all).includes('Maya'));
  });

  it('recommends the original top dates for every event type', async () => {
    for (const type of ['recruiting', 'relax', 'general']) {
      const { status, body } = await post(api, '/api/recommend-date', { type, audience: 'all' });
      assert.equal(status, 200);
      assert.deepEqual(body.picks, golden.variants.full.campus.all.picks[type], type);
    }
    assert.equal((await post(api, '/api/recommend-date', { type: 'party' })).status, 400);
  });
});

describe('mock events for hosts', () => {
  let api;
  before(async () => { api = await startServer('base'); });
  after(() => api.close());

  it('ranks dates with mock events in the way, and never stores them', async () => {
    const first = (await post(api, '/api/recommend-date', { type: 'relax', audience: 'all' })).body.picks[0];
    const withMock = (await post(api, '/api/recommend-date', { type: 'relax', audience: 'all', mockEvents: [{ type: 'relax', date: first.date }] })).body.picks;
    assert.notEqual(withMock[0].date, first.date, 'a second relax event the same day ranks lower');
    const again = withMock.find((p) => p.date === first.date);
    if (again) { assert.equal(first.score - again.score, 15); assert.match(again.reason, /1 similar event already that day/); }
    // Nothing was kept: the next request without mock events is back to the original ranking.
    assert.deepEqual((await post(api, '/api/recommend-date', { type: 'relax', audience: 'all' })).body.picks[0], first);
    assert.equal((await api.call('/api/events', { method: 'POST', body: { type: 'relax', date: first.date } })).status, 404, 'there is no way to add a real event');
  });

  it('says whether each mock event would be too crowded', async () => {
    const { status, body } = await post(api, '/api/preview/crowding', { audience: 'all', mockEvents: [{ type: 'recruiting', date: '2026-12-12' }, { type: 'relax', date: '2026-12-11' }] });
    assert.equal(status, 200);
    assert.deepEqual(body.events.map((e) => [e.type, e.date]), [['recruiting', '2026-12-12'], ['relax', '2026-12-11']]);
    assert.ok(['good', 'busy', 'too-crowded'].includes(body.events[0].verdict));
    assert.equal(body.events[0].verdict, 'too-crowded', 'the Dec 12 peak (heat 73) is too busy for a recruiting event');
    assert.equal(body.events[1].verdict, 'good', 'a break before the peak is welcome');
    assert.equal(body.intensity['2026-12-12'], golden.variants.base.campus.all.intensity['2026-12-12']);
    assert.ok(!JSON.stringify(body).includes('Maya'));
  });

  it('rejects bad input', async () => {
    assert.equal((await post(api, '/api/recommend-date', { type: 'relax', mockEvents: [{ type: 'party', date: '2026-12-10' }] })).status, 400);
    assert.equal((await post(api, '/api/preview/crowding', { mockEvents: [{ type: 'relax', date: '2026-13-40' }] })).status, 400);
    assert.equal((await post(api, '/api/preview/crowding', { mockEvents: [{ type: 'relax', date: '2027-01-10' }] })).status, 400);
    assert.equal((await post(api, '/api/preview/crowding', { mockEvents: 'x' })).status, 400);
  });

  it('lists the audiences as counts only', async () => {
    assert.deepEqual((await api.call('/api/audiences')).body.majors.map((m) => [m.major, m.count]), [['CS', 3], ['ECE', 1], ['MechE', 1]]);
  });

  it('rejects malformed JSON with a JSON error', async () => {
    const res = await fetch(`${api.base}/api/preview/crowding`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{nope' });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error.code, 'invalid_request');
  });
});

describe('POST /api/event-fit', () => {
  let api;
  before(async () => { api = await startServer('base'); });
  after(() => api.close());

  it('returns every day with its fit, the workload, and the picks', async () => {
    const { status, body } = await post(api, '/api/event-fit', { type: 'relax', audience: 'all' });
    assert.equal(status, 200);
    assert.equal(Object.keys(body.days).length, 31);
    assert.equal(body.studentCount, 5);
    assert.deepEqual(body.picks.map((p) => [p.date, p.score]), golden.eventFit.base.all.relax.picks.map((p) => [p.date, p.score]));
    assert.deepEqual(body.intensity, golden.variants.base.campus.all.intensity);
    assert.deepEqual(body.days['2026-12-12'].availability, 'Only weekday dates are available for scheduling.');
    assert.ok(!JSON.stringify(body).includes('Maya'));
  });

  it('counts mock events as clashes, and rejects bad input', async () => {
    const mocked = await post(api, '/api/event-fit', { type: 'relax', audience: 'all', mockEvents: [{ type: 'relax', date: '2026-12-10' }] });
    assert.equal(mocked.body.days['2026-12-10'].score, golden.eventFit.base.all.relax.fit['2026-12-10'].score - 15);
    assert.equal((await post(api, '/api/event-fit', { type: 'party' })).status, 400);
    assert.equal((await post(api, '/api/event-fit', { type: 'relax', audience: 'major:Art' })).status, 400);
  });
});

describe('availability and the week over the API', () => {
  let api;
  before(async () => { api = await startServer('full'); });
  after(() => api.close());

  it('GET /availability returns the slot grid for an audience and range', async () => {
    const { status, body } = await api.call('/api/availability?audience=major:CS&from=2026-12-07&to=2026-12-11');
    assert.equal(status, 200);
    assert.deepEqual([body.studentCount, body.days.length, body.top.length], [3, 5, 10]);
    assert.equal((await api.call('/api/availability?audience=major:Art')).status, 400);
    assert.equal((await api.call('/api/availability?from=2026-12-10&to=2026-12-01')).status, 400);
  });

  it('GET /students/:id/week returns the days laid out on the hours', async () => {
    const { status, body } = await api.call('/api/students/s1/week?start=2026-12-14&days=7&canvas=1');
    assert.equal(status, 200);
    assert.equal(body.days.length, 7);
    assert.ok(body.days[0].items.some((i) => i.kind === 'class'));
    assert.equal((await api.call('/api/students/s1/week?start=2026-12-14&days=3&canvas=1')).status, 400);
    assert.equal((await api.call('/api/students/s1/week?canvas=1')).status, 400);
  });
});

describe('stress, split heat and event preview over the API', () => {
  let api;
  before(async () => { api = await startServer('full'); });
  after(() => api.close());
  const q = '?canvas=1&gcal=1';

  it('the workload carries a stress level per day, a peak, and the event / coursework split', async () => {
    const { body } = await api.call(`/api/students/s1/workload${q}`);
    assert.ok(['high', 'critical'].includes(body.stress.level));
    const day = body.days['2026-12-12'];
    assert.deepEqual(Object.keys(day).sort(), ['due', 'dueCount', 'eventCount', 'eventHours', 'events', 'hours', 'level', 'stress', 'work', 'workHours']);
    assert.equal(day.events.length, day.eventCount);
    assert.equal(body.days['2026-12-15'].due.length, body.days['2026-12-15'].dueCount);
    assert.ok(body.days['2026-12-11'].work.every((w) => w.assignment && w.hours > 0));
    assert.equal(Math.round((day.workHours + day.eventHours) * 10) / 10, day.hours);
  });

  it('previews an event without registering it', async () => {
    const { status, body } = await api.call(`/api/students/s1/campus-events/ce1/preview${q}`);
    assert.equal(status, 200);
    assert.deepEqual([body.date, body.registered, body.addedHours, body.cap], ['2026-12-03', false, 4, 6]);
    assert.equal((await api.call(`/api/students/s1/campus-events${q}`)).body.events.find((e) => e.id === 'ce1').registered, false);
    assert.equal((await api.call(`/api/students/s1/campus-events/nope/preview${q}`)).status, 404);
  });

  it('campus events count toward the load even with Google Calendar left off', async () => {
    const off = (await api.call('/api/students/s1/workload?canvas=1')).body;
    assert.equal(off.days['2026-12-12'].eventCount, 1, 'the registered Jane Street session');
    assert.equal(off.days['2026-12-05'].eventCount, 0, 'but not the Google Calendar job shift');
  });
});
