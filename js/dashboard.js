// ── dashboard.js — crew dashboard page ───────────────────────────────────────
import { state } from './state.js';

const SHIP_CLASS_MAP = {'ML':'MILLENNIUM CLASS','IN':'MILLENNIUM CLASS','SM':'MILLENNIUM CLASS','CS':'MILLENNIUM CLASS','SL':'SOLSTICE CLASS','EQ':'SOLSTICE CLASS','EC':'SOLSTICE CLASS','SI':'SOLSTICE CLASS','RF':'SOLSTICE CLASS','EG':'EDGE CLASS','AX':'EDGE CLASS','BY':'EDGE CLASS','AT':'EDGE CLASS','XC':'EDGE CLASS'};
const CLASS_BADGE    = {'MILLENNIUM CLASS':'badge-teal','SOLSTICE CLASS':'badge-blue','EDGE CLASS':'badge-purple'};
const SHIP_NAME_MAP  = {'ML':'Millennium','IN':'Infinity','SM':'Summit','CS':'Constellation','SL':'Solstice','EQ':'Equinox','EC':'Eclipse','SI':'Silhouette','RF':'Reflection','EG':'Edge','AX':'Apex','BY':'Beyond','AT':'Ascent','XC':'Xcel'};

let dashSortKey = 'name', dashSortDir = 'asc', dashPage = 1;
const DASH_PAGE_SIZE = 50;
let dashCatFilter = '';
let signoffWindow = 30;

export function initDashboard() {
  const ships    = [...new Set(state.crew.map(c => c.recentShipCode).filter(Boolean))].sort();
  const shipOpts = '<option value="">All ships</option>' + ships.map(s => `<option value="${s}">${s} — ${SHIP_NAME_MAP[s]||s}</option>`).join('');
  document.getElementById('dash-ship').innerHTML = shipOpts;
  document.getElementById('so-ship').innerHTML   = shipOpts;
  renderDashStats();
  renderDashboard();
}

function renderDashStats() {
  const now             = new Date();
  const onboardWith     = state.crew.filter(c =>  c.status === 'Onboard' &&  c.futureOn).length;
  const onboardWithout  = state.crew.filter(c =>  c.status === 'Onboard' && !c.futureOn).length;
  const offboardWith    = state.crew.filter(c =>  c.status !== 'Onboard' &&  c.futureOn).length;
  const offboardWithout = state.crew.filter(c =>  c.status !== 'Onboard' && !c.futureOn).length;
  const signing30 = state.crew.filter(c => {
    if (!c.end || c.status !== 'Onboard') return false;
    const d = (new Date(c.end) - now) / 86400000;
    return d >= 0 && d <= 30;
  }).length;
  document.getElementById('dash-stats').innerHTML = `
    <div class="dash-stat ds-onboard" onclick="setDashCat('onboard-with',document.querySelector('[data-cat=onboard-with]'))">
      <div class="ds-label">Onboard — with assignment</div>
      <div class="ds-value">${onboardWith}</div>
    </div>
    <div class="dash-stat" style="border-color:rgba(77,212,160,.3);" onclick="setDashCat('onboard-without',document.querySelector('[data-cat=onboard-without]'))">
      <div class="ds-label" style="color:#4dd4a0;">Onboard — without assignment</div>
      <div class="ds-value" style="color:#4dd4a0;">${onboardWithout}</div>
    </div>
    <div class="dash-stat ds-offboard" onclick="setDashCat('offboard-with',document.querySelector('[data-cat=offboard-with]'))">
      <div class="ds-label">Offboard — with assignment</div>
      <div class="ds-value">${offboardWith}</div>
    </div>
    <div class="dash-stat" style="border-color:rgba(164,164,167,.3);" onclick="setDashCat('offboard-without',document.querySelector('[data-cat=offboard-without]'))">
      <div class="ds-label" style="color:var(--text2);">Offboard — without assignment</div>
      <div class="ds-value" style="color:var(--text2);">${offboardWithout}</div>
    </div>
    <div class="dash-stat ds-key" style="border-color:rgba(255,112,112,.4);cursor:pointer;" onclick="switchDashView('signoff',document.getElementById('dash-signoff-tab'))">
      <div class="ds-label" style="color:#ff7070;">Signing off (30d)</div>
      <div class="ds-value" style="color:#ff7070;">${signing30}</div>
    </div>`;
}

