// ── ship.js — individual ship pages ──────────────────────────────────────────
import { state } from './state.js';

export const SHIP_CODES_ORDERED = ['ML','IN','SM','CS','SL','EQ','EC','SI','RF','EG','AX','BY','AT','XC'];
export const SHIP_DISPLAY = {
  ML:{name:'Millennium',cls:'Millennium',icon:'⛴',badge:'badge-teal'},
  IN:{name:'Infinity',   cls:'Millennium',icon:'⛴',badge:'badge-teal'},
  SM:{name:'Summit',     cls:'Millennium',icon:'⛴',badge:'badge-teal'},
  CS:{name:'Constellation',cls:'Millennium',icon:'⛴',badge:'badge-teal'},
  SL:{name:'Solstice',   cls:'Solstice',icon:'⛵',badge:'badge-blue'},
  EQ:{name:'Equinox',    cls:'Solstice',icon:'⛵',badge:'badge-blue'},
  EC:{name:'Eclipse',    cls:'Solstice',icon:'⛵',badge:'badge-blue'},
  SI:{name:'Silhouette', cls:'Solstice',icon:'⛵',badge:'badge-blue'},
  RF:{name:'Reflection', cls:'Solstice',icon:'⛵',badge:'badge-blue'},
  EG:{name:'Edge',       cls:'Edge',icon:'🛳',badge:'badge-purple'},
  AX:{name:'Apex',       cls:'Edge',icon:'🛳',badge:'badge-purple'},
  BY:{name:'Beyond',     cls:'Edge',icon:'🛳',badge:'badge-purple'},
  AT:{name:'Ascent',     cls:'Edge',icon:'🛳',badge:'badge-purple'},
  XC:{name:'Xcel',       cls:'Edge',icon:'🛳',badge:'badge-purple'},
};
export const SHIP_CLASS_MAP = {
  ML:'MILLENNIUM CLASS',IN:'MILLENNIUM CLASS',SM:'MILLENNIUM CLASS',CS:'MILLENNIUM CLASS',
  SL:'SOLSTICE CLASS',EQ:'SOLSTICE CLASS',EC:'SOLSTICE CLASS',SI:'SOLSTICE CLASS',RF:'SOLSTICE CLASS',
  EG:'EDGE CLASS',AX:'EDGE CLASS',BY:'EDGE CLASS',AT:'EDGE CLASS',XC:'EDGE CLASS'
};
export const SHIP_NAME_MAP = {
  ML:'Millennium',IN:'Infinity',SM:'Summit',CS:'Constellation',
  SL:'Solstice',EQ:'Equinox',EC:'Eclipse',SI:'Silhouette',RF:'Reflection',
  EG:'Edge',AX:'Apex',BY:'Beyond',AT:'Ascent',XC:'Xcel'
};
export const POS_ORDER = ['SPM','VPM','ETDC','EOF','EOS','EOL','ESS','EOMC'];
export const POS_COLORS = {SPM:'#E87435',VPM:'#299BE1',ETDC:'#13818D',EOF:'#4dd4a0',EOS:'#A4A4A7',EOL:'#7fc8e8',ESS:'#5a9fd4',EOMC:'#E87435'};
export const POS_COLORS_FUTURE = {SPM:'#f0a070',VPM:'#6dbee8',ETDC:'#4abcc8',EOF:'#80ddb8',EOS:'#c4c4c6',EOL:'#a8d8ee',ESS:'#8ab8da',EOMC:'#f0a070'};

export let currentShipCode = '';

export function initShipNav() {
  const clsGroups = {Millennium:[],Solstice:[],Edge:[]};
  SHIP_CODES_ORDERED.forEach(sc => {
    const d = SHIP_DISPLAY[sc];
    if (d) clsGroups[d.cls].push(sc);
  });
  let html = '';
  Object.entries(clsGroups).forEach(([cls, codes]) => {
    codes.forEach(sc => {
      const d = SHIP_DISPLAY[sc];
      html += `<button class="nav-item nav-ship-item" id="shipnav-${sc}" onclick="showShip('${sc}',this)"><span class="nav-icon" style="font-size:11px;">${d.icon}</span><span style="font-size:12px;">${d.name}</span></button>`;
    });
  });
  document.getElementById('ship-nav-items').innerHTML = html;
}

