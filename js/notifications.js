// ── notifications.js — actionable notification inbox ─────────────────────────
import { state } from './state.js';
import { getSetting } from './settings.js';
import { esc } from './utils.js';

const URGENCY_ORDER = { critical: 0, warning: 1, info: 2 };

function daysFrom(dateStr) {
  if (!dateStr) return 9999;
  return Math.round((new Date(dateStr) - new Date()) / 864e5);
}

function daysAgo(dateStr) {
  if (!dateStr) return 0;
  return Math.round((new Date() - new Date(dateStr)) / 864e5);
}

function buildNotifications() {
  const items = [];
  const alertDays = getSetting('signoffAlertDays') || 30;

  // ── Offers awaiting response (Sent stage) ─────────────────────────────────
  state.offers.forEach(o => {
    if (o.stage !== 'Sent') return;
    const ago = o.sentDate ? daysAgo(o.sentDate) : 0;
    items.push({
      key: `offer-sent-${o.id}`,
      urgency: ago >= 7 ? 'critical' : 'warning',
      icon: '◎',
      title: `Offer awaiting response — ${esc(o.crewName)}`,
      desc: `${o.type} sent ${ago > 0 ? ago + ' day' + (ago !== 1 ? 's' : '') + ' ago' : 'today'}${o.ship ? ' · ' + o.ship : ''}`,
      actionLabel: 'View offer',
      action: `notifGo('contracts')`
    });
  });

  // ── Declined offers needing follow-up ────────────────────────────────────
  state.offers.forEach(o => {
    if (o.stage !== 'Declined') return;
    items.push({
      key: `offer-declined-${o.id}`,
      urgency: 'critical',
      icon: '✕',
      title: `Offer declined — ${esc(o.crewName)}`,
      desc: `${o.type}${o.ship ? ' · ' + o.ship : ''}${o.dateFrom ? ' · from ' + o.dateFrom : ''}`,
      actionLabel: 'Create new offer',
      action: `notifGo('contracts')`
    });
  });

  // ── Crew signing off within alert window with no accepted/confirmed offer ─
  state.crew.forEach(c => {
    if (!c.end || c.status !== 'Onboard') return;
    const d = daysFrom(c.end);
    if (d < 0 || d > alertDays) return;
    const hasOffer = state.offers.some(o =>
      o.crewId === c.id && ['Accepted', 'Confirmed'].includes(o.stage)
    );
    if (hasOffer) return;
    const pos  = state.positions.find(p => p.id == c.posId);
    const ship = state.ships.find(s => s.id == c.shipId);
    items.push({
      key: `signoff-${c.id}`,
      urgency: d <= 7 ? 'critical' : d <= 14 ? 'warning' : 'info',
      icon: '↩',
      title: `Signing off in ${d} day${d !== 1 ? 's' : ''} — ${esc(c.name)}`,
      desc: `${pos?.abbr || '—'} · ${ship?.name || '—'} · No confirmed replacement`,
      actionLabel: 'Find replacement',
      action: `notifGo('placement')`
    });
  });

  // ── Expiring certifications / documents ──────────────────────────────────
  state.crew.forEach(c => {
    [['medical', 'Medical cert'], ['passport', 'Passport']].forEach(([field, label]) => {
      if (!c[field]) return;
      const d = daysFrom(c[field]);
      if (d < 0 || d > 30) return;
      items.push({
        key: `cert-${c.id}-${field}`,
        urgency: d <= 7 ? 'critical' : 'warning',
        icon: '⚠',
        title: `${label} expiring — ${esc(c.name)}`,
        desc: `Expires ${c[field]} · ${d === 0 ? 'today' : d + ' day' + (d !== 1 ? 's' : '')}`,
        actionLabel: 'View profile',
        action: `openProfile(${c.id})`
      });
    });
  });

  // ── Onboard crew without a position assignment ────────────────────────────
  state.crew.filter(c => c.status === 'Onboard' && !c.posId).forEach(c => {
    const ship = state.ships.find(s => s.id == c.shipId);
    items.push({
      key: `unassigned-${c.id}`,
      urgency: 'warning',
      icon: '◉',
      title: `No position assigned — ${esc(c.name)}`,
      desc: `Onboard${ship ? ' · ' + ship.name : ''} without a position`,
      actionLabel: 'Assign',
      action: `openProfile(${c.id})`
    });
  });

  return items.sort((a, b) => URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency]);
}

export function renderNotifications() {
  const items    = buildNotifications();
  const critical = items.filter(i => i.urgency === 'critical').length;
  const warning  = items.filter(i => i.urgency === 'warning').length;

  document.getElementById('notif-summary').innerHTML = `
    <div class="rsum rsum-30" style="cursor:default;">
      <div class="rsum-label">Critical</div>
      <div class="rsum-value">${critical}</div>
      <div class="rsum-detail">Needs action now</div>
    </div>
    <div class="rsum rsum-60" style="cursor:default;">
      <div class="rsum-label">Warnings</div>
      <div class="rsum-value">${warning}</div>
      <div class="rsum-detail">Action recommended</div>
    </div>
    <div class="rsum rsum-cert" style="cursor:default;">
      <div class="rsum-label">Total open</div>
      <div class="rsum-value">${items.length}</div>
      <div class="rsum-detail">All items</div>
    </div>`;

  const list = document.getElementById('notif-list');
  if (!items.length) {
    list.innerHTML = `<div class="notif-empty">✓ Nothing needs your attention right now</div>`;
    return;
  }

  list.innerHTML = items.map(item => `
    <div class="notif-item notif-${item.urgency}">
      <div class="notif-icon">${item.icon}</div>
      <div class="notif-body">
        <div class="notif-title">${item.title}</div>
        <div class="notif-desc">${item.desc}</div>
      </div>
      <button class="btn btn-sm notif-action" onclick="${item.action}">${item.actionLabel} →</button>
    </div>`).join('');
}

// Navigate to a page from within a notification action button
window.notifGo = function(page) {
  const btn = [...document.querySelectorAll('.nav-item')]
    .find(b => (b.getAttribute('onclick') || '').includes(`'${page}'`));
  if (btn) window.showPage(page, btn);
};
