// Crunch Calendar scoring. Plain JS, no dependencies. Exposes window.Scoring.
(function () {
  const LEAD_DAYS = { homework: 3, quiz: 3, lab: 3, project: 5, midterm: 4, final: 4 };

  const dayKey = (d) => d.toISOString().slice(0, 10);
  const addDays = (k, n) => { const x = new Date(k + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return dayKey(x); };
  const eventHours = (e) => (new Date(e.end.dateTime) - new Date(e.start.dateTime)) / 36e5;
  const round1 = (x) => Math.round(x * 10) / 10;

  function monthKeys(from, days) {
    const out = [];
    for (let i = 0; i < days; i++) out.push(addDays(from, i));
    return out;
  }

  // Everything that adds hours to one day for one student.
  function dayItems(student, assignments, events, day) {
    const work = [];
    assignments
      .filter((a) => student.course_ids.includes(a.course_id))
      .forEach((a) => {
        const lead = LEAD_DAYS[a.type] || 3;
        const due = a.due_at.slice(0, 10);
        for (let i = 1; i <= lead; i++) {
          if (addDays(due, -i) === day) work.push({ assignment: a, hours: round1(a.effort_h / lead) });
        }
      });
    const evs = events.filter((e) => student.event_ids.includes(e.id) && e.start.dateTime.slice(0, 10) === day);
    const due = assignments.filter((a) => student.course_ids.includes(a.course_id) && a.due_at.slice(0, 10) === day);
    return { work, events: evs, due };
  }

  // Daily load in hours: assignment effort spread over its lead window + event hours.
  function dailyLoad(student, assignments, events, from, days) {
    const load = {};
    monthKeys(from, days).forEach((k) => {
      const it = dayItems(student, assignments, events, k);
      load[k] = round1(it.work.reduce((s, w) => s + w.hours, 0) + it.events.reduce((s, e) => s + eventHours(e), 0));
    });
    return load;
  }

  // 0 = green, 1 = yellow, 2 = red.
  const level = (hours, cap) => (hours >= cap ? 2 : hours > cap * 0.6 ? 1 : 0);

  // First run of 3+ days at or over the cap.
  function burnoutAlert(load, cap) {
    let run = [];
    for (const k of Object.keys(load)) {
      if (load[k] >= cap) run.push(k);
      else { if (run.length >= 3) break; run = []; }
    }
    if (run.length < 3) return null;
    const peak = Math.max(...run.map((k) => load[k]));
    return {
      level: run.length >= 4 || peak > cap * 1.5 ? 'Critical' : 'High',
      start: run[0],
      end: run[run.length - 1],
      days: run,
      peak,
    };
  }

  // Campus intensity 0-100 per day: average of load / cap across the audience.
  function campusIntensity(students, assignments, events, from, days) {
    const loads = students.map((s) => [s, dailyLoad(s, assignments, events, from, days)]);
    const out = {};
    monthKeys(from, days).forEach((k) => {
      if (!loads.length) { out[k] = 0; return; }
      const avg = loads.reduce((sum, [s, l]) => sum + Math.min(l[k] / s.daily_cap_h, 1.5), 0) / loads.length;
      out[k] = Math.round((avg / 1.5) * 100);
    });
    return out;
  }

  // Top N weekday slots for an event type inside a window. Recruiting avoids crunch; relax lands just before it.
  function bestDates(intensity, type, opts) {
    const { n = 3, from, to, hosted = [] } = opts || {};
    const keys = Object.keys(intensity);
    const isWeekday = (k) => { const d = new Date(k + 'T00:00:00Z').getUTCDay(); return d >= 1 && d <= 5; };
    return keys
      .filter((k) => isWeekday(k) && (!from || k >= from) && (!to || k <= to))
      .map((k) => {
        const next = [addDays(k, 1), addDays(k, 2)].map((x) => intensity[x] || 0);
        const nextMax = Math.max(...next);
        const clashes = hosted.filter((e) => e.start.dateTime.slice(0, 10) === k && e.host_type === type).length;
        const I = intensity[k];
        let score, reason;
        if (type === 'relax') {
          score = nextMax - Math.abs(I - 60);
          reason = `Crunch peaks right after (${nextMax}). Students need a break now.`;
        } else if (type === 'general') {
          score = 100 - Math.abs(I - 40);
          reason = `Moderate load (${I}), people are free but not checked out.`;
        } else {
          score = 100 - I - 0.5 * nextMax;
          reason = `Low load (${I}) and no crunch in the next 2 days.`;
        }
        score -= 15 * clashes;
        if (clashes) reason += ` ${clashes} similar event${clashes > 1 ? 's' : ''} already that day.`;
        return { date: k, score: Math.max(0, Math.round(score)), intensity: I, reason };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, n);
  }

  window.Scoring = { LEAD_DAYS, addDays, monthKeys, eventHours, dayItems, dailyLoad, level, burnoutAlert, campusIntensity, bestDates };
})();
