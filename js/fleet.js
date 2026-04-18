// ── fleet.js — fleet & manning page ─────────────────────────────────────────
import { state } from './state.js';
import { uid } from './state.js';
import { classBadge, statusBadge, toggleForm } from './utils.js';
import { upsertShip, dbDeleteShip, saveManning, saveShipManning } from './db.js';

export function renderFleet() {
  const codeMap = {};
  // Build name→code map from SHIP_DISPLAY if available
  if (window.SHIP_DISPLAY) {
    Object.entries(window.SHIP_DISPLAY).forEach(([code, d]) => { codeMap[d.name] = code; });
  }

  const classDefs = [
    {name:'Millennium', badge:'badge-teal',   color:'var(--teal-t)',   bg:'var(--teal-bg)'},
    {name:'Solstice',   badge:'badge-blue',   color:'var(--blue-t)',   bg:'var(--blue-bg)'},
    {name:'Edge',       badge:'badge-purple', color:'var(--purple-t)', bg:'var(--purple-bg)'}
  ];

  function getShipReq(ship, code) {
    // Per-ship override takes priority over class default
    return state.shipManning[code] || state.manning[ship.shipClass] || {};
  }

  function shipStats(ship) {
    const code = codeMap[ship.name] || '';
    const req = getShipReq(ship, code);
    const reqTotal = Object.values(req).reduce((a, b) => a + b, 0);
    const onboard = {};
    state.crew.filter(c => c.shipId === ship.id && c.status === 'Onboard')
      .forEach(c => { onboard[c.posId] = (onboard[c.posId] || 0) + 1; });
    const onboardTotal = Object.values(onboard).reduce((a, b) => a + b, 0);
    const incoming = {};
    state.crew.filter(c => c.futureShip === code && c.futureOn)
      .forEach(c => { incoming[c.posId] = (incoming[c.posId] || 0) + 1; });
    const incomingTotal = Object.values(incoming).reduce((a, b) => a + b, 0);
    const vacancies = Math.max(0, reqTotal - onboardTotal);
    return {req, reqTotal, onboard, onboardTotal, incoming, incomingTotal, vacancies, code};
  }

  let fleetReq = 0, fleetOnboard = 0, fleetIncoming = 0, fleetVac = 0;
  state.ships.forEach(s => {
    const st = shipStats(s);
    fleetReq += st.reqTotal; fleetOnboard += st.onboardTotal;
    fleetIncoming += st.incomingTotal; fleetVac += st.vacancies;
  });

  const statCards = [
    {label:'Required',  val:fleetReq,      color:'var(--blue-t)',  bg:'var(--blue-bg)'},
    {label:'Onboard',   val:fleetOnboard,  color:'var(--green-t)', bg:'var(--green-bg)'},
    {label:'Vacancies', val:fleetVac,      color:fleetVac>0?'var(--red-t)':'var(--green-t)', bg:fleetVac>0?'var(--red-bg)':'var(--green-bg)'},
    {label:'Incoming',  val:fleetIncoming, color:'var(--amber-t)', bg:'var(--amber-bg)'}
  ];
  document.getElementById('fleet-stats').innerHTML = statCards.map(s => `
    <div style="background:${s.bg};border:.5px solid ${s.color};border-radius:10px;padding:.75rem 1.1rem;min-width:110px;flex:1;">
      <div style="font-size:26px;font-weight:700;color:${s.color};line-height:1;">${s.val}</div>
      <div style="font-size:11px;color:var(--text2);margin-top:4px;">${s.label}</div>
    </div>
  `).join('');

  document.getElementById('fleet-grid').innerHTML = classDefs.map(cl => {
    const ships = state.ships.filter(s => s.shipClass === cl.name);
    const clReq = Object.values(state.manning[cl.name] || {}).reduce((a, b) => a + b, 0);

    const cards = ships.map(ship => {
      const st = shipStats(ship);
      const pct = st.reqTotal > 0 ? Math.min(100, Math.round(st.onboardTotal / st.reqTotal * 100)) : 0;
      const barColor = pct >= 100 ? 'var(--green-t)' : pct >= 70 ? 'var(--amber-t)' : 'var(--red-t)';

      const posChips = state.positions.map(p => {
        const req = st.req[p.id] || 0; if (!req) return '';
        const ob = st.onboard[p.id] || 0;
        const ok = ob >= req;
        return `<div title="${p.title}" style="text-align:center;padding:3px 7px;background:${ok ? 'var(--green-bg)' : 'var(--red-bg)'};border-radius:5px;min-width:38px;">
          <div style="font-size:9px;color:var(--text2);margin-bottom:1px;">${p.abbr}</div>
          <div style="font-size:12px;font-weight:600;color:${ok ? 'var(--green-t)' : 'var(--red-t)'};">${ob}<span style="font-weight:400;color:var(--text2);">/${req}</span></div>
        </div>`;
      }).join('');

      const alerts = [];
      if (st.vacancies > 0) alerts.push(`<span style="color:var(--red-t);font-size:10px;">&#9888; ${st.vacancies} open ${st.vacancies === 1 ? 'vacancy' : 'vacancies'}</span>`);
      if (st.incomingTotal > 0) alerts.push(`<span style="color:var(--amber-t);font-size:10px;">&#8593; ${st.incomingTotal} incoming</span>`);

      const hasOverride = !!state.shipManning[st.code];
      const editInputs = state.positions.map(p => {
        const val = st.req[p.id] || 0;
        return `<div style="text-align:center;">
          <div style="font-size:9px;color:var(--text2);margin-bottom:3px;">${p.abbr}</div>
          <input type="number" min="0" max="20" value="${val}"
            data-ship="${st.code}" data-pos="${p.id}"
            style="width:40px;text-align:center;padding:3px;font-size:12px;background:var(--input-bg);border:.5px solid var(--border);border-radius:4px;color:#fff;"/>
        </div>`;
      }).join('');

      return `<div style="padding:12px 14px;border-bottom:.5px solid var(--border);">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:6px;">
          <div>
            <div style="font-weight:500;font-size:13px;">${ship.name}${hasOverride ? ' <span style="font-size:9px;color:var(--blue-t);font-weight:400;">custom par</span>' : ''}</div>
            <div style="font-size:10px;color:var(--text2);margin-top:1px;">${ship.imo}&nbsp;&middot;&nbsp;${ship.gt}</div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;margin-left:8px;">
            ${statusBadge(ship.status)}
            <span style="font-size:12px;font-weight:600;color:${barColor};">${st.onboardTotal}/${st.reqTotal}</span>
            <button class="btn btn-sm" onclick="openShipParEdit('${st.code}')" style="padding:2px 7px;font-size:10px;">Edit par</button>
            <button class="btn btn-sm btn-danger" onclick="deleteShip(${ship.id})" style="padding:2px 6px;font-size:11px;">&#10005;</button>
          </div>
        </div>
        <div style="height:5px;background:var(--border2);border-radius:3px;margin-bottom:8px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:${barColor};border-radius:3px;transition:width .4s;"></div>
        </div>
        <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:${alerts.length ? '6px' : '0'};">${posChips}</div>
        ${alerts.length ? `<div style="display:flex;gap:10px;flex-wrap:wrap;">${alerts.join('')}</div>` : ''}
        <div id="ship-par-edit-${st.code}" style="display:none;margin-top:10px;padding:10px;background:rgba(255,255,255,.03);border:.5px solid var(--border);border-radius:6px;">
          <div style="font-size:11px;color:var(--text2);margin-bottom:8px;">Par levels for <strong style="color:#fff;">${ship.name}</strong> — overrides class default</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">${editInputs}</div>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-sm btn-primary" onclick="saveShipPar('${st.code}')">Save</button>
            <button class="btn btn-sm" onclick="closeShipParEdit('${st.code}')">Cancel</button>
            ${hasOverride ? `<button class="btn btn-sm" onclick="resetShipPar('${st.code}')" style="color:var(--text2);margin-left:auto;">Reset to class default</button>` : ''}
          </div>
        </div>
      </div>`;
    }).join('');

    return `<div class="fleet-class">
      <div class="fleet-class-header" style="display:flex;align-items:center;justify-content:space-between;">
        <div style="font-size:13px;font-weight:500;"><span class="badge ${cl.badge}">${cl.name}</span> Class</div>
        <div style="font-size:11px;color:var(--text2);">${ships.length} ships &middot; ${clReq} crew required</div>
      </div>
      ${cards}
    </div>`;
  }).join('');

  const countByClass = {};
  state.ships.forEach(s => { countByClass[s.shipClass] = (countByClass[s.shipClass] || 0) + 1; });
  renderManningTable(countByClass);
}