export function showShip(shipCode, el) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-ship').classList.add('active');
  if (el) el.classList.add('active');
  currentShipCode = shipCode;
  history.replaceState(null, '', '#ship-' + shipCode);
  renderShipPage(shipCode);
}

export function renderShipPage(sc) {
  const d = SHIP_DISPLAY[sc] || {name:sc,cls:'',icon:'⛴',badge:'badge-gray'};
  const now = new Date();

  const crew = state.crew.filter(c => c.recentShipCode === sc || c.shipCode === sc);
  const onboard = crew.filter(c => c.status === 'Onboard');
  const offboard = crew.filter(c => c.status === 'Offboard');
  const withFuture = crew.filter(c => c.futureOn && c.futureShip === sc);
  const signing30 = crew.filter(c => {
    if (!c.end || c.status !== 'Onboard') return false;
    const dd = (new Date(c.end) - now) / 86400000;
    return dd >= 0 && dd <= 30;
  });

  const kpiHtml = `
    <div class="ship-kpi"><div class="ship-kpi-label">Onboard</div><div class="ship-kpi-value ok">${onboard.length}</div></div>
    <div class="ship-kpi"><div class="ship-kpi-label">Offboard</div><div class="ship-kpi-value warn">${offboard.length}</div></div>
    <div class="ship-kpi"><div class="ship-kpi-label">Returning to ship</div><div class="ship-kpi-value">${withFuture.length}</div></div>
    <div class="ship-kpi"><div class="ship-kpi-label">Signing off (30d)</div><div class="ship-kpi-value ${signing30.length > 0 ? 'alert' : ''}">${signing30.length}</div></div>
    <div class="ship-kpi"><div class="ship-kpi-label">Total roster</div><div class="ship-kpi-value">${crew.length}</div></div>`;

  const posGridHtml = renderPosGrid(sc, crew, now);
  const tlHtml = renderTimeline(sc, crew, now);
  const manifestHtml = renderManifest(sc, crew, now);

  document.getElementById('ship-page-content').innerHTML = `
    <div class="ship-page-header">
      <div class="ship-page-icon" style="background:rgba(255,255,255,0.08);border:0.5px solid var(--border);">${d.icon}</div>
      <div>
        <div style="font-size:20px;font-weight:500;">${d.name}</div>
        <div style="font-size:13px;color:var(--text2);">${d.cls} Class</div>
      </div>
      <span class="badge ${d.badge}" style="margin-left:auto;">${sc}</span>
    </div>
    <div class="ship-kpi-row">${kpiHtml}</div>

    <div class="manifest-tabs">
      <button class="manifest-tab active" id="stab-manifest-${sc}" onclick="switchShipTab('${sc}','manifest')">Crew manifest</button>
      <button class="manifest-tab" id="stab-grid-${sc}" onclick="switchShipTab('${sc}','grid')">Crew by position</button>
      <button class="manifest-tab" id="stab-timeline-${sc}" onclick="switchShipTab('${sc}','timeline')">Contract timeline</button>
    </div>

    <div id="ship-tab-manifest-${sc}">${manifestHtml}</div>
    <div id="ship-tab-grid-${sc}" style="display:none;">
      <div class="card">
        <div class="card-header"><div><div class="card-title">Crew by position</div><div class="card-sub">Current onboard, offboard and future assignments</div></div></div>
        <div class="pos-grid">${posGridHtml}</div>
      </div>
    </div>
    <div id="ship-tab-timeline-${sc}" style="display:none;">
      <div class="card">
        <div class="card-header"><div><div class="card-title">Contract timeline</div><div class="card-sub">Sign-on and sign-off dates — 6 month window. Green = onboard, blue = future, amber = offboard/recent.</div></div></div>
        ${tlHtml}
      </div>
    </div>`;
}

