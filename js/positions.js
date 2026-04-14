// ── positions.js — positions management page ─────────────────────────────────
import { state } from './state.js';
import { uid } from './state.js';
import { showToast, toggleForm } from './utils.js';
import { upsertPosition, dbDeletePosition } from './db.js';

const RANK_OPTIONS = ['Senior Management','Management','Technical Senior','Technical','Crew'];

export function renderPositions() {
  const list = document.getElementById('positions-list');
  if (!state.positions.length) {
    list.innerHTML = '<p style="padding:1rem;font-size:12px;color:var(--text2);">No positions defined yet.</p>';
    return;
  }
  list.innerHTML = state.positions.map(p => `
    <div class="row-item" id="pos-row-${p.id}" style="flex-direction:column;align-items:stretch;gap:0;padding:0;">
      <div id="pos-view-${p.id}" style="display:flex;align-items:flex-start;gap:12px;padding:12px 14px;">
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:600;">${p.title} <span class="badge badge-gray">${p.abbr}</span></div>
          <div style="font-size:11px;color:var(--text2);margin-top:3px;">
            ${p.rank} · Contract: <strong>${p.contract}</strong>mo · Handover: <strong>${p.handover}</strong> days
          </div>
          ${p.certs?.length ? `<div class="tag-list" style="margin-top:5px;">${p.certs.map(c=>`<span class="tag">${c}</span>`).join('')}</div>` : ''}
          ${p.desc ? `<div style="font-size:11px;color:var(--text2);margin-top:4px;font-style:italic;">${p.desc}</div>` : ''}
        </div>
        <div class="row-actions" style="flex-shrink:0;">
          <button class="btn btn-sm" onclick="editPosition(${p.id})">✎ Edit</button>
          <button class="btn btn-sm btn-danger" onclick="deletePosition(${p.id})">✕</button>
        </div>
      </div>
      <div id="pos-edit-${p.id}" style="display:none;padding:12px 14px;border-top:.5px solid var(--border);background:rgba(255,255,255,.03);">
        <div class="grid-2" style="margin-bottom:10px;">
          <div class="field" style="margin:0;"><label>Position title</label><input id="pos-edit-title-${p.id}" value="${p.title}"/></div>
          <div class="field" style="margin:0;"><label>Abbreviation</label><input id="pos-edit-abbr-${p.id}" value="${p.abbr}"/></div>
        </div>
        <div class="grid-3" style="margin-bottom:10px;">
          <div class="field" style="margin:0;"><label>Contract (months)</label><input id="pos-edit-contract-${p.id}" type="number" value="${p.contract}"/></div>
          <div class="field" style="margin:0;"><label>Handover (days)</label><input id="pos-edit-handover-${p.id}" type="number" value="${p.handover}"/></div>
          <div class="field" style="margin:0;"><label>Rank</label><select id="pos-edit-rank-${p.id}">${RANK_OPTIONS.map(r=>`<option ${r===p.rank?'selected':''}>${r}</option>`).join('')}</select></div>
        </div>
        <div class="field" style="margin-bottom:10px;"><label>Required certifications (comma separated)</label><input id="pos-edit-certs-${p.id}" value="${(p.certs||[]).join(', ')}"/></div>
        <div class="field" style="margin-bottom:10px;"><label>Description</label><textarea id="pos-edit-desc-${p.id}" style="min-height:60px;">${p.desc||''}</textarea></div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-primary btn-sm" onclick="savePositionEdit(${p.id})">Save changes</button>
          <button class="btn btn-sm" onclick="cancelPositionEdit(${p.id})">Cancel</button>
        </div>
      </div>
    </div>`).join('');
}

export function editPosition(id) {
  state.positions.forEach(p => { if (p.id !== id) cancelPositionEdit(p.id); });
  document.getElementById(`pos-view-${id}`).style.display = 'none';
  document.getElementById(`pos-edit-${id}`).style.display = 'block';
  document.getElementById(`pos-edit-title-${id}`)?.focus();
}

export function cancelPositionEdit(id) {
  const view = document.getElementById(`pos-view-${id}`);
  const edit = document.getElementById(`pos-edit-${id}`);
  if (view) view.style.display = 'flex';
  if (edit) edit.style.display = 'none';
}

export function savePositionEdit(id) {
  const p = state.positions.find(x => x.id === id);
  if (!p) return;
  const title = document.getElementById(`pos-edit-title-${id}`).value.trim();
  if (!title) { showToast('Position title is required.'); return; }
  p.title    = title;
  p.abbr     = document.getElementById(`pos-edit-abbr-${id}`).value.trim();
  p.contract = parseInt(document.getElementById(`pos-edit-contract-${id}`).value) || 6;
  p.handover = parseInt(document.getElementById(`pos-edit-handover-${id}`).value) || 3;
  p.rank     = document.getElementById(`pos-edit-rank-${id}`).value;
  p.certs    = document.getElementById(`pos-edit-certs-${id}`).value.split(',').map(s => s.trim()).filter(Boolean);
  p.desc     = document.getElementById(`pos-edit-desc-${id}`).value.trim();
  renderPositions();
  showToast(`Position "${p.title}" updated`);
  upsertPosition(p);
}

export function savePosition() {
  const title = document.getElementById('pos-title').value.trim();
  if (!title) return;
  const pos = {
    id:       uid(),
    title,
    abbr:     document.getElementById('pos-abbr').value.trim(),
    rank:     document.getElementById('pos-rank').value,
    contract: parseInt(document.getElementById('pos-contract').value) || 6,
    handover: parseInt(document.getElementById('pos-handover').value) || 3,
    certs:    document.getElementById('pos-certs').value.split(',').map(s => s.trim()).filter(Boolean),
    desc:     document.getElementById('pos-desc').value.trim()
  };
  state.positions.push(pos);
  ['pos-title','pos-abbr','pos-contract','pos-handover','pos-certs','pos-desc'].forEach(id => document.getElementById(id).value = '');
  toggleForm('pos-form');
  renderPositions();
  showToast(`Position "${title}" added`);
  upsertPosition(pos);
}

export function deletePosition(id) {
  const p = state.positions.find(x => x.id === id);
  if (p && !confirm(`Delete position "${p.title}"? This cannot be undone.`)) return;
  state.positions = state.positions.filter(p => p.id !== id);
  renderPositions();
  dbDeletePosition(id);
}

window.renderPositions     = renderPositions;
window.editPosition        = editPosition;
window.cancelPositionEdit  = cancelPositionEdit;
window.savePositionEdit    = savePositionEdit;
window.savePosition        = savePosition;
window.deletePosition      = deletePosition;
