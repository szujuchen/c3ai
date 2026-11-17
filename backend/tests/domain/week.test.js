import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseMeetingTimes } from '../../src/modules/academics/domain/meetingTimes.js';
import { getStudentWeek } from '../../src/modules/workload/application/use-cases/getStudentWeek.js';
import { classBlocks, placeStudyBlocks, STUDY, wallMinutes } from '../../src/modules/workload/domain/services/calendarItems.js';
import { academics, makeDeps } from '../helpers.js';

const both = { canvas: true };
const overlaps = (a, b) => a.startMin < b.endMin && b.startMin < a.endMin;

describe('class meeting times', () => {
  it('reads weekly meetings in 24-hour time, with R for Thursday', () => {
    assert.deepEqual(parseMeetingTimes('MWF 10:00-10:50'), [1, 3, 5].map((dow) => ({ dow, startMin: 600, endMin: 650 })));
    assert.deepEqual(parseMeetingTimes('TR 9:30-10:50').map((m) => [m.dow, m.startMin, m.endMin]), [[2, 570, 650], [4, 570, 650]]);
    assert.deepEqual(parseMeetingTimes('TR 14:00-15:20').map((m) => m.startMin), [840, 840]);
  });
  it('returns nothing it cannot read', () => {
    for (const bad of ['', undefined, 'by appointment', 'MWF 10:00', 'XYZ 10:00-11:00', 'MWF 11:00-10:00']) assert.deepEqual(parseMeetingTimes(bad), [], String(bad));
  });
  it('puts a class on the right days, and stops when finals end', () => {
    const s = { course_ids: [101] };
    const courses = academics.courses();
    assert.equal(classBlocks(s, courses, '2026-12-07', '2026-12-18').length, 1); // Monday
    assert.equal(classBlocks(s, courses, '2026-12-08', '2026-12-18').length, 0); // Tuesday
    assert.equal(classBlocks(s, courses, '2026-12-21', '2026-12-18').length, 0); // after finals
    assert.equal(classBlocks({ course_ids: [999] }, courses, '2026-12-07', '2026-12-18').length, 0);
  });
});

describe('placing study blocks', () => {
  const item = (id, hours) => ({ assignment: { id, name: `A${id}`, course_id: 1 }, hours });
  const busy = (startMin, endMin) => ({ startMin, endMin });

  it('splits work into blocks of at most 2 hours inside the study window', () => {
    const { blocks, unplacedMin } = placeStudyBlocks([item(1, 3)], []);
    assert.deepEqual(blocks.map((b) => [b.startMin, b.endMin]), [[780, 900], [900, 960]]);
    assert.equal(unplacedMin, 0);
    assert.ok(blocks.every((b) => b.startMin >= STUDY.windowStart && b.endMin <= STUDY.windowEnd && b.endMin - b.startMin <= STUDY.maxBlockMin));
  });

  it('never overlaps a class or event, and fits around them', () => {
    const taken = [busy(13 * 60, 14 * 60), busy(16 * 60, 17 * 60)];
    const { blocks } = placeStudyBlocks([item(1, 2), item(2, 1)], taken);
    for (const b of blocks) for (const t of taken) assert.ok(!overlaps(b, t), `${b.startMin}-${b.endMin}`);
    assert.equal(Math.round(blocks.reduce((n, b) => n + (b.endMin - b.startMin), 0)), 180);
  });

  it('does the biggest item first', () => {
    const { blocks } = placeStudyBlocks([item(1, 1), item(2, 2)], []);
    assert.equal(blocks.find((b) => b.startMin === STUDY.windowStart).assignmentId, 2);
  });

  it('reports what does not fit instead of squeezing it in', () => {
    const { blocks, unplacedMin } = placeStudyBlocks([item(1, 12)], []);
    assert.ok(blocks.length <= STUDY.maxBlocks);
    assert.ok(unplacedMin > 0);
    assert.ok(blocks.every((b) => b.endMin <= STUDY.windowEnd));
    assert.equal(blocks.reduce((n, b) => n + (b.endMin - b.startMin), 0) + unplacedMin, 720);
  });

  it('places nothing when the window is full, and nothing for no work', () => {
    assert.deepEqual(placeStudyBlocks([item(1, 1)], [busy(0, 24 * 60)]), { blocks: [], unplacedMin: 60 });
    assert.deepEqual(placeStudyBlocks([], []), { blocks: [], unplacedMin: 0 });
  });
});