function renderManningTable(countByClass) {
  const editing = window._manningEditing || false;
  let rows = '', mT = 0, sT = 0, eT = 0;

  state.positions.forEach(p => {
    const mc = state.manning.Millennium[p.id] || 0;
    const sc = state.manning.Solstice[p.id]   || 0;
    const ec = state.manning.Edge[p.id]        || 0;
    const nm = countByClass.Millennium || 0, ns = countByClass.Solstice || 0, ne = countByClass.Edge || 0;
    const mF = mc * nm, sF = sc * ns, eF = ec * ne;
    mT += mF; sT += sF; eT += eF;

    const cell = (cls, posId, val, fleet) => editing
      ? `<input type="number" min="0" max="20" value="${val}"
           data-cls="${cls}" data-pos="${posId}"
           style="width:44px;text-align:center;padding:2px 4px;font-size:12px;background:var(--input-bg);border:.5px solid var(--border);border-radius:4px;color:#fff;"
           oninput="updateManningCell(this)"/>`
      : (val > 0 ? `${val} &times; ${fleet/val||0} = <strong>${fleet}</strong>` : '—');

    rows += `<tr>
      <td style="padding:7px 12px;"><span style="font-weight:500;">${p.abbr}</span> <span style="font-size:11px;color:var(--text2);">${p.title}</span></td>
      <td class="num" style="padding:7px 12px;">${cell('Millennium', p.id, mc, mF)}</td>
      <td class="num" style="padding:7px 12px;">${cell('Solstice',   p.id, sc, sF)}</td>
      <td class="num" style="padding:7px 12px;">${cell('Edge',       p.id, ec, eF)}</td>
      <td class="num" style="padding:7px 12px;font-weight:600;">${mF + sF + eF}</td>
    </tr>`;
  });

  rows += `<tr class="total-row">
    <td style="padding:7px 12px;">Fleet total</td>
    <td class="num" style="padding:7px 12px;">${mT}</td>
    <td class="num" style="padding:7px 12px;">${sT}</td>
    <td class="num" style="padding:7px 12px;">${eT}</td>
    <td class="num" style="padding:7px 12px;font-weight:700;">${mT + sT + eT}</td>
  </tr>`;

  document.getElementById('manning-breakdown').innerHTML = rows;

  // Show/hide edit vs save buttons
  const editBtn = document.getElementById('manning-edit-btn');
  const saveBtn = document.getElementById('manning-save-btn');
  const cancelBtn = document.getElementById('manning-cancel-btn');
  if (editBtn)   editBtn.style.display   = editing ? 'none' : '';
  if (saveBtn)   saveBtn.style.display   = editing ? '' : 'none';
  if (cancelBtn) cancelBtn.style.display = editing ? '' : 'none';
}

