// ── settings.js — app-wide user settings ─────────────────────────────────────
import { state } from './state.js';

const STORAGE_KEY = 'tec_settings_v1';

const DEFAULTS = {
  // User / Account
  schedulerName:    '',
  schedulerEmail:   '',
  companyName:      'Celebrity Cruises',
  department:       'Technical Entertainment Crew Scheduling',

  // Smart Suggest
  ssMinGapDays:   42,  // minimum days between sign-off and next boarding
  contractMonths:  6,  // default contract length in months

  // Alert windows
  signoffAlertDays:   30,  // days-before sign-off to flag in dashboard
  contractEndingDays: 60,  // days-before contract end shown in overview
  certAlertDays:      90,  // days-before cert expiry shown in overview
  offerOverdueDays:    5,  // days after sending before offer flagged overdue

  // Offer email defaults
  offerFromEmail: '',  // pre-filled "from" in compose overlay
  offerReplyTo:   '',  // reply-to address in compose overlay

  // Display
  dateFormat: 'YYYY-MM-DD',

  // Scheduling rules
  schedulingRules: [],  // [{ id, posA, direction ('before'|'after'|'either'), days, posB }]
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

// ── Page render ──────────────────────────────────────────────────────────────
function populateForm() {
  const s = _settings;
  document.getElementById('settings-scheduler-name').value    = s.schedulerName        || '';
  document.getElementById('settings-scheduler-email').value   = s.schedulerEmail       || '';
  document.getElementById('settings-company-name').value      = s.companyName          || '';
  document.getElementById('settings-department').value        = s.department           || '';
  document.getElementById('settings-ss-gap').value            = s.ssMinGapDays         ?? 42;
  document.getElementById('settings-contract-months').value   = s.contractMonths       ?? 6;
  document.getElementById('settings-signoff-alert').value     = s.signoffAlertDays     ?? 30;
  document.getElementById('settings-contract-ending').value   = s.contractEndingDays   ?? 60;
  document.getElementById('settings-cert-alert').value        = s.certAlertDays        ?? 90;
  document.getElementById('settings-offer-overdue').value     = s.offerOverdueDays     ?? 5;
  document.getElementById('settings-offer-from-email').value  = s.offerFromEmail       || '';
  document.getElementById('settings-offer-reply-to').value    = s.offerReplyTo         || '';
  document.getElementById('settings-date-format').value       = s.dateFormat           || 'YYYY-MM-DD';
  updateGapLabel(s.ssMinGapDays ?? 42);
}

export function renderSettings() { populateForm(); populateRuleSelects(); renderRules(); }

// ── Scheduling Rules ─────────────────────────────────────────────────────────

function posOptions(selectedAbbr) {
  return state.positions.map(p =>
    `<option value="${p.abbr}" ${p.abbr === selectedAbbr ? 'selected' : ''}>${p.abbr} — ${p.title}</option>`
  ).join('');
}

export function renderRules() {
  const list = document.getElementById('settings-rules-list');
  if (!list) return;
  const rules = _settings.schedulingRules || [];
  if (!rules.length) {
    list.innerHTML = '<p style="font-size:12px;color:var(--text2);margin:0;">No rules defined.</p>';
    return;
  }
  list.innerHTML = rules.map(r => {
    const dirLabel = r.direction === 'before' ? 'before' : r.direction === 'after' ? 'after' : 'before or after';
    return `<div class="rule-row">
      <span class="rule-dot">●</span>
      <span class="rule-text"><strong>${r.posA}</strong> cannot sign off within <strong>${r.days}</strong> day${r.days !== 1 ? 's' : ''} ${dirLabel} <strong>${r.posB}</strong> signing off</span>
      <button class="btn btn-sm btn-danger" onclick="deleteSchedulingRule(${r.id})" style="margin-left:auto;flex-shrink:0;">✕ Remove</button>
    </div>`;
  }).join('');
}

export function addSchedulingRule() {
  const posA      = document.getElementById('rule-pos-a').value;
  const days      = parseInt(document.getElementById('rule-days').value);
  const direction = document.getElementById('rule-direction').value;
  const posB      = document.getElementById('rule-pos-b').value;
  if (!posA || !posB || !days || posA === posB) {
    if (typeof window._showToast === 'function') window._showToast('Fill in all fields — positions must differ');
    return;
  }
  if (!_settings.schedulingRules) _settings.schedulingRules = [];
  const id = Date.now();
  _settings.schedulingRules.push({ id, posA, direction, days, posB });
  saveSettings();
  renderRules();
  document.getElementById('rule-days').value = 14;
}

export function deleteSchedulingRule(id) {
  if (!_settings.schedulingRules) return;
  _settings.schedulingRules = _settings.schedulingRules.filter(r => r.id !== id);
  saveSettings();
  renderRules();
}

export function populateRuleSelects() {
  ['rule-pos-a', 'rule-pos-b'].forEach(elId => {
    const el = document.getElementById(elId);
    if (!el) return;
    el.innerHTML = posOptions('');
  });
}

function updateGapLabel(val) {
  const weeks = Math.round(val / 7);
  const el = document.getElementById('settings-ss-gap-label');
  if (el) el.textContent = `${val} days (${weeks} week${weeks !== 1 ? 's' : ''})`;
}

export function saveSettingsForm() {
  _settings.schedulerName        = document.getElementById('settings-scheduler-name').value.trim();
  _settings.schedulerEmail       = document.getElementById('settings-scheduler-email').value.trim();
  _settings.companyName          = document.getElementById('settings-company-name').value.trim();
  _settings.department           = document.getElementById('settings-department').value.trim();
  _settings.ssMinGapDays         = parseInt(document.getElementById('settings-ss-gap').value)             || 42;
  _settings.contractMonths       = parseInt(document.getElementById('settings-contract-months').value)    || 6;
  _settings.signoffAlertDays     = parseInt(document.getElementById('settings-signoff-alert').value)      || 30;
  _settings.contractEndingDays   = parseInt(document.getElementById('settings-contract-ending').value)    || 60;
  _settings.certAlertDays        = parseInt(document.getElementById('settings-cert-alert').value)         || 90;
  _settings.offerOverdueDays     = parseInt(document.getElementById('settings-offer-overdue').value)      || 5;
  _settings.offerFromEmail       = document.getElementById('settings-offer-from-email').value.trim();
  _settings.offerReplyTo         = document.getElementById('settings-offer-reply-to').value.trim();
  _settings.dateFormat           = document.getElementById('settings-date-format').value;

  saveSettings();
  if (typeof window._showToast === 'function') window._showToast('Settings saved');
}

export function resetSettings() {
  if (!confirm('Reset all settings to defaults?')) return;
  _settings = { ...DEFAULTS };
  saveSettings();
  populateForm();
  if (typeof window._showToast === 'function') window._showToast('Settings reset to defaults');
}

window.saveSettingsForm        = saveSettingsForm;
window.resetSettings           = resetSettings;
window.updateGapLabel          = updateGapLabel;
window.addSchedulingRule       = addSchedulingRule;
window.deleteSchedulingRule    = deleteSchedulingRule;
window.populateRuleSelects     = populateRuleSelects;
