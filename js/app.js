// ── app.js — application entry point ─────────────────────────────────────────
// Imports all modules (which registers their window.* handlers), then boots.

import { loadAll, upsertOffer } from './db.js';
import { state }   from './state.js';
import { showToast } from './utils.js';

// Page modules — imported for their side-effects (window.* registrations)
import './navigation.js';
import './overview.js';
import './fleet.js';
import './rotations.js';
import './crew.js';
import './profile.js';
import './positions.js';
import './contracts.js';
import './email.js';
import './compliance.js';
import './reports.js';
import './placement.js';
import './dashboard.js';
import './deployment.js';
import './ship.js';
import './docwallet.js';
import './import.js';

// Expose showToast globally (used by db.js error handler and inline HTML)
window._showToast = showToast;
window.showToast  = showToast;

// ── Boot ─────────────────────────────────────────────────────────────────────
async function boot() {
  // Show loading indicator while we fetch data
  const loadingEl = document.getElementById('app-loading');
  if (loadingEl) loadingEl.style.display = 'flex';

  try {
    await loadAll();
  } catch (err) {
    console.error('Failed to load data from Supabase:', err);
    showToast('Could not load data — working offline', 4000);
  }

  if (loadingEl) loadingEl.style.display = 'none';

  // Check for offer response link (?offer=X&action=accept|decline)
  if (window.location.search.includes('offer=') && window.location.search.includes('action=')) {
    showOfferResponseOverlay();
    return; // don't render the normal app
  }

  // Initialise ship nav buttons
  window.initShipNav?.();

  // Render positions and compliance lists (used in sidebar/forms)
  window.renderPositions?.();
  window.renderCompliance?.();

  // Navigate to the page from the URL hash, or default to overview
  const hash = window.location.hash.slice(1); // strip leading #
  let navigated = false;
  if (hash) {
    if (hash.startsWith('ship-')) {
      const sc = hash.slice(5);
      const shipNavBtn = document.getElementById('shipnav-' + sc);
      if (shipNavBtn && typeof window.showShip === 'function') {
        window.showShip(sc, shipNavBtn);
        navigated = true;
      }
    } else {
      const navBtn = document.querySelector(`.nav-item[onclick*="'${hash}'"]`);
      if (navBtn) {
        window.showPage(hash, navBtn);
        navigated = true;
      }
    }
  }
  if (!navigated) {
    const defaultNav = document.querySelector('.nav-item[data-page="overview"]')
      || document.querySelector('.nav-item[onclick*="overview"]');
    window.showPage('overview', defaultNav || document.createElement('button'));
    if (defaultNav) defaultNav.classList.add('active');
  }
}

boot();

// ── OFFER RESPONSE HANDLER ────────────────────────────────────────────────────
// Called after data loads if ?offer=X&action=accept|decline is in the URL.

const SHIP_NAMES = {'ML':'Millennium','IN':'Infinity','SM':'Summit','CS':'Constellation','SL':'Solstice','EQ':'Equinox','EC':'Eclipse','SI':'Silhouette','RF':'Reflection','EG':'Edge','AX':'Apex','BY':'Beyond','AT':'Ascent','XC':'Xcel'};

let _ofrAction = null;
let _ofrOffer  = null;
let _ofrShip   = null;