export function switchShipTab(sc, tab) {
  ['manifest','grid','timeline'].forEach(t => {
    const el = document.getElementById(`ship-tab-${t}-${sc}`);
    const btn = document.getElementById(`stab-${t}-${sc}`);
    if (el) el.style.display = t === tab ? 'block' : 'none';
    if (btn) btn.classList.toggle('active', t === tab);
  });
}

// Helper: look up the port a ship is at on a given date from deployment data
export function deployPortOnDate(sc, dateStr) {
  if (!dateStr || !window._depData || !window._depData[sc]) return null;
  const rows = window._depData[sc];
  const row = rows.find(r => r.date === dateStr);
  if (!row) return null;
  if (row.dayType === 'S') return {port:'At sea',country:'',dayType:'S'};
  return {port:row.portName.split(',')[0].trim(),country:row.country||'',dayType:row.dayType};
}

export function renderManifest(sc, crew, now) {
  const current = crew.filter(c => c.status === 'Onboard').sort((a, b) => {
    const pa = POS_ORDER.indexOf(a.abbr), pb = POS_ORDER.indexOf(b.abbr);
    return pa !== pb ? pa - pb : a.name.localeCompare(b.name);
  });

  const incoming = crew.filter(c => c.status !== 'Onboard' && c.futureShip === sc && c.futureOn).sort((a, b) => {
    if (a.futureOn !== b.futureOn) return a.futureOn.localeCompare(b.futureOn);
    const pa = POS_ORDER.indexOf(a.abbr), pb = POS_ORDER.indexOf(b.abbr);
    return pa !== pb ? pa - pb : a.name.localeCompare(b.name);
  });

  const hasDeployment = !!(window._depData && window._depData[sc]);
  const deployNote = hasDeployment ? '' : `<div style="font-size:11px;color:var(--text2);background:rgba(232,116,53,.08);border:.5px solid rgba(232,116,53,.2);border-radius:var(--r);padding:6px 10px;margin-bottom:.75rem;">⚠ Upload fleet deployment data (Fleet → Fleet deployment) to see embark/debark ports.</div>`;

  function portCell(dateStr) {
    if (!dateStr) return `<td><span class="manifest-no-deploy">—</span></td>`;
    const info = deployPortOnDate(sc, dateStr);
    if (!hasDeployment) return `<td><span class="manifest-no-deploy">No deployment data</span></td>`;
    if (!info) return `<td><span class="manifest-no-deploy">Date not in range</span></td>`;
    const icon = info.dayType === 'T' ? '🔄' : info.dayType === 'S' ? '🌊' : '⚓';
    const portLabel = info.dayType === 'S' ? 'At sea' : info.port;
    return `<td><div class="manifest-port">${icon} ${portLabel}</div>${info.country && info.dayType !== 'S' ? `<div class="manifest-port-note">${info.country}</div>` : ''}</td>`;
  }

  function daysLeftBadge(dateStr) {
    if (!dateStr) return '';
    const days = Math.round((new Date(dateStr) - now) / 86400000);
    if (days < 0) return `<span class="days-badge days-critical">${Math.abs(days)}d ago</span>`;
    if (days <= 14) return `<span class="days-badge days-critical">${days}d</span>`;
    if (days <= 30) return `<span class="days-badge days-warn">${days}d</span>`;
    return `<span class="days-badge days-ok">${days}d</span>`;
  }

  function daysUntilBadge(dateStr) {
    if (!dateStr) return '';
    const days = Math.round((new Date(dateStr) - now) / 86400000);
    if (days < 0) return `<span class="days-badge days-critical">Overdue</span>`;
    if (days <= 14) return `<span class="days-badge days-warn">${days}d</span>`;
    if (days <= 30) return `<span class="days-badge days-ok">${days}d</span>`;
    return `<span class="days-badge days-future">${days}d</span>`;
  }

  const currentRows = current.map(c => {
    const posColor = POS_COLORS[c.abbr] || '#A4A4A7';
    return `<tr>
      <td><div class="manifest-name">${c.name}</div><div class="manifest-id">#${c.id}</div></td>
      <td><span class="badge" style="background:${posColor}22;color:${posColor};border:.5px solid ${posColor}55;font-size:10px;">${c.abbr}</span></td>
      <td style="font-size:11px;">${c.start || '—'}</td>
      ${portCell(c.start)}
      <td style="font-size:11px;">${c.end || '—'} ${daysLeftBadge(c.end)}</td>
      ${portCell(c.end)}
      <td style="font-size:11px;color:var(--text2);">${c.airport || '—'}</td>
      <td style="font-size:11px;color:var(--text2);">${c.nat || '—'}</td>
    </tr>`;
  }).join('');

  const incomingRows = incoming.map(c => {
    const posColor = POS_COLORS[c.abbr] || '#A4A4A7';
    return `<tr>
      <td><div class="manifest-name">${c.name}</div><div class="manifest-id">#${c.id}</div></td>
      <td><span class="badge" style="background:${posColor}22;color:${posColor};border:.5px solid ${posColor}55;font-size:10px;">${c.abbr}</span></td>
      <td style="font-size:11px;">${c.futureOn || '—'} ${daysUntilBadge(c.futureOn)}</td>
      ${portCell(c.futureOn)}
      <td style="font-size:11px;">${c.futureOff || '—'}</td>
      ${portCell(c.futureOff)}
      <td style="font-size:11px;color:var(--text2);">${c.airport || '—'}</td>
      <td style="font-size:11px;color:var(--text2);">${c.nat || '—'}</td>
    </tr>`;
  }).join('');

  const th = `<thead><tr>
    <th>Name / ID</th>
    <th>Position</th>
    <th>Sign on</th>
    <th>Embark port</th>
    <th>Sign off</th>
    <th>Debark port</th>
    <th>Gateway</th>
    <th>Nationality</th>
  </tr></thead>`;

  return `
    ${deployNote}
    <div class="card" style="margin-bottom:1rem;">
      <div class="card-header">
        <div>
          <div class="card-title">Current crew <span class="manifest-count-badge" style="background:rgba(77,212,160,.15);color:#4dd4a0;border:.5px solid rgba(77,212,160,.3);">${current.length}</span></div>
          <div class="card-sub">All crew currently onboard — sign-on/off dates and embark/debark ports</div>
        </div>
        <input class="manifest-search" placeholder="Search name or position…" oninput="filterManifest('${sc}','current',this.value)"/>
      </div>
      <div style="overflow-x:auto;max-height:460px;overflow-y:auto;" id="manifest-current-wrap-${sc}">
        <table class="manifest-table" id="manifest-current-${sc}">
          ${th}
          <tbody>${currentRows || `<tr><td colspan="8" class="manifest-empty">No crew currently onboard.</td></tr>`}</tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">Incoming crew <span class="manifest-count-badge" style="background:rgba(41,155,225,.15);color:#299BE1;border:.5px solid rgba(41,155,225,.3);">${incoming.length}</span></div>
          <div class="card-sub">Confirmed future assignments to this ship — ordered by sign-on date</div>
        </div>
        <input class="manifest-search" placeholder="Search name or position…" oninput="filterManifest('${sc}','incoming',this.value)"/>
      </div>
      <div style="overflow-x:auto;max-height:460px;overflow-y:auto;" id="manifest-incoming-wrap-${sc}">
        <table class="manifest-table" id="manifest-incoming-${sc}">
          ${th}
          <tbody>${incomingRows || `<tr><td colspan="8" class="manifest-empty">No incoming crew with confirmed future assignments.</td></tr>`}</tbody>
        </table>
      </div>
    </div>`;
}

