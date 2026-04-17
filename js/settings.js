// ── settings.js — app-wide user settings ─────────────────────────────────────
const STORAGE_KEY = 'tec_settings_v1';

const DEFAULTS = {
  // User / Account
  schedulerName:    '',
  schedulerEmail:   '',
  companyName:      'Celebrity Cruises',
  department:       'Technical Entertainment Crew Scheduling',

  // Smart Suggest
  ssMinGapDays:     42,   // minimum days between sign-off and next boarding
  contractMonths:   6,    // default contract length in months

  // Contracts & Offers
  signoffAlertDays: 30,   // days-before sign-off to flag in dashboard

  // Display
  dateFormat:       'YYYY-MM-DD', // or 'DD/MM/YYYY' or 'MM/DD/YYYY'
};

// In-memory settings object — loaded once on init
let _settings = { ...DEFAULTS };

export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) _settings = { ...DEFAULTS, ...JSON.parse(raw) };
  } catch(e) {
    console.warn('Failed to load settings:', e);
  }
}

export function saveSettings() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_settings));
  } catch(e) {
    console.warn('Failed to save settings:', e);
  }
}

export function getSetting(key) {
  return _settings[key] !== undefined ? _settings[key] : DEFAULTS[key];
}

export function setSetting(key, value) {
  _settings[key] = value;
  saveSettings();
}

// ── Overlay open / close ──────────────────────────────────────────────────────
function populateForm() {
  const s = _settings;
  document.getElementById('settings-scheduler-name').value  = s.schedulerName    || '';
  document.getElementById('settings-scheduler-email').value = s.schedulerEmail   || '';
  document.getElementById('settings-company-name').value    = s.companyName      || '';
  document.getElementById('settings-department').value      = s.department       || '';
  document.getElementById('settings-ss-gap').value          = s.ssMinGapDays     ?? 42;
  document.getElementById('settings-contract-months').value = s.contractMonths   ?? 6;
  document.getElementById('settings-signoff-alert').value   = s.signoffAlertDays ?? 30;
  document.getElementById('settings-date-format').value     = s.dateFormat       || 'YYYY-MM-DD';
  updateGapLabel(s.ssMinGapDays ?? 42);
}

export function openSettings() {
  populateForm();
  document.getElementById('settings-overlay').style.display = 'flex';
}

export function closeSettings() {
  document.getElementById('settings-overlay').style.display = 'none';
}

export function closeSettingsIfOutside(e) {
  if (e.target === document.getElementById('settings-overlay')) closeSettings();
}

// Keep renderSettings as an alias for navigation.js compatibility
export function renderSettings() { openSettings(); }

function updateGapLabel(val) {
  const weeks = Math.round(val / 7);
  const el = document.getElementById('settings-ss-gap-label');
  if (el) el.textContent = `${val} days (${weeks} week${weeks !== 1 ? 's' : ''})`;
}

export function saveSettingsForm() {
  _settings.schedulerName    = document.getElementById('settings-scheduler-name').value.trim();
  _settings.schedulerEmail   = document.getElementById('settings-scheduler-email').value.trim();
  _settings.companyName      = document.getElementById('settings-company-name').value.trim();
  _settings.department       = document.getElementById('settings-department').value.trim();
  _settings.ssMinGapDays     = parseInt(document.getElementById('settings-ss-gap').value) || 42;
  _settings.contractMonths   = parseInt(document.getElementById('settings-contract-months').value) || 6;
  _settings.signoffAlertDays = parseInt(document.getElementById('settings-signoff-alert').value) || 30;
  _settings.dateFormat       = document.getElementById('settings-date-format').value;

  saveSettings();
  closeSettings();
  if (typeof window._showToast === 'function') window._showToast('Settings saved');
}

export function resetSettings() {
  if (!confirm('Reset all settings to defaults?')) return;
  _settings = { ...DEFAULTS };
  saveSettings();
  renderSettings();
  if (typeof window._showToast === 'function') window._showToast('Settings reset to defaults');
}

window.openSettings            = openSettings;
window.closeSettings           = closeSettings;
window.closeSettingsIfOutside  = closeSettingsIfOutside;
window.saveSettingsForm        = saveSettingsForm;
window.resetSettings           = resetSettings;
window.updateGapLabel          = updateGapLabel;