function showOfferResponseOverlay() {
  const params   = new URLSearchParams(window.location.search);
  const offerId  = parseInt(params.get('offer'));
  const action   = params.get('action'); // 'accept' or 'decline'
  const ship     = params.get('ship')   || null; // specific ship chosen (ESS multi-ship)
  if (!offerId || !['accept','decline'].includes(action)) return;

  const overlay = document.getElementById('offer-response-overlay');
  if (!overlay) return;
  overlay.style.display = 'flex';

  // Hide the main app shell so crew only see the response screen
  const shell = document.getElementById('app-shell');
  if (shell) shell.style.display = 'none';

  const offer = state.offers.find(o => o.id === offerId);

  if (!offer) {
    document.getElementById('ofr-title').textContent = 'Offer not found';
    document.getElementById('ofr-sub').textContent   = `Offer #${offerId} could not be found. It may have already been processed.`;
    document.getElementById('ofr-details').innerHTML = '';
    document.getElementById('ofr-actions').style.display = 'none';
    return;
  }

  // Already responded — lock it, no changes allowed
  if (['Accepted','Declined','Confirmed'].includes(offer.stage)) {
    showOfrResult('already', offer);
    return;
  }

  _ofrAction = action;
  _ofrOffer  = offer;
  _ofrShip   = ship;

  const crew      = state.crew.find(c => c.id == offer.crewId);
  // For ESS per-ship accept, show the chosen ship; otherwise fall back to offer.ship
  const resolvedShip = ship || offer.ship;
  const shipName  = SHIP_NAMES[resolvedShip] || resolvedShip || '—';
  const typeLabel = offer.type === 'Extension' ? 'Contract Extension' : offer.type === 'Leave' ? 'Leave Request' : 'New Assignment Offer';

  document.getElementById('ofr-title').textContent = typeLabel;
  document.getElementById('ofr-sub').textContent   = `For ${crew?.name || 'Crew Member'} · Celebrity ${shipName}`;

  document.getElementById('ofr-details').innerHTML = [
    ['Ship',      `Celebrity ${shipName}`],
    ['Position',  crew?.abbr || crew?.posTitle || '—'],
    ['Start date',offer.startDate || offer.dateFrom || '—'],
    ['End date',  offer.endDate   || offer.dateTo   || '—'],
    ['Type',      offer.type || '—'],
    ['Status',    offer.stage],
  ].map(([label, value]) => `
    <div>
      <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text2);margin-bottom:2px;">${label}</div>
      <div style="font-size:13px;color:#fff;">${value}</div>
    </div>`).join('');

  document.getElementById('ofr-prompt').textContent = action === 'accept' && ship
    ? `You are accepting assignment to Celebrity ${shipName}. Please confirm below.`
    : `Please confirm your response below. This will update your offer status immediately.`;

  // Pre-highlight the relevant button
  if (action === 'accept') {
    document.getElementById('ofr-accept-btn').style.boxShadow  = '0 0 0 3px rgba(255,127,69,.4)';
  } else {
    document.getElementById('ofr-decline-btn').style.boxShadow = '0 0 0 3px rgba(255,107,122,.4)';
  }
}

async function confirmOfferResponse(action) {
  const offer = _ofrOffer;
  if (!offer) return;

  const acceptBtn  = document.getElementById('ofr-accept-btn');
  const declineBtn = document.getElementById('ofr-decline-btn');
  if (acceptBtn)  acceptBtn.disabled  = true;
  if (declineBtn) declineBtn.disabled = true;

  offer.stage = action === 'accept' ? 'Accepted' : 'Declined';
  // If crew chose a specific ship (ESS multi-ship), record it on the offer
  if (action === 'accept' && _ofrShip) {
    offer.ship = _ofrShip;
  }
  offer.history = offer.history || [];
  offer.history.push({
    date: new Date().toISOString().slice(0, 10),
    note: action === 'accept'
      ? `Crew member accepted offer via email link${_ofrShip ? ' — chose Celebrity ' + (SHIP_NAMES[_ofrShip] || _ofrShip) : ''}`
      : 'Crew member declined offer via email link',
  });

  await upsertOffer(offer);
  showOfrResult(action, offer);
}

function showOfrResult(type, offer) {
  document.getElementById('ofr-actions').style.display = 'none';
  const result = document.getElementById('ofr-result');
  result.style.display = 'block';

  const crew     = state.crew.find(c => c.id == offer?.crewId);
  const shipName = SHIP_NAMES[offer?.ship] || offer?.ship || '—';
  const name     = crew?.name?.split(' ')[0] || 'Crew Member';

  if (type === 'accept') {
    document.getElementById('ofr-result-icon').textContent  = '✅';
    document.getElementById('ofr-result-title').textContent = `Thank you, ${name}!`;
    document.getElementById('ofr-result-sub').textContent   = `Your acceptance of the Celebrity ${shipName} offer has been recorded. Your scheduling team will be in touch shortly with next steps.`;
  } else if (type === 'decline') {
    document.getElementById('ofr-result-icon').textContent  = '👍';
    document.getElementById('ofr-result-title').textContent = `Response recorded`;
    document.getElementById('ofr-result-sub').textContent   = `Your decline has been noted. Your scheduling team will follow up with alternative options.`;
  } else if (type === 'already') {
    const wasAccepted = ['Accepted','Confirmed'].includes(offer?.stage);
    const shipName    = SHIP_NAMES[offer?.ship] || offer?.ship || '—';
    document.getElementById('ofr-result-icon').textContent  = wasAccepted ? '🔒' : 'ℹ️';
    document.getElementById('ofr-result-title').textContent = wasAccepted ? `Ship selection locked` : `Already responded`;
    document.getElementById('ofr-result-sub').textContent   = wasAccepted
      ? `You have already accepted the Celebrity ${shipName} assignment. Your selection is final and cannot be changed. Your scheduling team will be in touch shortly.`
      : `This offer has already been ${offer?.stage?.toLowerCase()}. No further action is needed.`;
  }
}

window.confirmOfferResponse = confirmOfferResponse;
