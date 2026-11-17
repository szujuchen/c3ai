import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { addDays, monthKeys } from '../../src/shared/dateKeys.js';
import { getCampusEvents } from '../../src/modules/workload/application/use-cases/getCampusEvents.js';
import { getDayDetail } from '../../src/modules/workload/application/use-cases/getDayDetail.js';
import { getStudentWorkload } from '../../src/modules/workload/application/use-cases/getStudentWorkload.js';
import { burnoutAdvice, dayTip } from '../../src/modules/workload/domain/services/advice.js';
import { burnoutAlert } from '../../src/modules/workload/domain/services/burnoutDetector.js';
import { eventNote } from '../../src/modules/workload/domain/services/campusEventNotes.js';
import { dailyLoad, dayItems, level } from '../../src/modules/workload/domain/services/workloadCalculator.js';
import { academics, golden, makeDeps, term, VARIANTS } from '../helpers.js';

const sources = { 'canvas+gcal': { canvas: true, gcal: true }, canvas: { canvas: true, gcal: false }, gcal: { canvas: false, gcal: true } };

describe('workload (matches the original implementation)', () => {
  for (const variant of VARIANTS) {
    const deps = makeDeps(variant);
    for (const student of academics.students()) {
      // With registrations, campus events now count even without Google Calendar, so only compare the combos
      // where that makes no difference.
      for (const [name, src] of Object.entries(sources).filter(([n]) => variant === 'base' || n !== 'canvas')) {
        it(`[${variant}] ${student.name} with ${name}: load, alert, advice and campus event notes`, () => {
          const expected = golden.variants[variant].students[student.id][name];
          const w = getStudentWorkload(deps, student.id, src);
          assert.deepEqual(w.load, expected.load);
          assert.deepEqual(w.alert, expected.alert);
          if (!w.alert) assert.equal(expected.advice, null);
          else {
            assert.deepEqual({
              biggestId: w.advice.startAssignment?.assignment.id ?? null,
              biggestHours: w.advice.startAssignment?.hours ?? null,
              optionalIds: w.advice.optionalEvents.map((e) => e.id),
              relaxIds: w.advice.relaxEvents.map((e) => e.id),
            }, expected.advice);
          }
          const feed = getCampusEvents(deps, student.id, src).events;
          assert.deepEqual(feed.map((e) => ({ id: e.id, registered: e.registered, hours: e.hours, note: e.note })), expected.campusEvents);
        });
      }

      it(`[${variant}] ${student.name}: every day's items, level and tip`, () => {
        for (const [day, expected] of Object.entries(golden.variants[variant].students[student.id]['canvas+gcal'].days)) {
          const d = getDayDetail(deps, student.id, day, sources['canvas+gcal']);
          assert.deepEqual({
            hours: d.hours,
            level: d.level,
            dueIds: d.due.map((x) => x.id),
            work: d.work.map((w) => [w.assignment.id, w.hours]),
            eventIds: d.events.map((e) => e.id),
            tip: d.tip && (d.tip.type === 'move' ? { type: 'move', assignmentId: d.tip.assignment.id, hours: d.tip.hours, date: d.tip.date } : d.tip),
          }, expected, `${variant} ${student.id} ${day}`);
        }
      });
    }
  }
});

