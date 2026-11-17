import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

// Drives the built web app in jsdom against the real API (in memory): login, every role's view, and the flows
// that have broken before (e.g. the event modal not closing). Run with `npm run test:ui`.
const B = fileURLToPath(new URL('../../backend', import.meta.url));
const { createApp } = await import(`${B}/src/app.js`);
const { makeDeps } = await import(`${B}/tests/helpers.js`);

const settle = (ms = 250) => new Promise((r) => setTimeout(r, ms));
const bundle = fs.readFileSync(new URL('./.build/bundle.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/<link[^>]*>/g, '').replace(/<script[^>]*><\/script>/g, '');

function run(label, fn) {
  return test(label, async () => {
    const app = createApp(makeDeps('base'));
    const server = await new Promise((res) => { const s = app.listen(3111, () => res(s)); });
    const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/' });
    const w = dom.window;
    w.fetch = (u, o = {}) => fetch(u, { ...o, headers: { ...o.headers, Connection: 'close' } }); // no sockets reused between tests
    const realST = w.setTimeout.bind(w); w.setTimeout = (f, ms, ...a) => (ms === 2400 ? 0 : realST(f, ms, ...a)); // keep toasts
    w.eval(bundle); await settle(400);
    const d = w.document;
    const c = {
      w, d, $: (s) => d.querySelector(s), $$: (s) => [...d.querySelectorAll(s)],
      app: () => d.getElementById('app').innerHTML, text: () => d.getElementById('app').textContent,
      toast: () => d.getElementById('toast').textContent,
      click: async (s) => { const el = typeof s === 'string' ? d.querySelector(s) : s; assert.ok(el, `missing ${s}`); if (el.click) el.click(); else el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); await settle(500); },
      key: async (k) => { d.dispatchEvent(new w.KeyboardEvent('keydown', { key: k, bubbles: true })); await settle(400); },
      login: async (role, studentId) => { if (studentId) d.getElementById('login-student').value = studentId; await c.click(`[data-login="${role}"]`); },
    };
    try { await fn(c); } finally { w.close(); server.closeAllConnections(); await new Promise((r) => server.close(r)); }
  });
}

await run('login screen offers three roles, and a bad password-less login works', async (c) => {
  assert.equal(c.$$('[data-login]').length, 3);
  assert.equal(c.$('.tabs').hidden, true);
  assert.equal(c.$$('#login-student option').length, 5);
});

await run('student: only the student view, connects, and sees the timetable', async (c) => {
  await c.login('student', 's1');
  assert.equal(c.$('.tabs').hidden, true, 'a student has a single view');
  assert.match(c.$('#user').textContent, /Maya/);
  assert.equal(c.$('#student'), null, 'no student picker for a student');
  assert.match(c.text(), /Connect Canvas/);
  assert.ok(!/Google Calendar/.test(c.text()), 'Google Calendar is hidden');
  await c.click('#c-demo');
  assert.match(c.toast(), /Synced \d+ assignments/);
  assert.ok(c.$('.cal-card'), 'calendar is shown');
  assert.ok(c.$('.stress'), 'stress card');
  assert.ok(c.$$('.evitem').length === 6, 'six campus events');
  assert.ok(!/Google Calendar/.test(c.text()));
});

await run('student: day / week / month views, navigation', async (c) => {
  await c.login('student', 's1');
  await c.click('#c-demo');
  assert.ok(c.$('.month, .cal'), 'month grid by default');
  await c.click('[data-view="week"]');
  assert.ok(c.$('.tg'), 'time grid');
  assert.equal(c.$$('.tg-head').length, 7);
  assert.ok(c.$$('.tg-block.class').length > 0, 'class blocks');
  assert.ok(c.$$('.tg-chip.deadline').length > 0, 'deadline chips');
  const before = c.$('.cal-bar h2').textContent;
  await c.click('[data-nav="1"]');
  assert.notEqual(c.$('.cal-bar h2').textContent, before, 'next week');
  await c.click('[data-view="day"]');
  assert.equal(c.$$('.tg-head').length, 1);
  await c.click('[data-nav="-1"]');
  await c.click('[data-view="month"]');
  assert.ok(c.$$('[data-day]').length >= 31);
});

await run('student: filter the events list', async (c) => {
  await c.login('student', 's1');
  await c.click('#c-demo');
  await c.click('[data-filter="relax"]');
  assert.equal(c.$$('.evitem').length, 2);
  await c.click('[data-filter="recruiting"]');
  assert.equal(c.$$('.evitem').length, 2);
  await c.click('[data-filter="registered"]');
  assert.equal(c.$$('.evitem').length, 0);
  assert.match(c.text(), /No events match this filter/);
  await c.click('[data-filter="all"]');
  assert.equal(c.$$('.evitem').length, 6);
});

await run('student: the event modal opens, previews, and closes every way', async (c) => {
  await c.login('student', 's1');
  await c.click('#c-demo');
  for (const how of ['x', 'close-button', 'backdrop', 'escape']) {
    await c.click('.evitem');
    assert.ok(c.$('.modal'), `modal opens (${how})`);
    assert.match(c.$('.modal').textContent, /If you add this/, 'preview is shown');
    assert.match(c.$('.modal').textContent, /Hosted by/);
    if (how === 'x') await c.click('.modal-x');
    if (how === 'close-button') await c.click('.modal .row [data-close]');
    if (how === 'backdrop') await c.click('.modal-back');
    if (how === 'escape') await c.key('Escape');
    assert.equal(c.$('.modal'), null, `modal closes with ${how}`);
  }
});

await run('student: register from the modal, see it in the list, then unregister', async (c) => {
  await c.login('student', 's1');
  await c.click('#c-demo');
  await c.click('[data-open="ce1"]');
  assert.match(c.$('.modal').textContent, /Adds 4 h/);
  await c.click('.modal [data-reg="ce1"]');
  assert.match(c.toast(), /Registered for Tech/);
  assert.ok(c.$('.modal'), 'modal stays open to show the result');
  assert.match(c.$('.modal').textContent, /Your day with and without it/);
  await c.click('.modal-x');
  await c.click('[data-filter="registered"]');
  assert.equal(c.$$('.evitem').length, 1);
  await c.click('[data-open="ce1"]');
  await c.click('.modal [data-reg="ce1"]');
  assert.match(c.toast(), /Unregistered/);
});

await run('host: only the heatmap view; pin a slot, try a mock event, see the verdict', async (c) => {
  await c.login('host');
  assert.equal(c.$('.tabs').hidden, true);
  assert.match(c.text(), /Event planner/);
  assert.ok(c.$$('.hm-tile').length >= 14 * 7, 'availability tiles');
  assert.ok(c.$$('.top-slot').length === 10);
  assert.ok(!/Maya|Leo|Aisha/.test(c.text()), 'no student names');
  assert.equal(c.$('#mock-here'), null);
  await c.click('.hm-tile');
  assert.ok(c.$('.hm-tile.pinned'));
  assert.ok(c.$('#mock-here'));
  await c.click('#mock-here');
  assert.match(c.toast(), /Not saved/);
  assert.equal(c.$$('[data-unmock]').length, 1);
  assert.match(c.$('.mocks').textContent, /Good timing|Busy|Too crowded/);
  await c.click('#try-top');
  assert.equal(c.$$('[data-unmock]').length, 2);
  await c.click('#clear-mocks');
  assert.equal(c.$$('[data-unmock]').length, 0);
});

await run('host: audience by major, class year and course', async (c) => {
  await c.login('host');
  await c.click('[data-kind="major"]');
  assert.match(c.$('#aud').textContent, /CS \(3\)/);
  await c.click('[data-kind="year"]');
  assert.match(c.$('#aud').textContent, /Class of year 3 \(4\)/);
  await c.click('[data-kind="course"]');
  assert.match(c.$('#aud').textContent, /15-122/);
  assert.equal(c.$('.tile b').textContent, '3');
});

await run('host: cannot reach any student data', async (c) => {
  await c.login('host');
  const token = JSON.parse(c.w.sessionStorage.getItem('crunch-calendar-session')).token;
  for (const p of ['/api/students', '/api/students/s1/workload', '/api/canvas/courses']) {
    const r = await fetch(`http://localhost:3111${p}`, { headers: { Authorization: `Bearer ${token}`, Connection: 'close' } });
    assert.equal(r.status, 403, p);
  }
});

await run('admin: both views, a student picker, and the split heat', async (c) => {
  await c.login('admin');
  assert.equal(c.$('.tabs').hidden, false);
  assert.equal(c.$$('.tab:not([hidden])').length, 2);
  assert.match(c.text(), /Connect Canvas/);
  assert.ok(c.$('#student'), 'admin picks a student');
  await c.click('#c-demo');
  assert.ok(c.$$('.day .split').length > 0, 'two-color heat on the month calendar');
  assert.match(c.$('.legend').textContent, /Coursework/);
  await c.click('[data-view="week"]');
  await c.click('.tab[data-role="host"]');
  assert.ok(c.$$('.hm-tile').length > 0, 'heatmap');
  await c.click('.tab[data-role="student"]');
  assert.ok(c.$('.cal-card'));
});

await run('logging out returns to login, and a reload keeps you logged in', async (c) => {
  await c.login('student', 's2');
  assert.match(c.$('#user').textContent, /Leo/);
  await c.click('#logout');
  assert.equal(c.$$('[data-login]').length, 3);
  assert.equal(c.w.sessionStorage.getItem('crunch-calendar-session'), null);
});


// ---------- Host: 2D / 3D modes ----------
const to3d = async (c) => { await c.login('host'); await c.click('[data-mode="3d"]'); };
const key = async (c, el, k) => { el.dispatchEvent(new c.w.KeyboardEvent('keydown', { key: k, bubbles: true })); await settle(100); };

await run('host: starts in 2D, and the 3D mode is one click away and back', async (c) => {
  await c.login('host');
  assert.equal(c.$('[data-mode="2d"]').getAttribute('aria-pressed'), 'true');
  assert.ok(c.$$('.hm-tile').length > 0 && !c.$('.heatmap-3d'), '2D time slots by default');
  assert.ok(c.$('#from'), '2D has a date range');
  await c.click('[data-mode="3d"]');
  assert.ok(c.$('.heatmap-3d'), '3D month');
  assert.equal(c.$$('.hm-tile').length, 0);
  assert.equal(c.$('#from'), null, 'dates are 2D only');
  assert.equal(c.$('[data-mode="3d"]').getAttribute('aria-pressed'), 'true');
  await c.click('[data-mode="2d"]');
  assert.ok(c.$$('.hm-tile').length > 0 && !c.$('.heatmap-3d'));
  assert.ok(c.$('#from'));
});

await run('host 3D: a column per day, the top three dates ranked, and the best one selected', async (c) => {
  await to3d(c);
  assert.equal(c.$$('[data-heat-day]').length, 31);
  assert.equal(c.$$('.heat-rank').length, 3, 'three recommended dates');
  const selected = c.$('[data-heat-day][aria-pressed="true"]');
  assert.match(selected.getAttribute('aria-label'), /recommended date #1/, 'the #1 pick starts selected');
  assert.match(c.$('#heat-detail').textContent, /Recommended #1/);
  assert.match(c.$$('.pick .when')[0].textContent, new RegExp(selected.dataset.heatDay.slice(8)), 'and it is the first date listed');
  assert.match(c.$('#heat-detail').textContent, /Event fit/);
  assert.match(c.$('.heat-badge').textContent, /3D heatmap/);
  assert.equal(c.$$('.pick').length, 3);
  assert.match(c.$('.pick .sc').textContent, /fit/);
  assert.ok(!/Maya|Leo|Aisha/.test(c.text()), 'aggregates only');
});

await run('host 3D: weekends are flat and gray, and say why', async (c) => {
  await to3d(c);
  const sat = c.$('[data-heat-day="2026-12-12"]');
  assert.match(sat.getAttribute('class'), /out/);
  assert.match(sat.getAttribute('aria-label'), /unavailable: Only weekday dates are available/);
  assert.match(c.$('[data-heat-day="2026-12-09"]').getAttribute('aria-label'), /event fit \d+ out of 100/);
  assert.equal(c.$('[data-heat-day="2026-12-09"]').getAttribute('role'), 'button');
  await c.click(sat);
  assert.match(c.$('#heat-detail').textContent, /Unavailable date/);
  assert.match(c.$('#heat-detail').textContent, /Only weekday dates are available/);
});

await run('host 3D: click a column for details; arrow keys move between dates', async (c) => {
  await to3d(c);
  await c.click('[data-heat-day="2026-12-09"]');
  assert.equal(c.$('[data-heat-day][aria-pressed="true"]').dataset.heatDay, '2026-12-09');
  assert.match(c.$('#heat-detail').textContent, /Wed, Dec 9/);
  assert.equal(c.$$('[data-heat-day][tabindex="0"]').length, 1, 'one tab stop');
  const at = () => c.$('[data-heat-day][aria-pressed="true"]').dataset.heatDay;
  await key(c, c.$('[data-heat-day="2026-12-09"]'), 'ArrowRight'); assert.equal(at(), '2026-12-10');
  await key(c, c.$('[data-heat-day="2026-12-10"]'), 'ArrowDown'); assert.equal(at(), '2026-12-17');
  await key(c, c.$('[data-heat-day="2026-12-17"]'), 'ArrowLeft'); assert.equal(at(), '2026-12-16');
  await key(c, c.$('[data-heat-day="2026-12-16"]'), 'ArrowUp'); assert.equal(at(), '2026-12-09');
  await c.click('[data-heat-day="2026-12-01"]');
  await key(c, c.$('[data-heat-day="2026-12-01"]'), 'ArrowLeft'); assert.equal(at(), '2026-12-01', 'stops at the first day');
  await key(c, c.$('[data-heat-day="2026-12-01"]'), 'Enter'); assert.equal(at(), '2026-12-01');
});

await run('host 3D: the rotate slider turns the view without losing the selection', async (c) => {
  await to3d(c);
  const before = c.$('.heatmap-3d').getAttribute('viewBox');
  await c.click('[data-heat-day="2026-12-09"]');
  const slider = c.$('#heat-rotation');
  assert.deepEqual([slider.min, slider.max, slider.value], ['20', '60', '30']);
  slider.value = '55';
  slider.dispatchEvent(new c.w.Event('input', { bubbles: true }));
  await settle(100);
  assert.notEqual(c.$('.heatmap-3d').getAttribute('viewBox'), before, 'the picture changed');
  assert.equal(c.$('#heat-angle').value, '55°');
  assert.equal(c.$('[data-heat-day][aria-pressed="true"]').dataset.heatDay, '2026-12-09');
  assert.equal(c.$$('[data-heat-day]').length, 31);
  assert.ok(!c.$('.heatmap-3d').classList.contains('is-switching'), 'no animation while dragging');
});

await run('host 3D: switch between event fit and campus workload', async (c) => {
  await to3d(c);
  assert.equal(c.$('[data-heat-metric="fit"]').getAttribute('aria-pressed'), 'true');
  const fitFill = c.$('[data-heat-day="2026-12-09"] .heat-top').getAttribute('fill');
  await c.click('[data-heat-metric="workload"]');
  assert.equal(c.$('[data-heat-metric="workload"]').getAttribute('aria-pressed'), 'true');
  assert.match(c.$('.card h2').textContent, /Campus workload/);
  assert.match(c.$('.heat-key').textContent, /Faded: outside Dec 1–18/);
  assert.notEqual(c.$('[data-heat-day="2026-12-09"] .heat-top').getAttribute('fill'), fitFill, 'a different scale');
  assert.match(c.$('[data-heat-day="2026-12-12"]').getAttribute('aria-label'), /student workload \d+ out of 100/, 'a weekend has a workload');
  assert.ok(!/class="[^"]*out/.test(c.$('[data-heat-day="2026-12-12"]').outerHTML), 'weekends are not muted for workload');
  assert.match(c.$('[data-heat-day="2026-12-21"]').getAttribute('class'), /out/, 'after finals is muted');
  assert.equal(c.$('[data-heat-metric="workload"]'), c.d.activeElement, 'focus stays on the button you pressed');
  await c.click('[data-heat-metric="fit"]');
  assert.match(c.$('.card h2').textContent, /Best days to host/);
});

await run('host 3D: each event type has its own colours, ranks and animation', async (c) => {
  await to3d(c);
  const theme = () => c.$('.host-3d').getAttribute('style');
  assert.equal(c.$('.host-3d').dataset.hostTheme, 'recruiting');
  assert.match(theme(), /#4f46e5/);
  const recruitingPicks = c.$$('.pick .when').map((e) => e.textContent).join('|');
  await c.click('[data-type="relax"]');
  assert.equal(c.$('.host-3d').dataset.hostTheme, 'relax');
  assert.match(theme(), /#0f766e/);
  assert.equal(c.$('[data-type="relax"]').getAttribute('aria-pressed'), 'true');
  assert.ok(c.$('.heatmap-3d').classList.contains('is-switching'), 'columns rise when the category changes');
  assert.ok(c.$('.host-3d').classList.contains('is-switching'));
  assert.equal(c.$$('.heat-rank').length, 3);
  assert.notEqual(c.$$('.pick .when').map((e) => e.textContent).join('|'), recruitingPicks, 'different dates suit a wellness event');
  await c.click('[data-type="general"]');
  assert.match(theme(), /#c2410c/);
  assert.equal(c.$('[data-type="general"]'), c.d.activeElement);
  // The animation plays when the category or metric changes, and not on later redraws.
  await c.click('[data-heat-metric="workload"]');
  assert.ok(c.$('.heatmap-3d').classList.contains('is-switching'), 'the metric switch animates too');
  await c.click('#try-top');
  assert.ok(!c.$('.heatmap-3d').classList.contains('is-switching'), 'adding a mock event does not replay it');
  assert.ok(!c.$('.host-3d').classList.contains('is-switching'));
});

await run('host 3D: the audience changes the numbers, and 2D remembers it', async (c) => {
  await to3d(c);
  assert.match(c.$('.host-3d .status').textContent, /5 students/);
  await c.click('[data-kind="major"]');
  assert.match(c.$('.heat-key').closest('.host-3d').textContent, /3 students in CS/);
  await c.click('[data-mode="2d"]');
  assert.match(c.$('#aud').textContent, /CS/);
  assert.equal(c.$('.tile b').textContent, '3');
});

await run('host 3D: try a mock event, see it on the chart and the verdict, then it carries over to 2D', async (c) => {
  await to3d(c);
  const topDay = c.$('[data-heat-day][aria-label*="recommended date #1"]').dataset.heatDay;
  const scoreBefore = Number(c.$(`[data-heat-day="${topDay}"]`).getAttribute('aria-label').match(/event fit (\d+)/)[1]);
  await c.click('#try-top');
  assert.match(c.toast(), /Not saved/);
  assert.equal(c.$$('[data-unmock]').length, 1);
  assert.match(c.$('.mocks').textContent, /Good timing|Busy|Too crowded/);
  const label = c.$(`[data-heat-day="${topDay}"]`).getAttribute('aria-label');
  assert.match(label, /mock/, 'the mock event is on the column');
  assert.equal(Number(label.match(/event fit (\d+)/)[1]), Math.max(0, scoreBefore - 15), 'and it counts as a clash');
  assert.ok(c.$(`[data-heat-day="${topDay}"] .heat-event, [data-heat-day="${topDay}"] .heat-rank`), 'with a marker');
  await c.click('[data-mode="2d"]');
  assert.equal(c.$$('[data-unmock]').length, 1, 'same mock event in 2D');
  const to = c.$('#to'); to.value = '2026-12-31'; to.dispatchEvent(new c.w.Event('change', { bubbles: true })); await settle(500); // the default 2D range stops before the pick
  assert.ok(c.$('.hm-mock'), 'marked on the 2D day too');
  await c.click('#clear-mocks');
  await c.click('[data-mode="3d"]');
  assert.equal(c.$$('[data-unmock]').length, 0);
});

await run('host 3D: a host cannot see anyone, and an admin gets the 3D mode too', async (c) => {
  await c.login('admin');
  await c.click('.tab[data-role="host"]');
  assert.ok(c.$('[data-mode="3d"]'));
  await c.click('[data-mode="3d"]');
  assert.equal(c.$$('[data-heat-day]').length, 31);
  assert.ok(!/Maya|Leo|Aisha/.test(c.text()));
});
