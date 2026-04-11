// ── overview.js — overview page rendering ────────────────────────────────────
import { state } from './state.js';
import { CLASS_MANNING } from './data.js';
import { classBadge, statusBadge } from './utils.js';

export function renderOverview() {
  const now = new Date();
  const fleetTotal = state.ships.reduce((a, s) => {
    const m = CLASS_MANNING[s.shipClass];
    return a + (m ? Object.values(m).reduce((x, y) => x + y, 0) : 0);
  }, 0);
  const onboard    = state.crew.filter(c => c.status === 'Onboard').length;
  const incoming   = state.crew.filter(c => c.status === 'Incoming').length;
  const ending60   = state.crew.filter(c => { const d = (new Date(c.end) - now) / 86400000; return d >= 0 && d <= 60; }).length;
  const certAlerts = state.crew.filter(c => { const d = (new Date(c.medical) - now) / 86400000; return d >= 0 && d <= 90; }).length;

  document.getElementById('metrics').innerHTML = `
    <div class="metric"><div class="metric-label">Fleet crew capacity</div><div class="metric-value">${fleetTotal}</div></div>
    <div class="metric"><div class="metric-label">Onboard</div><div class="metric-value ok">${onboard}</div></div>
    <div class="metric"><div class="metric-label">Incoming</div><div class="metric-value">${incoming}</div></div>
    <div class="metric"><div class="metric-label">Ending (60d)</div><div class="metric-value ${ending60 > 0 ? 'warn' : 'ok'}">${ending60}</div></div>
    <div class="metric"><div class="metric-label">Cert alerts (90d)</div><div class="metric-value ${certAlerts > 0 ? 'alert' : 'ok'}">${certAlerts}</div></div>`;

  const classes = ['Millennium', 'Solstice', 'Edge'];
  const perShip = {Millennium: 10, Solstice: 13, Edge: 20};
  document.getElementById('overview-manning').innerHTML = `<table class="data-table">
    <thead><tr><th>Class</th><th class="num">Ships</th><th class="num">Crew/ship</th><th class="num">Total</th></tr></thead>
    <tbody>${classes.map(c => {
      const n = state.ships.filter(s => s.shipClass === c).length;
      return `<tr><td>${classBadge(c)} ${c} Class</td><td class="num">${n}</td><td class="num">${perShip[c]}</td><td class="num">${n * perShip[c]}</td></tr>`;
    }).join('')}<tr class="total-row"><td>Fleet total</td><td class="num">${state.ships.length}</td><td class="num">—</td><td class="num">${fleetTotal}</td></tr></tbody></table>`;

  const ending = state.crew.filter(c => { const d = (new Date(c.end) - now) / 86400000; return d >= 0 && d <= 60; });
  document.getElementById('upcoming-endings').innerHTML = ending.length ? ending.map(c => {
    const pos  = state.positions.find(p => p.id == c.posId);
    const ship = state.ships.find(s => s.id == c.shipId);
    const days = Math.round((new Date(c.end) - now) / 86400000);
    return `<div class="row-item"><div><div style="font-size:13px;font-weight:500;">${c.name}</div><div style="font-size:11px;color:var(--text2);">${pos ? pos.abbr : '—'} · ${ship ? ship.name : '—'}</div></div><span class="badge ${days < 30 ? 'badge-red' : 'badge-amber'}">${days}d</span></div>`;
  }).join('') : '<p class="empty">No contracts ending in the next 60 days.</p>';

  const alerts = state.crew.filter(c => { const d = (new Date(c.medical) - now) / 86400000; return d >= 0 && d <= 90; });
  document.getElementById('cert-alerts').innerHTML = alerts.length ? alerts.map(c => {
    const ship = state.ships.find(s => s.id == c.shipId);
    const days = Math.round((new Date(c.medical) - now) / 86400000);
    return `<div class="row-item"><div><div style="font-size:13px;font-weight:500;">${c.name}</div><div style="font-size:11px;color:var(--text2);">Medical cert expires ${c.medical} · ${ship ? ship.name : '—'}</div></div><span class="badge ${days < 30 ? 'badge-red' : 'badge-amber'}">${days}d</span></div>`;
  }).join('') : '<p class="empty">No certification alerts in the next 90 days.</p>';
}
