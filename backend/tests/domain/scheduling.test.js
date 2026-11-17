import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getIntensity } from '../../src/modules/scheduling/application/use-cases/getIntensity.js';
import { recommendDate } from '../../src/modules/scheduling/application/use-cases/recommendDate.js';
import { previewCrowding } from '../../src/modules/scheduling/application/use-cases/previewCrowding.js';
import { createMockEvent } from '../../src/modules/scheduling/domain/entities/mockEvent.js';
import { bestDates } from '../../src/modules/scheduling/domain/services/bestDateRanker.js';
import { campusIntensity } from '../../src/modules/scheduling/domain/services/campusIntensity.js';
import { golden, makeDeps, MOCK_EVENTS, VARIANTS } from '../helpers.js';

describe('scheduling (matches the original implementation)', () => {
  for (const variant of VARIANTS) {
    for (const [aud, expected] of Object.entries(golden.variants[variant].campus)) {
      it(`[${variant}] audience ${aud}: intensity and ranked dates for every event type`, () => {
        const deps = makeDeps(variant);
        const { intensity, studentCount } = getIntensity(deps, { audience: aud });
        assert.equal(studentCount, expected.studentCount);
        assert.deepEqual(intensity, expected.intensity);
        for (const type of ['recruiting', 'relax', 'general']) {
          assert.deepEqual(recommendDate(deps, { type, audience: aud }).picks, expected.picks[type], type);
        }
      });
    }
  }
});

describe('scheduling with mock events (matches the original ranking with those events present)', () => {
  for (const [aud, expected] of Object.entries(golden.variants.fullMock.campus)) {
    it(`audience ${aud}`, () => {
      const deps = makeDeps('full');
      for (const type of ['recruiting', 'relax', 'general']) {
        assert.deepEqual(recommendDate(deps, { type, audience: aud, mockEvents: MOCK_EVENTS }).picks, expected.picks[type], type);
      }
    });
  }

  it('mock events never change the heat itself', () => {
    const deps = makeDeps('base');
    assert.deepEqual(getIntensity(deps, {}).intensity, golden.variants.base.campus.all.intensity);
  });

  it('rejects bad mock events', () => {
    const deps = makeDeps('base');
    const bad = (mockEvents) => assert.throws(() => recommendDate(deps, { type: 'relax', mockEvents }), { status: 400 });
    bad('x');
    bad([{ type: 'party', date: '2026-12-10' }]);
    bad([{ type: 'relax', date: '2027-02-01' }]);
    bad([{ type: 'relax' }]);
    bad(Array.from({ length: 21 }, () => ({ type: 'relax', date: '2026-12-10' })));
  });
});

