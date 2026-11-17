import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getEventFit } from '../../src/modules/scheduling/application/use-cases/getEventFit.js';
import { eventFit, fitPicks } from '../../src/modules/scheduling/domain/services/eventFit.js';
import { golden, makeDeps, MOCK_EVENTS } from '../helpers.js';

const TYPES = ['recruiting', 'relax', 'general'];

describe('event fit for the 3D heatmap (matches the add/ implementation)', () => {
  for (const [scenario, mockEvents] of [['base', undefined], ['withMocks', MOCK_EVENTS]]) {
    for (const [aud, byType] of Object.entries(golden.eventFit[scenario])) {
      it(`${scenario}, audience ${aud}: every day's fit and the picks, for every event type`, () => {
        const deps = makeDeps(scenario === 'base' ? 'base' : 'full');
        for (const type of TYPES) {
          const r = getEventFit(deps, { type, audience: aud, mockEvents });
          assert.deepEqual(JSON.parse(JSON.stringify(r.days)), byType[type].fit, `${type} fit`);
          assert.deepEqual(JSON.parse(JSON.stringify(r.picks)), byType[type].picks, `${type} picks`);
        }
      });
    }
  }
});

describe('event fit rules', () => {
  const flat = (v) => Object.fromEntries(Array.from({ length: 31 }, (_, i) => [`2026-12-${String(i + 1).padStart(2, '0')}`, v(i + 1)]));

  it('weekends and days outside the window have no score and say why', () => {
    const fit = eventFit(flat(() => 30), 'recruiting', { from: '2026-12-01', to: '2026-12-18' });
    assert.deepEqual([fit['2026-12-05'].eligible, fit['2026-12-05'].score, fit['2026-12-05'].availability], [false, null, 'Only weekday dates are available for scheduling.']);
    assert.deepEqual([fit['2026-12-21'].eligible, fit['2026-12-21'].availability], [false, 'Outside the scheduling window.']);
    assert.equal(fit['2026-12-02'].eligible, true);
    assert.equal(fit['2026-12-02'].availability, '');
    assert.equal(Object.keys(fit).length, 31);
  });

  it('keeps the score between 0 and 100', () => {
    for (const type of TYPES) for (const v of [0, 100]) {
      const scores = Object.values(eventFit(flat(() => v), type, { from: '2026-12-01', to: '2026-12-31' })).filter((d) => d.eligible).map((d) => d.score);
      assert.ok(scores.every((s) => s >= 0 && s <= 100), `${type} ${v}`);
    }
  });

  it('relax fits the day before the peak, recruiting avoids it', () => {
    const intensity = flat((d) => (d === 11 ? 90 : 20));
    const range = { from: '2026-12-01', to: '2026-12-18' };
    assert.equal(fitPicks(eventFit(intensity, 'relax', range), 1)[0].date, '2026-12-09');
    assert.notEqual(fitPicks(eventFit(intensity, 'recruiting', range), 1)[0].date, '2026-12-10');
  });

  it('similar events that day cost 15 points and are mentioned', () => {
    const intensity = flat(() => 40);
    const ev = [{ start: { dateTime: '2026-12-02T18:00:00-05:00' }, host_type: 'general' }];
    const free = eventFit(intensity, 'general', {})['2026-12-02'];
    const busy = eventFit(intensity, 'general', { events: ev })['2026-12-02'];
    assert.equal(free.score - busy.score, 15);
    assert.match(busy.reason, /1 similar event is already scheduled that day/);
  });

  it('the picks are the top three eligible days by score', () => {
    const picks = fitPicks(eventFit(flat((d) => d * 3), 'recruiting', { from: '2026-12-01', to: '2026-12-18' }));
    assert.equal(picks.length, 3);
    assert.ok(picks.every((p) => p.eligible));
    assert.ok(picks[0].score >= picks[1].score && picks[1].score >= picks[2].score);
  });

  it('mock events change the fit of their day and nothing else', () => {
    const deps = makeDeps('base');
    const without = getEventFit(deps, { type: 'relax', audience: 'all' });
    const withMock = getEventFit(deps, { type: 'relax', audience: 'all', mockEvents: [{ type: 'relax', date: '2026-12-10' }] });
    assert.equal(without.days['2026-12-10'].score - withMock.days['2026-12-10'].score, 15);
    assert.equal(without.days['2026-12-09'].score, withMock.days['2026-12-09'].score);
    assert.deepEqual(without.intensity, withMock.intensity);
  });

  it('rejects a bad type, audience or mock event', () => {
    const deps = makeDeps('base');
    assert.throws(() => getEventFit(deps, { type: 'party' }), { status: 400 });
    assert.throws(() => getEventFit(deps, { type: 'relax', audience: 'major:Art' }), { status: 400 });
    assert.throws(() => getEventFit(deps, { type: 'relax', mockEvents: [{ type: 'relax', date: '2027-01-01' }] }), { status: 400 });
  });
});
