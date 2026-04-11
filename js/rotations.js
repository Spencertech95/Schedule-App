// ── rotations.js — rotation page ─────────────────────────────────────────────
import { state } from './state.js';
import { SHIP_DEPLOYMENT, CLASS_MANNING } from './data.js';
import { saveRotations } from './db.js';
import { toggleForm } from './utils.js';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const YEARS  = ['2025','2026','2027'];

export function initRotations() {
  document.getElementById('year-tabs').innerHTML = YEARS.map(y =>
    `<button class="year-tab ${y === state.currentYear ? 'active' : ''}" onclick="setRotationYear('${y}',this)">${y}</button>`
  ).join('');
  if (state.rotationMode === 'overview') switchRotationMode('overview');
  else switchRotationMode('ship', state.currentRotationShip);
}

export function setRotationYear(y, el) {
  state.currentYear = y;
  document.querySelectorAll('.year-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  if (state.rotationMode === 'overview') renderRotationOverview();
  else renderShipRotation(state.currentRotationShip);
}

export function switchRotationMode(mode, ship) {
  state.rotationMode = mode;
  if (mode === 'overview') {
    document.getElementById('rotation-overview-section').style.display = '';
    document.getElementById('rotation-ship-section').style.display = 'none';
    renderRotationOverview();
  } else {
    state.currentRotationShip = ship || Object.keys(SHIP_DEPLOYMENT)[0];
    document.getElementById('rotation-overview-section').style.display = 'none';
    document.getElementById('rotation-ship-section').style.display = '';
    renderShipTabs();
    renderShipRotation(state.currentRotationShip);
  }
}

function renderRotationOverview() {
  const ships = Object.keys(SHIP_DEPLOYMENT);
  const months = Array.from({length: 12}, (_, i) => {
    const m = String(i + 1).padStart(2, '0');
    return `${state.currentYear}-${m}`;
  });
  const head = document.getElementById('fleet-dep-head');
  const body = document.getElementById('fleet-dep-body');
  head.innerHTML = `<tr><th>Ship</th>${months.map(m => `<th>${MONTHS[parseInt(m.split('-')[1]) - 1]}</th>`).join('')}</tr>`;
  const classBadges = {Millennium: 'badge-teal', Solstice: 'badge-blue', Edge: 'badge-purple'};
  body.innerHTML = ships.map(ship => {
    const dep = SHIP_DEPLOYMENT[ship];
    const cls = dep.class.replace(' CLASS', '');
    return `<tr><td style="cursor:pointer;font-size:12px;" onclick="switchRotationMode('ship','${ship}')"><span class="badge ${classBadges[cls] || 'badge-gray'}" style="font-size:10px;">${cls.slice(0, 4)}</span> <span style="font-weight:500;">${ship}</span></td>${months.map(m => {
      const d = dep.monthly[m];
      if (!d) return `<td style="color:var(--text2);font-size:10px;">—</td>`;
      const isDry = d.region.toLowerCase().includes('dry dock') || d.region.toLowerCase().includes('drydock') || d.region.toLowerCase().includes('building');
      return `<td style="font-size:10px;cursor:pointer;${isDry ? 'color:var(--highlight);' : ''}" onclick="switchRotationMode('ship','${ship}')" title="${d.ports.join(', ')}">${d.region.split(' ').slice(0, 2).join(' ')}</td>`;
    }).join('')}</tr>`;
  }).join('');
}

function renderShipTabs() {
  const ships = Object.keys(SHIP_DEPLOYMENT);
  document.getElementById('ship-rotation-tabs').innerHTML = ships.map(s =>
    `<button class="ship-tab ${s === state.currentRotationShip ? 'active' : ''}" onclick="selectShipRotation('${s}',this)">${s}</button>`
  ).join('');
}

export function selectShipRotation(ship, el) {
  state.currentRotationShip = ship;
  document.querySelectorAll('.ship-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  renderShipRotation(ship);
}

export function renderShipRotation(ship) {
  const dep = SHIP_DEPLOYMENT[ship];
  const cls = dep.class.replace(' CLASS', '');
  document.getElementById('rotation-ship-title').textContent = `${ship} — ${state.currentYear} deployment`;
  document.getElementById('rotation-ship-sub').textContent = `${dep.class} · Ship code: ${dep.code}`;

  const months = Array.from({length: 12}, (_, i) => {
    const m = String(i + 1).padStart(2, '0');
    return `${state.currentYear}-${m}`;
  });
  document.getElementById('rotation-month-grid').innerHTML = months.map(m => {
    const d = dep.monthly[m];
    if (!d) return `<div class="rotation-month" style="opacity:0.4;"><div class="rotation-month-name">${MONTHS[parseInt(m.split('-')[1]) - 1]}</div><div class="rotation-ports">Not deployed</div></div>`;
    const isDry = d.region.toLowerCase().includes('dry dock') || d.region.toLowerCase().includes('drydock') || d.region.toLowerCase().includes('building');
    return `<div class="rotation-month" style="${isDry ? 'border:1px solid var(--highlight);' : ''}"><div class="rotation-month-name">${MONTHS[parseInt(m.split('-')[1]) - 1]} ${state.currentYear.slice(2)}</div><div class="rotation-region" style="${isDry ? 'color:var(--highlight);' : ''}">${d.region}</div><div class="rotation-ports">${d.ports.slice(0, 2).map(p => p.split(',')[0]).join(' · ')}</div></div>`;
  }).join('');

  const manning = CLASS_MANNING[cls];
  const tbody = document.getElementById('rotation-pos-tbody');
  tbody.innerHTML = state.positions.map(p => {
    const count = manning[p.id] || 0;
    if (count === 0) return '';
    const firstMonth = months.find(m => dep.monthly[m]);
    const lastMonth  = [...months].reverse().find(m => dep.monthly[m]);
    const signOnPort  = firstMonth && dep.monthly[firstMonth] ? dep.monthly[firstMonth].ports[0] : '—';
    const signOffPort = lastMonth  && dep.monthly[lastMonth]  ? dep.monthly[lastMonth].ports[0]  : '—';
    const signOnDate  = firstMonth ? `1 ${MONTHS[parseInt(firstMonth.split('-')[1]) - 1]} ${state.currentYear}` : '—';
    const signOffDate = lastMonth  ? `28 ${MONTHS[parseInt(lastMonth.split('-')[1]) - 1]} ${state.currentYear}` : '—';
    const entries = (state.rotations[ship] || []).filter(e => e.posId === p.id && e.date.startsWith(state.currentYear));
    return `<tr>
      <td><span class="badge badge-gray">${p.abbr}</span> ${p.title}</td>
      <td class="num">${count}</td>
      <td><span class="sign-on">↑ ${signOnDate}</span><div style="font-size:10px;color:var(--text2);">${signOnPort.split(',')[0]}</div>${entries.filter(e => e.type === 'Sign-on').length ? '<div style="margin-top:4px;">' + entries.filter(e => e.type === 'Sign-on').map(e => `<div style="font-size:10px;color:#4dd4a0;">▲ ${e.date}${e.crew ? ' — ' + e.crew : ''}</div>`).join('') + '</div>' : ''}</td>
      <td><span class="sign-off">↓ ${signOffDate}</span><div style="font-size:10px;color:var(--text2);">${signOffPort.split(',')[0]}</div>${entries.filter(e => e.type === 'Sign-off').length ? '<div style="margin-top:4px;">' + entries.filter(e => e.type === 'Sign-off').map(e => `<div style="font-size:10px;color:var(--highlight);">▼ ${e.date}${e.crew ? ' — ' + e.crew : ''}</div>`).join('') + '</div>' : ''}</td>
      <td>${p.contract} months</td>
      <td>${p.handover} days</td>
    </tr>`;
  }).join('');

  const entries = (state.rotations[ship] || []).filter(e => e.date.startsWith(state.currentYear));
  document.getElementById('rotation-entries-list').innerHTML = entries.length
    ? entries.map((e, i) => {
        const pos = state.positions.find(p => p.id === e.posId);
        return `<div class="row-item"><div><div style="font-size:13px;font-weight:500;">${pos ? pos.abbr : '—'} — ${e.type}</div><div style="font-size:11px;color:var(--text2);">${e.date} · ${e.port || '—'}${e.crew ? ' · ' + e.crew : ''}</div>${e.notes ? `<div style="font-size:11px;color:var(--text2);">${e.notes}</div>` : ''}</div><span class="badge ${e.type === 'Sign-on' ? 'badge-green' : 'badge-amber'}">${e.type}</span></div>`;
      }).join('')
    : '<p class="empty">No custom rotation entries for this ship and year. Add entries above to track specific sign-on and sign-off dates.</p>';

  document.getElementById('rot-pos').innerHTML = state.positions
    .filter(p => (manning[p.id] || 0) > 0)
    .map(p => `<option value="${p.id}">${p.abbr} — ${p.title}</option>`)
    .join('');
}

export function saveRotation() {
  const ship = state.currentRotationShip;
  if (!ship) return;
  const posId = parseInt(document.getElementById('rot-pos').value);
  const entry = {
    posId,
    type:  document.getElementById('rot-type').value,
    date:  document.getElementById('rot-date').value,
    port:  document.getElementById('rot-port').value.trim(),
    crew:  document.getElementById('rot-crew').value.trim(),
    notes: document.getElementById('rot-notes').value.trim()
  };
  if (!entry.date) return;
  if (!state.rotations[ship]) state.rotations[ship] = [];
  state.rotations[ship].push(entry);
  ['rot-date','rot-port','rot-crew','rot-notes'].forEach(id => document.getElementById(id).value = '');
  toggleForm('rotation-form');
  renderShipRotation(ship);
  saveRotations(ship);
}

window.setRotationYear      = setRotationYear;
window.switchRotationMode   = switchRotationMode;
window.selectShipRotation   = selectShipRotation;
window.saveRotation         = saveRotation;
