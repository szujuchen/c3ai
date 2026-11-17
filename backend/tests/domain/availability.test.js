import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getAudiences } from '../../src/modules/scheduling/application/use-cases/getAudiences.js';
import { getAvailability } from '../../src/modules/scheduling/application/use-cases/getAvailability.js';
import { freeChance, SLOTS, slotSummary } from '../../src/modules/scheduling/domain/services/availability.js';
import { academics, makeDeps } from '../helpers.js';

const free = (over) => freeChance({ slotIndex: 5, date: '2026-12-09', blocks: [], loadHours: 0, afterFinals: false, ...over }); // Wed 6-8 PM

describe('how likely a student is to be free', () => {
  it('has seven 2-hour slots from 8 AM to 10 PM', () => {
    assert.deepEqual(SLOTS.map((s) => [s.startHour, s.endHour]), [[8, 10], [10, 12], [12, 14], [14, 16], [16, 18], [18, 20], [20, 22]]);
  });
  it('is zero when a class, event or exam covers the slot for at least 30 minutes', () => {
    assert.equal(free({ blocks: [{ startMin: 18 * 60, endMin: 19 * 60 }] }), 0);
    assert.equal(free({ blocks: [{ startMin: 19 * 60 + 30, endMin: 21 * 60 }] }), 0);
    assert.ok(free({ blocks: [{ startMin: 19 * 60 + 45, endMin: 21 * 60 }] }) > 0, 'a 15 minute overlap does not count');
    assert.ok(free({ blocks: [{ startMin: 10 * 60, endMin: 11 * 60 }] }) > 0, 'a class in another slot');
  });
  it('is lower on weekend mornings than weekday mornings', () => {
    assert.ok(free({ slotIndex: 0, date: '2026-12-12' }) < free({ slotIndex: 0, date: '2026-12-09' }));
    assert.equal(free({ slotIndex: 5, date: '2026-12-12' }), free({ slotIndex: 5, date: '2026-12-09' }), 'evenings are the same');
  });
  it('drops as the day fills with work, by half at about 10 hours', () => {
    const none = free({ loadHours: 0 });
    assert.ok(Math.abs(free({ loadHours: 10 }) - none / 2) < 1e-9);
    assert.ok(Math.abs(free({ loadHours: 25 }) - none / 2) < 1e-9, 'capped at half');
    assert.ok(free({ loadHours: 5 }) < none && free({ loadHours: 5 }) > none / 2);
  });
  it('is 15% after finals, whatever else is going on', () => {
    assert.ok(Math.abs(free({ afterFinals: true, loadHours: 12 }) - 0.15) < 1e-9);
  });
});

describe('what a slot shows', () => {
  it('availability is the audience average, turnout is the expected free students times the share who attend', () => {
    const s = slotSummary([[0, 0, 0, 0, 0, 0.5, 0], [0, 0, 0, 0, 0, 0.5, 0], [0, 0, 0, 0, 0, 0.5, 0], [0, 0, 0, 0, 0, 0.5, 0]], 5, '2026-12-09');
    assert.deepEqual(s, { startHour: 18, endHour: 20, availability: 50, turnout: 0.6 }); // 4 x 0.5 x 30%
  });
  it('weekend turnout is 85% of the weekday figure', () => {
    const chances = [Array(7).fill(1), Array(7).fill(1)];
    assert.equal(slotSummary(chances, 5, '2026-12-09').turnout, 0.6);
    assert.equal(slotSummary(chances, 5, '2026-12-12').turnout, 0.5);
  });
  it('an empty audience has no availability', () => {
    assert.equal(slotSummary([], 3, '2026-12-09').availability, 0);
  });
});

describe('availability for an audience and date range', () => {
  const deps = makeDeps('base');
  const slot = (a, date, hour) => a.days.find((d) => d.date === date).slots.find((s) => s.startHour === hour);

  it('covers every day in the range, with seven slots each, a campus stress figure, and a ranked top ten', () => {
    const a = getAvailability(deps, { audience: 'all', from: '2026-12-07', to: '2026-12-13' });
    assert.deepEqual([a.days.length, a.slotCount, a.studentCount], [7, 49, 5]);
    assert.ok(a.days.every((d) => d.slots.length === 7 && d.stress >= 0 && d.stress <= 100));
    assert.equal(a.top.length, 10);
    assert.deepEqual(a.best, a.top[0]);
    for (let i = 1; i < a.top.length; i++) assert.ok(a.top[i - 1].turnout >= a.top[i].turnout);
    assert.equal(a.average, Math.round(a.days.flatMap((d) => d.slots).reduce((n, s) => n + s.availability, 0) / 49));
  });

  it("is zero when the whole audience has a class then, and not on a day without one", () => {
    const a = getAvailability(deps, { audience: 'course:101', from: '2026-12-07', to: '2026-12-08' });
    assert.equal(slot(a, '2026-12-07', 10).availability, 0, 'Monday 10:00 class');
    assert.ok(slot(a, '2026-12-08', 10).availability > 0, 'Tuesday has none');
  });

  it('is low after finals end (break)', () => {
    const a = getAvailability(deps, { audience: 'all', from: '2026-12-19', to: '2026-12-20' });
    assert.ok(a.days.every((d) => d.afterFinals && d.slots.every((s) => s.availability === 15)));
  });

  it('can target everyone, a major, a class year or a course', () => {
    const n = (audience) => getAvailability(deps, { audience, from: '2026-12-07', to: '2026-12-07' }).studentCount;
    assert.deepEqual(['all', 'major:CS', 'CS', 'major:ECE', 'year:3', 'year:2', 'course:103', 'course:101'].map(n), [5, 3, 3, 1, 4, 1, 4, 3]);
  });

  it('defaults to two weeks from the start of the term', () => {
    const a = getAvailability(deps, {});
    assert.deepEqual([a.from, a.to, a.days.length], ['2026-12-01', '2026-12-14', 14]);
  });

  it('rejects a bad range or audience', () => {
    const bad = (args) => assert.throws(() => getAvailability(deps, args), { status: 400 });
    bad({ from: '2026-12-10', to: '2026-12-05' });
    bad({ from: 'soon' });
    bad({ from: '2026-11-01', to: '2026-12-05' });
    bad({ from: '2026-12-01', to: '2027-01-05' });
    bad({ audience: 'major:Art' });
    bad({ audience: 'year:9' });
    bad({ audience: 'course:999' });
    bad({ audience: 'wizards:all' });
  });

  it('returns aggregates only', () => {
    assert.ok(!/Maya|Leo|Aisha|s1|HW 9/.test(JSON.stringify(getAvailability(deps, {}))));
  });
});

describe('what a host can target', () => {
  it('lists majors, class years and courses with counts', () => {
    const a = getAudiences({ academics });
    assert.deepEqual(a.years, [{ year: 2, count: 1 }, { year: 3, count: 4 }]);
    assert.deepEqual(a.courses.map((c) => [c.id, c.code, c.count]), [[101, '15-122', 3], [102, '21-241', 4], [103, '33-141', 4], [104, '76-101', 3]]);
  });
});