export function switchDashView(view, btn) {
  document.getElementById('dash-roster-view').style.display  = view === 'roster'  ? 'block' : 'none';
  document.getElementById('dash-signoff-view').style.display = view === 'signoff' ? 'block' : 'none';
  document.getElementById('dash-main-tab').classList.toggle('active',    view === 'roster');
  document.getElementById('dash-signoff-tab').classList.toggle('active', view === 'signoff');
  if (view === 'signoff') renderSignoffTable();
}

export function setDashCat(cat, btn) {
  dashCatFilter = cat;
  document.querySelectorAll('.dash-pill').forEach(p => p.classList.remove('active'));
  if (btn) btn.classList.add('active');
  dashPage = 1;
  renderDashboard();
}

export function dashSort(key) {
  if (dashSortKey === key) dashSortDir = dashSortDir === 'asc' ? 'desc' : 'asc';
  else { dashSortKey = key; dashSortDir = 'asc'; }
  dashPage = 1;
  renderDashboard();
}

export function renderDashboard() {
  const now   = new Date();
  const q     = (document.getElementById('dash-search').value || '').toLowerCase();
  const shipF = document.getElementById('dash-ship').value;
  const clsF  = document.getElementById('dash-class').value;
  const posF  = document.getElementById('dash-pos').value;

  let data = state.crew.filter(c => {
    if (dashCatFilter === 'onboard-with'      && !(c.status === 'Onboard' &&  c.futureOn)) return false;
    if (dashCatFilter === 'onboard-without'   && !(c.status === 'Onboard' && !c.futureOn)) return false;
    if (dashCatFilter === 'offboard-with'     && !(c.status !== 'Onboard' &&  c.futureOn)) return false;
    if (dashCatFilter === 'offboard-without'  && !(c.status !== 'Onboard' && !c.futureOn)) return false;
    if (shipF && c.recentShipCode !== shipF) return false;
    if (clsF  && (SHIP_CLASS_MAP[c.recentShipCode]||'') !== clsF) return false;
    if (posF  && c.abbr !== posF) return false;
    if (q && !(c.name.toLowerCase().includes(q) || c.abbr.toLowerCase().includes(q) || (c.recentShipName||'').toLowerCase().includes(q) || (c.nat||'').toLowerCase().includes(q))) return false;
    return true;
  });

  data.sort((a, b) => {
    const va = a[dashSortKey] || '', vb = b[dashSortKey] || '';
    if (typeof va === 'number') return dashSortDir === 'asc' ? va - vb : vb - va;
    return dashSortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
  });

  document.getElementById('dash-count').textContent = `${data.length} crew`;

  ['name','abbr','recentShipCode','status','start','end','futureOn','futureName','nat','tenure'].forEach(k => {
    const el = document.getElementById('sa-' + k);
    if (!el) return;
    el.className = 'sort-arrow' + (k === dashSortKey ? ' ' + (dashSortDir === 'asc' ? 'asc' : 'desc') : '');
  });

  const total      = data.length;
  const totalPages = Math.max(1, Math.ceil(total / DASH_PAGE_SIZE));
  dashPage = Math.min(dashPage, totalPages);
  const slice = data.slice((dashPage - 1) * DASH_PAGE_SIZE, dashPage * DASH_PAGE_SIZE);

  const tbody = document.getElementById('roster-tbody');
  if (!slice.length) {
    tbody.innerHTML = `<tr><td colspan="10" style="padding:1.5rem 8px;text-align:center;color:var(--text2);font-size:13px;">No crew match the current filters.</td></tr>`;
  } else {
    tbody.innerHTML = slice.map(c => {
      const cls        = SHIP_CLASS_MAP[c.recentShipCode] || '';
      const clsBadge   = CLASS_BADGE[cls] || 'badge-gray';
      const daysLeft   = c.end ? Math.round((new Date(c.end) - now) / 86400000) : null;
      const daysBadge  = daysLeft !== null ? (daysLeft < 0 ? 'badge-red' : daysLeft <= 30 ? 'badge-red' : daysLeft <= 60 ? 'badge-amber' : 'badge-green') : 'badge-gray';
      const daysLabel  = daysLeft !== null ? (daysLeft < 0 ? 'Expired' : daysLeft + 'd') : '—';
      const futureCls  = SHIP_CLASS_MAP[c.futureShip] || '';
      const futureBadge = CLASS_BADGE[futureCls] || 'badge-gray';
      let catBadge = '';
      if      (c.status === 'Onboard' &&  c.futureOn) catBadge = `<span class="badge badge-blue" style="font-size:9px;margin-left:4px;">Assigned</span>`;
      else if (c.status === 'Onboard' && !c.futureOn) catBadge = `<span class="badge badge-green" style="font-size:9px;margin-left:4px;">No assignment</span>`;
      else if (c.status !== 'Onboard' &&  c.futureOn) catBadge = `<span class="badge badge-blue" style="font-size:9px;margin-left:4px;">Assigned</span>`;
      else                                              catBadge = `<span class="badge badge-gray" style="font-size:9px;margin-left:4px;">Unassigned</span>`;
      return `<tr>
        <td style="font-weight:500;white-space:nowrap;">${c.name}</td>
        <td><span class="badge badge-gray" style="font-size:10px;">${c.abbr}</span></td>
        <td><span class="badge ${clsBadge}" style="font-size:9px;margin-right:3px;">${c.recentShipCode||'—'}</span><span style="font-size:11px;">${c.recentShipName||'—'}</span></td>
        <td><span class="status-dot ${c.status==='Onboard'?'dot-on':'dot-off'}"></span><span style="font-size:11px;">${c.status}</span>${catBadge}</td>
        <td style="font-size:11px;color:var(--text2);white-space:nowrap;">${c.start||'—'}</td>
        <td style="white-space:nowrap;">${c.end?`<span class="badge ${daysBadge}" style="font-size:10px;">${c.end}</span><span style="font-size:10px;color:var(--text2);margin-left:4px;">${daysLabel}</span>`:'—'}</td>
        <td style="font-size:11px;color:var(--text2);white-space:nowrap;">${c.futureOn||'—'}</td>
        <td>${c.futureShip?`<span class="badge ${futureBadge}" style="font-size:9px;">${c.futureShip}</span> <span style="font-size:11px;">${c.futureName}</span>`:'—'}</td>
        <td style="font-size:11px;color:var(--text2);">${c.nat}</td>
        <td class="num" style="font-size:11px;color:var(--text2);">${c.tenure?c.tenure+'y':'—'}</td>
      </tr>`;
    }).join('');
  }

  const pager = document.getElementById('dash-pager');
  if (totalPages <= 1) { pager.innerHTML = ''; return; }
  pager.innerHTML = `
    <span style="font-size:12px;color:var(--text2);">Page ${dashPage} of ${totalPages}</span>
    <button class="btn btn-sm" onclick="dashPage=Math.max(1,dashPage-1);renderDashboard()" ${dashPage===1?'disabled':''}>← Prev</button>
    <button class="btn btn-sm" onclick="dashPage=Math.min(${totalPages},dashPage+1);renderDashboard()" ${dashPage===totalPages?'disabled':''}>Next →</button>`;
}

