import { fmt } from '../../../shared/utils/dates.js';

const LABEL = { low: 'Low', watch: 'Watch', high: 'High', critical: 'Critical' };

// How stressed the student is likely to be: a 0-100 score from their workload, streak of heavy days and deadlines.
export function renderStressCard(dayStress, peak, date) {
  return `<div class="card stress">
      <h2>Stress level</h2>
      <p class="sub">Estimated from your workload. It is not a diagnosis.</p>
      <div class="stress-row"><span class="stress-score s-${dayStress.level}">${dayStress.score}</span>
        <div><b>${LABEL[dayStress.level]}</b><div class="sub">${fmt(date)}</div></div></div>
      <div class="meter stressbar"><div class="fill s-${dayStress.level}" style="width:${dayStress.score}%"></div>
        <i class="mark" style="left:60%"></i><i class="mark" style="left:75%"></i><i class="mark" style="left:90%"></i></div>
      <div class="gradient-labels"><span>0</span><span>60 watch</span><span>75 high</span><span>90 critical</span></div>
      <p class="sub" style="margin-top:10px">Peak this month: <b>${peak.score}</b> (${LABEL[peak.level].toLowerCase()}) on ${fmt(peak.date)}</p></div>`;
}
