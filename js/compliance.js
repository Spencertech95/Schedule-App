// ── compliance.js — compliance rules page ────────────────────────────────────
import { state } from './state.js';
import { uid } from './state.js';
import { toggleForm } from './utils.js';
import { upsertCompliance } from './db.js';

export function renderCompliance() {
  const el = document.getElementById('compliance-list');
  if (!state.compliance.length) { el.innerHTML = '<p class="empty">No rules added yet.</p>'; return; }
  const cc = {'MLC 2006':'badge-blue','STCW':'badge-green','Flag state':'badge-amber','Company policy':'badge-gray','ISM':'badge-gray'};
  el.innerHTML = state.compliance.map(r =>
    `<div class="row-item"><div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:500;">${r.title}</div><div style="margin:3px 0;"><span class="badge ${cc[r.cat]||'badge-gray'}">${r.cat}</span></div><div style="font-size:12px;color:var(--text2);">${r.desc}</div></div><button class="btn btn-sm btn-danger" onclick="deleteCompliance(${r.id})">✕</button></div>`
  ).join('');
}

export function saveCompliance() {
  const title = document.getElementById('comp-title').value.trim();
  if (!title) return;
  const rule = {
    id:   uid(),
    title,
    cat:  document.getElementById('comp-cat').value,
    desc: document.getElementById('comp-desc').value.trim()
  };
  state.compliance.push(rule);
  ['comp-title','comp-desc'].forEach(id => document.getElementById(id).value = '');
  toggleForm('comp-form');
  renderCompliance();
  upsertCompliance(rule);
}

export function deleteCompliance(id) {
  state.compliance = state.compliance.filter(r => r.id !== id);
  renderCompliance();
}

window.saveCompliance   = saveCompliance;
window.deleteCompliance = deleteCompliance;
