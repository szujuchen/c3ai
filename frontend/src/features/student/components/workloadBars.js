import { dayOfMonth, short } from '../../../shared/utils/dates.js';

// Bar chart of hours per day against the daily cap. `days[k]` is { hours, level }.
export function renderBars(keys, days, cap) {
  const max = Math.max(cap * 1.6, ...keys.map((k) => days[k].hours));
  return `<div class="bars">
      <div class="cap" style="bottom:${(cap / max) * 100}%"><span>daily cap ${cap} h</span></div>
      ${keys.map((k) => `<div class="bar l${days[k].level}" style="height:${(days[k].hours / max) * 100}%" title="${short(k)}: ${days[k].hours} h"></div>`).join('')}
    </div>
    <div class="bar-labels">${keys.map((k) => `<span>${dayOfMonth(k) % 2 ? dayOfMonth(k) : ''}</span>`).join('')}</div>`;
}
