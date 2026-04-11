// ── utils.js — shared utilities ──────────────────────────────────────────────
import { state } from './state.js';

export function showToast(msg, dur=2800) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._to);
  t._to = setTimeout(() => t.classList.remove('show'), dur);
}

export function toggleForm(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const isOpen = el.classList.toggle('open');
  el.style.display = isOpen ? 'block' : 'none';
}

export function classBadge(c) {
  const m = {Millennium:'badge-teal', Solstice:'badge-blue', Edge:'badge-purple'};
  return `<span class="badge ${m[c]||'badge-gray'}">${c}</span>`;
}

export function statusBadge(s) {
  const m = {Onboard:'badge-green', Incoming:'badge-blue', 'On leave':'badge-amber', Pipeline:'badge-gray', Pending:'badge-amber', Accepted:'badge-blue', Confirmed:'badge-green', Declined:'badge-red', Active:'badge-green', Drydock:'badge-amber', Refit:'badge-amber'};
  return `<span class="badge ${m[s]||'badge-gray'}">${s}</span>`;
}

export function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// Expose to window for HTML onclick handlers and db.js toast
window._showToast = showToast;
window.toggleForm = toggleForm;
