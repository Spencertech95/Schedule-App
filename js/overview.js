// ── overview.js — overview page rendering ────────────────────────────────────
import { state } from './state.js';
import { classBadge, statusBadge, crewLink } from './utils.js';

export function renderOverview() {
  const now = new Date();
  const fleetTotal = state.ships.reduce((a, s) => {
    const m = state.manning[s.shipClass];
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
    return `<div class="row-item"><div><div style="font-size:13px;font-weight:500;">${crewLink(c.name, c.id)}</div><div style="font-size:11px;color:var(--text2);">${pos ? pos.abbr : '—'} · ${ship ? ship.name : '—'}</div></div><span class="badge ${days < 30 ? 'badge-red' : 'badge-amber'}">${days}d</span></div>`;
  }).join('') : '<p class="empty">No contracts ending in the next 60 days.</p>';

  const alerts = state.crew.filter(c => { const d = (new Date(c.medical) - now) / 86400000; return d >= 0 && d <= 90; });
  document.getElementById('cert-alerts').innerHTML = alerts.length ? alerts.map(c => {
    const ship = state.ships.find(s => s.id == c.shipId);
    const days = Math.round((new Date(c.medical) - now) / 86400000);
    return `<div class="row-item"><div><div style="font-size:13px;font-weight:500;">${crewLink(c.name, c.id)}</div><div style="font-size:11px;color:var(--text2);">Medical cert expires ${c.medical} · ${ship ? ship.name : '—'}</div></div><span class="badge ${days < 30 ? 'badge-red' : 'badge-amber'}">${days}d</span></div>`;
  }).join('') : '<p class="empty">No certification alerts in the next 90 days.</p>';

  // ── Open Offers ──
  const activeOffers = state.offers.filter(o => !o.terminalDate || ((now - new Date(o.terminalDate)) / 86400000) < 30);
  const stageCounts  = { Draft: 0, Sent: 0, Accepted: 0, Declined: 0, Confirmed: 0 };
  for (const o of activeOffers) if (stageCounts[o.stage] !== undefined) stageCounts[o.stage]++;

  const stagePills = [
    { key: 'Draft',     cls: 'badge-gray'   },
    { key: 'Sent',      cls: 'badge-amber'  },
    { key: 'Accepted',  cls: 'badge-green'  },
    { key: 'Confirmed', cls: 'badge-teal'   },
    { key: 'Declined',  cls: 'badge-red'    },
  ].filter(s => stageCounts[s.key] > 0)
   .map(s => `<span class="badge ${s.cls}" style="font-size:10px;">${s.key} <strong>${stageCounts[s.key]}</strong></span>`)
   .join('');

  const sentOffers = activeOffers
    .filter(o => o.stage === 'Sent')
    .sort((a, b) => (a.sentDate || '').localeCompare(b.sentDate || ''));

  const sentRows = sentOffers.map(o => {
    const crew = state.crew.find(c => c.id == o.crewId);
    const daysWaiting = o.sentDate ? Math.round((now - new Date(o.sentDate)) / 86400000) : null;
    const SHIP_NAMES = {ML:'Millennium',IN:'Infinity',SM:'Summit',CS:'Constellation',SL:'Solstice',EQ:'Equinox',EC:'Eclipse',SI:'Silhouette',RF:'Reflection',EG:'Edge',AX:'Apex',BY:'Beyond',AT:'Ascent',XC:'Xcel'};
    const shipName = SHIP_NAMES[o.ship] || o.ship || '—';
    return `<div class="row-item">
      <div>
        <div style="font-size:13px;font-weight:500;">${crew ? crewLink(crew.name, crew.id) : (o.crewName || '—')}</div>
        <div style="font-size:11px;color:var(--text2);">${o.type || 'Offer'} · ${shipName}${o.dateFrom ? ' · ' + o.dateFrom : ''}</div>
      </div>
      ${daysWaiting !== null ? `<span class="badge ${daysWaiting >= 5 ? 'badge-red' : 'badge-amber'}" style="flex-shrink:0;">${daysWaiting}d waiting</span>` : ''}
    </div>`;
  }).join('');

  document.getElementById('overview-offers').innerHTML = `
    <div class="card-title">Open Offers</div>
    <div style="display:flex;flex-wrap:wrap;gap:5px;margin:6px 0 12px;">${stagePills || '<span style="font-size:12px;color:var(--text2);">No active offers</span>'}</div>
    ${sentOffers.length
      ? `<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text2);margin-bottom:6px;">Awaiting response</div>${sentRows}`
      : '<p class="empty" style="margin:0;">No offers awaiting crew response.</p>'}`;

  // ── Upcoming Turnover ──
  const in30 = c => { const d = (new Date(c) - now) / 86400000; return d >= 0 && d <= 30; };

  const signingOff = state.crew
    .filter(c => c.status === 'Onboard' && in30(c.end))
    .sort((a, b) => a.end.localeCompare(b.end));

  const signingOn = state.crew
    .filter(c => c.status === 'Incoming' && in30(c.start))
    .sort((a, b) => (a.start || '').localeCompare(b.start || ''));

  function turnoverRow(c) {
    const pos  = state.positions.find(p => p.id == c.posId);
    const ship = state.ships.find(s => s.id == c.shipId);
    const date = c.status === 'Onboard' ? c.end : c.start;
    const days = Math.round((new Date(date) - now) / 86400000);
    return `<div class="row-item">
      <div>
        <div style="font-size:13px;font-weight:500;">${crewLink(c.name, c.id)}</div>
        <div style="font-size:11px;color:var(--text2);">${pos ? pos.abbr : '—'} · ${ship ? ship.name : '—'}</div>
      </div>
      <span class="badge ${days <= 7 ? 'badge-red' : 'badge-amber'}" style="flex-shrink:0;">${days === 0 ? 'Today' : days + 'd'}</span>
    </div>`;
  }

  const offSection = signingOff.length
    ? `<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text2);margin-bottom:6px;">Signing off</div>${signingOff.map(turnoverRow).join('')}`
    : '';
  const onSection = signingOn.length
    ? `<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text2);margin:${signingOff.length ? '14px' : '0'} 0 6px;">Signing on</div>${signingOn.map(turnoverRow).join('')}`
    : '';

  document.getElementById('overview-turnover').innerHTML = `
    <div class="card-title">Upcoming Turnover <span class="badge badge-gray" style="font-size:10px;margin-left:6px;">30 days</span></div>
    <div style="margin-top:10px;">
      ${offSection || onSection ? offSection + onSection : '<p class="empty" style="margin:0;">No turnover in the next 30 days.</p>'}
    </div>`;
}
