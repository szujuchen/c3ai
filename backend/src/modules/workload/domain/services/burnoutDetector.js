// First run of 3+ days at or over the cap. Critical if 4+ days or the peak is over 1.5x the cap.
export function burnoutAlert(load, cap) {
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
