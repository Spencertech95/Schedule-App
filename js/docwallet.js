// ── docwallet.js — per-crew document wallet ───────────────────────────────────
import { state } from './state.js';
import { showToast } from './utils.js';
import { upsertCrew } from './db.js';

export const DW_DOC_TYPES = [
  {id:'passport',     label:'Passport',                        icon:'🛂', pinned:true},
  {id:'medical',      label:'Medical Certificate',             icon:'🏥', pinned:true},
  {id:'usc1d',        label:'US C1/D Visa',                    icon:'🇺🇸'},
  {id:'schengen',     label:'Schengen Visa',                   icon:'🇪🇺'},
  {id:'uk',           label:'UK Visa',                         icon:'🇬🇧'},
  {id:'canada',       label:'Canadian Visa',                   icon:'🇨🇦'},
  {id:'australia',    label:'Australian Visa',                 icon:'🇦🇺'},
  {id:'stcw_basic',   label:'STCW Basic Safety',               icon:'⚓'},
  {id:'stcw_psc',     label:'STCW Proficiency Survival Craft', icon:'🛟'},
  {id:'stcw_aff',     label:'STCW Advanced Firefighting',      icon:'🔥'},
  {id:'stcw_mfa',     label:'STCW Medical First Aid',          icon:'🩺'},
  {id:'stcw_sec',     label:'STCW Security Awareness',         icon:'🛡'},
  {id:'gmdss',        label:'GMDSS',                           icon:'📡'},
  {id:'yellow_fever', label:'Yellow Fever Vaccination',        icon:'💉'},
  {id:'other',        label:'Other',                           icon:'📄'},
];
export const DW_PINNED = ['passport','medical'];
export const DW_ICONS  = Object.fromEntries(DW_DOC_TYPES.map(d => [d.id, d.icon]));
export const DW_LABELS = Object.fromEntries(DW_DOC_TYPES.map(d => [d.id, d.label]));

let _dwSelectedId = null;
let _dwAddOpen    = false;

function dwDocStatus(expiry) {
  if (!expiry) return {cls:'dw-no-date', badge:'exp-gray', label:'No date', dotCls:'ds-gray'};
  const days = Math.round((new Date(expiry) - new Date()) / 86400000);
  if (days < 0)   return {cls:'dw-expired',    badge:'exp-red',   label:'Expired',         dotCls:'ds-red',   days};
  if (days <= 30) return {cls:'dw-expired',    badge:'exp-red',   label:`Exp. in ${days}d`, dotCls:'ds-red',   days};
  if (days <= 90) return {cls:'dw-warn-amber', badge:'exp-amber', label:`${days}d left`,   dotCls:'ds-amber', days};
  return             {cls:'dw-ok',             badge:'exp-green', label:`${days}d left`,   dotCls:'ds-green', days};
}

function dwCrewWorstStatus(c) {
  const allExpiries = [];
  if (c.passport) allExpiries.push(c.passport);
  if (c.medical)  allExpiries.push(c.medical);
  (c.docs || []).forEach(d => { if (d.expiry) allExpiries.push(d.expiry); });
  if (!allExpiries.length) return 'ds-gray';
  const statuses = allExpiries.map(e => dwDocStatus(e));
  if (statuses.some(s => s.dotCls === 'ds-red'))   return 'ds-red';
  if (statuses.some(s => s.dotCls === 'ds-amber')) return 'ds-amber';
  return 'ds-green';
}

// Helper: derive avatar initials and colour (shared pattern with profile.js)
function profInitials(name) {
  const parts = (name || '').trim().split(/\s+/);
  return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : (name || '?')[0].toUpperCase();
}
function profColor(name) {
  const colors = ['#E87435','#299BE1','#13818D','#4dd4a0','#7fc8e8','#5a9fd4','#A4A4A7','#f0a070'];
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return colors[Math.abs(h) % colors.length];
}

export function initDocWallet() {
  _dwSelectedId = null;
  _dwAddOpen = false;
  renderDWList();
  document.getElementById('dw-empty').style.display = 'flex';
  document.getElementById('dw-detail-content').style.display = 'none';
}

export function openDocWallet(crewId, evt) {
  if (evt) evt.stopPropagation();
  const navBtn = document.querySelector('.nav-item[onclick*="docwallet"]');
  window.showPage('docwallet', navBtn || document.createElement('button'));
  setTimeout(() => selectDWCrew(crewId), 30);
}

export function renderDWList() {
  const q = (document.getElementById('dw-search')?.value || '').toLowerCase().trim();
  let crew = [...state.crew];
  if (q) crew = crew.filter(c => c.name.toLowerCase().includes(q) || (c.nat || '').toLowerCase().includes(q));
  crew.sort((a, b) => a.name.localeCompare(b.name));
  const pos = state.positions;
  document.getElementById('dw-list-items').innerHTML = crew.map(c => {
    const p = pos.find(x => x.id == c.posId);
    const dotCls = dwCrewWorstStatus(c);
    const isActive = c.id === _dwSelectedId;
    return `<div class="dw-crew-row${isActive ? ' active' : ''}" onclick="selectDWCrew(${c.id})">
      <div class="dw-status-dot ${dotCls}"></div>
      <div style="flex:1;min-width:0;">
        <div class="dw-crew-name">${c.name}</div>
        <div class="dw-crew-sub">${p ? p.abbr : '—'} · ${c.nat || '—'}</div>
      </div>
    </div>`;
  }).join('') || '<div style="padding:1rem;font-size:12px;color:var(--text2);">No crew found</div>';
}

