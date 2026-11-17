import { isWeekday, scoreDay } from './bestDateRanker.js';

// A 0-100 "event fit" for every day of the term, the number behind the 3D heatmap's columns. Days a host cannot
// schedule on (weekends, or outside the scheduling window) have no score and say why.
export function eventFit(intensity, type, { from, to, events = [] } = {}) {
  return Object.fromEntries(Object.keys(intensity).map((k) => {
    const { I, nextMax, clashes, score } = scoreDay(intensity, type, k, events);
    const reason = type === 'relax' ? `Workload is ${I}/100 today and peaks at ${nextMax}/100 over the next two days. Wellness events fit best just before a busy stretch.`
      : type === 'general' ? `Student workload is ${I}/100. General events fit best on moderately busy days, with room for an activity.`
      : `Workload is ${I}/100 today and peaks at ${nextMax}/100 over the next two days. Quieter stretches give students more room for recruiting.`;
    const availability = (from && k < from) || (to && k > to) ? 'Outside the scheduling window.'
      : !isWeekday(k) ? 'Only weekday dates are available for scheduling.' : '';
    return [k, {
      date: k,
      score: availability ? null : Math.max(0, Math.min(100, Math.round(score))),
      intensity: I,
      reason: reason + (clashes ? ` ${clashes} similar event${clashes > 1 ? 's are' : ' is'} already scheduled that day.` : ''),
      eligible: !availability,
      availability,
    }];
  }));
}

// The best dates by fit: the same scores the chart shows, highest first.
export const fitPicks = (fit, n = 3) => Object.values(fit).filter((d) => d.eligible).sort((a, b) => b.score - a.score).slice(0, n);
