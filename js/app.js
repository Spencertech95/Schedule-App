// ── app.js — application entry point ─────────────────────────────────────────
// Imports all modules (which registers their window.* handlers), then boots.

import { loadAll } from './db.js';
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

  // Initialise ship nav buttons
  window.initShipNav?.();

  // Render positions and compliance lists (used in sidebar/forms)
  window.renderPositions?.();
  window.renderCompliance?.();

  // Navigate to the default page (overview)
  const defaultNav = document.querySelector('.nav-item[data-page="overview"]')
    || document.querySelector('.nav-item[onclick*="overview"]');
  window.showPage('overview', defaultNav || document.createElement('button'));
  if (defaultNav) defaultNav.classList.add('active');
}

boot();
