import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { crowdingVerdict } from '../../src/modules/scheduling/domain/services/crowding.js';
import { getAudiences } from '../../src/modules/scheduling/application/use-cases/getAudiences.js';
import { previewCrowding } from '../../src/modules/scheduling/application/use-cases/previewCrowding.js';
import { academics, makeDeps } from '../helpers.js';

describe('would a mock event be too crowded?', () => {
  const v = (type, intensity, sameDayEvents = 0, clashes = 0) => crowdingVerdict({ type, intensity, sameDayEvents, clashes }).verdict;

  it('a quiet day is good', () => assert.equal(v('recruiting', 20), 'good'));
  it('a busy campus makes a recruiting or general event busy, then too crowded', () => {
    assert.deepEqual([49, 50, 69, 70].map((i) => v('recruiting', i)), ['good', 'busy', 'busy', 'too-crowded']);
    assert.equal(v('general', 80), 'too-crowded');
  });
  it('other events that day crowd it, whatever the heat', () => {
    assert.deepEqual([0, 1, 2, 3].map((n) => v('recruiting', 10, n)), ['good', 'good', 'busy', 'too-crowded']);
  });
  it('a relax event wants a stressed campus, so heat never counts against it', () => {
    assert.equal(v('relax', 95), 'good');
    assert.equal(v('relax', 95, 3), 'too-crowded');
  });
  it('another event at the same time makes it busy, and two make it too crowded, whatever the heat', () => {
    assert.deepEqual([0, 1, 2].map((o) => crowdingVerdict({ type: 'recruiting', intensity: 10, sameDayEvents: 1, clashes: 0, overlapping: o }).verdict), ['good', 'busy', 'too-crowded']);
    assert.equal(crowdingVerdict({ type: 'relax', intensity: 95, sameDayEvents: 1, clashes: 0, overlapping: 1 }).verdict, 'busy');
    assert.match(crowdingVerdict({ type: 'general', intensity: 10, sameDayEvents: 2, clashes: 0, overlapping: 2 }).reason, /2 other events at the same time/);
  });

  it('explains itself', () => {
    assert.match(crowdingVerdict({ type: 'recruiting', intensity: 80, sameDayEvents: 2, clashes: 1 }).reason, /80\/100.*2 other events.*1 of the same type/);
    assert.match(crowdingVerdict({ type: 'recruiting', intensity: 10, sameDayEvents: 0, clashes: 0 }).reason, /quiet day/);
    assert.match(crowdingVerdict({ type: 'relax', intensity: 80, sameDayEvents: 0, clashes: 0 }).reason, /need a break/);
  });

  it('judges each mock event against the real heat, the campus events that day, and the other mocks', () => {
    const deps = makeDeps('base');
    const { events, intensity } = previewCrowding(deps, { audience: 'all', mockEvents: [{ type: 'recruiting', date: '2026-12-03' }, { type: 'recruiting', date: '2026-12-03' }, { type: 'relax', date: '2026-12-11' }] });
    assert.equal(events.length, 3);
    // Dec 3 has the career fair; two mocks that day see it and each other.
    assert.deepEqual(events.slice(0, 2).map((e) => [e.date, e.sameDayEvents, e.clashes]), [['2026-12-03', 2, 2], ['2026-12-03', 2, 2]]);
    assert.equal(events[0].intensity, intensity['2026-12-03']);
    assert.equal(events[0].verdict, 'busy');
    assert.equal(events[2].type, 'relax');
  });

  it('judges a mock event against what is on at its own time, not just that day', () => {
    const deps = makeDeps('base'); // the career fair runs 12 to 4 PM on Dec 3
    const at = (startHour) => previewCrowding(deps, { audience: 'all', mockEvents: [{ type: 'general', date: '2026-12-03', startHour }] }).events[0];
    assert.deepEqual([at(12).overlapping, at(14).overlapping, at(16).overlapping, at(18).overlapping], [1, 1, 0, 0]);
    assert.equal(at(12).sameDayEvents, 1);
    assert.equal(at(12).verdict, 'busy');
    assert.match(at(12).reason, /1 other event at the same time/);
    assert.equal(at(18).verdict, 'good');
    assert.equal(at(18).sameDayEvents, 1, 'still on the same day');
  });

  it('two mock events in the same slot overlap each other', () => {
    const e = previewCrowding(makeDeps('base'), { mockEvents: [{ type: 'general', date: '2026-12-22', startHour: 18 }, { type: 'recruiting', date: '2026-12-22', startHour: 18 }, { type: 'relax', date: '2026-12-22', startHour: 10 }] }).events; // Dec 22 has nothing else on
    assert.deepEqual(e.map((x) => x.overlapping), [1, 1, 0]); // each of the two sees the other; the 10 AM one overlaps nothing
  });

  it('with no mock events there is nothing to judge, but the heat is still returned', () => {
    const r = previewCrowding(makeDeps('base'), { audience: 'CS' });
    assert.deepEqual(r.events, []);
    assert.equal(r.studentCount, 3);
    assert.equal(Object.keys(r.intensity).length, 31);
  });

  it('audiences are counts only', () => {
    const a = getAudiences({ academics });
    assert.equal(a.total, 5);
    assert.deepEqual(a.majors, [{ major: 'CS', count: 3 }, { major: 'ECE', count: 1 }, { major: 'MechE', count: 1 }]);
    assert.ok(!JSON.stringify(a).includes('Maya'));
  });
});
