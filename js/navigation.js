// ── navigation.js — SPA page router ─────────────────────────────────────────
import { renderOverview } from './overview.js';
import { renderFleet } from './fleet.js';
import { initRotations } from './rotations.js';
import { renderCrew, populateCrewForm, populateFilters } from './crew.js';
import { initContracts } from './contracts.js';
import { initReports } from './reports.js';
import { initPlacement } from './placement.js';
import { initDashboard } from './dashboard.js';
import { initDeployment } from './deployment.js';
import { initDocWallet } from './docwallet.js';
import { renderPositions } from './positions.js';
import { renderCompliance } from './compliance.js';
import { renderSettings } from './settings.js';
import { renderNotifications } from './notifications.js';

export function showPage(name, el) {
  document.querySelectorAll('.topbar-nav-item, .topbar-action-btn, .nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const pageEl = document.getElementById('page-' + name);
  if (!pageEl) return;
  pageEl.classList.add('active');
  el.classList.add('active');
  history.replaceState(null, '', '#' + name);
  if (name === 'overview')   renderOverview();
  if (name === 'fleet')      renderFleet();
  if (name === 'rotations')  initRotations();
  if (name === 'crew')       { populateCrewForm(); populateFilters(); renderCrew(); }
  if (name === 'contracts')  initContracts();
  if (name === 'reports')    initReports();
  if (name === 'placement')  initPlacement();
  if (name === 'dashboard')  initDashboard();
  if (name === 'deployment') initDeployment();
  if (name === 'docwallet')  initDocWallet();
  if (name === 'positions')  renderPositions();
  if (name === 'compliance') renderCompliance();
  if (name === 'settings')       renderSettings();
  if (name === 'notifications')  renderNotifications();
  if (name === 'ship') { /* rendered via showShip */ }
}

window.showPage = showPage;
