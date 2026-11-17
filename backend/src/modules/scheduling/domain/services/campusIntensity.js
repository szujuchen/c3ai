import { monthKeys } from '../../../../shared/dateKeys.js';
import { dailyLoad } from '../../../workload/domain/services/workloadCalculator.js';

// Campus intensity 0-100 per day: average of load / cap across the audience.
export function campusIntensity(students, assignments, events, from, days) {
  const loads = students.map((s) => [s, dailyLoad(s, assignments, events, from, days)]);
  const out = {};
  monthKeys(from, days).forEach((k) => {
    if (!loads.length) { out[k] = 0; return; }
    const avg = loads.reduce((sum, [s, l]) => sum + Math.min(l[k] / s.daily_cap_h, 1.5), 0) / loads.length;
    out[k] = Math.round((avg / 1.5) * 100);
  });
  return out;
}