export function filterManifest(sc, section, query) {
  const q = query.toLowerCase().trim();
  const tbody = document.querySelector(`#manifest-${section}-${sc} tbody`);
  if (!tbody) return;
  tbody.querySelectorAll('tr').forEach(tr => {
    const text = tr.textContent.toLowerCase();
    tr.style.display = (!q || text.includes(q)) ? '' : 'none';
  });
}

export function renderPosGrid(sc, crew, now) {
  let html = '';
  POS_ORDER.forEach(abbr => {
    const members = crew.filter(c => c.abbr === abbr);
    if (!members.length) return;
    const sorted = [
      ...members.filter(c => c.status === 'Onboard').sort((a, b) => a.name.localeCompare(b.name)),
      ...members.filter(c => c.status !== 'Onboard' && c.futureShip === sc).sort((a, b) => a.name.localeCompare(b.name)),
      ...members.filter(c => c.status !== 'Onboard' && c.futureShip !== sc).sort((a, b) => a.name.localeCompare(b.name)),
    ];
    const slots = sorted.map(c => {
      const isOnboard = c.status === 'Onboard';
      const isFuture = c.status !== 'Onboard' && c.futureShip === sc;
      const cls = isOnboard ? 'onboard' : isFuture ? 'future' : 'offboard';
      const daysLeft = c.end && isOnboard ? Math.round((new Date(c.end) - now) / 86400000) : null;
      const badge = daysLeft !== null ? (daysLeft < 0 ? 'badge-red' : daysLeft <= 30 ? 'badge-red' : daysLeft <= 60 ? 'badge-amber' : 'badge-green') : '';
      const dateInfo = isOnboard && c.end
        ? `<span class="badge ${badge}" style="font-size:10px;">${c.end} <span style="opacity:0.8;">(${daysLeft}d)</span></span>`
        : isFuture && c.futureOn
        ? `<span class="badge badge-blue" style="font-size:10px;">→ ${c.futureOn}</span>`
        : c.end
        ? `<span style="font-size:10px;color:var(--text2);">Off: ${c.end}</span>`
        : '<span style="font-size:10px;color:var(--text2);">—</span>';
      const statusLabel = isOnboard ? 'Onboard' : isFuture ? 'Returning' : 'Offboard';
      const dotCls = isOnboard ? 'dot-on' : isFuture ? '' : 'dot-off';
      return `<div class="crew-slot ${cls}">
        <div><div class="crew-slot-name">${c.name}</div><div class="crew-slot-nat">${c.nat || ''}${c.airport ? ' · ' + c.airport : ''}</div></div>
        <div>${dateInfo}</div>
        <div><span class="status-dot ${dotCls}" style="${isFuture ? 'background:var(--blue-t);' : ''} margin-right:4px;"></span><span style="font-size:10px;color:var(--text2);">${statusLabel}</span></div>
      </div>`;
    }).join('');
    html += `<div class="pos-grid-row">
      <div class="pos-label-cell"><div class="pos-label">${abbr}</div></div>
      <div class="pos-slots">${slots}</div>
    </div>`;
  });
  return html || '<p class="empty">No crew records found for this ship.</p>';
}