export function editManning() {
  window._manningEditing = true;
  window._manningSnapshot = JSON.parse(JSON.stringify(state.manning));
  const countByClass = {};
  state.ships.forEach(s => { countByClass[s.shipClass] = (countByClass[s.shipClass] || 0) + 1; });
  renderManningTable(countByClass);
}

export function cancelManningEdit() {
  state.manning = window._manningSnapshot;
  window._manningEditing = false;
  const countByClass = {};
  state.ships.forEach(s => { countByClass[s.shipClass] = (countByClass[s.shipClass] || 0) + 1; });
  renderManningTable(countByClass);
}

export function saveManningEdit() {
  window._manningEditing = false;
  saveManning();
  const countByClass = {};
  state.ships.forEach(s => { countByClass[s.shipClass] = (countByClass[s.shipClass] || 0) + 1; });
  renderManningTable(countByClass);
  if (typeof window._showToast === 'function') window._showToast('Par levels saved');
}

export function updateManningCell(input) {
  const cls = input.dataset.cls;
  const pos = parseInt(input.dataset.pos);
  const val = parseInt(input.value) || 0;
  if (!state.manning[cls]) state.manning[cls] = {};
  state.manning[cls][pos] = val;
  // Update fleet total column live
  const row = input.closest('tr');
  if (row) {
    const inputs = row.querySelectorAll('input[data-pos]');
    let rowTotal = 0;
    inputs.forEach(inp => { rowTotal += parseInt(inp.value) || 0; });
    const lastCell = row.querySelector('td:last-child');
    if (lastCell) lastCell.innerHTML = `<strong>${rowTotal}</strong>`;
  }
}

