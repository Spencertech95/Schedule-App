// ── utils.js — shared utilities ──────────────────────────────────────────────
import { state } from './state.js';
import { SHIP_DEPLOYMENT } from './data.js';

// Ship code → name map used for SHIP_DEPLOYMENT lookups
const SC2NAME_DEP = {ML:'Millennium',IN:'Infinity',SM:'Summit',CS:'Constellation',SL:'Solstice',EQ:'Equinox',EC:'Eclipse',SI:'Silhouette',RF:'Reflection',EG:'Edge',AX:'Apex',BY:'Beyond',AT:'Ascent',XC:'Xcel'};

/**
 * Returns the embarkation/debarkation info for a ship on a given date.
 * Tries exact month first, then nearest available month in either direction.
 * Uses the day-of-month to pick the appropriate port from the ordered itinerary list.
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
  const keys        = Object.keys(monthly).sort();
  if (!keys.length) return null;

  // Pick the port whose position in the ordered list best matches the day within the month
  function pickPort(ports, ds) {
    if (ports.length <= 1) return ports[0];
    const day = parseInt(ds.slice(8, 10), 10) || 1;
    const [y, mo] = ds.slice(0, 7).split('-').map(Number);
    const daysInMonth = new Date(y, mo, 0).getDate();
    const idx = Math.min(ports.length - 1, Math.floor((day - 1) / daysInMonth * ports.length));
    return ports[idx];
  }

  // Exact match
  if (monthly[targetMonth]?.ports?.length) {
    const e = monthly[targetMonth];
    return { port: pickPort(e.ports, dateStr), region: e.region, allPorts: e.ports };
  }

  // Nearest available month (either direction)
  function ym(s) { const [y, m] = s.split('-').map(Number); return y * 12 + m; }
  const tgt = ym(targetMonth);
  const nearest = keys.reduce((best, k) =>
    !best || Math.abs(ym(k) - tgt) < Math.abs(ym(best) - tgt) ? k : best
  , null);

  const e = nearest && monthly[nearest];
  if (!e?.ports?.length) return null;
  return { port: pickPort(e.ports, dateStr), region: e.region, allPorts: e.ports };
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

export function crewLink(name, id, stopProp = false) {
  const click = stopProp
    ? `event.stopPropagation();openProfile(${id})`
    : `openProfile(${id})`;
  return `<span onclick="${click}" style="cursor:pointer;color:var(--blue-t);">${esc(name || '—')}</span>`;
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

// US states and territories — used to append ", USA" to the country label
const US_STATES = new Set([
  'FLORIDA','ALASKA','CALIFORNIA','HAWAII','WASHINGTON','OREGON','TEXAS',
  'NEW YORK','NEW JERSEY','MASSACHUSETTS','MARYLAND','VIRGINIA','GEORGIA',
  'SOUTH CAROLINA','NORTH CAROLINA','CONNECTICUT','RHODE ISLAND','MAINE',
  'NEW HAMPSHIRE','LOUISIANA','MISSISSIPPI','ALABAMA','PORT CANAVERAL',
  'PUERTO RICO','U.S VIRGIN ISLANDS','U.S. VIRGIN ISLANDS','GUAM',
]);

// Canadian provinces
const CA_PROVINCES = new Set([
  'BRITISH COLUMBIA','ONTARIO','NOVA SCOTIA','NEW BRUNSWICK','QUEBEC',
  'PRINCE EDWARD ISLAND','NEWFOUNDLAND','YUKON','NORTHWEST TERRITORIES',
]);

/**
 * Parses a port name string like "COZUMEL, MEXICO" or "KEY WEST, FLORIDA"
 * into { city, country } with full country name where applicable.
 */
export function parsePortLocation(portName) {
  if (!portName || portName === 'AT SEA') return { city: 'At sea', country: '' };
  const parts   = portName.split(',').map(p => p.trim());
  const city    = parts[0] || portName;
  const region  = parts.slice(1).join(', ').trim();
  if (!region) return { city, country: '' };

  const regionUC = region.toUpperCase();
  if (US_STATES.has(regionUC))    return { city, country: `${toTitleCase(region)}, USA` };
  if (CA_PROVINCES.has(regionUC)) return { city, country: `${toTitleCase(region)}, Canada` };
  return { city, country: toTitleCase(region) };
}

function toTitleCase(str) {
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

// Expose to window for HTML onclick handlers and db.js toast
window._showToast = showToast;
window.toggleForm = toggleForm;