export function selectDWCrew(crewId) {
  _dwSelectedId = crewId;
  _dwAddOpen = false;
  renderDWList();
  renderDWDetail();
}

export function renderDWDetail() {
  const c = state.crew.find(x => x.id === _dwSelectedId);
  if (!c) {
    document.getElementById('dw-empty').style.display = 'flex';
    document.getElementById('dw-detail-content').style.display = 'none';
    return;
  }
  document.getElementById('dw-empty').style.display = 'none';
  const content = document.getElementById('dw-detail-content');
  content.style.cssText = 'display:flex;flex-direction:column;overflow:hidden;height:100%;width:100%;';

  const pos  = state.positions.find(p => p.id == c.posId);
  const ship = state.ships.find(s => s.id == c.shipId);
  document.getElementById('dw-detail-hdr').innerHTML = `
    <div style="width:38px;height:38px;border-radius:50%;background:${profColor(c.name)};display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#fff;flex-shrink:0;">${profInitials(c.name)}</div>
    <div>
      <div class="dw-detail-name">${c.name}</div>
      <div class="dw-detail-meta">${pos ? pos.abbr : '—'} · ${ship ? ship.name : '—'} · ${c.nat || '—'}</div>
    </div>`;

  const docs = c.docs || [];

  const pinnedHtml = DW_DOC_TYPES.filter(t => t.pinned).map(t => {
    const expiry = c[t.id] || '';
    const st = dwDocStatus(expiry);
    return `<div class="dw-doc-card ${st.cls}" id="dwcard-pinned-${t.id}">
      <div class="dw-doc-icon">${t.icon}</div>
      <div class="dw-doc-info">
        <div class="dw-doc-type">${t.label}</div>
        <div id="dw-exp-view-${t.id}" style="display:flex;align-items:center;gap:6px;margin-top:3px;">
          <span class="dw-doc-expiry">${expiry ? 'Expires ' + expiry : 'No expiry date'}</span>
          <span class="dw-doc-badge ${st.badge}">${st.label}</span>
        </div>
        <div id="dw-exp-edit-${t.id}" style="display:none;" class="dw-inline-edit">
          <input type="date" id="dw-input-${t.id}" value="${expiry}" placeholder="yyyy-mm-dd"/>
          <button class="btn btn-sm btn-primary" style="font-size:10px;padding:3px 8px;" onclick="savePinnedDoc('${t.id}')">Save</button>
          <button class="btn btn-sm" style="font-size:10px;padding:3px 8px;" onclick="cancelPinnedDocEdit('${t.id}')">✕</button>
        </div>
      </div>
      <div class="dw-doc-actions">
        <button class="btn btn-sm" style="font-size:10px;" onclick="editPinnedDoc('${t.id}')" title="Edit expiry">✎ Edit</button>
      </div>
    </div>`;
  }).join('');

  const addHtml = docs.map((d, i) => {
    const tDef = DW_DOC_TYPES.find(x => x.id === d.typeId) || {label:d.typeId, icon:'📄'};
    const st = dwDocStatus(d.expiry);
    return `<div class="dw-doc-card ${st.cls}" id="dwcard-doc-${i}">
      <div class="dw-doc-icon">${tDef.icon}</div>
      <div class="dw-doc-info">
        <div class="dw-doc-type">${tDef.label}${d.label ? ` — <span style="font-weight:400;font-size:11px;">${d.label}</span>` : ''}</div>
        <div id="dw-adoc-view-${i}" style="display:flex;align-items:center;gap:6px;margin-top:3px;">
          <span class="dw-doc-expiry">${d.expiry ? 'Expires ' + d.expiry : 'No expiry date'}</span>
          <span class="dw-doc-badge ${st.badge}">${st.label}</span>
        </div>
        <div id="dw-adoc-edit-${i}" style="display:none;" class="dw-inline-edit">
          <input type="date" id="dw-adoc-input-${i}" value="${d.expiry || ''}" placeholder="yyyy-mm-dd"/>
          <button class="btn btn-sm btn-primary" style="font-size:10px;padding:3px 8px;" onclick="saveAdditionalDoc(${i})">Save</button>
          <button class="btn btn-sm" style="font-size:10px;padding:3px 8px;" onclick="cancelAdditionalDocEdit(${i})">✕</button>
        </div>
      </div>
      <div class="dw-doc-actions">
        <button class="btn btn-sm" style="font-size:10px;" onclick="editAdditionalDoc(${i})" title="Edit expiry">✎</button>
        <button class="btn btn-sm btn-danger" style="font-size:10px;" onclick="deleteDoc(${i})" title="Delete">✕</button>
      </div>
    </div>`;
  }).join('');

  const addableTypes = DW_DOC_TYPES.filter(t => !t.pinned);
  const addFormHtml = _dwAddOpen ? `
    <div class="dw-add-form" id="dw-add-form">
      <div class="dw-add-form-row">
        <select id="dw-new-type" style="flex:1;">
          ${addableTypes.map(t => `<option value="${t.id}">${t.icon} ${t.label}</option>`).join('')}
        </select>
        <input type="date" id="dw-new-expiry" placeholder="Expiry date (optional)" style="flex:1;"/>
      </div>
      <input id="dw-new-label" placeholder="Custom label (optional, e.g. B1/B2, EU Visa)" style="width:100%;"/>
      <div style="display:flex;gap:7px;">
        <button class="btn btn-primary btn-sm" onclick="saveNewDoc()">Add document</button>
        <button class="btn btn-sm" onclick="_dwAddOpen=false;renderDWDetail();">Cancel</button>
      </div>
    </div>` : '';

  document.getElementById('dw-detail-body').innerHTML = `
    <div class="dw-section-label">Identity &amp; Medical</div>
    <div class="dw-doc-cards">${pinnedHtml}</div>
    ${docs.length ? `<div class="dw-section-label">Visas &amp; Certificates</div><div class="dw-doc-cards">${addHtml}</div>` : ''}
    <div class="dw-add-row">
      ${!_dwAddOpen ? `<button class="btn btn-primary btn-sm" onclick="_dwAddOpen=true;renderDWDetail();">+ Add document</button>` : ''}
      ${addFormHtml}
    </div>`;
}

