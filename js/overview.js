// ── overview.js — overview page rendering ────────────────────────────────────
import { state } from './state.js';
import { classBadge, crewLink } from './utils.js';

const MAX = 5;

function moreNote(total) {
  if (total <= MAX) return '';
  return `<div style="font-size:11px;color:var(--text2);padding-top:4px;">+${total - MAX} more</div>`;
}

function sectionHead(label, mt = false) {
  return `<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text2);${mt ? 'margin-top:12px;' : ''}margin-bottom:5px;">${label}</div>`;
}

export function renderOverview() {
  const now = new Date();

  // ── KPI metrics ──
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

  // ── Manning by class ──
  const classes = ['Millennium', 'Solstice', 'Edge'];
  const perShip = { Millennium: 10, Solstice: 13, Edge: 20 };
  document.getElementById('overview-manning').innerHTML = `
    <div class="card-title">Manning</div>
    <table class="data-table" style="margin-top:8px;">
      <thead><tr><th>Class</th><th class="num">Ships</th><th class="num">Per ship</th><th class="num">Total</th></tr></thead>
      <tbody>${classes.map(c => {
        const n = state.ships.filter(s => s.shipClass === c).length;
        return `<tr><td>${classBadge(c)} ${c}</td><td class="num">${n}</td><td class="num">${perShip[c]}</td><td class="num">${n * perShip[c]}</td></tr>`;
      }).join('')}
      <tr class="total-row"><td>Fleet total</td><td class="num">${state.ships.length}</td><td class="num">—</td><td class="num">${fleetTotal}</td></tr>
      </tbody>
    </table>`;

  // ── Contracts ending ──
  const ending = state.crew
    .filter(c => { const d = (new Date(c.end) - now) / 86400000; return d >= 0 && d <= 60; })
    .sort((a, b) => a.end.localeCompare(b.end));

  document.getElementById('upcoming-endings').innerHTML = `
    <div class="card-title">Contracts Ending <span class="badge badge-gray" style="font-size:10px;margin-left:6px;">60 days</span></div>
    <div style="margin-top:8px;">${ending.length
      ? ending.slice(0, MAX).map(c => {
          const pos  = state.positions.find(p => p.id == c.posId);
          const ship = state.ships.find(s => s.id == c.shipId);
          const days = Math.round((new Date(c.end) - now) / 86400000);
          return `<div class="ov-row"><div><div class="ov-name">${crewLink(c.name, c.id)}</div><div class="ov-sub">${pos ? pos.abbr : '—'} · ${ship ? ship.name : '—'}</div></div><span class="badge ${days < 30 ? 'badge-red' : 'badge-amber'}">${days}d</span></div>`;
        }).join('') + moreNote(ending.length)
      : '<p class="empty" style="margin:0;">None in the next 60 days.</p>'}
    </div>`;

  // ── Cert alerts ──
  const alerts = state.crew
    .filter(c => { const d = (new Date(c.medical) - now) / 86400000; return d >= 0 && d <= 90; })
    .sort((a, b) => a.medical.localeCompare(b.medical));

  document.getElementById('cert-alerts').innerHTML = `
    <div class="card-title">Cert Alerts <span class="badge badge-gray" style="font-size:10px;margin-left:6px;">90 days</span></div>
    <div style="margin-top:8px;">${alerts.length
      ? alerts.slice(0, MAX).map(c => {
          const ship = state.ships.find(s => s.id == c.shipId);
          const days = Math.round((new Date(c.medical) - now) / 86400000);
          return `<div class="ov-row"><div><div class="ov-name">${crewLink(c.name, c.id)}</div><div class="ov-sub">Expires ${c.medical} · ${ship ? ship.name : '—'}</div></div><span class="badge ${days < 30 ? 'badge-red' : 'badge-amber'}">${days}d</span></div>`;
        }).join('') + moreNote(alerts.length)
      : '<p class="empty" style="margin:0;">None in the next 90 days.</p>'}
    </div>`;

  // ── Open Offers ──
  const activeOffers = state.offers.filter(o => !o.terminalDate || ((now - new Date(o.terminalDate)) / 86400000) < 30);
  const stageCounts  = { Draft: 0, Sent: 0, Accepted: 0, Declined: 0, Confirmed: 0 };
  for (const o of activeOffers) if (stageCounts[o.stage] !== undefined) stageCounts[o.stage]++;

  const stagePills = [
    { key: 'Draft',     cls: 'badge-gray'  },
    { key: 'Sent',      cls: 'badge-amber' },
    { key: 'Accepted',  cls: 'badge-green' },
    { key: 'Confirmed', cls: 'badge-teal'  },
    { key: 'Declined',  cls: 'badge-red'   },
  ].filter(s => stageCounts[s.key] > 0)
   .map(s => `<span class="badge ${s.cls}" style="font-size:10px;">${s.key} <strong>${stageCounts[s.key]}</strong></span>`)
   .join('');

  const SHIP_NAMES = {ML:'Millennium',IN:'Infinity',SM:'Summit',CS:'Constellation',SL:'Solstice',EQ:'Equinox',EC:'Eclipse',SI:'Silhouette',RF:'Reflection',EG:'Edge',AX:'Apex',BY:'Beyond',AT:'Ascent',XC:'Xcel'};
  const sentOffers = activeOffers
    .filter(o => o.stage === 'Sent')
    .sort((a, b) => (a.sentDate || '').localeCompare(b.sentDate || ''));

  const sentRows = sentOffers.slice(0, MAX).map(o => {
    const crew = state.crew.find(c => c.id == o.crewId);
    const daysWaiting = o.sentDate ? Math.round((now - new Date(o.sentDate)) / 86400000) : null;
    return `<div class="ov-row">
      <div>
        <div class="ov-name">${crew ? crewLink(crew.name, crew.id) : (o.crewName || '—')}</div>
        <div class="ov-sub">${o.type || 'Offer'} · ${SHIP_NAMES[o.ship] || o.ship || '—'}${o.dateFrom ? ' · ' + o.dateFrom : ''}</div>
      </div>
      ${daysWaiting !== null ? `<span class="badge ${daysWaiting >= 5 ? 'badge-red' : 'badge-amber'}" style="flex-shrink:0;">${daysWaiting}d</span>` : ''}
    </div>`;
  }).join('');

  document.getElementById('overview-offers').innerHTML = `
    <div class="card-title">Open Offers</div>
    <div style="display:flex;flex-wrap:wrap;gap:5px;margin:6px 0 10px;">${stagePills || '<span style="font-size:12px;color:var(--text2);">No active offers</span>'}</div>
    ${sentOffers.length
      ? sectionHead('Awaiting response') + sentRows + moreNote(sentOffers.length)
      : '<p class="empty" style="margin:0;">No offers awaiting crew response.</p>'}`;

  // ── Upcoming Turnover ──
  const in30 = d => { const days = (new Date(d) - now) / 86400000; return days >= 0 && days <= 30; };

  const signingOff = state.crew.filter(c => c.status === 'Onboard' && c.end && in30(c.end))
    .sort((a, b) => a.end.localeCompare(b.end));
  const signingOn  = state.crew.filter(c => c.status === 'Incoming' && c.start && in30(c.start))
    .sort((a, b) => a.start.localeCompare(b.start));

  function turnoverRow(c) {
    const pos  = state.positions.find(p => p.id == c.posId);
    const ship = state.ships.find(s => s.id == c.shipId);
    const date = c.status === 'Onboard' ? c.end : c.start;
    const days = Math.round((new Date(date) - now) / 86400000);
    return `<div class="ov-row">
      <div>
        <div class="ov-name">${crewLink(c.name, c.id)}</div>
        <div class="ov-sub">${pos ? pos.abbr : '—'} · ${ship ? ship.name : '—'}</div>
      </div>
      <span class="badge ${days <= 7 ? 'badge-red' : 'badge-amber'}" style="flex-shrink:0;">${days === 0 ? 'Today' : days + 'd'}</span>
    </div>`;
  }

  const hasBoth = signingOff.length && signingOn.length;
  document.getElementById('overview-turnover').innerHTML = `
    <div class="card-title">Upcoming Turnover <span class="badge badge-gray" style="font-size:10px;margin-left:6px;">30 days</span></div>
    ${signingOff.length || signingOn.length
      ? `<div style="display:grid;grid-template-columns:${hasBoth ? '1fr 1fr' : '1fr'};gap:0 1.5rem;margin-top:8px;">
          ${signingOff.length ? `<div>${sectionHead('Signing off')}${signingOff.slice(0, MAX).map(turnoverRow).join('')}${moreNote(signingOff.length)}</div>` : ''}
          ${signingOn.length  ? `<div>${sectionHead('Signing on')} ${signingOn.slice(0, MAX).map(turnoverRow).join('')}${moreNote(signingOn.length)}</div>` : ''}
         </div>`
      : '<p class="empty" style="margin-top:8px;">No turnover in the next 30 days.</p>'}`;
}
