import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { previewCampusEvent } from '../../src/modules/workload/application/use-cases/previewCampusEvent.js';
import { getStudentWorkload } from '../../src/modules/workload/application/use-cases/getStudentWorkload.js';
import { setRegistration } from '../../src/modules/academics/application/use-cases/setRegistration.js';
import { makeDeps } from '../helpers.js';

const both = { canvas: true, gcal: true };

describe('previewing a campus event before adding it', () => {
  it('shows the day with and without the event, and matches what registering really does', () => {
    const deps = makeDeps('full');
    const p = previewCampusEvent(deps, 's1', 'ce1', both); // Career fair, Dec 3, 4 h, not registered by Maya
    assert.equal(p.date, '2026-12-03');
    assert.equal(p.registered, false);
    assert.equal(p.counted, true);
    assert.equal(p.addedHours, 4);
    assert.equal(Math.round((p.hoursAfter - p.hoursBefore) * 10) / 10, 4);

    const before = getStudentWorkload(deps, 's1', both).load['2026-12-03'];
    setRegistration(deps, 's1', 'ce1', true);
    assert.equal(getStudentWorkload(deps, 's1', both).load['2026-12-03'], p.hoursAfter);
    assert.equal(before, p.hoursBefore);
  });

  it('does not register the student, and does not change anything', () => {
    const deps = makeDeps('base');
    previewCampusEvent(deps, 's1', 'ce1', both);
    assert.deepEqual(deps.registrations.forStudent('s1'), []);
  });

  it('for an event already registered, "before" is the day without it', () => {
    const p = previewCampusEvent(makeDeps('full'), 's1', 'ce3', both); // registered in the `full` variant
    assert.equal(p.registered, true);
    assert.ok(p.hoursAfter > p.hoursBefore);
    assert.equal(p.addedHours, 1);
  });

  it('a relax event adds no workload', () => {
    const p = previewCampusEvent(makeDeps('base'), 's1', 'ce4', both);
    assert.equal(p.addedHours, 0);
    assert.equal(p.hoursBefore, p.hoursAfter);
  });

  it('reports the cap, the levels and the stress change', () => {
    const p = previewCampusEvent(makeDeps('full'), 's1', 'ce3', both);
    assert.equal(p.cap, 6);
    assert.ok(p.levelAfter >= p.levelBefore);
    assert.ok(p.stressAfter.score >= p.stressBefore.score);
    assert.ok(['low', 'watch', 'high', 'critical'].includes(p.stressAfter.level));
  });

  it('works without Google Calendar connected, because campus events always count', () => {
    const p = previewCampusEvent(makeDeps('base'), 's1', 'ce1', { canvas: true, gcal: false });
    assert.equal(p.counted, true);
    assert.equal(p.addedHours, 4);
  });

  it('rejects unknown events and students', () => {
    assert.throws(() => previewCampusEvent(makeDeps('base'), 's1', 'nope', both), { status: 404 });
    assert.throws(() => previewCampusEvent(makeDeps('base'), 'nobody', 'ce1', both), { status: 404 });
  });
});
