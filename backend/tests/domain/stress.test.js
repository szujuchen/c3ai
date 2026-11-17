import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getDayDetail } from '../../src/modules/workload/application/use-cases/getDayDetail.js';
import { getStudentWorkload } from '../../src/modules/workload/application/use-cases/getStudentWorkload.js';
import { stressByDay, stressLevel } from '../../src/modules/workload/domain/services/stress.js';
import { dailyLoad, dailyLoadBreakdown } from '../../src/modules/workload/domain/services/workloadCalculator.js';
import { academics, makeDeps, term } from '../helpers.js';

const student = { course_ids: [1], event_ids: [], daily_cap_h: 6 };
const days = (hours) => Object.fromEntries(hours.map((h, i) => [`2026-12-${String(i + 1).padStart(2, '0')}`, h]));

describe('stress level', () => {
  it('has the design doc levels: watch 60, high 75, critical 90', () => {
    assert.deepEqual([0, 59, 60, 74, 75, 89, 90, 100].map(stressLevel), ['low', 'low', 'watch', 'watch', 'high', 'high', 'critical', 'critical']);
  });

  it('an ordinary week (about 4 h a day against a 6 h cap) lands near 30', () => {
    const { byDay } = stressByDay(days([4, 4, 4, 4, 4, 4, 4]), student, []);
    assert.ok(byDay['2026-12-04'].score >= 25 && byDay['2026-12-04'].score <= 35, `got ${byDay['2026-12-04'].score}`);
    assert.equal(byDay['2026-12-04'].level, 'low');
  });

  it('a crunch (days over the cap in a row, with deadlines) climbs into high and critical', () => {
    const due = [1, 2, 3].map((n) => ({ course_id: 1, due_at: `2026-12-0${5 + n}T10:00:00-05:00` }));
    const { byDay, peak } = stressByDay(days([3, 4, 8, 9, 9, 9, 9, 3]), student, due);
    assert.ok(byDay['2026-12-01'].score < byDay['2026-12-05'].score && byDay['2026-12-05'].score <= byDay['2026-12-06'].score);
    assert.ok(peak.score >= 90 && peak.level === 'critical', JSON.stringify(peak));
  });

  it('rises with the streak of over-cap days, and with upcoming deadlines', () => {
    const calm = stressByDay(days([7, 3, 3, 3]), student, []).byDay['2026-12-04'].score;
    const streak = stressByDay(days([7, 7, 7, 7]), student, []).byDay['2026-12-04'].score;
    const deadlines = stressByDay(days([7, 3, 3, 3]), student, [1, 2, 3].map(() => ({ course_ids: [1], course_id: 1, due_at: '2026-12-04T10:00:00-05:00' }))).byDay['2026-12-04'].score;
    assert.ok(streak > calm);
    assert.ok(deadlines > calm);
  });

  it('a lower mood raises it; only the student\'s own courses\' deadlines count', () => {
    const base = stressByDay(days([6, 6, 6]), student, []).byDay['2026-12-03'].score;
    assert.ok(stressByDay(days([6, 6, 6]), student, [], 1).byDay['2026-12-03'].score > base);
    assert.ok(stressByDay(days([6, 6, 6]), student, [], 5).byDay['2026-12-03'].score < base);
    const others = [{ course_id: 99, due_at: '2026-12-03T10:00:00-05:00' }, { course_id: 99, due_at: '2026-12-03T11:00:00-05:00' }];
    assert.equal(stressByDay(days([6, 6, 6]), student, others).byDay['2026-12-03'].score, base);
  });

  it('is reported with the workload: a score per day and the peak day', () => {
    const w = getStudentWorkload(makeDeps('full'), 's1', { canvas: true, gcal: true });
    assert.equal(Object.keys(w.days).length, 31);
    assert.ok(Object.values(w.days).every((d) => d.stress.score >= 0 && d.stress.score <= 100));
    assert.equal(w.stress.score, Math.max(...Object.values(w.days).map((d) => d.stress.score)));
    assert.ok(['2026-12-13', '2026-12-14', '2026-12-15', '2026-12-16'].includes(w.stress.date), w.stress.date);
    assert.ok(['high', 'critical'].includes(w.stress.level));
    assert.deepEqual(getDayDetail(makeDeps('full'), 's1', w.stress.date, { canvas: true, gcal: true }).stress, w.days[w.stress.date].stress);
  });

  it('is low for a student who has connected nothing', () => {
    const w = getStudentWorkload(makeDeps('base'), 's1', { canvas: false, gcal: false });
    assert.equal(w.stress.level, 'low');
  });
});

describe('heat split into events and coursework', () => {
  const ev = (id, type, hours) => ({ id, host_type: type, start: { dateTime: '2026-12-02T18:00:00-05:00' }, end: { dateTime: `2026-12-02T${18 + hours}:00:00-05:00` } });
  const hw = { id: 1, course_id: 1, type: 'homework', due_at: '2026-12-03T10:00:00-05:00', effort_h: 3 };

  it('splits each day into coursework hours and event hours that add up to the day', () => {
    const s = { course_ids: [1], event_ids: ['a', 'r'], daily_cap_h: 6 };
    const events = [ev('a', 'recruiting', 2), ev('r', 'relax', 3)];
    const parts = dailyLoadBreakdown(s, [hw], events, '2026-12-01', 4);
    assert.deepEqual(parts['2026-12-02'], { work: 1, events: 2 }); // the relax event is a break
    const load = dailyLoad(s, [hw], events, '2026-12-01', 4);
    for (const k of Object.keys(load)) assert.equal(Math.round((parts[k].work + parts[k].events) * 10) / 10, load[k]);
  });

  it('is in the workload and day responses', () => {
    const deps = makeDeps('full');
    const w = getStudentWorkload(deps, 's1', { canvas: true, gcal: true });
    for (const d of Object.values(w.days)) assert.equal(Math.round((d.workHours + d.eventHours) * 10) / 10, d.hours);
    assert.ok(w.days['2026-12-12'].eventHours > 0, 'registered Jane Street session');
    const day = getDayDetail(deps, 's1', '2026-12-12', { canvas: true, gcal: true });
    assert.deepEqual([day.workHours, day.eventHours], [w.days['2026-12-12'].workHours, w.days['2026-12-12'].eventHours]);
  });

  it('students without events have only coursework heat', () => {
    const w = getStudentWorkload(makeDeps('base'), 's3', { canvas: true, gcal: false });
    assert.ok(Object.values(w.days).every((d) => d.eventHours === 0));
    assert.ok(academics.student('s3'));
  });
});
