// ── utils.js — shared utilities ──────────────────────────────────────────────
import { state } from './state.js';
import { SHIP_DEPLOYMENT } from './data.js';

// Ship code → name map used for SHIP_DEPLOYMENT lookups
const SC2NAME_DEP = {ML:'Millennium',IN:'Infinity',SM:'Summit',CS:'Constellation',SL:'Solstice',EQ:'Equinox',EC:'Eclipse',SI:'Silhouette',RF:'Reflection',EG:'Edge',AX:'Apex',BY:'Beyond',AT:'Ascent',XC:'Xcel'};

/**
 * Returns the embarkation/debarkation info for a ship on a given date.
 * Looks up the monthly itinerary entry for that date's month (or the next
 * available month if none exists for that exact month).
 * Returns { port, region, allPorts } or null if no data found.
 */
export function getShipPortForDate(shipCode, dateStr) {
  if (!shipCode || !dateStr) return null;
  const shipName   = SC2NAME_DEP[shipCode];
  if (!shipName) return null;
  const deployment = SHIP_DEPLOYMENT[shipName];
  if (!deployment?.monthly) return null;

  const targetMonth = dateStr.slice(0, 7); // YYYY-MM
  const monthly     = deployment.monthly;

  // Try exact month, then walk forward to the nearest future month
  const entry = monthly[targetMonth]
    || monthly[Object.keys(monthly).sort().find(m => m >= targetMonth) || ''];
  if (!entry || !entry.ports?.length) return null;

  return { port: entry.ports[0], region: entry.region, allPorts: entry.ports };
}

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