describe("a student's week laid out on the hours", () => {
  const deps = makeDeps('full');
  const week = getStudentWeek(deps, 's1', { start: '2026-12-14', days: 7 }, both);
  const day = (d) => week.days.find((x) => x.date === d);
  const of = (d, kind) => day(d).items.filter((i) => i.kind === kind);

  it('has seven days, Monday to Sunday, with the days after the term marked', () => {
    assert.deepEqual(week.days.map((d) => d.date), ['2026-12-14', '2026-12-15', '2026-12-16', '2026-12-17', '2026-12-18', '2026-12-19', '2026-12-20']);
    assert.deepEqual(week.days.map((d) => d.afterFinals), [false, false, false, false, false, true, true]);
    assert.ok(week.days.every((d) => d.inTerm));
  });

  it("puts Maya's classes on their meeting times", () => {
    assert.deepEqual(of('2026-12-14', 'class').map((c) => [c.title, c.startMin, c.endMin]), [['15-122', 600, 650], ['21-241', 780, 830]]);
    assert.deepEqual(of('2026-12-15', 'class').map((c) => c.title), ['33-141', '76-101']);
    assert.equal(of('2026-12-19', 'class').length, 0);
  });

  it('puts a deadline at its due time', () => {
    const exam = of('2026-12-14', 'deadline').find((d) => d.title === 'Final Exam');
    assert.equal(exam.startMin, 8 * 60 + 30);
    const lab = of('2026-12-15', 'deadline').find((d) => d.title === 'Lab Report 9');
    assert.equal(lab.startMin, 23 * 60 + 59);
  });

  it('fits study blocks around her classes, and says how much did not fit', () => {
    for (const d of week.days) {
      const fixed = d.items.filter((i) => ['class', 'event'].includes(i.kind) && !i.relax);
      for (const b of d.items.filter((i) => i.kind === 'study')) for (const f of fixed) assert.ok(!overlaps(b, f), `${d.date} ${b.title}`);
    }
    assert.ok(day('2026-12-14').unplacedHours > 0, 'the Monday before finals is more than a day can hold');
    assert.equal(day('2026-12-17').unplacedHours, 0);
  });

  it('adds a start-studying marker on the first day of a study window, and the registered event', () => {
    const early = getStudentWeek(deps, 's1', { start: '2026-12-07', days: 7 }, both);
    const markers = early.days.flatMap((d) => d.items.filter((i) => i.kind === 'start').map((i) => [d.date, i.title]));
    assert.ok(markers.some(([, t]) => /Start studying: Final Exam/.test(t)), JSON.stringify(markers));
    assert.deepEqual(early.days.find((d) => d.date === '2026-12-12').items.filter((i) => i.kind === 'event').map((e) => e.title), ['Jane Street info session']);
  });

  it('a relax event shows but does not block study time', () => {
    const w = getStudentWeek(deps, 's1', { start: '2026-12-14', days: 7 }, both);
    const yoga = w.days[0].items.find((i) => i.kind === 'event');
    assert.equal(yoga, undefined, 'yoga is Dec 14 but Maya has not registered for it');
    const r = makeDeps('base');
    r.registrations.add('s1', 'ce5');
    const withYoga = getStudentWeek(r, 's1', { start: '2026-12-14', days: 1 }, both).days[0];
    const ev = withYoga.items.find((i) => i.kind === 'event');
    assert.deepEqual([ev.relax, ev.startMin], [true, 17 * 60 + 30]);
  });

  it('a single day, and days outside the term', () => {
    assert.equal(getStudentWeek(deps, 's1', { start: '2026-12-15', days: 1 }, both).days.length, 1);
    const edge = getStudentWeek(deps, 's1', { start: '2026-11-30', days: 7 }, both);
    assert.deepEqual([edge.days[0].inTerm, edge.days[0].items.length, edge.days[1].inTerm], [false, 0, true]);
  });

  it('rejects a bad start, a bad length, and an unknown student', () => {
    assert.throws(() => getStudentWeek(deps, 's1', { start: 'soon', days: 7 }, both), { status: 400 });
    assert.throws(() => getStudentWeek(deps, 's1', { start: '2026-12-14', days: 3 }, both), { status: 400 });
    assert.throws(() => getStudentWeek(deps, 'nobody', { start: '2026-12-14', days: 7 }, both), { status: 404 });
  });

  it('reads times straight off the string', () => {
    assert.equal(wallMinutes('2026-12-15T23:59:00-05:00'), 1439);
    assert.equal(wallMinutes('2026-12-14T08:30:00-05:00'), 510);
  });
});