export function saveShip() {
  const name = document.getElementById('ship-name').value.trim();
  if (!name) return;
  const ship = {
    id: uid(), name,
    shipClass: document.getElementById('ship-class').value,
    imo: document.getElementById('ship-imo').value.trim(),
    port: document.getElementById('ship-port').value.trim(),
    gt: document.getElementById('ship-gt').value.trim(),
    status: document.getElementById('ship-status').value,
    notes: document.getElementById('ship-notes').value.trim()
  };
  state.ships.push(ship);
  ['ship-name','ship-imo','ship-port','ship-gt','ship-notes'].forEach(id => document.getElementById(id).value = '');
  toggleForm('ship-form');
  renderFleet();
  upsertShip(ship);
}

export function deleteShip(id) {
  state.ships = state.ships.filter(s => s.id !== id);
  renderFleet();
  dbDeleteShip(id);
}

export function openShipParEdit(code) {
  // Close any other open edit panels first
  document.querySelectorAll('[id^="ship-par-edit-"]').forEach(el => el.style.display = 'none');
  const panel = document.getElementById(`ship-par-edit-${code}`);
  if (panel) panel.style.display = 'block';
}

export function closeShipParEdit(code) {
  const panel = document.getElementById(`ship-par-edit-${code}`);
  if (panel) panel.style.display = 'none';
}

export function saveShipPar(code) {
  const panel = document.getElementById(`ship-par-edit-${code}`);
  if (!panel) return;
  const inputs = panel.querySelectorAll('input[data-pos]');
  const vals = {};
  inputs.forEach(inp => { vals[parseInt(inp.dataset.pos)] = parseInt(inp.value) || 0; });
  state.shipManning[code] = vals;
  saveShipManning();
  renderFleet();
  if (typeof window._showToast === 'function') window._showToast(`Par levels saved for ${code}`);
}

export function resetShipPar(code) {
  delete state.shipManning[code];
  saveShipManning();
  renderFleet();
  if (typeof window._showToast === 'function') window._showToast(`${code} reset to class default`);
}

window.saveShip          = saveShip;
window.deleteShip        = deleteShip;
window.openShipParEdit   = openShipParEdit;
window.closeShipParEdit  = closeShipParEdit;
window.saveShipPar       = saveShipPar;
window.resetShipPar      = resetShipPar;
window.editManning       = editManning;
window.cancelManningEdit = cancelManningEdit;
window.saveManningEdit   = saveManningEdit;
window.updateManningCell = updateManningCell;
