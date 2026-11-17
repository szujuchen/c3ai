// Crunch Calendar UI. Plain JS: render functions rebuild #app from state.
(function () {
  const S = window.Scoring;
  const M = window.MOCK;

  const MONTH_START = '2026-12-01';
  const MONTH_DAYS = 31;
  const TERM_END = '2026-12-18';
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const state = {
    role: 'student',
    studentId: 's1',
    canvas: false,
    gcal: false,
    selectedDay: null,
    done: {},
    syllabusExams: [],
    pending: {},
    hostType: 'recruiting',
    audience: 'all',
    hosted: [],
  };

  const $app = document.getElementById('app');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const dow = (k) => new Date(k + 'T00:00:00Z').getUTCDay();
  const fmt = (k) => `${DOW[dow(k)]}, ${MONTHS[Number(k.slice(5, 7)) - 1]} ${Number(k.slice(8))}`;
  const short = (k) => `${MONTHS[Number(k.slice(5, 7)) - 1]} ${Number(k.slice(8))}`;
  const time = (iso) => {
    const h = Number(iso.slice(11, 13)), m = iso.slice(14, 16);
    return `${((h + 11) % 12) + 1}${m === '00' ? '' : ':' + m} ${h < 12 ? 'AM' : 'PM'}`;
  };
  const course = (id) => M.canvasCourses.find((c) => c.id === id);
  const allAssignments = () => M.canvasAssignments.concat(state.syllabusExams);
  const MONTHS_FULL = ['january','february','march','april','may','june','july','august','september','october','november','december'];
  const allEvents = () => M.gcalEvents.items.concat(state.hosted);

  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 2400);
  }

  // ---------- Student ----------
  function studentData() {
    const st = M.students.find((s) => s.id === state.studentId);
    const assignments = state.canvas ? allAssignments() : [];
    const events = state.gcal ? allEvents() : [];
    const load = S.dailyLoad(st, assignments, events, MONTH_START, MONTH_DAYS);
    const alert = S.burnoutAlert(load, st.daily_cap_h);
    return { st, assignments, events, load, alert };
  }

  function renderStudent() {
    const picker = `<select id="student">${M.students
      .map((s) => `<option value="${s.id}" ${s.id === state.studentId ? 'selected' : ''}>${esc(s.name)} · ${s.major}, year ${s.year}</option>`)
      .join('')}</select>`;
    const connect = `
      <button class="btn ${state.canvas ? 'connected' : 'primary'}" id="c-canvas" ${state.canvas ? 'disabled' : ''}>${state.canvas ? '✓ Canvas synced' : 'Connect Canvas'}</button>
      <button class="btn ${state.gcal ? 'connected' : 'primary'}" id="c-gcal" ${state.gcal ? 'disabled' : ''}>${state.gcal ? '✓ Google Calendar synced' : 'Connect Google Calendar'}</button>`;

    if (!state.canvas && !state.gcal) {
      $app.innerHTML = `
        <div class="row spread"><div class="row">${picker}</div></div>
        <div class="card connect" style="margin-top:20px">
          <h2>Connect your accounts</h2>
          <p class="sub">We read your Canvas deadlines and Google Calendar events, then show you where the crunch is.</p>
          <div class="row">${connect}</div>
          <p class="status" style="margin-top:14px">Demo mode: connecting loads mock data shaped like the real APIs.</p>
        </div>`;
      bindStudent();
      return;
    }

    const { st, assignments, events, load, alert } = studentData();
    const keys = Object.keys(load);
    if (!state.selectedDay) state.selectedDay = alert ? alert.start : MONTH_START;

    $app.innerHTML = `
      <div class="row spread">
        <div class="row">${picker}<span class="status">Daily cap: ${st.daily_cap_h} h · ${st.course_ids.length} courses</span></div>
        <div class="row">${connect}</div>
      </div>
      ${renderAlert(st, assignments, events, load, alert)}
      ${renderMissingExams(st)}
      <div class="grid-2">
        <div class="stack">
          <div class="card">
            <div class="row spread"><h2>December 2026</h2><span class="sub">Finals season</span></div>
            ${renderCalendar(keys, (k) => {
              const it = S.dayItems(st, assignments, events, k);
              const lv = S.level(load[k], st.daily_cap_h);
              const dots = it.due.slice(0, 3).map(() => '<i class="dot"></i>').join('');
              return `<button class="day l${lv} ${k === state.selectedDay ? 'selected' : ''}" data-day="${k}">
                ${Number(k.slice(8))}${it.events.length ? '<i class="ev"></i>' : ''}
                ${load[k] ? `<span class="hrs">${load[k]} h</span>` : ''}<span class="dots">${dots}</span></button>`;
            })}
            <div class="legend"><span class="g">Light</span><span class="y">Busy</span><span class="r">Over your cap</span><span class="d">Deadline</span><span class="e">Event</span></div>
          </div>
          <div class="card">
            <h2>Workload until finals end</h2>
            <p class="sub">Hours of work per day against your ${st.daily_cap_h} h cap</p>
            ${renderBars(keys.filter((k) => k <= TERM_END), load, st.daily_cap_h)}
          </div>
        </div>
        ${renderDayPanel(st, assignments, events, load)}
      </div>`;
    bindStudent();
  }

  function renderAlert(st, assignments, events, load, alert) {
    if (!state.canvas) return '';
    if (!alert) {
      return `<div class="card alert ok" style="margin-top:20px"><span class="pill">On track</span><strong>No burnout risk this month</strong>
        <p class="sub" style="margin-top:6px">No stretch of 3+ days over your ${st.daily_cap_h} h cap.</p></div>`;
    }
    // Biggest deliverable driving the crunch, optional recruiting events inside it, relax events nearby.
    const inRun = new Set(alert.days);
    const drivers = {};
    alert.days.forEach((k) => S.dayItems(st, assignments, events, k).work.forEach((w) => {
      drivers[w.assignment.id] = (drivers[w.assignment.id] || 0) + w.hours;
    }));
    const biggest = assignments.find((a) => a.id === Number(Object.keys(drivers).sort((a, b) => drivers[b] - drivers[a])[0]));
    const optional = events.filter((e) => st.event_ids.includes(e.id) && e.host_type === 'recruiting' && inRun.has(e.start.dateTime.slice(0, 10)));
    const relax = allEvents().filter((e) => e.host_type === 'relax' && e.start.dateTime.slice(0, 10) >= S.addDays(alert.start, -3) && e.start.dateTime.slice(0, 10) <= alert.end);
    const fixes = [];
    if (biggest) fixes.push(`Start <b>${esc(course(biggest.course_id).course_code)} ${esc(biggest.name)}</b> now. It is the biggest driver (${Math.round(drivers[biggest.id])} h in this stretch).`);
    optional.forEach((e) => fixes.push(`Consider skipping <b>${esc(e.summary)}</b> on ${short(e.start.dateTime.slice(0, 10))} (optional).`));
    relax.forEach((e) => fixes.push(`Take a break: <b>${esc(e.summary)}</b>, ${fmt(e.start.dateTime.slice(0, 10))} ${time(e.start.dateTime)}.`));
    return `<div class="card alert" style="margin-top:20px">
      <span class="pill">${alert.level} burnout risk</span><strong>${short(alert.start)} – ${short(alert.end)}: ${alert.days.length} days over your ${st.daily_cap_h} h cap</strong>
      <p class="sub" style="margin-top:6px">Peak day needs about ${alert.peak} h of work.</p>
      <ul>${fixes.map((f) => `<li>${f}</li>`).join('')}</ul></div>`;
  }

  // ---------- Missing exam dates (syllabus upload) ----------
  function missingExamCourses(st) {
    if (!state.canvas) return [];
    return st.course_ids.filter((cid) => !allAssignments().some((a) => a.course_id === cid && (a.type === 'final' || a.type === 'midterm')));
  }

  // Find "Final Exam ... December 15 ... 10:00 AM" in syllabus text.
  function parseExam(text) {
    const re = /(final|midterm)[^\n]{0,80}?\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:,?\s*(\d{4}))?([^\n]{0,30})/i;
    const m = text.match(re);
    if (!m) return null;
    const mon = MONTHS_FULL.findIndex((x) => x.startsWith(m[2].toLowerCase())) + 1;
    const year = m[4] || '2026';
    const t = (m[5] || '').match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
    let hh = 9, mm = '00';
    if (t) { hh = (Number(t[1]) % 12) + (t[3].toLowerCase() === 'pm' ? 12 : 0); mm = t[2] || '00'; }
    return {
      type: m[1].toLowerCase(),
      date: `${year}-${String(mon).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`,
      time: `${String(hh).padStart(2, '0')}:${mm}`,
      quote: m[0].trim(),
    };
  }

  function renderMissingExams(st) {
    const added = state.syllabusExams.filter((a) => st.course_ids.includes(a.course_id));
    const missing = missingExamCourses(st);
    if (!missing.length && !added.length) return '';
    const rows = missing.map((cid) => {
      const c = course(cid);
      const p = state.pending[cid];
      const form = p ? `
        <div class="exam-form">
          <p class="sub">${p.quote ? `Found in <b>${esc(p.file)}</b>: “${esc(p.quote)}”` : p.file ? `Couldn't find an exam date in <b>${esc(p.file)}</b>. Enter it below.` : 'Enter the exam date from your syllabus.'}</p>
          <div class="row" style="margin-top:8px">
            <select data-f="type" data-c="${cid}"><option value="final" ${p.type !== 'midterm' ? 'selected' : ''}>Final exam</option><option value="midterm" ${p.type === 'midterm' ? 'selected' : ''}>Midterm</option></select>
            <input type="date" data-f="date" data-c="${cid}" value="${p.date || ''}" />
            <input type="time" data-f="time" data-c="${cid}" value="${p.time || '09:00'}" />
            <button class="btn primary" data-confirm="${cid}">Add for the class</button>
          </div>
        </div>` : '';
      return `<li class="miss"><div class="row spread" style="width:100%">
          <span><b>${esc(c.course_code)}</b> ${esc(c.name)} <span class="meta">· no exam date in Canvas</span></span>
          <span class="row"><label class="btn">Upload syllabus<input type="file" accept=".txt,.pdf,.md,.html" data-up="${cid}" hidden /></label>
          <button class="btn" data-manual="${cid}">Enter date</button></span>
        </div>${form}</li>`;
    }).join('');
    const done = added.map((a) => `<li><span>✓ <b>${esc(course(a.course_id).course_code)}</b> ${esc(a.name)}, ${fmt(a.due_at.slice(0, 10))} ${time(a.due_at)}</span>
      <span class="meta">from syllabus · ${esc(a.added_by)} · shared with all ${M.students.filter((s) => s.course_ids.includes(a.course_id)).length} students in the course</span></li>`).join('');
    return `<div class="card" style="margin-top:20px">
      <h2>${missing.length ? 'Exam dates missing from Canvas' : 'Exam dates added from syllabi'}</h2>
      <p class="sub">Canvas confirms you're enrolled, so an exam date you add is shared with everyone in that course and counts toward campus intensity.</p>
      <ul class="list" style="margin-top:8px">${rows}${done}</ul></div>`;
  }

  function bindMissing(st) {
    $app.querySelectorAll('[data-up]').forEach((inp) => (inp.onchange = () => {
      const f = inp.files[0]; if (!f) return;
      const cid = Number(inp.dataset.up);
      const reader = new FileReader();
      reader.onload = () => {
        const found = parseExam(String(reader.result));
        state.pending[cid] = Object.assign({ file: f.name }, found || {});
        render();
      };
      reader.readAsText(f);
    }));
    $app.querySelectorAll('[data-manual]').forEach((b) => (b.onclick = () => { state.pending[Number(b.dataset.manual)] = {}; render(); }));
    $app.querySelectorAll('[data-f]').forEach((el) => (el.onchange = () => { state.pending[Number(el.dataset.c)][el.dataset.f] = el.value; }));
    $app.querySelectorAll('[data-confirm]').forEach((b) => (b.onclick = () => {
      const cid = Number(b.dataset.confirm);
      const p = state.pending[cid];
      const type = p.type || 'final';
      if (!p.date) { toast('Pick a date first'); return; }
      if (!st.course_ids.includes(cid)) { toast('Only enrolled students can add exam dates'); return; }
      state.syllabusExams.push({
        id: 9000 + state.syllabusExams.length, course_id: cid, name: type === 'final' ? 'Final Exam' : 'Midterm',
        due_at: `${p.date}T${p.time || '09:00'}:00-05:00`, points_possible: 200, type, effort_h: type === 'final' ? 12 : 8,
        source: 'syllabus', added_by: st.name,
      });
      delete state.pending[cid];
      const n = M.students.filter((s) => s.course_ids.includes(cid)).length;
      state.selectedDay = null;
      toast(`Exam added for all ${n} students in ${course(cid).course_code}`);
      render();
    }));
  }

  function renderCalendar(keys, cell) {
    const lead = (dow(keys[0]) + 6) % 7; // Monday first
    const head = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => `<div class="dow">${d}</div>`).join('');
    const blanks = Array.from({ length: lead }, () => '<div class="day empty"></div>').join('');
    return `<div class="cal">${head}${blanks}${keys.map(cell).join('')}</div>`;
  }

  function renderBars(keys, load, cap) {
    const max = Math.max(cap * 1.6, ...keys.map((k) => load[k]));
    return `<div class="bars">
      <div class="cap" style="bottom:${(cap / max) * 100}%"><span>daily cap ${cap} h</span></div>
      ${keys.map((k) => `<div class="bar l${S.level(load[k], cap)}" style="height:${(load[k] / max) * 100}%" title="${short(k)}: ${load[k]} h"></div>`).join('')}
    </div>
    <div class="bar-labels">${keys.map((k) => `<span>${Number(k.slice(8)) % 2 ? Number(k.slice(8)) : ''}</span>`).join('')}</div>`;
  }

  function renderDayPanel(st, assignments, events, load) {
    const k = state.selectedDay;
    const it = S.dayItems(st, assignments, events, k);
    const lv = S.level(load[k], st.daily_cap_h);
    const due = it.due.map((a) => `<li><span>${esc(course(a.course_id).course_code)} ${esc(a.name)}${a.source === 'syllabus' ? ' <span class="meta">(syllabus)</span>' : ''}</span><span class="meta">${time(a.due_at)}</span></li>`).join('');
    const work = it.work
      .sort((a, b) => b.hours - a.hours)
      .map((w) => {
        const id = `${k}-${w.assignment.id}`;
        return `<li><label><input type="checkbox" class="chk" data-done="${id}" ${state.done[id] ? 'checked' : ''}/>
          <span style="${state.done[id] ? 'text-decoration:line-through;color:#999' : ''}">${esc(course(w.assignment.course_id).course_code)} ${esc(w.assignment.name)}</span></label>
          <span class="meta">${w.hours} h</span></li>`;
      })
      .join('');
    const evs = it.events.map((e) => `<li><span>${esc(e.summary)}</span><span class="meta">${time(e.start.dateTime)}</span></li>`).join('');

    let tip = '';
    if (lv === 2 && it.work.length) {
      const smallest = it.work.slice().sort((a, b) => a.hours - b.hours)[0];
      let earlier = null;
      for (let i = 1; i <= 7; i++) {
        const d = S.addDays(k, -i);
        if (d < MONTH_START) break;
        if (load[d] + smallest.hours < st.daily_cap_h * 0.8) { earlier = d; break; }
      }
      tip = earlier
        ? `<div class="tip">Over your cap. Move <b>${esc(course(smallest.assignment.course_id).course_code)} ${esc(smallest.assignment.name)}</b> prep (${smallest.hours} h) to ${fmt(earlier)}, which has room.</div>`
        : `<div class="tip">Over your cap with no lighter day nearby. Ask for an extension or drop an optional event.</div>`;
    } else if (lv === 0) {
      tip = `<div class="tip good">Light day. A good time to get ahead on the next deadline.</div>`;
    }

    return `<div class="card panel">
      <h2>${fmt(k)}</h2>
      <p class="sub">About ${load[k]} h of work · cap ${st.daily_cap_h} h</p>
      <h3>Due (Canvas)</h3>${due ? `<ul class="list">${due}</ul>` : '<p class="sub">Nothing due.</p>'}
      <h3>Study plan</h3>${work ? `<ul class="list">${work}</ul>` : '<p class="sub">No study blocks planned.</p>'}
      <h3>Events (Google Calendar)</h3>${evs ? `<ul class="list">${evs}</ul>` : `<p class="sub">${state.gcal ? 'No events.' : 'Connect Google Calendar to see events.'}</p>`}
      ${tip}
    </div>`;
  }

  function bindStudent() {
    const stNow = M.students.find((s) => s.id === state.studentId);
    bindMissing(stNow);
    document.getElementById('student').onchange = (e) => { state.studentId = e.target.value; state.selectedDay = null; render(); };
    const cv = document.getElementById('c-canvas');
    if (cv && !state.canvas) cv.onclick = () => { state.canvas = true; state.selectedDay = null; toast(`Synced ${M.canvasAssignments.length} assignments from Canvas`); render(); };
    const gc = document.getElementById('c-gcal');
    if (gc && !state.gcal) gc.onclick = () => { state.gcal = true; state.selectedDay = null; toast(`Synced ${M.gcalEvents.items.length} events from Google Calendar`); render(); };
    $app.querySelectorAll('[data-day]').forEach((b) => (b.onclick = () => { state.selectedDay = b.dataset.day; render(); }));
    $app.querySelectorAll('[data-done]').forEach((c) => (c.onchange = () => { state.done[c.dataset.done] = c.checked; render(); }));
  }

  // ---------- Host ----------
  function renderHost() {
    const audience = M.students.filter((s) => state.audience === 'all' || s.major === state.audience);
    const intensity = S.campusIntensity(audience, allAssignments(), allEvents(), MONTH_START, MONTH_DAYS);
    const picks = S.bestDates(intensity, state.hostType, { from: MONTH_START, to: TERM_END, hosted: allEvents() });
    const rank = {}; picks.forEach((p, i) => (rank[p.date] = i + 1));
    const keys = Object.keys(intensity);
    const majors = [...new Set(M.students.map((s) => s.major))];
    const typeLabel = { recruiting: 'Recruiting', relax: 'Relax / wellness', general: 'General' };

    $app.innerHTML = `
      <div class="row spread">
        <div class="row">
          <div class="seg">${Object.keys(typeLabel).map((t) => `<button data-type="${t}" class="${t === state.hostType ? 'on' : ''}">${typeLabel[t]}</button>`).join('')}</div>
          <select id="aud"><option value="all">All students (${M.students.length})</option>${majors.map((m) => `<option value="${m}" ${m === state.audience ? 'selected' : ''}>${m} students</option>`).join('')}</select>
        </div>
        <span class="status">Window: Dec 1 – 18 · weekdays · only aggregates are shown</span>
      </div>
      <div class="grid-2">
        <div class="card">
          <div class="row spread"><h2>Campus intensity · December 2026</h2><span class="sub">${audience.length} students</span></div>
          <div class="heat">${renderCalendar(keys, (k) => {
            const I = intensity[k];
            const hosted = allEvents().filter((e) => e.start.dateTime.slice(0, 10) === k);
            return `<div class="day ${k > TERM_END ? 'out' : ''}" style="background:hsl(${140 - 1.35 * I},62%,${88 - I * 0.12}%)" title="${fmt(k)}: intensity ${I}${hosted.length ? ' · ' + hosted.map((e) => e.summary).join(', ') : ''}">
              ${Number(k.slice(8))}${rank[k] ? `<span class="rank">${rank[k]}</span>` : hosted.length ? '<i class="ev" style="position:absolute;right:7px;top:7px;width:7px;height:7px;border-radius:2px;background:#2f6fed"></i>' : ''}
              <span class="score">${I}</span></div>`;
          })}</div>
          <div class="gradient"></div><div class="gradient-labels"><span>0 · relaxed</span><span>100 · crunch</span></div>
        </div>
        <div class="card">
          <h2>Best dates for a ${typeLabel[state.hostType].toLowerCase()} event</h2>
          <p class="sub">${state.hostType === 'relax' ? 'Lands just before the crunch peaks, when students need it most.' : state.hostType === 'recruiting' ? 'Avoids deadline crunch so students actually show up rested.' : 'Moderate days with no clashing events.'}</p>
          <div style="margin-top:8px">${picks.map((p, i) => `
            <div class="pick"><span class="num">${i + 1}</span>
              <div><div class="when">${fmt(p.date)}, 6 PM</div><div class="why">${esc(p.reason)}</div></div>
              <span class="sc">${p.score}</span></div>`).join('')}</div>
          <button class="btn primary" id="publish" style="margin-top:12px;width:100%">Schedule at #1: ${fmt(picks[0].date)}</button>
          ${state.hosted.length ? `<h3>Your scheduled events</h3><ul class="list">${state.hosted.map((e) => `<li><span>${esc(e.summary)}</span><span class="meta">${fmt(e.start.dateTime.slice(0, 10))}</span></li>`).join('')}</ul>` : ''}
        </div>
      </div>`;

    $app.querySelectorAll('[data-type]').forEach((b) => (b.onclick = () => { state.hostType = b.dataset.type; render(); }));
    document.getElementById('aud').onchange = (e) => { state.audience = e.target.value; render(); };
    document.getElementById('publish').onclick = () => {
      const d = picks[0].date;
      state.hosted.push({
        id: `host-${state.hosted.length + 1}`,
        summary: `${typeLabel[state.hostType]} event`,
        start: { dateTime: `${d}T18:00:00-05:00` },
        end: { dateTime: `${d}T19:30:00-05:00` },
        host_type: state.hostType,
      });
      toast(`Scheduled for ${fmt(d)} at 6 PM`);
      render();
    };
  }

  // ---------- Shell ----------
  function render() {
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.role === state.role));
    state.role === 'student' ? renderStudent() : renderHost();
  }
  document.querySelectorAll('.tab').forEach((t) => (t.onclick = () => { state.role = t.dataset.role; render(); }));
  render();
})();