describe('workload rules', () => {
  const student = { course_ids: [1], event_ids: [], daily_cap_h: 6 };

  it('spreads an exam over its 4 lead days and a project over 5', () => {
    const exam = { id: 1, course_id: 1, type: 'final', due_at: '2026-12-10T09:00:00-05:00', effort_h: 12 };
    const project = { id: 2, course_id: 1, type: 'project', due_at: '2026-12-10T23:59:00-05:00', effort_h: 15 };
    const days = (a) => monthKeys('2026-12-01', 31).filter((d) => dayItems(student, [a], [], d).work.length);
    assert.deepEqual(days(exam), ['2026-12-06', '2026-12-07', '2026-12-08', '2026-12-09']);
    assert.deepEqual(days(project), ['2026-12-05', '2026-12-06', '2026-12-07', '2026-12-08', '2026-12-09']);
    assert.equal(dayItems(student, [exam], [], '2026-12-09').work[0].hours, 3);
  });

  it('falls back to 3 lead days for an unknown assignment type', () => {
    const odd = { id: 3, course_id: 1, type: 'seminar', due_at: '2026-12-10T09:00:00-05:00', effort_h: 6 };
    assert.equal(dayItems(student, [odd], [], '2026-12-07').work[0].hours, 2);
    assert.equal(dayItems(student, [odd], [], '2026-12-06').work.length, 0);
  });

  it('ignores assignments from courses the student is not in', () => {
    const other = { id: 4, course_id: 99, type: 'homework', due_at: '2026-12-10T09:00:00-05:00', effort_h: 6 };
    assert.equal(dayItems(student, [other], [], '2026-12-09').work.length, 0);
  });

  it('levels: green under 60% of cap, yellow above it, red at the cap', () => {
    assert.deepEqual([3.5, 3.7, 5.9, 6].map((h) => level(h, 6)), [0, 1, 1, 2]);
  });

  it('events add their hours to the day, but relax events are breaks and add none', () => {
    const s = { course_ids: [], event_ids: ['a', 'b'], daily_cap_h: 6 };
    const ev = (id, type) => ({ id, host_type: type, start: { dateTime: '2026-12-02T18:00:00-05:00' }, end: { dateTime: '2026-12-02T20:00:00-05:00' } });
    const load = dailyLoad(s, [], [ev('a', 'recruiting'), ev('b', 'relax')], '2026-12-01', 3);
    assert.equal(load['2026-12-02'], 2);
    assert.equal(dayItems(s, [], [ev('b', 'relax')], '2026-12-02').events.length, 1);
  });

  it('burnout needs 3+ days at or over the cap, High until 4 days or 1.5x the cap', () => {
    const load = (hours) => Object.fromEntries(hours.map((h, i) => [addDays('2026-12-01', i), h]));
    assert.equal(burnoutAlert(load([6, 6, 1, 6, 6]), 6), null);
    assert.equal(burnoutAlert(load([6, 7, 6]), 6).level, 'High');
    assert.equal(burnoutAlert(load([6, 6, 6, 6]), 6).level, 'Critical');
    assert.equal(burnoutAlert(load([6, 9.5, 6]), 6).level, 'Critical');
    assert.deepEqual(burnoutAlert(load([1, 6, 6, 6, 1, 7, 7, 7, 7]), 6).days, ['2026-12-02', '2026-12-03', '2026-12-04']);
  });

  it('says there is no room when no earlier day is light enough', () => {
    const heavy = { course_ids: [1], event_ids: [], daily_cap_h: 6 };
    const a = { id: 5, course_id: 1, type: 'homework', due_at: '2026-12-02T09:00:00-05:00', effort_h: 18 };
    const load = dailyLoad(heavy, [a], [], term.start, term.days);
    assert.equal(level(load['2026-12-01'], 6), 2);
    assert.deepEqual(dayTip(heavy, [a], [], load, '2026-12-01', term.start), { type: 'no-room' });
  });

  it('suggests at most 2 breaks', () => {
    const s = { course_ids: [], event_ids: [], daily_cap_h: 6 };
    const relax = (id, d) => ({ id, host_type: 'relax', start: { dateTime: `${d}T18:00:00-05:00` }, end: { dateTime: `${d}T19:00:00-05:00` } });
    const all = [relax('r1', '2026-12-09'), relax('r2', '2026-12-10'), relax('r3', '2026-12-11')];
    const alert = { start: '2026-12-11', end: '2026-12-13', days: ['2026-12-11', '2026-12-12', '2026-12-13'] };
    assert.deepEqual(burnoutAdvice(s, [], [], all, alert).relaxEvents.map((e) => e.id), ['r1', 'r2']);
  });
});

describe('campus event notes', () => {
  const student = { event_ids: [], daily_cap_h: 6 };
  const ev = (type, day = '2026-12-10', hours = 1) => ({ id: 'x', host_type: type, start: { dateTime: `${day}T18:00:00-05:00` }, end: { dateTime: `${day}T${18 + hours}:00:00-05:00` } });
  const alert = { start: '2026-12-11', end: '2026-12-13' };

  it('recommends a relax event during or 2 days before a crunch, and on any over-cap day', () => {
    assert.deepEqual(eventNote(student, ev('relax', '2026-12-09'), {}, alert), { type: 'recommended-break' });
    assert.deepEqual(eventNote(student, ev('relax', '2026-12-13'), {}, alert), { type: 'recommended-break' });
    assert.equal(eventNote(student, ev('relax', '2026-12-08'), {}, alert), null);
    assert.deepEqual(eventNote(student, ev('relax'), { '2026-12-10': 7 }, null), { type: 'recommended-break' });
  });

  it('warns about a heavy day, or a day it would push over the cap', () => {
    assert.deepEqual(eventNote(student, ev('recruiting'), { '2026-12-10': 7 }, null), { type: 'heavy-day', hours: 7 });
    assert.deepEqual(eventNote(student, ev('general', '2026-12-10', 2), { '2026-12-10': 4 }, null), { type: 'over-cap' });
    assert.equal(eventNote(student, ev('general', '2026-12-10', 1), { '2026-12-10': 4 }, null), null);
  });

  it('does not warn "over cap" for an event already registered', () => {
    const registered = { ...student, event_ids: ['x'] };
    assert.equal(eventNote(registered, ev('general', '2026-12-10', 2), { '2026-12-10': 4 }, null), null);
  });
});
