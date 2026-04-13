// ── email.js — email compose overlay ─────────────────────────────────────────
import { state } from './state.js';
import { showToast } from './utils.js';
import { upsertCrew } from './db.js';
import { upsertOffer } from './db.js';
import { getEssShipOptions } from './placement.js';

export function getCrewEmail(crewId) {
  const c = state.crew.find(x => x.id == crewId);
  return c?.email || '';
}

export function saveCrewEmail(crewId, email) {
  const c = state.crew.find(x => x.id == crewId);
  if (c) {
    c.email = email.trim();
    upsertCrew(c);
  }
}

function buildOfferEmailBody(o) {
  const crew        = state.crew.find(c => c.id == o.crewId);
  const SHIP_DISPLAY = window.SHIP_DISPLAY || {};
  const SHIP_CLASS_MAP = window.SHIP_CLASS_MAP || {};
  const shipDisplay = SHIP_DISPLAY[o.ship] || {name: o.ship || '—', cls: ''};
  const cls         = SHIP_CLASS_MAP[o.ship] || '';
  const typeLabel   = o.type === 'Extension' ? 'Contract Extension'
    : o.type === 'Leave' ? `Leave Request — ${o.subtype || ''}`
    : 'New Assignment Offer';
  const dateSection = o.dateFrom
    ? `Start date:    ${o.dateFrom}${o.dateTo ? '\nEnd date:      ' + o.dateTo : ''}`
    : '';
  const BASE_URL    = 'https://spencertech95.github.io/Schedule-App/';
  const acceptLink  = `${BASE_URL}?offer=${o.id}&action=accept`;
  const declineLink = `${BASE_URL}?offer=${o.id}&action=decline`;

  // ESS: append 3 ship options
  let essSection = '';
  if (crew?.abbr === 'ESS' && crew?.end) {
    const opts = getEssShipOptions(crew);
    if (opts.length) {
      const medals = ['🥇','🥈','🥉'];
      const ranks  = ['1st Choice','2nd Choice','3rd Choice'];
      const lines  = opts.map((opt, i) => {
        const gap     = opt.timingGap < 999 ? ` · ${opt.timingGap}d timing gap` : '';
        const sameShip = crew.recentShipCode === opt.sc ? ' · Familiar ship' : '';
        const sameCls  = !sameShip && opt.cls && opt.cls === (window.SC2CLS?.[crew.recentShipCode] || '') ? ' · Same class' : '';
        const avail    = opt.bestVac ? `Available ~${opt.bestVac.end}` : 'Vacancy available';
        return `  ${medals[i]}  ${ranks[i]}: Celebrity ${opt.name} (${opt.sc})\n     ${avail}${gap}${sameShip}${sameCls}`;
      }).join('\n\n');
      essSection = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  YOUR NEXT SHIP OPTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Based on your sign-off date and current fleet needs, we have identified
the following ship options for your next assignment:

${lines}

Please indicate your preferred ship when responding to this offer.

`;
    }
  }

  return `Dear ${crew?.name?.split(' ')[0] || 'Crew Member'},

We are pleased to extend the following offer to you from Celebrity Cruises Technical Entertainment.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ${typeLabel.toUpperCase()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Ship:          ${shipDisplay.name}${cls ? ' (' + cls + ' Class)' : ''}
Position:      ${crew?.posTitle || crew?.abbr || '—'}
${dateSection}
Approver:      ${o.approver || 'Celebrity Cruises Technical Entertainment'}

${o.notes ? 'Additional notes:\n' + o.notes + '\n\n' : ''}${essSection}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  RESPOND TO THIS OFFER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

To respond, click the link that matches your decision:

  ✅  ACCEPT — click here to accept this offer:
  → ${acceptLink}

  ❌  DECLINE — click here to decline this offer:
  → ${declineLink}

Clicking either link will open a confirmation page — no login required.
Your response will be recorded instantly.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

We value your continued contribution to the Celebrity Cruises fleet and look forward to your response.

Warm regards,

Celebrity Cruises
Technical Entertainment Crew Scheduling
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This message contains confidential information.`;
}

export function openEmailCompose(offerId) {
  const o = state.offers.find(x => x.id === offerId);
  if (!o) { showToast('Offer not found'); return; }
  const crew        = state.crew.find(c => c.id == o.crewId);
  const SHIP_DISPLAY = window.SHIP_DISPLAY || {};
  const shipDisplay = SHIP_DISPLAY[o.ship] || {name: o.ship || '—'};
  const typeLabel   = o.type === 'Extension' ? 'Contract Extension' : o.type === 'Leave' ? 'Leave Request' : 'New Assignment Offer';
  const subject     = `${typeLabel} — ${crew?.name || '—'} — Celebrity ${shipDisplay.name}`;

  document.getElementById('email-overlay').classList.remove('hidden');
  document.getElementById('email-modal-sub').textContent = `${typeLabel} for ${crew?.name || '—'}`;
  document.getElementById('email-to').value      = getCrewEmail(o.crewId);
  document.getElementById('email-from').value    = '';
  document.getElementById('email-subject').value = subject;
  document.getElementById('email-body').value    = buildOfferEmailBody(o);
  document.getElementById('email-copy-confirm').style.display = 'none';
  document.getElementById('email-modal').dataset.offerId = offerId;

  const toInput = document.getElementById('email-to');
  toInput.onblur = () => {
    const id    = parseInt(document.getElementById('email-modal').dataset.offerId);
    const offer = state.offers.find(x => x.id === id);
    if (offer) saveCrewEmail(offer.crewId, toInput.value);
  };
}

export function closeEmailModal() {
  document.getElementById('email-overlay').classList.add('hidden');
}

export function closeEmailIfOutside(e) {
  if (e.target === document.getElementById('email-overlay')) closeEmailModal();
}

export function sendEmailViaMailto() {
  const to      = encodeURIComponent(document.getElementById('email-to').value.trim());
  const subject = encodeURIComponent(document.getElementById('email-subject').value.trim());
  const body    = encodeURIComponent(document.getElementById('email-body').value.trim());
  if (!to) { showToast('Please enter a recipient email address.'); return; }

  const id    = parseInt(document.getElementById('email-modal').dataset.offerId);
  const offer = state.offers.find(x => x.id === id);
  if (offer) saveCrewEmail(offer.crewId, decodeURIComponent(to));

  if (offer && offer.stage === 'Draft') {
    offer.stage = 'Sent';
    offer.history = offer.history || [];
    offer.history.push({date: new Date().toISOString().slice(0, 10), note: 'Offer emailed to crew member — stage advanced to Sent'});
    upsertOffer(offer);
    // re-render contracts if page is active
    if (typeof window.renderContracts === 'function') window.renderContracts();
    if (typeof window.renderCoSummary === 'function') window.renderCoSummary();
  }

  window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
  showToast('Opening email client…');
}

export function copyEmailToClipboard() {
  const subject = document.getElementById('email-subject').value;
  const body    = document.getElementById('email-body').value;
  const full    = `Subject: ${subject}\n\n${body}`;
  navigator.clipboard.writeText(full).then(() => {
    const conf = document.getElementById('email-copy-confirm');
    conf.style.display = 'inline';
    setTimeout(() => conf.style.display = 'none', 2500);
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = full; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
    showToast('Copied to clipboard');
  });
}

window.openEmailCompose    = openEmailCompose;
window.closeEmailModal     = closeEmailModal;
window.closeEmailIfOutside = closeEmailIfOutside;
window.sendEmailViaMailto  = sendEmailViaMailto;
window.copyEmailToClipboard = copyEmailToClipboard;
// also expose so contracts.js renderCoDetailModal inline `saveCrewEmail(...)` works
window.saveCrewEmail       = saveCrewEmail;
window.getCrewEmail        = getCrewEmail;