export function renderTimeline(sc, crew, now) {
  const windowStart = new Date(now);
  windowStart.setMonth(windowStart.getMonth() - 1);
  windowStart.setDate(1);
  const windowEnd = new Date(windowStart);
  windowEnd.setMonth(windowEnd.getMonth() + 7);
  const totalDays = (windowEnd - windowStart) / 86400000;
  const TOTAL_W = 900;

  function pct(d) { return Math.max(0, Math.min(100, (d - windowStart) / (windowEnd - windowStart) * 100)); }

  const months = [];
  let m = new Date(windowStart); m.setDate(1);
  while (m <= windowEnd) {
    months.push(new Date(m));
    m.setMonth(m.getMonth() + 1);
  }
  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const rulerHtml = months.map(mo => {
    const w = (new Date(mo.getFullYear(), mo.getMonth() + 1, 1) - mo) / 86400000 / totalDays * 100;
    return `<div class="tl-ruler-mark" style="width:${w}%;">${MONTH_NAMES[mo.getMonth()]} ${String(mo.getFullYear()).slice(2)}</div>`;
  }).join('');

  const todayPct = pct(now);

  const sorted = [...crew].sort((a, b) => {
    const pa = POS_ORDER.indexOf(a.abbr), pb = POS_ORDER.indexOf(b.abbr);
    if (pa !== pb) return pa - pb;
    return a.name.localeCompare(b.name);
  });

  const ROW_H = 24;
  const ROW_GAP = 4;
  const totalH = (ROW_H + ROW_GAP) * sorted.length;

  let bars = '';
  let labelRows = '';
  sorted.forEach((c, i) => {
    const top = i * (ROW_H + ROW_GAP);
    if (c.start || c.end) {
      const s = c.start ? new Date(c.start) : windowStart;
      const e = c.end ? new Date(c.end) : windowEnd;
      if (e >= windowStart && s <= windowEnd) {
        const left = pct(s);
        const right = pct(e);
        const width = right - left;
        const color = c.status === 'Onboard' ? POS_COLORS[c.abbr] || '#4dd4a0' : POS_COLORS_FUTURE[c.abbr] || 'var(--highlight)';
        const opacity = c.status === 'Onboard' ? 1 : 0.55;
        if (width > 0) bars += `<div class="tl-bar" style="left:${left}%;width:${width}%;top:${top}px;height:${ROW_H}px;background:${color};opacity:${opacity};" title="${c.name} · ${c.abbr} · ${c.start || '?'} → ${c.end || '?'}">${width > 4 ? c.name : ''}</div>`;
      }
    }
    if (c.futureOn && (c.futureShip === sc || !c.futureShip)) {
      const fs = new Date(c.futureOn);
      const fe = c.futureOff ? new Date(c.futureOff) : new Date(fs.getTime() + 180 * 86400000);
      if (fe >= windowStart && fs <= windowEnd) {
        const left = pct(fs);
        const right = pct(fe);
        const width = right - left;
        if (width > 0) bars += `<div class="tl-bar tl-future" style="left:${left}%;width:${width}%;top:${top}px;height:${ROW_H}px;background:${POS_COLORS_FUTURE[c.abbr] || 'var(--blue-t)'};" title="${c.name} · Future: ${c.futureOn} → ${c.futureOff || '?'}">${width > 4 ? c.name : ''}</div>`;
      }
    }
    labelRows += `<div style="height:${ROW_H}px;display:flex;align-items:center;gap:6px;margin-bottom:${ROW_GAP}px;">
      <span class="badge badge-gray" style="font-size:9px;width:34px;text-align:center;flex-shrink:0;">${c.abbr}</span>
      <span style="font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:130px;">${c.name}</span>
    </div>`;
  });

  const todayBar = `<div class="today-line" style="left:${todayPct}%;height:${totalH}px;"></div>`;

  return `<div style="display:grid;grid-template-columns:180px 1fr;gap:0;">
    <div style="padding-top:24px;overflow:hidden;">${labelRows}</div>
    <div class="timeline-wrap">
      <div class="tl-ruler">${rulerHtml}</div>
      <div class="tl-outer" style="width:${TOTAL_W}px;height:${totalH}px;position:relative;">
        ${bars}
        ${todayBar}
      </div>
    </div>
  </div>`;
}

// Expose constants on window for modules that access them at render time
window.SHIP_DISPLAY        = SHIP_DISPLAY;
window.SHIP_CLASS_MAP      = SHIP_CLASS_MAP;
window.SHIP_NAME_MAP       = SHIP_NAME_MAP;
window.SHIP_CODES_ORDERED  = SHIP_CODES_ORDERED;
window.POS_ORDER           = POS_ORDER;
window.POS_COLORS          = POS_COLORS;
window.POS_COLORS_FUTURE   = POS_COLORS_FUTURE;

window.initShipNav      = initShipNav;
window.showShip         = showShip;
window.renderShipPage   = renderShipPage;
window.switchShipTab    = switchShipTab;
window.deployPortOnDate = deployPortOnDate;
window.renderManifest   = renderManifest;
window.filterManifest   = filterManifest;
window.renderPosGrid    = renderPosGrid;
window.renderTimeline   = renderTimeline;
