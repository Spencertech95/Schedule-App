// ── ship.js — individual ship pages ──────────────────────────────────────────
import { state, uid } from './state.js';
import { parsePortLocation, getShipPortForDate, crewLink, showToast } from './utils.js';
import { upsertCrew } from './db.js';

const SC_TO_SHIP_ID = {ML:1,IN:2,SM:3,CS:4,SL:5,EQ:6,EC:7,SI:8,RF:9,EG:10,AX:11,BY:12,AT:13,XC:14};

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

export function toggleShipsNav() {
  document.getElementById('ship-nav-items').classList.toggle('open');
}

export function showShip(shipCode, el) {
  document.querySelectorAll('.topbar-nav-item, .topbar-action-btn, .nav-item').forEach(n => n.classList.remove('active'));
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

// Helper: look up the port a ship is at on a given date.
// Tries per-day _depData first (exact match), then falls back to monthly SHIP_DEPLOYMENT.
export function deployPortOnDate(sc, dateStr) {
  if (!dateStr) return null;

  // Try exact per-day data if uploaded
  if (window._depData && window._depData[sc]) {
    const row = window._depData[sc].find(r => r.date === dateStr);
    if (row) {
      if (row.dayType === 'S') return { port: 'At sea', city: 'At sea', country: '', dayType: 'S' };
      const loc = parsePortLocation(row.portName);
      return { port: loc.city, city: loc.city, country: loc.country, dayType: row.dayType };
    }
  }

  // Fall back to monthly SHIP_DEPLOYMENT data
  const monthly = getShipPortForDate(sc, dateStr);
  if (monthly) {
    const loc = parsePortLocation(monthly.port);
    return { port: loc.city, city: loc.city, country: loc.country, region: monthly.region, dayType: 'T' };
  }

  return null;
}

function buildAddForm(sc, section) {
  const isIncoming = section === 'incoming';
  const posOpts = state.positions.map(p => `<option value="${p.id}">${p.abbr} — ${p.title}</option>`).join('');
  return `<div id="manifest-add-${section}-${sc}" style="display:none;background:rgba(255,255,255,.03);border-bottom:.5px solid var(--border);padding:10px 12px;">
    <div style="font-size:11px;font-weight:600;color:var(--text2);margin-bottom:8px;">Add ${isIncoming ? 'incoming' : 'onboard'} crew member</div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;">
      <div class="field" style="margin:0;flex:2;min-width:150px;">
        <label style="font-size:10px;">Full name *</label>
        <input type="text" id="madd-name-${sc}-${section}" placeholder="First Last" style="font-size:12px;width:100%;"/>
      </div>
      <div class="field" style="margin:0;min-width:140px;">
        <label style="font-size:10px;">Position *</label>
        <select id="madd-pos-${sc}-${section}" style="font-size:12px;width:100%;">${posOpts}</select>
      </div>
      <div class="field" style="margin:0;min-width:130px;">
        <label style="font-size:10px;">${isIncoming ? 'Sign on (future)' : 'Sign on'}</label>
        <input type="date" id="madd-signon-${sc}-${section}" style="font-size:12px;width:100%;"/>
      </div>
      <div class="field" style="margin:0;min-width:130px;">
        <label style="font-size:10px;">${isIncoming ? 'Sign off (future)' : 'Sign off'}</label>
        <input type="date" id="madd-signoff-${sc}-${section}" style="font-size:12px;width:100%;"/>
      </div>
      <div class="field" style="margin:0;width:72px;">
        <label style="font-size:10px;">Nationality</label>
        <input type="text" id="madd-nat-${sc}-${section}" placeholder="GBR" maxlength="3" style="font-size:12px;width:100%;"/>
      </div>
      <div class="field" style="margin:0;width:72px;">
        <label style="font-size:10px;">Airport</label>
        <input type="text" id="madd-airport-${sc}-${section}" placeholder="LHR" maxlength="4" style="font-size:12px;width:100%;"/>
      </div>
      <div style="display:flex;gap:6px;padding-bottom:1px;">
        <button class="btn btn-sm btn-primary" onclick="saveManifestAdd('${sc}','${section}')">Add</button>
        <button class="btn btn-sm" onclick="toggleAddManifestForm('${sc}','${section}')">Cancel</button>
      </div>
    </div>
  </div>`;
}

export function toggleAddManifestForm(sc, section) {
  const el = document.getElementById(`manifest-add-${section}-${sc}`);
  if (!el) return;
  el.style.display = el.style.display === 'none' ? '' : 'none';
  if (el.style.display !== 'none') document.getElementById(`madd-name-${sc}-${section}`)?.focus();
}

export function saveManifestAdd(sc, section) {
  const isIncoming = section === 'incoming';
  const name    = document.getElementById(`madd-name-${sc}-${section}`)?.value.trim();
  const posId   = parseInt(document.getElementById(`madd-pos-${sc}-${section}`)?.value);
  const signOn  = document.getElementById(`madd-signon-${sc}-${section}`)?.value  || '';
  const signOff = document.getElementById(`madd-signoff-${sc}-${section}`)?.value || '';
  const nat     = (document.getElementById(`madd-nat-${sc}-${section}`)?.value.trim()     || '').toUpperCase();
  const airport = (document.getElementById(`madd-airport-${sc}-${section}`)?.value.trim() || '').toUpperCase();

  if (!name) { showToast('Name is required'); return; }

  const pos  = state.positions.find(p => p.id === posId);
  const abbr = pos?.abbr || '';

  const member = {
    id: uid(), name, nat, posId,
    abbr,
    shipId:         SC_TO_SHIP_ID[sc] || 0,
    shipCode:       sc,
    recentShipCode: sc,
    status:         isIncoming ? 'Offboard' : 'Onboard',
    start:          isIncoming ? '' : signOn,
    end:            isIncoming ? '' : signOff,
    futureShip:     isIncoming ? sc : '',
    futureOn:       isIncoming ? signOn  : '',
    futureOff:      isIncoming ? signOff : '',
    airport, email: '', passport: '', medical: '', certs: [], notes: '', docs: [],
  };

  state.crew.push(member);
  upsertCrew(member);

  const allCrew = state.crew.filter(c => c.recentShipCode === sc || c.shipCode === sc);
  const wrap = document.getElementById(`ship-tab-manifest-${sc}`);
  if (wrap) wrap.innerHTML = renderManifest(sc, allCrew, new Date());
  showToast(`${name} added to manifest`);
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

  function portCell(dateStr) {
    if (!dateStr) return `<td><span class="manifest-no-deploy">—</span></td>`;
    const info = deployPortOnDate(sc, dateStr);
    if (!info) return `<td><span class="manifest-no-deploy">Not in itinerary</span></td>`;
    const icon = info.dayType === 'T' ? '🔄' : info.dayType === 'S' ? '🌊' : '⚓';
    if (info.dayType === 'S') return `<td><div class="manifest-port">🌊 At sea</div></td>`;
    return `<td>
      <div class="manifest-port">${icon} ${info.city}</div>
      ${info.country ? `<div class="manifest-port-note">${info.country}</div>` : ''}
    </td>`;
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

  function editRow(c, isIncoming) {
    const posOpts = state.positions.map(p =>
      `<option value="${p.id}" ${p.id === c.tempPosId ? 'selected' : ''}>${p.abbr} — ${p.title}</option>`
    ).join('');
    const hasTempPromo = c.tempAbbr && c.tempPosStart;
    const tempStatus = hasTempPromo
      ? `<span style="font-size:10px;color:var(--text2);">Currently: <strong style="color:var(--blue-t);">↑ ${c.tempAbbr}</strong> from ${c.tempPosStart}${c.tempPosEnd ? ' → ' + c.tempPosEnd : ''}</span>`
      : '';
    return `<tr id="manifest-edit-row-${c.id}" style="display:none;background:rgba(255,255,255,.03);">
      <td colspan="9" style="padding:10px 12px;">
        <div style="font-size:11px;font-weight:600;color:var(--text2);margin-bottom:8px;">
          Edit — ${c.name}${isIncoming ? ' (incoming)' : ''}
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;">
          <div class="field" style="margin:0;min-width:130px;">
            <label style="font-size:10px;">Sign on</label>
            <input type="date" id="medit-signon-${c.id}" value="${(isIncoming ? c.futureOn : c.start) || ''}"
              style="width:100%;font-size:12px;"/>
          </div>
          <div class="field" style="margin:0;min-width:130px;">
            <label style="font-size:10px;">Sign off</label>
            <input type="date" id="medit-signoff-${c.id}" value="${(isIncoming ? c.futureOff : c.end) || ''}"
              style="width:100%;font-size:12px;"/>
          </div>
          <div class="field" style="margin:0;min-width:130px;">
            <label style="font-size:10px;">Gateway airport</label>
            <input type="text" id="medit-airport-${c.id}" value="${c.airport || ''}" placeholder="e.g. MIA"
              style="width:100%;font-size:12px;"/>
          </div>
          <div class="field" style="margin:0;flex:1;min-width:180px;">
            <label style="font-size:10px;">Reason / note</label>
            <input type="text" id="medit-note-${c.id}" placeholder="e.g. Delayed, Extension approved…"
              style="width:100%;font-size:12px;"/>
          </div>
          <div style="display:flex;gap:6px;padding-bottom:1px;">
            <button class="btn btn-sm btn-primary" onclick="saveManifestEdit(${c.id},${isIncoming})">Save</button>
            <button class="btn btn-sm" onclick="closeManifestEdit(${c.id})">Cancel</button>
          </div>
        </div>
        <!-- Temporary Promotion -->
        <div style="margin-top:10px;padding-top:10px;border-top:.5px solid var(--border);">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
            <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text2);">Temporary promotion</span>
            ${tempStatus}
            ${hasTempPromo ? `<button class="btn btn-sm btn-danger" onclick="clearTempPromo(${c.id})" style="margin-left:auto;">✕ Clear</button>` : ''}
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;">
            <div class="field" style="margin:0;min-width:160px;">
              <label style="font-size:10px;">Acting position</label>
              <select id="medit-temppos-${c.id}" style="width:100%;font-size:12px;">
                <option value="">— Select position —</option>
                ${posOpts}
              </select>
            </div>
            <div class="field" style="margin:0;min-width:130px;">
              <label style="font-size:10px;">Effective from</label>
              <input type="date" id="medit-tempstart-${c.id}" value="${c.tempPosStart || ''}"
                style="width:100%;font-size:12px;"/>
            </div>
            <div class="field" style="margin:0;min-width:130px;">
              <label style="font-size:10px;">Until (optional)</label>
              <input type="date" id="medit-tempend-${c.id}" value="${c.tempPosEnd || ''}"
                style="width:100%;font-size:12px;"/>
            </div>
          </div>
        </div>
      </td>
    </tr>`;
  }

  function posCell(c) {
    const posColor = POS_COLORS[c.abbr] || '#A4A4A7';
    const base = `<span class="badge" style="background:${posColor}22;color:${posColor};border:.5px solid ${posColor}55;font-size:10px;">${c.abbr}</span>`;
    if (!c.tempAbbr || !c.tempPosStart) return `<td>${base}</td>`;
    const today = now.toISOString().slice(0, 10);
    const started  = c.tempPosStart <= today;
    const notEnded = !c.tempPosEnd || c.tempPosEnd >= today;
    if (!notEnded) return `<td>${base}</td>`;
    const tempColor = POS_COLORS[c.tempAbbr] || '#A4A4A7';
    const label = started ? 'Acting' : `From ${c.tempPosStart}`;
    return `<td>
      <span class="badge" style="background:${tempColor}22;color:${tempColor};border:.5px solid ${tempColor}55;font-size:10px;">↑ ${c.tempAbbr}</span>
      <div style="font-size:9px;color:var(--text2);margin-top:2px;">${label} (${c.abbr})</div>
    </td>`;
  }

  const currentRows = current.map(c => {
    return `<tr>
      <td><div class="manifest-name">${crewLink(c.name, c.id)}</div><div class="manifest-id">#${c.id}</div></td>
      ${posCell(c)}
      <td style="font-size:11px;">${c.start || '—'}</td>
      ${portCell(c.start)}
      <td style="font-size:11px;">${c.end || '—'} ${daysLeftBadge(c.end)}</td>
      ${portCell(c.end)}
      <td style="font-size:11px;color:var(--text2);">${c.airport || '—'}</td>
      <td style="font-size:11px;color:var(--text2);">${c.nat || '—'}</td>
      <td><button class="btn btn-sm" onclick="openManifestEdit(${c.id})" style="padding:2px 8px;font-size:10px;">Edit</button></td>
    </tr>${editRow(c, false)}`;
  }).join('');

  const incomingRows = incoming.map(c => {
    return `<tr>
      <td><div class="manifest-name">${crewLink(c.name, c.id)}</div><div class="manifest-id">#${c.id}</div></td>
      ${posCell(c)}
      <td style="font-size:11px;">${c.futureOn || '—'} ${daysUntilBadge(c.futureOn)}</td>
      ${portCell(c.futureOn)}
      <td style="font-size:11px;">${c.futureOff || '—'}</td>
      ${portCell(c.futureOff)}
      <td style="font-size:11px;color:var(--text2);">${c.airport || '—'}</td>
      <td style="font-size:11px;color:var(--text2);">${c.nat || '—'}</td>
      <td><button class="btn btn-sm" onclick="openManifestEdit(${c.id})" style="padding:2px 8px;font-size:10px;">Edit</button></td>
    </tr>${editRow(c, true)}`;
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
    <th></th>
  </tr></thead>`;

  return `
    <div class="card" style="margin-bottom:1rem;">
      <div class="card-header">
        <div>
          <div class="card-title">Current crew <span class="manifest-count-badge" style="background:rgba(77,212,160,.15);color:#4dd4a0;border:.5px solid rgba(77,212,160,.3);">${current.length}</span></div>
          <div class="card-sub">All crew currently onboard — sign-on/off dates and embark/debark ports</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <input class="manifest-search" placeholder="Search name or position…" oninput="filterManifest('${sc}','current',this.value)"/>
          <button class="btn btn-sm btn-primary" onclick="toggleAddManifestForm('${sc}','current')" style="white-space:nowrap;">+ Add crew</button>
        </div>
      </div>
      ${buildAddForm(sc, 'current')}
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
        <div style="display:flex;gap:8px;align-items:center;">
          <input class="manifest-search" placeholder="Search name or position…" oninput="filterManifest('${sc}','incoming',this.value)"/>
          <button class="btn btn-sm btn-primary" onclick="toggleAddManifestForm('${sc}','incoming')" style="white-space:nowrap;">+ Add crew</button>
        </div>
      </div>
      ${buildAddForm(sc, 'incoming')}
      <div style="overflow-x:auto;max-height:460px;overflow-y:auto;" id="manifest-incoming-wrap-${sc}">
        <table class="manifest-table" id="manifest-incoming-${sc}">
          ${th}
          <tbody>${incomingRows || `<tr><td colspan="8" class="manifest-empty">No incoming crew with confirmed future assignments.</td></tr>`}</tbody>
        </table>
      </div>
    </div>`;
}

export function openManifestEdit(id) {
  // Close any other open edit rows first
  document.querySelectorAll('[id^="manifest-edit-row-"]').forEach(row => {
    if (row.id !== `manifest-edit-row-${id}`) row.style.display = 'none';
  });
  const row = document.getElementById(`manifest-edit-row-${id}`);
  if (row) row.style.display = row.style.display === 'none' ? '' : 'none';
}

export function closeManifestEdit(id) {
  const row = document.getElementById(`manifest-edit-row-${id}`);
  if (row) row.style.display = 'none';
}

export function saveManifestEdit(id, isIncoming) {
  const c = state.crew.find(x => x.id === id);
  if (!c) return;

  const signOn  = document.getElementById(`medit-signon-${id}`)?.value.trim()  || '';
  const signOff = document.getElementById(`medit-signoff-${id}`)?.value.trim() || '';
  const airport = document.getElementById(`medit-airport-${id}`)?.value.trim() || '';
  const note    = document.getElementById(`medit-note-${id}`)?.value.trim()    || '';

  if (isIncoming) {
    if (signOn)  c.futureOn  = signOn;
    if (signOff) c.futureOff = signOff;
  } else {
    if (signOn)  c.start = signOn;
    if (signOff) c.end   = signOff;
  }
  if (airport) c.airport = airport;
  if (note && !c.notes.includes(note)) {
    c.notes = c.notes ? `${c.notes}\n${note}` : note;
  }

  // Temporary promotion
  const tempPosId  = parseInt(document.getElementById(`medit-temppos-${id}`)?.value  || '0');
  const tempStart  = document.getElementById(`medit-tempstart-${id}`)?.value.trim()  || '';
  const tempEnd    = document.getElementById(`medit-tempend-${id}`)?.value.trim()    || '';
  if (tempPosId && tempStart) {
    const pos = state.positions.find(p => p.id === tempPosId);
    c.tempPosId    = tempPosId;
    c.tempAbbr     = pos?.abbr || '';
    c.tempPosStart = tempStart;
    c.tempPosEnd   = tempEnd;
  }

  upsertCrew(c);
  closeManifestEdit(id);
  const sc = currentShipCode;
  const crew = state.crew.filter(x => x.recentShipCode === sc || x.shipCode === sc);
  const wrap = document.getElementById(`ship-tab-manifest-${sc}`);
  if (wrap) wrap.innerHTML = renderManifest(sc, crew, new Date());
}

export function clearTempPromo(id) {
  const c = state.crew.find(x => x.id === id);
  if (!c) return;
  delete c.tempPosId; delete c.tempAbbr; delete c.tempPosStart; delete c.tempPosEnd;
  upsertCrew(c);
  const sc = currentShipCode;
  const crew = state.crew.filter(x => x.recentShipCode === sc || x.shipCode === sc);
  const wrap = document.getElementById(`ship-tab-manifest-${sc}`);
  if (wrap) wrap.innerHTML = renderManifest(sc, crew, new Date());
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
        <div><div class="crew-slot-name">${crewLink(c.name, c.id)}</div><div class="crew-slot-nat">${c.nat || ''}${c.airport ? ' · ' + c.airport : ''}</div></div>
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
window.toggleShipsNav   = toggleShipsNav;
window.showShip         = showShip;
window.renderShipPage   = renderShipPage;
window.switchShipTab    = switchShipTab;
window.deployPortOnDate = deployPortOnDate;
window.renderManifest         = renderManifest;
window.filterManifest         = filterManifest;
window.openManifestEdit       = openManifestEdit;
window.closeManifestEdit      = closeManifestEdit;
window.saveManifestEdit       = saveManifestEdit;
window.toggleAddManifestForm  = toggleAddManifestForm;
window.saveManifestAdd        = saveManifestAdd;
window.clearTempPromo         = clearTempPromo;
window.renderPosGrid    = renderPosGrid;
window.renderTimeline   = renderTimeline;
