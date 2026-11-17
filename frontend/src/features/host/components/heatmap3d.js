import { addDays, dayOfMonth, dow, fmt, short, time } from '../../../shared/utils/dates.js';
import { esc } from '../../../shared/utils/html.js';

// The 3D month: each day is a column, as tall and dark as its score. Weekdays run left to right and weeks run back
// to front, drawn as an isometric SVG with no libraries. Ported from the original add/ prototype.
export const HOST_THEMES = {
  recruiting: { colors: ['#e0f2fe', '#7dd3fc', '#6366f1', '#4338ca'], accent: '#4f46e5', soft: '#eef2ff' },
  relax: { colors: ['#dcfce7', '#86efac', '#2dd4bf', '#0f766e'], accent: '#0f766e', soft: '#e6f7f1' },
  general: { colors: ['#fff7d6', '#fcd34d', '#fb923c', '#c2410c'], accent: '#c2410c', soft: '#fff3e5' },
};
export const WORKLOAD_COLORS = ['#e2e8f0', '#cbd5e1', '#fb923c', '#dc2626'];
export const colorsFor = (metric, hostType) => (metric === 'fit' ? HOST_THEMES[hostType].colors : WORKLOAD_COLORS);

const hexToRgb = (hex) => [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));

// A colour along the scale for a 0-100 value.
function heatColor(value, colors) {
  const position = (Math.max(0, Math.min(100, value)) / 100) * (colors.length - 1);
  const i = Math.min(Math.floor(position), colors.length - 2);
  const start = hexToRgb(colors[i]), end = hexToRgb(colors[i + 1]);
  return start.map((channel, j) => Math.round(channel + (end[j] - channel) * (position - i)));
}

const relativeLuminance = (rgb) => rgb.map((channel) => {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);

// `fit[k]` is { score, eligible, availability, reason }; `intensity[k]` is campus workload 0-100;
// `rank[k]` is the 1-3 position of a recommended date; `eventsByDay[k]` are the events that day.
export function renderHeatmap3d({ keys, intensity, fit, rank, eventsByDay, rotation, metric, hostType, selectedDay, termEnd, animate }) {
  const isFit = metric === 'fit';
  const colors = colorsFor(metric, hostType);
  const lead = (dow(keys[0]) + 6) % 7; // Monday first
  const rows = Math.ceil((lead + keys.length) / 7);
  const angle = (rotation * Math.PI) / 180;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  // Orthographic projection: weekdays on X, weeks on Y, the selected metric on Z.
  const project = (x, y, z = 0) => [72 * (x * cos - y * sin), 48 * (x * sin + y * cos) - z * 62];
  const points = (vertices) => vertices.map((v) => project(...v).map((n) => n.toFixed(2)).join(',')).join(' ');
  const floor = [[0, 0], [7, 0], [7, rows], [0, rows]];
  const bounds = floor.flatMap(([x, y]) => [project(x, y), project(x, y, 1.4)]);
  const left = Math.min(...bounds.map((p) => p[0])) - 76;
  const top = Math.min(...bounds.map((p) => p[1])) - 16;
  const width = Math.max(...bounds.map((p) => p[0])) - left + 38;
  const height = Math.max(...bounds.map((p) => p[1])) - top + 58;
  const grid = [];
  for (let x = 0; x <= 7; x++) grid.push(`<polyline points="${points([[x, 0], [x, rows]])}" />`);
  for (let y = 0; y <= rows; y++) grid.push(`<polyline points="${points([[0, y], [7, y]])}" />`);
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => {
    const [x, y] = project(i + 0.5, rows + 0.43);
    return `<text x="${x}" y="${y}" class="heat-axis" text-anchor="middle">${d}</text>`;
  });
  for (let row = 0; row < rows; row++) {
    const [x, y] = project(-0.15, row + 0.5);
    labels.push(`<text x="${x - 10}" y="${y}" class="heat-axis" text-anchor="end">${short(addDays(keys[0], row * 7 - lead))}</text>`);
  }
  // Draw back to front so nearer columns cover farther ones.
  const cells = keys.map((k, i) => ({ k, x: (lead + i) % 7, y: Math.floor((lead + i) / 7) })).map((c) => ({ ...c, depth: c.x * sin + c.y * cos })).sort((a, b) => a.depth - b.depth);
  const columns = cells.map(({ k, x, y }) => {
    const available = fit[k].eligible;
    const muted = isFit ? !available : k > termEnd;
    const value = isFit ? fit[k].score : intensity[k];
    const z = ((value ?? 0) / 100) * 1.3 + 0.04;
    const x0 = x + 0.12, x1 = x + 0.88, y0 = y + 0.12, y1 = y + 0.88;
    const rgb = isFit && !available ? [226, 232, 240] : heatColor(value, colors);
    const shade = (s) => `rgb(${rgb.map((channel) => Math.round(channel * s)).join(',')})`;
    const [tx, ty] = project(x + 0.5, y + 0.5, z);
    const [bx, by] = project(x1, y0, z);
    const events = eventsByDay[k] ?? [];
    const fitLabel = available ? `event fit ${fit[k].score} out of 100` : `unavailable: ${fit[k].availability}`;
    const description = `${fmt(k)}: ${isFit ? fitLabel : `student workload ${intensity[k]} out of 100`}${rank[k] ? `, recommended date #${rank[k]}` : ''}${events.length ? ', ' + events.map((e) => e.summary).join(', ') : ''}`;
    return `<g class="heat-column ${muted ? 'out' : ''}" style="--column-delay:${(x + y) * 28}ms;--column-opacity:${muted ? '.4' : '1'}" role="button" tabindex="${k === selectedDay ? '0' : '-1'}" data-heat-day="${k}" aria-pressed="${k === selectedDay}" aria-label="${esc(description)}">
        <title>${esc(description)}</title>
        <polygon class="heat-side" points="${points([[x0, y1, 0], [x1, y1, 0], [x1, y1, z], [x0, y1, z]])}" fill="${shade(0.68)}" />
        <polygon class="heat-side" points="${points([[x1, y0, 0], [x1, y1, 0], [x1, y1, z], [x1, y0, z]])}" fill="${shade(0.83)}" />
        <polygon class="heat-top" points="${points([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]])}" fill="${shade(1)}" />
        <text class="heat-date" fill="${relativeLuminance(rgb) > 0.179 ? '#000' : '#fff'}" x="${tx}" y="${ty}" dy=".35em" text-anchor="middle">${dayOfMonth(k)}</text>
        ${rank[k] ? `<circle class="heat-rank" cx="${bx}" cy="${by}" r="9" /><text class="heat-rank-label" x="${bx}" y="${by}" dy=".35em" text-anchor="middle">${rank[k]}</text>` : events.length ? `<circle class="heat-event" cx="${bx - 3}" cy="${by + 3}" r="3.5" />` : ''}
      </g>`;
  }).join('');
  return `<svg class="heatmap-3d ${animate ? 'is-switching' : ''}" viewBox="${left} ${top} ${width} ${height}" role="group" aria-labelledby="heat-title heat-description">
      <title id="heat-title">3D ${isFit ? 'event fit' : 'campus workload'} calendar, December 2026</title>
      <desc id="heat-description">${isFit ? 'Taller, darker columns mean a better fit for the selected event category, from 0 to 100. Unavailable dates are flat and gray.' : 'Taller, darker columns mean heavier student workload, from 0 to 100.'} Weekdays run left to right and weeks run back to front. Use arrow keys to move between dates, or select a column for details.</desc>
      <polygon class="heat-floor" points="${points(floor)}" />
      <g class="heat-grid" aria-hidden="true">${grid.join('')}</g>
      <g aria-hidden="true">${labels.join('')}</g>
      ${columns}
    </svg>`;
}

