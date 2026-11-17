import { esc } from '../../../shared/utils/html.js';
import { fmt, time } from '../../../shared/utils/dates.js';
import { renderNote, TAG } from './eventNote.js';

const LEVEL = ['On track', 'Busy', 'Over your cap'];
const meter = (hours, cap) => {
  const max = cap * 1.6;
  const lv = hours >= cap ? 2 : hours > cap * 0.6 ? 1 : 0;
  return `<div class="meter"><div class="fill l${lv}" style="width:${Math.min(100, (hours / max) * 100)}%"></div><div class="capline" style="left:${(cap / max) * 100}%"></div></div>`;
};

function renderPreview(p) {
  const verdict = !p.counted
    ? 'This event would not count toward your load.'
    : p.addedHours === 0 ? 'A break: it adds no workload.'
    : p.levelAfter === 2 ? `Adds ${p.addedHours} h and puts you over your ${p.cap} h cap.`
    : `Adds ${p.addedHours} h and keeps you under your ${p.cap} h cap.`;
  return `<h3>${p.registered ? 'Your day with and without it' : 'If you add this'}</h3>
      <div class="pv">
        <div class="pv-row"><span>${fmt(p.date)} without it</span><b>${p.hoursBefore} h</b></div>${meter(p.hoursBefore, p.cap)}
        <div class="pv-row"><span>${fmt(p.date)} with it</span><b>${p.hoursAfter} h</b></div>${meter(p.hoursAfter, p.cap)}
        <p class="sub" style="margin-top:8px">Cap ${p.cap} h · ${LEVEL[p.levelBefore]} → <b>${LEVEL[p.levelAfter]}</b></p>
        <p class="sub">Stress ${p.stressBefore.score} (${p.stressBefore.level}) → <b>${p.stressAfter.score} (${p.stressAfter.level})</b></p>
        <p class="pv-verdict ${p.levelAfter === 2 && p.addedHours > 0 ? 'bad' : 'good'}">${verdict}</p>
      </div>`;
}

export function renderEventModal(event, preview) {
  if (!event) return '';
  const d = event.start.dateTime.slice(0, 10);
  return `<div class="modal-back" data-close></div>
    <div class="modal" role="dialog" aria-modal="true" aria-label="${esc(event.summary)}">
      <button class="modal-x" data-close aria-label="Close">×</button>
      <span class="etag ${event.host_type}">${TAG[event.host_type] || 'Event'}</span>
      <h2 style="margin-top:8px">${esc(event.summary)}</h2>
      <ul class="list" style="margin-top:8px">
        <li><span>When</span><span class="meta">${fmt(d)} · ${time(event.start.dateTime)} – ${time(event.end.dateTime)} (${event.hours} h)</span></li>
        ${event.host ? `<li><span>Hosted by</span><span class="meta">${esc(event.host)}</span></li>` : ''}
        ${event.location ? `<li><span>Where</span><span class="meta">${esc(event.location)}</span></li>` : ''}
      </ul>
      <div style="margin-top:8px">${renderNote(event.note)}</div>
      ${preview ? renderPreview(preview) : '<p class="sub" style="margin-top:12px">Loading the preview…</p>'}
      <div class="row" style="margin-top:16px;justify-content:flex-end">
        <button class="btn" data-close>Close</button>
        <button class="btn ${event.registered ? '' : 'primary'}" data-reg="${event.id}">${event.registered ? 'Unregister' : 'Register for this event'}</button>
      </div>
    </div>`;
}