export function setSignoffWindow(days, btn) {
  signoffWindow = days;
  [30,60,90].forEach(d => {
    const el = document.getElementById('so-tab-' + d);
    if (el) el.classList.toggle('active', d === days);
  });
  renderSignoffTable();
}

export function renderSignoffTable() {
  const now   = new Date();
  const q     = (document.getElementById('so-search').value || '').toLowerCase();
  const shipF = document.getElementById('so-ship').value;
  const posF  = document.getElementById('so-pos').value;

  const data = state.crew.filter(c => {
    if (!c.end || c.status !== 'Onboard') return false;
    const d = (new Date(c.end) - now) / 86400000;
    if (d < 0 || d > signoffWindow) return false;
    if (shipF && c.recentShipCode !== shipF) return false;
    if (posF  && c.abbr !== posF) return false;
    if (q && !(c.name.toLowerCase().includes(q) || c.abbr.toLowerCase().includes(q) || (c.recentShipName||'').toLowerCase().includes(q))) return false;
    return true;
  }).sort((a, b) => a.end.localeCompare(b.end));

  document.getElementById('so-count').textContent = `${data.length} crew signing off`;

  const b0 = data.filter(c => ((new Date(c.end)-now)/86400000) <= 14).length;
  const b1 = data.filter(c => { const d=(new Date(c.end)-now)/86400000; return d>14&&d<=30; }).length;
  const b2 = data.filter(c => ((new Date(c.end)-now)/86400000) > 30).length;
  document.getElementById('so-summary').innerHTML = `
    <div class="dash-stat" style="border-color:rgba(255,112,112,.35);">
      <div class="ds-label" style="color:#ff7070;">Within 14 days</div>
      <div class="ds-value" style="color:#ff7070;">${b0}</div>
    </div>
    <div class="dash-stat" style="border-color:rgba(232,116,53,.35);">
      <div class="ds-label" style="color:var(--highlight);">15 – 30 days</div>
      <div class="ds-value" style="color:var(--highlight);">${b1}</div>
    </div>
    <div class="dash-stat" style="border-color:rgba(41,155,225,.25);">
      <div class="ds-label" style="color:var(--blue-t);">31 – ${signoffWindow} days</div>
      <div class="ds-value" style="color:var(--blue-t);">${b2}</div>
    </div>`;

  const tbody = document.getElementById('so-tbody');
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="padding:1.5rem;text-align:center;color:var(--text2);font-size:13px;">No crew signing off in the next ${signoffWindow} days.</td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(c => {
    const days       = Math.round((new Date(c.end) - now) / 86400000);
    const daysBadge  = days <= 14 ? 'badge-red' : days <= 30 ? 'badge-amber' : 'badge-blue';
    const cls        = SHIP_CLASS_MAP[c.recentShipCode] || '';
    const clsBadge   = CLASS_BADGE[cls] || 'badge-gray';
    const futureCls  = SHIP_CLASS_MAP[c.futureShip] || '';
    const futureBadge = CLASS_BADGE[futureCls] || 'badge-gray';
    const reliefHtml = c.futureShip === c.recentShipCode && c.futureOn
      ? `<span class="so-relief-ok">✓ Relief confirmed</span>`
      : c.futureOn ? `<span class="so-relief-warn">⚠ Moving to ${c.futureShip}</span>`
      : `<span class="so-relief-none">✕ No relief</span>`;
    return `<tr>
      <td style="font-weight:500;white-space:nowrap;">${c.name}</td>
      <td><span class="badge badge-gray" style="font-size:10px;">${c.abbr}</span></td>
      <td><span class="badge ${clsBadge}" style="font-size:9px;margin-right:3px;">${c.recentShipCode}</span><span style="font-size:11px;">${c.recentShipName||''}</span></td>
      <td style="font-size:11px;white-space:nowrap;">${c.end}</td>
      <td><span class="badge ${daysBadge}" style="font-size:10px;">${days}d</span></td>
      <td>${reliefHtml}</td>
      <td>${c.futureShip?`<span class="badge ${futureBadge}" style="font-size:9px;">${c.futureShip}</span> <span style="font-size:11px;">${c.futureName}</span> <span style="font-size:10px;color:var(--text2);">${c.futureOn}</span>`:'<span style="color:var(--text2);font-size:11px;">—</span>'}</td>
      <td style="font-size:11px;color:var(--text2);">${c.nat}</td>
    </tr>`;
  }).join('');
}

window.initDashboard    = initDashboard;
window.switchDashView   = switchDashView;
window.setDashCat       = setDashCat;
window.dashSort         = dashSort;
window.renderDashboard  = renderDashboard;
window.setSignoffWindow = setSignoffWindow;
window.renderSignoffTable = renderSignoffTable;