export function renderHeatDetail({ day, fit, intensity, rank, eventsByDay }) {
  const f = fit[day];
  const events = eventsByDay[day] ?? [];
  return `<div class="row spread"><strong>${fmt(day)}</strong><span class="heat-availability">${rank[day] ? `Recommended #${rank[day]}` : f.eligible ? 'Available date' : 'Unavailable date'}</span></div>
      <div class="heat-stats">
        <div><span>Event fit</span><strong>${f.eligible ? `${f.score}<small> / 100</small>` : '<small>Unavailable</small>'}</strong></div>
        <div><span>Student workload</span><strong>${intensity[day]}<small> / 100</small></strong></div>
      </div>
      <p class="heat-reason">${esc(f.eligible ? f.reason : f.availability)}</p>
      <p class="heat-events">${events.length ? events.map((e) => `${esc(e.summary)} · ${time(e.start.dateTime)}`).join('<br>') : 'No campus events scheduled.'}</p>`;
}

// The best dates by fit, with a way to try the top one as a mock event.
export function renderFitPicks(picks, hostType, typeLabel) {
  const why = hostType === 'relax' ? 'Lands just before the crunch peaks, when students need it most.' : hostType === 'recruiting' ? 'Avoids deadline crunch so students actually show up rested.' : 'Moderate days with no clashing events.';
  return `<p class="sub">${why}</p>
      <div style="margin-top:8px">${picks.map((p, i) => `
        <div class="pick" style="--pick-delay:${120 + i * 80}ms"><span class="num">${i + 1}</span>
          <div><div class="when">${fmt(p.date)}, 6 PM</div><div class="why">${esc(p.reason)}</div></div>
          <span class="sc">${p.score}<small>/ 100 fit</small></span></div>`).join('')}</div>
      <button class="btn primary" id="try-top" style="margin-top:12px;width:100%" ${picks.length ? '' : 'disabled'}>${picks.length ? `Try ${typeLabel.toLowerCase()} on ${fmt(picks[0].date)} (mock)` : 'No dates available'}</button>`;
}

// Selecting a column updates the detail panel without redrawing the chart; the slider redraws only the chart.
export function bindHeatmap3d({ chart, detail, keys, getSelected, onSelect, redrawChart, getDetail, onRotate }) {
  const selectDay = (k, focus = false) => {
    onSelect(k);
    chart.querySelectorAll('[data-heat-day]').forEach((cell) => {
      const selected = cell.dataset.heatDay === k;
      cell.setAttribute('aria-pressed', String(selected));
      cell.setAttribute('tabindex', selected ? '0' : '-1');
      if (selected && focus) cell.focus();
    });
    detail.innerHTML = getDetail(k);
  };
  const bindColumns = () => chart.querySelectorAll('[data-heat-day]').forEach((cell) => {
    cell.onclick = () => selectDay(cell.dataset.heatDay);
    cell.onkeydown = (e) => {
      const i = keys.indexOf(cell.dataset.heatDay);
      const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault(); selectDay(cell.dataset.heatDay);
      } else if (Object.prototype.hasOwnProperty.call(offsets, e.key)) {
        e.preventDefault(); selectDay(keys[Math.max(0, Math.min(keys.length - 1, i + offsets[e.key]))], true);
      }
    };
  });
  bindColumns();
  document.getElementById('heat-rotation').oninput = (e) => {
    onRotate(Number(e.target.value));
    document.getElementById('heat-angle').value = `${e.target.value}°`;
    chart.innerHTML = redrawChart();
    bindColumns();
  };
  return getSelected;
}