export function editPinnedDoc(typeId) {
  document.getElementById('dw-exp-view-' + typeId).style.display = 'none';
  document.getElementById('dw-exp-edit-' + typeId).style.display = 'flex';
  document.getElementById('dw-input-' + typeId)?.focus();
}

export function cancelPinnedDocEdit(typeId) {
  document.getElementById('dw-exp-view-' + typeId).style.display = 'flex';
  document.getElementById('dw-exp-edit-' + typeId).style.display = 'none';
}

export function savePinnedDoc(typeId) {
  const c = state.crew.find(x => x.id === _dwSelectedId);
  if (!c) return;
  c[typeId] = document.getElementById('dw-input-' + typeId).value;
  upsertCrew(c);
  renderDWList();
  renderDWDetail();
  showToast('Saved');
}

export function editAdditionalDoc(idx) {
  document.getElementById('dw-adoc-view-' + idx).style.display = 'none';
  document.getElementById('dw-adoc-edit-' + idx).style.display = 'flex';
  document.getElementById('dw-adoc-input-' + idx)?.focus();
}

export function cancelAdditionalDocEdit(idx) {
  document.getElementById('dw-adoc-view-' + idx).style.display = 'flex';
  document.getElementById('dw-adoc-edit-' + idx).style.display = 'none';
}

export function saveAdditionalDoc(idx) {
  const c = state.crew.find(x => x.id === _dwSelectedId);
  if (!c || !c.docs) return;
  c.docs[idx].expiry = document.getElementById('dw-adoc-input-' + idx).value;
  upsertCrew(c);
  renderDWList();
  renderDWDetail();
  showToast('Saved');
}

export function saveNewDoc() {
  const c = state.crew.find(x => x.id === _dwSelectedId);
  if (!c) return;
  if (!c.docs) c.docs = [];
  const typeId = document.getElementById('dw-new-type').value;
  const expiry = document.getElementById('dw-new-expiry').value;
  const label  = (document.getElementById('dw-new-label').value || '').trim();
  c.docs.push({typeId, expiry, label});
  _dwAddOpen = false;
  upsertCrew(c);
  renderDWList();
  renderDWDetail();
  showToast('Document added');
}

export function deleteDoc(idx) {
  const c = state.crew.find(x => x.id === _dwSelectedId);
  if (!c || !c.docs) return;
  const d = c.docs[idx];
  const label = DW_LABELS[d.typeId] || d.typeId;
  if (!confirm(`Remove "${label}" from ${c.name}'s wallet?`)) return;
  c.docs.splice(idx, 1);
  upsertCrew(c);
  renderDWList();
  renderDWDetail();
}

window._dwAddOpen            = _dwAddOpen; // kept as module-level var; expose setter via helper
window.initDocWallet         = initDocWallet;
window.openDocWallet         = openDocWallet;
window.renderDWList          = renderDWList;
window.selectDWCrew          = selectDWCrew;
window.renderDWDetail        = renderDWDetail;
window.editPinnedDoc         = editPinnedDoc;
window.cancelPinnedDocEdit   = cancelPinnedDocEdit;
window.savePinnedDoc         = savePinnedDoc;
window.editAdditionalDoc     = editAdditionalDoc;
window.cancelAdditionalDocEdit = cancelAdditionalDocEdit;
window.saveAdditionalDoc     = saveAdditionalDoc;
window.saveNewDoc            = saveNewDoc;
window.deleteDoc             = deleteDoc;