describe('scheduling rules', () => {
  const flat = (v) => Object.fromEntries(Array.from({ length: 14 }, (_, i) => [`2026-12-${String(i + 1).padStart(2, '0')}`, v(i + 1)]));

  it('only ranks weekdays', () => {
    const picks = bestDates(flat(() => 10), 'recruiting', { n: 14 });
    assert.equal(picks.length, 10);
    assert.ok(picks.every((p) => ![0, 6].includes(new Date(p.date + 'T00:00:00Z').getUTCDay())));
  });

  it('relax prefers the day right before the peak; recruiting avoids it', () => {
    const intensity = flat((d) => (d === 11 ? 90 : 20));
    assert.equal(bestDates(intensity, 'relax', { n: 1 })[0].date, '2026-12-09');
    assert.notEqual(bestDates(intensity, 'recruiting', { n: 1 })[0].date, '2026-12-10');
  });

  it('each similar event already that day costs 15 points and is mentioned', () => {
    const intensity = flat(() => 20);
    const hosted = [{ start: { dateTime: '2026-12-02T18:00:00-05:00' }, host_type: 'general' }];
    const free = bestDates(intensity, 'general', { n: 14 }).find((p) => p.date === '2026-12-02');
    const clash = bestDates(intensity, 'general', { n: 14, hosted }).find((p) => p.date === '2026-12-02');
    assert.equal(free.score - clash.score, 15);
    assert.match(clash.reason, /1 similar event already that day/);
  });

  it('respects the from/to window', () => {
    const picks = bestDates(flat(() => 10), 'recruiting', { n: 14, from: '2026-12-03', to: '2026-12-07' });
    // Dec 5-6, 2026 is a weekend.
    assert.deepEqual(picks.map((p) => p.date).sort(), ['2026-12-03', '2026-12-04', '2026-12-07']);
  });

  it('intensity of an empty audience is 0 everywhere', () => {
    assert.deepEqual(campusIntensity([], [], [], '2026-12-01', 3), { '2026-12-01': 0, '2026-12-02': 0, '2026-12-03': 0 });
  });

  it('registrations raise the audience intensity', () => {
    const base = getIntensity(makeDeps('base'), { audience: 'CS' }).intensity;
    const deps = makeDeps('base');
    deps.registrations.add('s1', 'ce1');
    deps.registrations.add('s2', 'ce1');
    deps.registrations.add('s4', 'ce1');
    const after = getIntensity(deps, { audience: 'CS' }).intensity;
    assert.ok(after['2026-12-03'] > base['2026-12-03']);
  });

  it('a mock event can carry the host\'s own name; blank names fall back to the type', () => {
    const deps = makeDeps('base');
    const names = (mockEvents) => previewCrowding(deps, { mockEvents }).events.length;
    assert.equal(createMockEvent({ id: 'mock-1', type: 'recruiting', date: '2026-12-08', name: 'Jane Street info session' }).summary, 'Jane Street info session (mock)');
    assert.equal(createMockEvent({ id: 'mock-1', type: 'recruiting', date: '2026-12-08', name: '' }).summary, 'Recruiting event (mock)');
    assert.equal(names([{ type: 'relax', date: '2026-12-08', name: '  Yoga  ' }, { type: 'relax', date: '2026-12-08', name: '' }]), 2);
  });

  it('rejects a name that is not text or is too long', () => {
    const deps = makeDeps('base');
    const bad = (name) => assert.throws(() => recommendDate(deps, { type: 'relax', mockEvents: [{ type: 'relax', date: '2026-12-08', name }] }), { status: 400 });
    bad(42);
    bad({});
    bad('x'.repeat(81));
    const badHour = (startHour) => assert.throws(() => recommendDate(deps, { type: 'relax', mockEvents: [{ type: 'relax', date: '2026-12-08', startHour }] }), { status: 400 });
    for (const h of [7, 9, 11, 22, 24, '10', 10.5, null]) badHour(h);
    for (const h of [8, 10, 12, 14, 16, 18, 20]) assert.doesNotThrow(() => recommendDate(deps, { type: 'relax', mockEvents: [{ type: 'relax', date: '2026-12-08', startHour: h }] }));
    assert.doesNotThrow(() => recommendDate(deps, { type: 'relax', mockEvents: [{ type: 'relax', date: '2026-12-08', name: 'x'.repeat(80) }] }));
  });

  it('a mock event with a time slot fills that 2-hour slot', () => {
    const m = createMockEvent({ id: 'mock-1', type: 'general', date: '2026-12-09', name: 'Talk', startHour: 10 });
    assert.deepEqual([m.start.dateTime, m.end.dateTime], ['2026-12-09T10:00:00-05:00', '2026-12-09T12:00:00-05:00']);
    assert.deepEqual([createMockEvent({ id: 'm', type: 'general', date: '2026-12-09', startHour: 20 }).end.dateTime], ['2026-12-09T22:00:00-05:00']);
    assert.deepEqual([createMockEvent({ id: 'm', type: 'general', date: '2026-12-09', startHour: 8 }).start.dateTime], ['2026-12-09T08:00:00-05:00']);
  });

  it('builds a mock event as a 6:00-7:30 PM calendar event, marked as mock', () => {
    assert.deepEqual(createMockEvent({ id: 'mock-1', type: 'relax', date: '2026-12-11' }), {
      id: 'mock-1',
      summary: 'Relax / wellness event (mock)',
      start: { dateTime: '2026-12-11T18:00:00-05:00' },
      end: { dateTime: '2026-12-11T19:30:00-05:00' },
      host_type: 'relax',
      mock: true,
    });
  });
});
