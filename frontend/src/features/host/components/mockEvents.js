import { esc } from '../../../shared/utils/html.js';
import { fmt } from '../../../shared/utils/dates.js';
import { TYPE_LABEL } from './heatmap.js';

const VERDICT = { good: 'Good timing', busy: 'Busy', 'too-crowded': 'Too crowded' };

// The best dates for an event type, with a way to try one as a mock event.
export function renderPicks(picks, hostType) {
  const why = hostType === 'relax' ? 'Lands just before the crunch peaks, when students need it most.' : hostType === 'recruiting' ? 'Avoids deadline crunch so students show up rested.' : 'Moderate days with no clashing events.';
  return `<div class="seg" style="margin-top:10px">${Object.keys(TYPE_LABEL).map((t) => `<button data-type="${t}" class="${t === hostType ? 'on' : ''}">${TYPE_LABEL[t]}</button>`).join('')}</div>
      <p class="sub" style="margin-top:8px">${why}</p>
      <div>${picks.map((p, i) => `<div class="pick"><span class="num">${i + 1}</span>
          <div><div class="when">${fmt(p.date)}, 6 PM</div><div class="why">${esc(p.reason)}</div></div><span class="sc">${p.score}</span></div>`).join('')}</div>
      <button class="btn primary" id="try-top" style="margin-top:12px;width:100%">Try ${TYPE_LABEL[hostType].toLowerCase()} on ${fmt(picks[0].date)} (mock)</button>`;
}

// Mock events are for planning only: held in this browser, never saved, never shown to students.
export function renderMocks(mocks, verdicts) {
  if (!mocks.length) return '<p class="sub" style="margin-top:12px">No mock events yet. Pin a slot or try the top date to see whether it would be too crowded.</p>';
  return `<ul class="list mocks">${mocks.map((m, i) => {
    const v = verdicts[i];
    return `<li><span><b>${TYPE_LABEL[m.type]}</b> on ${fmt(m.date)}
        ${v ? `<span class="verdict ${v.verdict}">${VERDICT[v.verdict]}</span><span class="why">${esc(v.reason)}</span>` : ''}</span>
        <button class="btn" data-unmock="${i}" aria-label="Remove mock event">Remove</button></li>`;
  }).join('')}</ul><button class="btn" id="clear-mocks" style="margin-top:8px">Clear all mock events</button>`;
}
