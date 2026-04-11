// ── crew.js — crew roster page ───────────────────────────────────────────────
import { state } from './state.js';
import { uid } from './state.js';
import { classBadge, statusBadge, toggleForm, showToast } from './utils.js';
import { upsertCrew, dbDeleteCrew } from './db.js';

export function populateCrewForm() {
  document.getElementById('crew-pos').innerHTML = state.positions.map(p => `<option value="${p.id}">${p.abbr} — ${p.title}</option>`).join('');
  document.getElementById('crew-ship').innerHTML = state.ships.map(s => `<option value="${s.id}">${s.name} (${s.shipClass})</option>`).join('');
}

export function populateFilters() {
  document.getElementById('filter-ship').innerHTML = '<option value="">All ships</option>' + state.ships.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  document.getElementById('filter-pos').innerHTML  = '<option value="">All positions</option>' + state.positions.map(p => `<option value="${p.id}">${p.abbr}</option>`).join('');
}

export function renderCrew() {
  const sf  = document.getElementById('filter-ship').value;
  const cf  = document.getElementById('filter-class').value;
  const pf  = document.getElementById('filter-pos').value;
  const stf = document.getElementById('filter-status').value;
  const q   = (document.getElementById('crew-search')?.value || '').toLowerCase().trim();
  const now = new Date();

  let filtered = state.crew.filter(c => {
    if (sf && c.shipId != sf) return false;
    if (pf && c.posId != pf) return false;
    if (stf && c.status !== stf) return false;
    if (cf) { const ship = state.ships.find(s => s.id == c.shipId); if (!ship || ship.shipClass !== cf) return false; }
    if (q) {
      const hay = (c.name + ' ' + (c.nat || '') + ' ' + (state.ships.find(s => s.id == c.shipId)?.name || '') + ' ' + (state.positions.find(p => p.id == c.posId)?.abbr || '')).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  document.getElementById('crew-count-label').textContent = `${filtered.length} crew member${filtered.length !== 1 ? 's' : ''} shown`;
  const tbody = document.getElementById('crew-tbody');
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="11" style="padding:1rem 9px;color:var(--text2);font-size:12px;">No crew match the current filters.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(c => {
    const pos  = state.positions.find(p => p.id == c.posId);
    const ship = state.ships.find(s => s.id == c.shipId);
    const daysLeft = Math.round((new Date(c.end) - now) / 86400000);
    const medDays  = c.medical ? Math.round((new Date(c.medical) - now) / 86400000) : 999;
    const dc = daysLeft < 30 ? 'badge-red' : daysLeft < 60 ? 'badge-amber' : 'badge-green';
    const mc = medDays < 30 ? 'badge-red' : medDays < 90 ? 'badge-amber' : '';
    const emailVal  = c.email || '';
    const emailCell = emailVal
      ? `<a href="mailto:${emailVal}" style="font-size:11px;color:var(--blue-t);text-decoration:none;" title="${emailVal}" onclick="event.stopPropagation()">✉ ${emailVal}</a>`
      : `<span class="crew-email-add" onclick="crewInlineEmail(${c.id},this)" style="font-size:11px;color:var(--text2);cursor:pointer;" title="Click to add email">+ add email</span>`;
    return `<tr>
      <td style="font-weight:500;cursor:pointer;" onclick="openProfile(${c.id})" title="Open profile">
        <span style="color:var(--blue-t);text-decoration:none;">${c.name}</span>
        <span style="font-size:10px;font-weight:400;color:var(--text2);"> ${c.nat}</span>
      </td>
      <td><span class="badge badge-gray">${pos ? pos.abbr : '—'}</span></td>
      <td style="white-space:nowrap;">${ship ? ship.name : '—'}</td>
      <td>${ship ? classBadge(ship.shipClass) : '—'}</td>
      <td>${statusBadge(c.status)}</td>
      <td id="email-cell-${c.id}" style="min-width:160px;">${emailCell}</td>
      <td style="white-space:nowrap;color:var(--text2);font-size:11px;">${c.end || '—'}</td>
      <td><span class="badge ${dc}">${c.end ? (daysLeft > 0 ? daysLeft + 'd' : 'Exp.') : '—'}</span></td>
      <td>${mc ? `<span class="badge ${mc}">${c.medical}</span>` : `<span style="font-size:11px;color:var(--text2);">${c.medical || '—'}</span>`}</td>
      <td><button class="btn btn-sm" style="font-size:10px;" onclick="openDocWallet(${c.id},event)" title="Open document wallet">📋 Docs</button></td>
      <td><button class="btn btn-sm btn-danger" onclick="deleteCrew(${c.id})">✕</button></td>
    </tr>`;
  }).join('');
}

export function crewInlineEmail(crewId, el) {
  const cell = document.getElementById(`email-cell-${crewId}`);
  if (!cell) return;
  cell.innerHTML = `<div style="display:flex;gap:5px;align-items:center;">
    <input id="inline-email-${crewId}" type="email" value="" placeholder="email@example.com"
      style="font-size:11px;padding:3px 7px;width:190px;background:rgba(0,0,0,.3);border:.5px solid var(--border2);border-radius:6px;color:#fff;outline:none;"
      onkeydown="if(event.key==='Enter')saveInlineEmail(${crewId})"
      onclick="event.stopPropagation()"/>
    <button class="btn btn-sm" style="font-size:10px;padding:2px 7px;" onclick="saveInlineEmail(${crewId})">Save</button>
    <button class="btn btn-sm" style="font-size:10px;padding:2px 7px;" onclick="renderCrew()">✕</button>
  </div>`;
  document.getElementById(`inline-email-${crewId}`)?.focus();
}

export function saveInlineEmail(crewId) {
  const input = document.getElementById(`inline-email-${crewId}`);
  if (!input) return;
  const email = input.value.trim();
  saveCrewEmail(crewId, email);
  renderCrew();
  if (email) showToast(`Email saved for crew #${crewId}`);
}

export function saveCrew() {
  const name = document.getElementById('crew-name').value.trim();
  if (!name) return;
  const emailVal = (document.getElementById('crew-email')?.value || '').trim();
  const crew = {
    id: uid(), name,
    nat:      document.getElementById('crew-nat').value.trim(),
    posId:    parseInt(document.getElementById('crew-pos').value),
    shipId:   parseInt(document.getElementById('crew-ship').value),
    status:   document.getElementById('crew-status').value,
    start:    document.getElementById('crew-start').value,
    end:      document.getElementById('crew-end').value,
    passport: document.getElementById('crew-passport').value,
    medical:  document.getElementById('crew-medical').value,
    airport:  document.getElementById('crew-airport').value.trim(),
    email:    emailVal,
    certs:    document.getElementById('crew-certs').value.split(',').map(s => s.trim()).filter(Boolean),
    notes:    document.getElementById('crew-notes').value.trim(),
    docs:     []
  };
  state.crew.push(crew);
  ['crew-name','crew-nat','crew-airport','crew-email','crew-certs','crew-notes','crew-start','crew-end','crew-passport','crew-medical']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  toggleForm('crew-form');
  renderCrew();
  upsertCrew(crew);
}

export function deleteCrew(id) {
  const c = state.crew.find(x => x.id === id);
  if (c && !confirm(`Remove ${c.name} from the roster?`)) return;
  state.crew = state.crew.filter(c => c.id !== id);
  renderCrew();
  dbDeleteCrew(id);
}

export function saveCrewEmail(crewId, email) {
  const c = state.crew.find(x => x.id === crewId);
  if (!c) return;
  c.email = email;
  upsertCrew(c);
}

export function getCrewEmail(crewId) {
  return state.crew.find(x => x.id === crewId)?.email || '';
}

window.renderCrew       = renderCrew;
window.crewInlineEmail  = crewInlineEmail;
window.saveInlineEmail  = saveInlineEmail;
window.saveCrew         = saveCrew;
window.deleteCrew       = deleteCrew;
window.saveCrewEmail    = saveCrewEmail;
window.getCrewEmail     = getCrewEmail;
