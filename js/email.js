// ── email.js — email compose overlay ─────────────────────────────────────────
import { state } from './state.js';
import { showToast } from './utils.js';
import { upsertCrew } from './db.js';
import { upsertOffer } from './db.js';
import { RESEND_API_KEY, RESEND_FROM } from './config.js';

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

  return `Dear ${crew?.name?.split(' ')[0] || 'Crew Member'},

We are pleased to extend the following offer to you from Celebrity Cruises Technical Entertainment.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ${typeLabel.toUpperCase()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Ship:          ${shipDisplay.name}${cls ? ' (' + cls + ' Class)' : ''}
Position:      ${crew?.posTitle || crew?.abbr || '—'}
${dateSection}
Approver:      ${o.approver || 'Celebrity Cruises Technical Entertainment'}

${o.notes ? 'Additional notes:\n' + o.notes + '\n\n' : ''}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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

function buildOfferEmailHtml(o) {
  const crew        = state.crew.find(c => c.id == o.crewId);
  const SHIP_DISPLAY = window.SHIP_DISPLAY || {};
  const SHIP_CLASS_MAP = window.SHIP_CLASS_MAP || {};
  const shipDisplay = SHIP_DISPLAY[o.ship] || {name: o.ship || '—', cls: ''};
  const cls         = SHIP_CLASS_MAP[o.ship] || '';
  const typeLabel   = o.type === 'Extension' ? 'Contract Extension'
    : o.type === 'Leave' ? `Leave Request — ${o.subtype || ''}`
    : 'New Assignment Offer';
  const firstName   = crew?.name?.split(' ')[0] || 'Crew Member';
  const BASE_URL    = 'https://spencertech95.github.io/Schedule-App/';
  const acceptLink  = `${BASE_URL}?offer=${o.id}&action=accept`;
  const declineLink = `${BASE_URL}?offer=${o.id}&action=decline`;

  const rows = [
    ['Ship',      `${shipDisplay.name}${cls ? ' (' + cls + ' Class)' : ''}`],
    ['Position',  crew?.posTitle || crew?.abbr || '—'],
    o.dateFrom ? ['Start Date', o.dateFrom] : null,
    o.dateTo   ? ['End Date',   o.dateTo]   : null,
    ['Approver',  o.approver || 'Celebrity Cruises Technical Entertainment'],
  ].filter(Boolean).map(([label, value]) => `
    <tr>
      <td style="padding:8px 12px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#888;white-space:nowrap;">${label}</td>
      <td style="padding:8px 12px;font-size:14px;color:#1a1a1a;">${value}</td>
    </tr>`).join('');

  const notesSection = o.notes ? `
    <p style="margin:0 0 24px;font-size:14px;color:#444;line-height:1.6;"><strong>Additional notes:</strong><br>${o.notes}</p>` : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">

        <!-- Header -->
        <tr><td style="background:#1a1a2e;padding:28px 32px;">
          <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#ff7f45;">Celebrity Cruises</p>
          <p style="margin:6px 0 0;font-size:20px;font-weight:700;color:#fff;">${typeLabel}</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px;">
          <p style="margin:0 0 24px;font-size:15px;color:#333;">Dear ${firstName},</p>
          <p style="margin:0 0 24px;font-size:14px;color:#555;line-height:1.6;">
            We are pleased to extend the following offer to you from Celebrity Cruises Technical Entertainment.
          </p>

          <!-- Details table -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f8f9;border-radius:8px;overflow:hidden;margin-bottom:28px;">
            <tbody>${rows}</tbody>
          </table>

          ${notesSection}

          <p style="margin:0 0 20px;font-size:14px;color:#555;">Please confirm your response using one of the buttons below:</p>

          <!-- Buttons -->
          <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            <tr>
              <td style="padding-right:12px;">
                <a href="${acceptLink}" style="display:inline-block;padding:14px 28px;background:#22c55e;color:#fff;font-size:15px;font-weight:700;text-decoration:none;border-radius:8px;letter-spacing:.02em;">✅ Accept Offer</a>
              </td>
              <td>
                <a href="${declineLink}" style="display:inline-block;padding:14px 28px;background:#ef4444;color:#fff;font-size:15px;font-weight:700;text-decoration:none;border-radius:8px;letter-spacing:.02em;">❌ Decline Offer</a>
              </td>
            </tr>
          </table>

          <p style="margin:0;font-size:12px;color:#999;line-height:1.6;">
            Clicking either button will open a confirmation page — no login required. Your response will be recorded instantly.
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f8f8f9;padding:20px 32px;border-top:1px solid #ebebeb;">
          <p style="margin:0;font-size:12px;color:#888;line-height:1.6;">
            Warm regards,<br>
            <strong>Celebrity Cruises Technical Entertainment Crew Scheduling</strong>
          </p>
          <p style="margin:8px 0 0;font-size:11px;color:#bbb;">This message contains confidential information.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendEmailViaResend() {
  const to      = document.getElementById('email-to').value.trim();
  const subject = document.getElementById('email-subject').value.trim();

  if (!to) { showToast('Please enter a recipient email address.'); return; }

  const id    = parseInt(document.getElementById('email-modal').dataset.offerId);
  const offer = state.offers.find(x => x.id === id);

  if (offer) saveCrewEmail(offer.crewId, to);

  const btn = document.querySelector('#email-modal .btn-primary');
  const orig = btn?.innerHTML;
  if (btn) { btn.disabled = true; btn.innerHTML = '<span>⏳</span> Sending…'; }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [to],
        subject,
        html: buildOfferEmailHtml(offer),
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || data.name || 'Send failed');
    }

    // Advance offer stage Draft → Sent
    if (offer && offer.stage === 'Draft') {
      offer.stage = 'Sent';
      offer.history = offer.history || [];
      offer.history.push({ date: new Date().toISOString().slice(0, 10), note: 'Offer emailed to crew member — stage advanced to Sent' });
      upsertOffer(offer);
      if (typeof window.renderContracts === 'function') window.renderContracts();
      if (typeof window.renderCoSummary === 'function') window.renderCoSummary();
    }

    closeEmailModal();
    showToast('Email sent successfully ✓');
  } catch (err) {
    showToast(`Send failed: ${err.message}`, 6000);
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = orig; }
  }
}

window.openEmailCompose    = openEmailCompose;
window.closeEmailModal     = closeEmailModal;
window.closeEmailIfOutside = closeEmailIfOutside;
window.sendEmailViaMailto  = sendEmailViaMailto;
window.sendEmailViaResend  = sendEmailViaResend;
window.copyEmailToClipboard = copyEmailToClipboard;
// also expose so contracts.js renderCoDetailModal inline `saveCrewEmail(...)` works
window.saveCrewEmail       = saveCrewEmail;
window.getCrewEmail        = getCrewEmail;
