// ── contracts.js — contracts & offers page ───────────────────────────────────
import { state } from './state.js';
import { uid } from './state.js';
import { showToast } from './utils.js';
import { upsertOffer, dbDeleteOffer, upsertCrew } from './db.js';
import { saveCrewEmail, getCrewEmail } from './crew.js';
import { openEmailCompose } from './email.js';
import { getSetting } from './settings.js';

export const CO_STAGES    = ['Draft','Sent','Acknowledged','Accepted','Declined','Confirmed'];
export const CO_STAGE_IDX = {Draft:0,Sent:1,Acknowledged:2,Accepted:3,Declined:4,Confirmed:5};
export const CO_TYPE_COLORS = {Extension:'co-type-ext',Offer:'co-type-offer',Leave:'co-type-leave'};
export const CO_TYPE_ICONS  = {Extension:'⟳',Offer:'✦',Leave:'◎'};
export const LEAVE_SUBTYPES = ['Compassionate leave','Medical leave','Unpaid leave','Parental leave','Emergency leave'];

let coCatFilter = '', coView = 'table', coSortKey = 'created', coSortDir = 'desc';
let coEditId    = null;
let _coMainTab  = 'pipeline';
let _ssWindow   = 30;
let _ssSelections = new Set();

// Helper: get SHIP_* constants (defined on window by ship.js)
const SHIP_CLASS_MAP = () => window.SHIP_CLASS_MAP || {};
const CLASS_BADGE    = () => window.CLASS_BADGE    || {};
const SHIP_NAME_MAP  = () => window.SHIP_NAME_MAP  || {};
const SHIP_DISPLAY   = () => window.SHIP_DISPLAY   || {};
const SHIP_CODES_ORDERED = () => window.SHIP_CODES_ORDERED || [];
const POS_ORDER      = () => window.POS_ORDER      || [];
const POS_COLORS     = () => window.POS_COLORS     || {};

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

export function switchCoMainTab(tab, btn) {
  _coMainTab = tab;
  document.getElementById('co-tab-pipeline').style.display = tab === 'pipeline' ? 'block' : 'none';
  document.getElementById('co-tab-suggest').style.display  = tab === 'suggest'  ? 'block' : 'none';
  document.querySelectorAll('.co-tab').forEach(b => b.classList.remove('active'));
  const activeBtn = btn || document.getElementById('cotab-' + tab);
  if (activeBtn) activeBtn.classList.add('active');
  if (tab === 'suggest') renderSmartSuggest();
}

export function setSSWindow(days, btn) {
  _ssWindow = days;
  document.querySelectorAll('.ss-win-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderSmartSuggest();
}

function initSSFilters() {
  const posEl = document.getElementById('ss-pos-filter');
  if (!posEl || posEl.options.length > 1) return;
  POS_ORDER().forEach(a => {
    const p = state.positions.find(x => x.abbr === a);
    const o = document.createElement('option');
    o.value = a; o.textContent = a + (p ? ' \u2014 ' + p.title : '');
    posEl.appendChild(o);
  });
}

function renderSmartSuggest() {
  const SCM = SHIP_CLASS_MAP();
  const CB  = CLASS_BADGE();
  const SNM = SHIP_NAME_MAP();
  const SD  = SHIP_DISPLAY();
  const SCO = SHIP_CODES_ORDERED();
  const PC  = POS_COLORS();
  initSSFilters();
  const now        = new Date();
  const windowDays = _ssWindow;
  const vacWeeks   = Math.max(1, parseInt(document.getElementById('ss-vac-weeks')?.value) || 6);
  const vacDays    = vacWeeks * 7;
  const posF       = document.getElementById('ss-pos-filter')?.value  || '';
  const clsF       = document.getElementById('ss-class-filter')?.value || '';
  const viewMode   = document.getElementById('ss-view-mode')?.value    || 'by-crew';

  // Build one entry per crew member signing off — find destination ships for each
  const crewOffers = state.crew
    .filter(c => {
      if (!c.end) return false;
      if (posF && c.abbr !== posF) return false;
      if (clsF && (SCM[c.recentShipCode || c.shipCode] !== clsF)) return false;
      const d = (new Date(c.end) - now) / 864e5;
      return d >= 0 && d <= windowDays;
    })
    .map(crewMember => {
      const daysUntil     = Math.round((new Date(crewMember.end) - now) / 864e5);
      const shipOptions   = ssBuildShipOptions(crewMember, windowDays, vacDays, SCM, SNM, CB, SCO);
      const existingOffer = state.offers.find(o =>
        o.crewId == crewMember.id && !['Confirmed','Declined'].includes(o.stage)
      );
      return { crewMember, daysUntil, shipOptions, existingOffer };
    })
    .sort((a, b) => a.daysUntil - b.daysUntil);

  const urgent     = crewOffers.filter(o => o.daysUntil <= 14 && !o.existingOffer).length;
  const needsOffer = crewOffers.filter(o => !o.existingOffer && o.shipOptions.length > 0).length;
  const inProgress = crewOffers.filter(o => !!o.existingOffer).length;
  const noOptions  = crewOffers.filter(o => !o.existingOffer && o.shipOptions.length === 0).length;

  document.getElementById('ss-kpi').innerHTML = `
    <div class="co-stat"><div class="co-stat-label">Signing off in ${windowDays}d</div><div class="co-stat-val">${crewOffers.length}</div></div>
    <div class="co-stat" style="border-color:rgba(255,107,122,.25)"><div class="co-stat-label" style="color:var(--red-t);">⚠ Urgent (≤14d)</div><div class="co-stat-val" style="color:var(--red-t);">${urgent}</div></div>
    <div class="co-stat" style="border-color:rgba(255,107,122,.2)"><div class="co-stat-label" style="color:var(--red-t);">Needs offer</div><div class="co-stat-val" style="color:var(--red-t);">${needsOffer}</div></div>
    <div class="co-stat" style="border-color:rgba(77,168,247,.2)"><div class="co-stat-label" style="color:var(--blue-t);">Offer in progress</div><div class="co-stat-val" style="color:var(--blue-t);">${inProgress}</div></div>
    <div class="co-stat" style="border-color:rgba(164,164,167,.2)"><div class="co-stat-label" style="color:var(--text2);">No options found</div><div class="co-stat-val" style="color:var(--text2);">${noOptions}</div></div>`;

  const badge = document.getElementById('cotab-suggest-count');
  if (badge) { badge.textContent = needsOffer || ''; badge.style.display = needsOffer ? '' : 'none'; }
  ssUpdateBulkBar();

  const body = document.getElementById('ss-body');
  if (!crewOffers.length) {
    body.innerHTML = `<div class="card" style="padding:2.5rem;text-align:center;color:var(--text2);">
      <div style="font-size:28px;margin-bottom:10px;">✓</div>
      <div style="font-size:14px;font-weight:500;color:#fff;">No crew signing off in the next ${windowDays} days</div>
      <div style="font-size:12px;margin-top:6px;">All positions have crew signed on through this window.</div>
    </div>`;
    return;
  }
  viewMode === 'by-ship'
    ? renderSSByShip(crewOffers, SCM, CB, SNM, SD, SCO, PC)
    : renderSSByCrew(crewOffers, SCM, CB, SNM, PC);
}

// Minimum break between sign-off and next boarding — configurable in Settings (default 6 weeks)
const SS_MIN_GAP_DAYS = () => getSetting('ssMinGapDays');
// Positions where the scheduler picks one ship to offer (per-card buttons, not a combined email)
const SS_SINGLE_SHIP = new Set(['EOS','EOL','EOF','VPM','SPM','ETDC']);

// Build up to 3 destination ship options for a signing-off crew member.
// ESS → crew picks from all 3 via per-ship email links.
// All other positions → 3 options shown, scheduler clicks the one to offer.
// Boarding date must be ≥ crew sign-off + 6 weeks minimum.
function ssBuildShipOptions(crewMember, windowDays, vacDays, SCM, SNM, CB, SCO) {
  const crewSc    = crewMember.recentShipCode || crewMember.shipCode;
  const crewCls   = SCM[crewSc] || '';
  // Respect the UI gap slider but never go below the 6-week minimum
  const gapDays   = Math.max(SS_MIN_GAP_DAYS(), vacDays);
  const availDate = new Date(new Date(crewMember.end).getTime() + gapDays * 864e5);

  return SCO
    .map(sc => {
      // Find crew in the same position on this ship who are vacating
      const allVacancies = state.crew.filter(c =>
        (c.recentShipCode === sc || c.shipCode === sc) &&
        c.abbr === crewMember.abbr &&
        c.id !== crewMember.id &&
        c.end
      );
      if (!allVacancies.length) return null;

      const cls      = SCM[sc] || '';
      const clsBadge = CB[cls] || 'badge-gray';

      // Only consider vacancies whose opening date is on or after this crew member's
      // earliest availability (sign-off + gap). This enforces the 6-week minimum.
      const eligible = allVacancies.filter(v => {
        const vOpen = new Date(new Date(v.end).getTime() + gapDays * 864e5);
        return vOpen >= availDate;
      });
      if (!eligible.length) return null;

      // Pick the earliest eligible vacancy (soonest available boarding)
      const bestVac = eligible.reduce((best, v) => {
        const vOpen = new Date(new Date(v.end).getTime() + gapDays * 864e5);
        const bOpen = new Date(new Date(best.end).getTime() + gapDays * 864e5);
        return vOpen < bOpen ? v : best;
      }, eligible[0]);

      const vacOpenDate = new Date(new Date(bestVac.end).getTime() + gapDays * 864e5);
      // timingGap: days between crew's earliest availability and the boarding date (always ≥ 0)
      const timingGap   = Math.round((vacOpenDate - availDate) / 864e5);
      const openStr     = vacOpenDate.toISOString().slice(0, 10);

      // Score: lower is better
      let score = timingGap;
      if (sc === crewSc)        score -= 50; // returning to familiar ship
      else if (cls === crewCls) score -= 25; // same class
      if (state.crew.some(c => c.futureShip === sc && c.abbr === crewMember.abbr && c.id !== crewMember.id)) score += 20;

      const existingOffer = state.offers.find(o =>
        o.crewId == crewMember.id && o.ship === sc && !['Confirmed','Declined'].includes(o.stage)
      );

      return { sc, name: SNM[sc] || sc, cls, clsBadge, score, timingGap, openStr, bestVac, existingOffer };
    })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);
}

function renderSSByCrew(crewOffers, SCM, CB, SNM, PC) {
  const groups = [
    {label:'Next 14 days', color:'var(--red-t)',   items: crewOffers.filter(o => o.daysUntil <= 14)},
    {label:'15–30 days',   color:'var(--amber-t)', items: crewOffers.filter(o => o.daysUntil > 14 && o.daysUntil <= 30)},
    {label:'31–60 days',   color:'var(--blue-t)',  items: crewOffers.filter(o => o.daysUntil > 30 && o.daysUntil <= 60)},
    {label:'61+ days',     color:'var(--text2)',   items: crewOffers.filter(o => o.daysUntil > 60)},
  ];
  document.getElementById('ss-body').innerHTML = groups.filter(g => g.items.length).map(g => `
    <div class="ss-window-group">
      <div class="ss-window-header">
        <div class="ss-window-title" style="color:${g.color}">${g.label}</div>
        <span class="badge" style="background:${g.color}22;color:${g.color};border:.5px solid ${g.color}55;font-size:10px;">${g.items.length} crew</span>
      </div>
      ${g.items.map(o => ssRenderCrewCard(o, SCM, CB, SNM, PC)).join('')}
    </div>`).join('');
}

function ssRenderCrewCard({crewMember, daysUntil, shipOptions, existingOffer}, SCM, CB, SNM, PC) {
  const posColor     = PC[crewMember.abbr] || '#A4A4A7';
  const crewSc       = crewMember.recentShipCode || crewMember.shipCode;
  const crewCls      = SCM[crewSc] || '';
  const crewClsBadge = CB[crewCls] || 'badge-gray';
  const isSelected   = _ssSelections.has(crewMember.id);

  const urgBadge = daysUntil <= 0  ? `<span class="badge badge-red">Signed off</span>`
    : daysUntil <= 7  ? `<span class="badge badge-red">🔴 ${daysUntil}d</span>`
    : daysUntil <= 14 ? `<span class="badge badge-red">${daysUntil}d</span>`
    : daysUntil <= 30 ? `<span class="badge badge-amber">${daysUntil}d</span>`
    : `<span class="badge badge-blue">${daysUntil}d</span>`;

  const isEss        = crewMember.abbr === 'ESS';
  // Single-ship positions: always offer just 1 option, scheduler picks and sends directly
  const isSingleShip = SS_SINGLE_SHIP.has(crewMember.abbr);

  // ESS: header button sends all options at once — crew picks via per-ship accept links
  // Single-ship & other non-ESS: per-card buttons (scheduler chooses which ship to offer)
  const headerActionBtn = existingOffer
    ? `<span class="pipe-badge pipe-${existingOffer.stage.toLowerCase()}" style="font-size:10px;">${existingOffer.stage}</span>
       <button class="btn btn-sm" style="font-size:10px;margin-left:6px;" onclick="openEmailCompose(${existingOffer.id})">✉ Re-send</button>`
    : isEss && shipOptions.length
      ? `<button class="btn btn-primary btn-sm" style="font-size:11px;" onclick="ssCreateAndEmail(${crewMember.id},'${shipOptions.map(o=>`${o.sc}:${o.openStr}`).join(',')}')">✉ Send offer (${shipOptions.length} option${shipOptions.length !== 1 ? 's' : ''})</button>
         <button class="btn btn-sm" style="font-size:10px;" onclick="ssCreateDraft(${crewMember.id},'${shipOptions.map(o=>`${o.sc}:${o.openStr}`).join(',')}')">Draft</button>`
      : isEss
      ? `<span style="font-size:10px;color:var(--text2);font-style:italic;">No ESS vacancies found</span>`
      : ''; // non-ESS / single-ship: buttons live on each ship card

  const optionCards = shipOptions.length ? shipOptions.map((opt, i) => {
    const rankLabel = ['1st choice','2nd choice','3rd choice'][i];
    const rankColor = ['var(--green-t)','var(--blue-t)','var(--text2)'][i];
    const sameShip  = crewSc === opt.sc;
    const sameCls   = !sameShip && crewCls === opt.cls;
    const expTag    = sameShip ? `<span class="badge badge-green" style="font-size:9px;">Familiar ship</span>`
      : sameCls     ? `<span class="badge badge-teal"  style="font-size:9px;">Same class</span>` : '';
    const gapColor  = opt.timingGap <= 3 ? 'var(--green-t)' : opt.timingGap <= 14 ? 'var(--amber-t)' : 'var(--text2)';
    const gapLabel  = opt.timingGap <= 1 ? 'Perfect timing' : `${opt.timingGap}d gap`;

    // Non-ESS: per-card offer button — scheduler picks which ship to send
    const cardBtn = !isEss && !existingOffer
      ? `<button class="btn btn-primary btn-sm" style="width:100%;justify-content:center;font-size:10px;margin-top:8px;" onclick="ssCreateAndEmail(${crewMember.id},'${opt.sc}:${opt.openStr}')">✉ Offer this ship</button>`
      : !isEss && existingOffer
      ? `<button class="btn btn-sm" style="width:100%;justify-content:center;font-size:10px;margin-top:8px;" onclick="openEmailCompose(${existingOffer.id})">✉ Re-send</button>`
      : '';

    return `<div class="ss-ship-card rank-${i+1}">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
        <span style="font-size:9px;font-weight:700;color:${rankColor};text-transform:uppercase;letter-spacing:.06em;">${rankLabel}</span>
        <span class="badge ${opt.clsBadge}" style="font-size:9px;">${opt.sc}</span>
      </div>
      <div style="font-size:13px;font-weight:700;color:#fff;margin-bottom:5px;">Celebrity ${esc(opt.name)}</div>
      <div style="font-size:11px;color:var(--text2);margin-bottom:2px;">Vacancy opens</div>
      <div style="font-size:12px;font-weight:600;color:#fff;margin-bottom:4px;">${opt.openStr}</div>
      <div style="font-size:11px;font-weight:600;color:${gapColor};margin-bottom:6px;">${gapLabel}</div>
      ${expTag ? `<div style="margin-bottom:4px;">${expTag}</div>` : ''}
      ${cardBtn}
    </div>`;
  }).join('') : !isEss ? `<div style="font-size:12px;color:var(--text2);font-style:italic;padding:4px 0;">No vacancies found in this window for ${crewMember.abbr}.</div>` : '';

  return `<div class="ss-crew-card ${existingOffer ? 'has-offer' : ''} ${isSelected ? 'ss-selected' : ''}" id="ss-card-${crewMember.id}">
    <div class="ss-crew-header">
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">
          <input type="checkbox" style="width:15px;height:15px;cursor:pointer;accent-color:var(--highlight);" ${isSelected ? 'checked' : ''} onchange="ssToggleSelect(${crewMember.id},this)"/>
          <div style="font-size:14px;font-weight:700;">${esc(crewMember.name)}</div>
          <span class="badge" style="background:${posColor}22;color:${posColor};border:.5px solid ${posColor}55;font-size:10px;">${crewMember.abbr}</span>
          <span class="badge ${crewClsBadge}" style="font-size:9px;">${crewSc || '—'}</span>
          ${urgBadge}
        </div>
        <div style="font-size:11px;color:var(--text2);">Signs off <strong style="color:#fff;">${crewMember.end || '—'}</strong> · Currently on ${SNM[crewSc] || crewSc || '—'}</div>
      </div>
      <div style="display:flex;gap:6px;align-items:center;flex-shrink:0;margin-left:12px;">
        ${headerActionBtn}
      </div>
    </div>
    ${optionCards ? `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:2px;">${optionCards}</div>` : ''}
  </div>`;
}

function renderSSByShip(crewOffers, SCM, CB, SNM, SD, SCO, PC) {
  // Group by destination ship — each ship shows which crew members have it as an option
  const byShip = {};
  crewOffers.forEach(co => {
    co.shipOptions.forEach((opt, rank) => {
      if (!byShip[opt.sc]) byShip[opt.sc] = [];
      byShip[opt.sc].push({...co, opt, rank});
    });
  });
  const shipsWithOffers = SCO.filter(sc => byShip[sc]?.length);
  if (!shipsWithOffers.length) {
    document.getElementById('ss-body').innerHTML = `<div style="padding:2rem;text-align:center;color:var(--text2);font-size:12px;">No destination ships found.</div>`;
    return;
  }
  document.getElementById('ss-body').innerHTML = shipsWithOffers.map(sc => {
    const d        = SD[sc] || {name: sc, icon: '⛴'};
    const cls      = SCM[sc] || '';
    const clsBadge = CB[cls] || 'badge-gray';
    const entries  = byShip[sc];
    const needsOffer = entries.filter(e => !e.existingOffer).length;
    return `<div class="ss-ship-block">
      <div class="ss-ship-block-header">
        <span style="font-size:20px;">${d.icon}</span>
        <div>
          <div style="font-size:14px;font-weight:700;">Celebrity ${d.name}</div>
          <span class="badge ${clsBadge}" style="font-size:9px;">${sc}</span>
        </div>
        <div style="margin-left:auto;display:flex;gap:6px;align-items:center;">
          ${needsOffer ? `<span class="badge badge-red" style="font-size:10px;">${needsOffer} need${needsOffer===1?'s':''} offer</span>` : ''}
          <span style="font-size:11px;color:var(--text2);">${entries.length} crew option${entries.length!==1?'s':''}</span>
        </div>
      </div>
      <div>
        ${entries.map(e => {
          const posColor  = PC[e.crewMember.abbr] || '#A4A4A7';
          const rankLabel = ['1st','2nd','3rd'][e.rank] || '';
          const rankColor = ['var(--green-t)','var(--blue-t)','var(--text2)'][e.rank] || 'var(--text2)';
          const gapColor  = e.opt.timingGap <= 3 ? 'var(--green-t)' : e.opt.timingGap <= 14 ? 'var(--amber-t)' : 'var(--text2)';
          const shipCodes = e.shipOptions.map(o => o.sc).join(',');
          const btn = e.existingOffer
            ? `<button class="btn btn-sm" style="font-size:10px;" onclick="openEmailCompose(${e.existingOffer.id})">✉ Email</button>`
            : `<button class="btn btn-primary btn-sm" style="font-size:10px;" onclick="ssCreateAndEmail(${e.crewMember.id},'${shipCodes}')">✉ Offer</button>`;
          return `<div style="display:flex;align-items:center;gap:10px;padding:8px 14px;border-bottom:.5px solid rgba(255,255,255,.04);">
            <span class="badge" style="background:${posColor}22;color:${posColor};border:.5px solid ${posColor}55;font-size:9px;flex-shrink:0;">${e.crewMember.abbr}</span>
            <div style="flex:1;min-width:0;">
              <div style="font-size:12px;font-weight:600;">${esc(e.crewMember.name)}</div>
              <div style="font-size:10px;color:var(--text2);">Signs off ${e.crewMember.end} · ${SNM[e.crewMember.recentShipCode] || e.crewMember.recentShipCode || '—'}</div>
            </div>
            <span style="font-size:10px;font-weight:700;color:${rankColor};">${rankLabel} choice</span>
            <span style="font-size:10px;color:${gapColor};">${e.opt.timingGap <= 1 ? 'Perfect' : e.opt.timingGap+'d gap'}</span>
            ${btn}
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }).join('');
}

// shipCodesArg: comma-separated string of "SC" or "SC:YYYY-MM-DD" entries (up to 3 options)
// e.g. "EC:2026-05-03,SI:2026-05-08,SL:2026-05-15" or just "EC:2026-05-03"
export function ssCreateDraft(crewId, shipCodesArg) {
  const SNM  = SHIP_NAME_MAP();
  const crew = state.crew.find(c => c.id == crewId);
  if (!crew) return null;

  // Parse "SC:date" pairs
  const entries = (typeof shipCodesArg === 'string' ? shipCodesArg : '').split(',').filter(Boolean);
  const parsed  = entries.map(e => { const [sc, date] = e.split(':'); return { sc, boardingDate: date || null }; });
  const shipCodes    = parsed.map(p => p.sc);
  const primarySc    = shipCodes[0] || '';
  const primaryDate  = parsed[0]?.boardingDate || null;

  const today   = new Date().toISOString().slice(0, 10);
  const dateFrom = primaryDate || today;
  const dateTo   = (() => { const d = new Date(dateFrom); d.setMonth(d.getMonth() + 6); return d.toISOString().slice(0, 10); })();
  const shipLabel = shipCodes.map(sc => SNM[sc] || sc).join(', ') || '—';

  // Store full option details (sc + boarding date) so the email can show them per ship
  const shipOptionDetails = parsed.length > 1
    ? parsed.map(p => ({ sc: p.sc, name: SNM[p.sc] || p.sc, boardingDate: p.boardingDate }))
    : null;

  const offer = {
    id: uid(), crewId, crewName: crew.name, ship: primarySc,
    // shipOptions (codes only) drives the multi-accept-link email for ESS
    ...(parsed.length > 1 ? { shipOptions: shipCodes, shipOptionDetails } : {}),
    type: 'Offer', subtype: 'New assignment offer', stage: 'Draft',
    dateFrom, dateTo, approver: '',
    notes: `Smart suggest: ${crew.name} signs off ${crew.end || '—'}. Ship options: ${shipLabel}.`,
    created: today,
    history: [{date: today, note: 'Created by Smart Suggest engine'}]
  };
  state.offers.push(offer);
  renderCoSummary();
  updateCoPipelineTabCount();
  showToast(`Draft offer — ${crew.name} → ${shipLabel}`);
  renderSmartSuggest();
  upsertOffer(offer);
  return offer;
}

export function ssCreateAndEmail(crewId, shipCodesArg) {
  const offer = ssCreateDraft(crewId, shipCodesArg);
  if (offer) openEmailCompose(offer.id);
}

export function ssToggleSelect(crewId, checkbox) {
  if (checkbox.checked) _ssSelections.add(crewId);
  else _ssSelections.delete(crewId);
  const card = document.getElementById(`ss-card-${crewId}`);
  if (card) card.classList.toggle('ss-selected', checkbox.checked);
  ssUpdateBulkBar();
}

export function ssClearSelections() { _ssSelections.clear(); renderSmartSuggest(); }

function ssUpdateBulkBar() {
  const bar = document.getElementById('ss-bulk-bar');
  const lbl = document.getElementById('ss-bulk-label');
  if (!bar) return;
  bar.style.display = _ssSelections.size > 0 ? 'flex' : 'none';
  if (lbl) lbl.textContent = `${_ssSelections.size} crew member${_ssSelections.size !== 1 ? 's' : ''} selected`;
}

export function ssBulkCreateOffers() {
  const vacDays    = (parseInt(document.getElementById('ss-vac-weeks')?.value) || 6) * 7;
  const SCM = SHIP_CLASS_MAP(); const SNM = SHIP_NAME_MAP(); const CB = CLASS_BADGE(); const SCO = SHIP_CODES_ORDERED();
  let created = 0;
  _ssSelections.forEach(crewId => {
    const c = state.crew.find(x => x.id == crewId);
    if (!c || !c.end) return;
    if (state.offers.find(o => o.crewId == crewId && !['Confirmed','Declined'].includes(o.stage))) return;
    const opts = ssBuildShipOptions(c, _ssWindow, vacDays, SCM, SNM, CB, SCO);
    if (!opts.length) return;
    ssCreateDraft(crewId, opts.map(o => `${o.sc}:${o.openStr}`).join(','));
    created++;
  });
  showToast(`${created} draft offer${created !== 1 ? 's' : ''} created`);
  _ssSelections.clear();
  renderSmartSuggest();
}

export function updateCoPipelineTabCount() {
  const active = state.offers.filter(o => !['Confirmed','Declined'].includes(o.stage)).length;
  const el = document.getElementById('cotab-pipeline-count');
  if (el) { el.textContent = active || ''; el.style.display = active ? '' : 'none'; }
}

function coMigrateOffers() {
  state.offers = state.offers.map(o => {
    if (!o.stage) o.stage = o.status || 'Draft';
    if (!o.type || !['Extension','Offer','Leave'].includes(o.type)) {
      if ((o.type||'').toLowerCase().includes('extension')) o.type = 'Extension';
      else if ((o.type||'').toLowerCase().includes('leave') || o.type?.toLowerCase().includes('time off')) o.type = 'Leave';
      else o.type = 'Offer';
    }
    if (!o.subtype) o.subtype = '';
    if (!o.created) o.created = new Date().toISOString().slice(0, 10);
    if (!o.crewName) { const c = state.crew.find(x => x.id == o.crewId); o.crewName = c ? c.name : ''; }
    if (!o.ship) { const c = state.crew.find(x => x.id == o.crewId); o.ship = c ? c.recentShipCode : ''; }
    if (!o.history) o.history = [];
    return o;
  });
}

export function initContracts() {
  coMigrateOffers();
  const ships = [...new Set(state.crew.map(c => c.recentShipCode).filter(Boolean))].sort();
  const SNM   = SHIP_NAME_MAP();
  document.getElementById('co-filter-ship').innerHTML = '<option value="">All ships</option>' + ships.map(s => `<option value="${s}">${s} — ${SNM[s] || s}</option>`).join('');
  renderCoSummary();
  renderContracts();
  updateCoPipelineTabCount();
  switchCoMainTab(_coMainTab || 'pipeline');
}

function renderCoSummary() {
  const total    = state.offers.length;
  const byStage  = s => state.offers.filter(o => o.stage === s).length;
  const pending  = state.offers.filter(o => !['Confirmed','Declined'].includes(o.stage)).length;
  document.getElementById('co-summary').innerHTML = `
    <div class="co-stat" onclick="setCoStageFilter('',this)">
      <div class="co-stat-label">Total offers</div>
      <div class="co-stat-val">${total}</div>
    </div>
    <div class="co-stat" onclick="setCoStageFilter('Draft',this)">
      <div class="co-stat-label" style="color:var(--gray-t);">Draft</div>
      <div class="co-stat-val" style="color:var(--gray-t);">${byStage('Draft')}</div>
    </div>
    <div class="co-stat" onclick="setCoStageFilter('Sent',this)" style="border-color:rgba(77,168,247,.25);">
      <div class="co-stat-label" style="color:var(--blue-t);">In progress</div>
      <div class="co-stat-val" style="color:var(--blue-t);">${pending}</div>
    </div>
    <div class="co-stat" onclick="setCoStageFilter('Confirmed',this)" style="border-color:rgba(61,232,160,.2);">
      <div class="co-stat-label" style="color:var(--green-t);">Confirmed</div>
      <div class="co-stat-val" style="color:var(--green-t);">${byStage('Confirmed')}</div>
    </div>
    <div class="co-stat" onclick="setCoStageFilter('Declined',this)" style="border-color:rgba(255,107,122,.2);">
      <div class="co-stat-label" style="color:var(--red-t);">Declined</div>
      <div class="co-stat-val" style="color:var(--red-t);">${byStage('Declined')}</div>
    </div>`;
}

export function setCoStageFilter(stage, el) {
  document.getElementById('co-filter-stage').value = stage;
  renderContracts();
}

export function setCoCat(cat, btn) {
  coCatFilter = cat;
  document.querySelectorAll('[data-cocat]').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderContracts();
}

export function setCoView(v) {
  coView = v;
  document.getElementById('co-table-view').style.display = v === 'table' ? 'block' : 'none';
  document.getElementById('co-board-view').style.display = v === 'board' ? 'block' : 'none';
  document.getElementById('co-vbtn-table').classList.toggle('active', v === 'table');
  document.getElementById('co-vbtn-board').classList.toggle('active', v === 'board');
  renderContracts();
}

export function coSort(key) {
  if (coSortKey === key) coSortDir = coSortDir === 'asc' ? 'desc' : 'asc';
  else { coSortKey = key; coSortDir = 'asc'; }
  renderContracts();
}

// ── Archive helpers ───────────────────────────────────────────────────────────
const ARCHIVE_DAYS = () => getSetting('signoffAlertDays');

// Date an offer entered its terminal state; falls back to created for legacy offers
function getTerminalDate(o) {
  return o.terminalDate || o.created || null;
}

// An offer is archived when it has been uploaded to E1, or Confirmed/Declined for 30+ days
function isArchived(o) {
  if (o.e1Uploaded) return true;
  if (!['Confirmed','Declined'].includes(o.stage)) return false;
  const td = getTerminalDate(o);
  if (!td) return false;
  return (new Date() - new Date(td + 'T00:00:00')) / 864e5 >= ARCHIVE_DAYS();
}

function coBaseFilter(o, q, shipF, stageF) {
  if (coCatFilter && o.type !== coCatFilter) return false;
  if (shipF  && o.ship  !== shipF)  return false;
  if (stageF && o.stage !== stageF) return false;
  if (q && !((o.crewName||'').toLowerCase().includes(q) || (o.ship||'').toLowerCase().includes(q) || (o.approver||'').toLowerCase().includes(q))) return false;
  return true;
}

function coSorted(arr) {
  return arr.sort((a, b) => {
    const va = a[coSortKey] || '', vb = b[coSortKey] || '';
    return coSortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
  });
}

// Active offers — excludes anything that has aged into the archive
function coFilteredOffers() {
  const q     = (document.getElementById('co-search').value || '').toLowerCase();
  const shipF = document.getElementById('co-filter-ship').value;
  const stageF = document.getElementById('co-filter-stage').value;
  return coSorted(state.offers.filter(o => {
    if (isArchived(o)) return false;
    return coBaseFilter(o, q, shipF, stageF);
  }));
}

// Archived offers — Confirmed/Declined for 30+ days
function coArchivedOffers() {
  const q     = (document.getElementById('co-search').value || '').toLowerCase();
  const shipF = document.getElementById('co-filter-ship').value;
  const stageF = document.getElementById('co-filter-stage').value;
  return coSorted(state.offers.filter(o => {
    if (!isArchived(o)) return false;
    return coBaseFilter(o, q, shipF, stageF);
  }));
}

export function renderContracts() {
  if (coView === 'table') renderCoTable();
  else renderCoBoard();
}

function coStageBadge(stage) {
  const cls = {Draft:'pipe-draft',Sent:'pipe-sent',Acknowledged:'pipe-ack',Accepted:'pipe-accepted',Declined:'pipe-declined',Confirmed:'pipe-confirmed'}[stage] || 'pipe-draft';
  return `<span class="pipe-badge ${cls}">${stage}</span>`;
}

function coPipelineMini(stage) {
  const idx      = CO_STAGE_IDX[stage] ?? 0;
  const declined = stage === 'Declined';
  return CO_STAGES.filter(s => s !== 'Declined' || declined).slice(0, declined ? 4 : 5).map((s, i) => {
    const si = CO_STAGE_IDX[s];
    let cls = '';
    if (declined && s === 'Declined') cls = 'declined';
    else if (si < idx) cls = 'done';
    else if (si === idx) cls = 'current';
    return `<div class="co-step ${cls}"></div>`;
  }).join('');
}

function renderCoTable() {
  const data  = coFilteredOffers();
  const tbody = document.getElementById('co-tbody');
  const empty = document.getElementById('co-table-empty');
  const SCM   = SHIP_CLASS_MAP(); const CB = CLASS_BADGE(); const SNM = SHIP_NAME_MAP();
  ['crewName','type','ship','stage','dateFrom','approver','created'].forEach(k => {
    const el = document.getElementById('co-sa-' + k);
    if (el) el.textContent = k === coSortKey ? (coSortDir === 'asc' ? ' ↑' : ' ↓') : '';
  });

  // Accepted notification banner
  const acceptedOffers = state.offers.filter(o => o.stage === 'Accepted');
  const bannerEl = document.getElementById('co-accepted-banner');
  if (bannerEl) {
    if (acceptedOffers.length) {
      const names = acceptedOffers.map(o => {
        const ship = SNM[o.ship] ? `Celebrity ${SNM[o.ship]}` : o.ship || '—';
        return `<span style="font-weight:600;color:#fff;">${o.crewName||'—'}</span> → ${ship}`;
      }).join(' &nbsp;·&nbsp; ');
      bannerEl.style.display = 'flex';
      bannerEl.innerHTML = `<span style="font-size:14px;margin-right:8px;">🔔</span>
        <div style="flex:1;">
          <span style="font-weight:600;font-size:12px;color:#fff;">${acceptedOffers.length} offer${acceptedOffers.length!==1?'s':''} awaiting confirmation</span>
          <span style="font-size:11px;color:rgba(255,255,255,.7);margin-left:10px;">${names}</span>
        </div>
        <button class="btn btn-sm" style="font-size:10px;background:rgba(255,255,255,.15);border-color:rgba(255,255,255,.3);color:#fff;flex-shrink:0;" onclick="setCoStageFilter('Accepted',null)">View all</button>`;
    } else {
      bannerEl.style.display = 'none';
    }
  }

  if (!data.length) { tbody.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  tbody.innerHTML = data.map(o => {
    const cls      = SCM[o.ship] || '';
    const clsBadge = CB[cls] || 'badge-gray';
    const typeIcon  = CO_TYPE_ICONS[o.type] || '';
    const typeColor = o.type === 'Extension' ? 'var(--blue-t)' : o.type === 'Offer' ? 'var(--purple-t)' : 'var(--teal-t)';
    const dateDisplay = o.dateFrom ? (o.dateTo ? `${o.dateFrom} → ${o.dateTo}` : o.dateFrom) : '—';
    const isAccepted = o.stage === 'Accepted';
    const rowStyle = isAccepted
      ? 'cursor:pointer;background:rgba(61,232,160,.06);border-left:3px solid var(--green-t);'
      : 'cursor:pointer;';
    const isTerminal = ['Confirmed','Declined'].includes(o.stage);
    const confirmBtn = isAccepted
      ? `<button class="btn btn-sm" style="font-size:10px;color:var(--green-t);border-color:rgba(61,232,160,.4);white-space:nowrap;" onclick="event.stopPropagation();advanceCoStage(${o.id},'Confirmed')" title="Confirm">✓ Confirm</button>`
      : isTerminal
      ? '' // terminal offers are retained — no delete
      : `<button class="btn btn-sm btn-danger" onclick="event.stopPropagation();deleteCoOffer(${o.id})" title="Delete">✕</button>`;
    return `<tr style="${rowStyle}" onclick="openCoModal(${o.id})">
      <td><div style="font-weight:600;font-size:12px;">${o.crewName||'—'}</div><div style="font-size:10px;color:var(--text2);">#${o.crewId||'—'}</div></td>
      <td><span style="font-size:11px;font-weight:600;color:${typeColor};">${typeIcon} ${o.type}</span>${o.subtype?`<div style="font-size:10px;color:var(--text2);">${o.subtype}</div>`:''}</td>
      <td>${o.ship?`<span class="badge ${clsBadge}" style="font-size:9px;">${o.ship}</span>`:'<span style="color:var(--text2);font-size:11px;">—</span>'}</td>
      <td>${coStageBadge(o.stage)}</td>
      <td><div class="co-pipeline">${coPipelineMini(o.stage)}</div></td>
      <td style="font-size:11px;color:var(--text2);white-space:nowrap;">${dateDisplay}</td>
      <td style="font-size:11px;color:var(--text2);">${o.approver||'—'}</td>
      <td style="font-size:11px;color:var(--text2);">${o.created||'—'}</td>
      <td>${confirmBtn}</td>
    </tr>`;
  }).join('');

  // ── Archive section ───────────────────────────────────────────────────────
  const archived = coArchivedOffers();
  let archiveEl = document.getElementById('co-archive-section');
  if (!archiveEl) {
    archiveEl = document.createElement('div');
    archiveEl.id = 'co-archive-section';
    archiveEl.style.cssText = 'margin-top:1.5rem;';
    document.getElementById('co-table-view').appendChild(archiveEl);
  }
  const open = archiveEl.dataset.open !== 'false';
  archiveEl.innerHTML = `
      <div onclick="toggleCoArchive()" style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:10px 14px;background:rgba(255,255,255,.03);border:.5px solid rgba(255,255,255,.08);border-radius:6px;user-select:none;">
        <span style="font-size:13px;font-weight:500;color:var(--text2);">Archive</span>
        <span class="badge badge-gray" style="font-size:10px;">${archived.length}</span>
        <span style="font-size:11px;color:var(--text2);">— E1 uploaded &amp; closed offers</span>
        <span style="margin-left:auto;font-size:12px;color:var(--text2);">${open ? '▲' : '▼'}</span>
      </div>
      <div id="co-archive-body" style="display:${open ? 'block' : 'none'};margin-top:8px;">
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead><tr style="color:var(--text2);font-size:10px;text-transform:uppercase;letter-spacing:.04em;">
            <th style="text-align:left;padding:6px 8px;font-weight:500;">Crew member</th>
            <th style="text-align:left;padding:6px 8px;font-weight:500;">Type</th>
            <th style="text-align:left;padding:6px 8px;font-weight:500;">Ship</th>
            <th style="text-align:left;padding:6px 8px;font-weight:500;">Stage</th>
            <th style="text-align:left;padding:6px 8px;font-weight:500;">Dates</th>
            <th style="text-align:left;padding:6px 8px;font-weight:500;">Created</th>
            <th style="text-align:left;padding:6px 8px;font-weight:500;">Sent</th>
            <th style="text-align:left;padding:6px 8px;font-weight:500;">Closed</th>
          </tr></thead>
          <tbody>${archived.length ? archived.map(o => {
            const cls2     = SCM[o.ship] || '';
            const cb2      = CB[cls2] || 'badge-gray';
            const typeColor2 = o.type === 'Extension' ? 'var(--blue-t)' : o.type === 'Offer' ? 'var(--purple-t)' : 'var(--teal-t)';
            const dd2      = o.dateFrom ? (o.dateTo ? `${o.dateFrom} → ${o.dateTo}` : o.dateFrom) : '—';
            return `<tr style="border-top:.5px solid rgba(255,255,255,.06);opacity:.7;cursor:pointer;" onclick="openCoModal(${o.id})">
              <td style="padding:7px 8px;"><span style="font-weight:500;">${o.crewName||'—'}</span></td>
              <td style="padding:7px 8px;color:${typeColor2};font-weight:500;">${CO_TYPE_ICONS[o.type]} ${o.type}</td>
              <td style="padding:7px 8px;">${o.ship?`<span class="badge ${cb2}" style="font-size:9px;">${o.ship}</span>`:'—'}</td>
              <td style="padding:7px 8px;">${coStageBadge(o.stage)}</td>
              <td style="padding:7px 8px;color:var(--text2);white-space:nowrap;">${dd2}</td>
              <td style="padding:7px 8px;color:var(--text2);">${o.created||'—'}</td>
              <td style="padding:7px 8px;color:var(--text2);">${o.sentDate||'—'}</td>
              <td style="padding:7px 8px;color:var(--text2);">${o.e1UploadedDate || getTerminalDate(o)||'—'}</td>
            </tr>`;
          }).join('') : `<tr><td colspan="8" style="padding:14px 8px;color:var(--text2);font-size:12px;text-align:center;">No archived offers yet — confirmed contracts move here after E1 upload.</td></tr>`}</tbody>
        </table>
      </div>`;
}

export function toggleCoArchive() {
  const el = document.getElementById('co-archive-section');
  if (!el) return;
  el.dataset.open = el.dataset.open === 'false' ? 'true' : 'false';
  renderCoTable();
}

function renderCoBoard() {
  const data     = coFilteredOffers();
  const archived = coArchivedOffers();
  const SCM      = SHIP_CLASS_MAP(); const CB = CLASS_BADGE();
  const visStages = ['Draft','Sent','Acknowledged','Accepted','Declined','Confirmed'];
  const board  = document.getElementById('co-board');

  const makeCard = (o) => {
    const typeColor = o.type === 'Extension' ? 'var(--blue-t)' : o.type === 'Offer' ? 'var(--purple-t)' : 'var(--teal-t)';
    const cls       = SCM[o.ship] || '';
    const clsBadge  = CB[cls] || 'badge-gray';
    return `<div class="co-card" onclick="openCoModal(${o.id})">
      <div class="co-card-name">${o.crewName||'—'}</div>
      <div class="co-card-meta">${o.ship?`<span class="badge ${clsBadge}" style="font-size:9px;margin-right:3px;">${o.ship}</span>`:''}${o.dateFrom||'No date'}</div>
      <div class="co-card-type" style="color:${typeColor};">${CO_TYPE_ICONS[o.type]} ${o.type}${o.subtype?' — '+o.subtype:''}</div>
    </div>`;
  };

  const stageCols = visStages.map(stage => {
    const cards = data.filter(o => o.stage === stage);
    const hdrColor = {Draft:'var(--gray-t)',Sent:'var(--blue-t)',Acknowledged:'var(--purple-t)',Accepted:'var(--green-t)',Declined:'var(--red-t)',Confirmed:'var(--amber-t)'}[stage] || '#fff';
    return `<div class="co-col">
      <div class="co-col-header" style="color:${hdrColor};">${stage}<span class="co-col-count">${cards.length}</span></div>
      <div class="co-col-body">
        ${cards.length ? cards.map(makeCard).join('') : `<div style="font-size:11px;color:var(--text2);text-align:center;padding:1rem;font-style:italic;">Empty</div>`}
      </div>
    </div>`;
  }).join('');

  const archiveCol = archived.length ? `<div class="co-col">
    <div class="co-col-header" style="color:var(--text2);">Archive<span class="co-col-count">${archived.length}</span></div>
    <div class="co-col-body" style="opacity:.6;">${archived.map(makeCard).join('')}</div>
  </div>` : '';

  board.innerHTML = stageCols + archiveCol;
}

export function openCoModal(id) {
  coEditId = id || null;
  const overlay  = document.getElementById('co-modal-overlay');
  overlay.classList.remove('hidden');
  const existing = id ? state.offers.find(o => o.id === id) : null;
  if (existing) renderCoDetailModal(existing);
  else renderCoNewModal();
}

export function closeCoModal() {
  document.getElementById('co-modal-overlay').classList.add('hidden');
  coEditId = null;
}

export function closeCoModalIfOutside(e) { if (e.target === document.getElementById('co-modal-overlay')) closeCoModal(); }

function renderCoNewModal() {
  document.getElementById('co-modal-title').textContent    = 'New offer / request';
  document.getElementById('co-modal-subtitle').textContent = 'Create a contract extension, new assignment offer, or leave request';
  const crewOpts = state.crew.map(c => `<option value="${c.id}">${c.name} — ${c.abbr} (${c.recentShipCode||'—'})</option>`).join('');
  document.getElementById('co-modal-body').innerHTML = `
    <div class="co-modal-section">
      <div class="co-modal-section-title">Offer details</div>
      <div class="grid-3" style="margin-bottom:10px;">
        <div class="field"><label>Type</label><select id="co-new-type" onchange="coUpdateSubtype()">
          <option value="Extension">Contract extension</option>
          <option value="Offer">New assignment offer</option>
          <option value="Leave">Leave request</option>
        </select></div>
        <div class="field" id="co-subtype-wrap" style="display:none;"><label>Leave subtype</label>
          <select id="co-new-subtype">${LEAVE_SUBTYPES.map(s=>`<option>${s}</option>`).join('')}</select>
        </div>
        <div class="field"><label>Stage</label><select id="co-new-stage">${CO_STAGES.map(s=>`<option value="${s}">${s}</option>`).join('')}</select></div>
      </div>
      <div class="grid-2" style="margin-bottom:10px;">
        <div class="field"><label>Crew member</label><select id="co-new-crew" onchange="coUpdateCrewEmail()">${crewOpts}</select></div>
        <div class="field"><label>Crew email <span style="color:var(--text2);font-weight:400;">(for sending offer)</span></label>
          <input id="co-new-email" type="email" placeholder="crew.member@example.com"/></div>
      </div>
      <div class="grid-2" style="margin-bottom:10px;">
        <div class="field"><label>Approver / manager</label><input id="co-new-approver" placeholder="e.g. Fleet Entertainment Manager"/></div>
      </div>
      <div class="grid-2" style="margin-bottom:10px;">
        <div class="field"><label>Start / new sign-off date</label><input id="co-new-datefrom" type="date"/></div>
        <div class="field"><label>End / return date</label><input id="co-new-dateto" type="date"/></div>
      </div>
      <div class="field"><label>Notes</label><textarea id="co-new-notes" placeholder="Reason, compensation changes, relief status, any relevant context…" style="min-height:80px;"></textarea></div>
    </div>`;
  document.getElementById('co-modal-actions').innerHTML = `
    <button class="btn btn-primary" onclick="saveCoOffer()">Save offer</button>
    <button class="btn" onclick="closeCoModal()">Cancel</button>`;
}

export function coUpdateSubtype() {
  const t = document.getElementById('co-new-type').value;
  const wrap = document.getElementById('co-subtype-wrap');
  if (wrap) wrap.style.display = t === 'Leave' ? 'block' : 'none';
}

function renderCoDetailModal(o) {
  const crew = state.crew.find(c => c.id == o.crewId);
  const SCM  = SHIP_CLASS_MAP(); const CB = CLASS_BADGE();
  const cls  = SCM[o.ship] || '';
  const clsBadge = CB[cls] || 'badge-gray';
  document.getElementById('co-modal-title').textContent = `${o.crewName||'—'} — ${o.type}`;
  document.getElementById('co-modal-subtitle').innerHTML = `
    ${o.ship ? `<span class="badge ${clsBadge}" style="font-size:9px;margin-right:5px;">${o.ship}</span>` : ''}
    ${coStageBadge(o.stage)}
    <span style="margin-left:6px;font-size:11px;color:var(--text2);">Created ${o.created||'—'}</span>`;
  const activeStages = o.stage === 'Declined' ? ['Draft','Sent','Acknowledged','Declined'] : ['Draft','Sent','Acknowledged','Accepted','Confirmed'];
  const pipeHtml = `<div class="co-pipeline-full">
    ${activeStages.map((s, i) => {
      const si = CO_STAGE_IDX[s], oi = CO_STAGE_IDX[o.stage];
      let dot = 'pending';
      if (s === o.stage) dot = o.stage === 'Declined' ? 'declined' : 'current';
      else if (si < oi) dot = 'done';
      const icon = dot === 'done' ? '✓' : dot === 'declined' ? '✕' : (i+1);
      return `<div class="co-pf-step"><div><div class="co-pf-dot ${dot}">${icon}</div></div><div class="co-pf-label">${s}</div></div>`;
    }).join('')}
  </div>`;
  document.getElementById('co-modal-body').innerHTML = `
    <div class="co-modal-section"><div class="co-modal-section-title">Pipeline</div>${pipeHtml}</div>
    <div class="co-modal-section">
      <div class="co-modal-section-title">Details</div>
      <div class="co-detail-grid">
        <div class="co-detail-item"><label>Crew member</label><span>${o.crewName||'—'} ${crew?`<span style="color:var(--text2);font-size:11px;">(#${crew.id})</span>`:''}</span></div>
        <div class="co-detail-item"><label>Type</label><span>${CO_TYPE_ICONS[o.type]} ${o.type}${o.subtype?' — '+o.subtype:''}</span></div>
        <div class="co-detail-item"><label>Ship</label><span>${o.ship||'—'}</span></div>
        <div class="co-detail-item"><label>Approver</label><span>${o.approver||'—'}</span></div>
        <div class="co-detail-item"><label>Start date</label><span>${o.dateFrom||'—'}</span></div>
        <div class="co-detail-item"><label>End date</label><span>${o.dateTo||'—'}</span></div>
        <div class="co-detail-item" style="grid-column:1/-1;">
          <label>Crew email</label>
          <div style="display:flex;gap:8px;align-items:center;margin-top:3px;">
            <input id="detail-email-${o.id}" type="email" value="${crew?.email||''}" placeholder="crew.member@example.com"
              style="flex:1;max-width:300px;font-size:12px;padding:5px 8px;"
              onblur="saveCrewEmail(${o.crewId},this.value)"/>
            <span style="font-size:11px;color:var(--text2);">Saved on crew record</span>
          </div>
        </div>
      </div>
      ${o.notes ? `<div style="margin-top:12px;padding:10px 12px;background:rgba(255,255,255,.04);border-radius:var(--r);font-size:12px;color:var(--text2);border:.5px solid var(--border);">${o.notes}</div>` : ''}
    </div>
    ${o.history && o.history.length ? `
    <div class="co-modal-section">
      <div class="co-modal-section-title">History</div>
      ${o.history.map(h => `<div style="display:flex;gap:8px;font-size:11px;padding:4px 0;border-bottom:.5px solid var(--border);"><span style="color:var(--text2);flex-shrink:0;">${h.date}</span><span>${h.note}</span></div>`).join('')}
    </div>` : ''}
    <div class="co-modal-section">
      <div class="co-modal-section-title">Move pipeline stage</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        ${CO_STAGES.filter(s => s !== o.stage).map(s => `<button class="btn btn-sm" onclick="advanceCoStage(${o.id},'${s}')">${s}</button>`).join('')}
      </div>
    </div>`;
  document.getElementById('co-modal-actions').innerHTML = `
    <button class="btn btn-primary btn-sm" onclick="openEmailCompose(${o.id})">✉ Send email</button>
    <button class="btn btn-sm" onclick="openCoEditInline(${o.id})">Edit</button>
    <button class="btn btn-sm btn-danger" onclick="deleteCoOffer(${o.id});closeCoModal()">Delete</button>
    <button class="btn btn-sm" onclick="closeCoModal()" style="margin-left:auto;">Close</button>`;
}

export function openCoEditInline(id) {
  const o = state.offers.find(x => x.id === id);
  if (!o) return;
  const crewOpts = state.crew.map(c => `<option value="${c.id}" ${c.id == o.crewId ? 'selected' : ''}>${c.name} — ${c.abbr} (${c.recentShipCode||'—'})</option>`).join('');
  document.getElementById('co-modal-body').innerHTML = `
    <div class="co-modal-section">
      <div class="grid-3" style="margin-bottom:10px;">
        <div class="field"><label>Type</label><select id="co-edit-type" onchange="coUpdateEditSubtype()">
          ${['Extension','Offer','Leave'].map(t=>`<option value="${t}" ${t===o.type?'selected':''}>${t==='Extension'?'Contract extension':t==='Offer'?'New assignment offer':'Leave request'}</option>`).join('')}
        </select></div>
        <div class="field" id="co-edit-subtype-wrap" style="${o.type==='Leave'?'':'display:none'}">
          <label>Subtype</label>
          <select id="co-edit-subtype">${LEAVE_SUBTYPES.map(s=>`<option ${s===o.subtype?'selected':''}>${s}</option>`).join('')}</select>
        </div>
        <div class="field"><label>Stage</label><select id="co-edit-stage">${CO_STAGES.map(s=>`<option ${s===o.stage?'selected':''}>${s}</option>`).join('')}</select></div>
      </div>
      <div class="grid-2" style="margin-bottom:10px;">
        <div class="field"><label>Crew member</label><select id="co-edit-crew">${crewOpts}</select></div>
        <div class="field"><label>Approver</label><input id="co-edit-approver" value="${o.approver||''}"/></div>
      </div>
      <div class="grid-2" style="margin-bottom:10px;">
        <div class="field"><label>Start / new sign-off date</label><input id="co-edit-datefrom" type="date" value="${o.dateFrom||''}"/></div>
        <div class="field"><label>End / return date</label><input id="co-edit-dateto" type="date" value="${o.dateTo||''}"/></div>
      </div>
      <div class="field"><label>Notes</label><textarea id="co-edit-notes" style="min-height:70px;">${o.notes||''}</textarea></div>
    </div>`;
  document.getElementById('co-modal-actions').innerHTML = `
    <button class="btn btn-primary btn-sm" onclick="saveCoEdit(${id})">Save changes</button>
    <button class="btn btn-sm" onclick="openCoModal(${id})">Cancel</button>`;
}

export function coUpdateEditSubtype() {
  const wrap = document.getElementById('co-edit-subtype-wrap');
  if (wrap) wrap.style.display = document.getElementById('co-edit-type').value === 'Leave' ? 'block' : 'none';
}

export function coUpdateCrewEmail() {
  const sel = document.getElementById('co-new-crew');
  if (!sel) return;
  const crewId = parseInt(sel.value);
  const emailEl = document.getElementById('co-new-email');
  if (emailEl) emailEl.value = getCrewEmail(crewId);
}

export function saveCoOffer() {
  const crewId = parseInt(document.getElementById('co-new-crew').value);
  const crew   = state.crew.find(c => c.id === crewId);
  const type   = document.getElementById('co-new-type').value;
  const subEl  = document.getElementById('co-new-subtype');
  const emailVal = (document.getElementById('co-new-email')?.value || '').trim();
  if (emailVal) saveCrewEmail(crewId, emailVal);
  const newOffer = {
    id: uid(), crewId, crewName: crew ? crew.name : '',
    ship: crew ? crew.recentShipCode : '',
    type, subtype: type === 'Leave' && subEl ? subEl.value : '',
    stage:    document.getElementById('co-new-stage').value,
    dateFrom: document.getElementById('co-new-datefrom').value,
    dateTo:   document.getElementById('co-new-dateto').value,
    approver: document.getElementById('co-new-approver').value.trim(),
    notes:    document.getElementById('co-new-notes').value.trim(),
    created:  new Date().toISOString().slice(0, 10),
    history:  []
  };
  state.offers.push(newOffer);
  closeCoModal();
  renderCoSummary();
  renderContracts();
  showToast(`${type} created for ${crew ? crew.name : '—'}`);
  upsertOffer(newOffer);
}

export function saveCoEdit(id) {
  const o = state.offers.find(x => x.id === id);
  if (!o) return;
  const crewId   = parseInt(document.getElementById('co-edit-crew').value);
  const crew     = state.crew.find(c => c.id === crewId);
  const type     = document.getElementById('co-edit-type').value;
  const subEl    = document.getElementById('co-edit-subtype');
  const oldStage = o.stage;
  const newStage = document.getElementById('co-edit-stage').value;
  Object.assign(o, {
    crewId, crewName: crew ? crew.name : o.crewName, ship: crew ? crew.recentShipCode : o.ship,
    type, subtype: type === 'Leave' && subEl ? subEl.value : '',
    stage: newStage,
    dateFrom: document.getElementById('co-edit-datefrom').value,
    dateTo:   document.getElementById('co-edit-dateto').value,
    approver: document.getElementById('co-edit-approver').value.trim(),
    notes:    document.getElementById('co-edit-notes').value.trim()
  });
  if (oldStage !== newStage) {
    const today2 = new Date().toISOString().slice(0, 10);
    o.history = o.history || [];
    o.history.push({date: today2, note: `Stage changed: ${oldStage} → ${newStage}`});
    if (['Confirmed','Declined'].includes(newStage) && !o.terminalDate) o.terminalDate = today2;
    // Apply accepted/confirmed offer to the crew record
    if (['Accepted','Confirmed'].includes(newStage)) applyOfferToCrew(o);
  }
  renderCoDetailModal(o);
  renderCoSummary();
  renderContracts();
  upsertOffer(o);
}

// When an offer reaches Accepted (or Confirmed), write future assignment back to the crew record.
// For a new Offer: set futureShip/futureOn/futureOff so the crew member appears in Incoming Crew.
// For an Extension: extend the current sign-off date in place.
function applyOfferToCrew(o) {
  if (o.type === 'Leave') return; // leave requests don't change ship assignments
  const c = state.crew.find(x => x.id == o.crewId);
  if (!c) return;

  if (o.type === 'Extension') {
    // Extend the current contract end date
    if (o.dateTo) { c.end = o.dateTo; c.signOff = o.dateTo; }
  } else {
    // New offer — populate future assignment fields
    if (o.ship)    c.futureShip = o.ship;
    if (o.dateFrom) c.futureOn  = o.dateFrom;
    if (o.dateTo)   c.futureOff = o.dateTo;
    const SNM = window.SHIP_NAME_MAP || {};
    if (o.ship && SNM[o.ship]) c.futureName = SNM[o.ship];
  }

  upsertCrew(c);
}

export function advanceCoStage(id, stage) {
  const o = state.offers.find(x => x.id === id);
  if (!o) return;
  const today    = new Date().toISOString().slice(0, 10);
  const oldStage = o.stage;
  o.stage = stage;
  // Stamp the date an offer first enters a terminal state — used for 30-day archive window
  if (['Confirmed','Declined'].includes(stage) && !o.terminalDate) {
    o.terminalDate = today;
  }
  o.history = o.history || [];
  o.history.push({date: today, note: `Stage: ${oldStage} → ${stage}`});
  // Apply accepted/confirmed offer to the crew record
  if (['Accepted','Confirmed'].includes(stage)) applyOfferToCrew(o);
  renderCoDetailModal(o);
  renderCoSummary();
  renderContracts();
  upsertOffer(o);
}

export function deleteCoOffer(id) {
  const o = state.offers.find(x => x.id === id);
  // Offers that have been sent or beyond are permanent records — block deletion
  if (o && o.stage !== 'Draft') {
    showToast(`Cannot delete — this offer has been sent and is a permanent record. Archive it via E1 upload instead.`, 6000);
    return;
  }
  state.offers = state.offers.filter(x => x.id !== id);
  renderCoSummary();
  renderContracts();
  dbDeleteOffer(id);
}

// legacy shims
export function populateOfferDropdown() {}
export function renderOffers() {}
export function renderHandoverSummary() {}

window.switchCoMainTab     = switchCoMainTab;
window.setSSWindow         = setSSWindow;
window.ssCreateDraft       = ssCreateDraft;
window.ssCreateAndEmail    = ssCreateAndEmail;
window.ssToggleSelect      = ssToggleSelect;
window.ssClearSelections   = ssClearSelections;
window.ssBulkCreateOffers  = ssBulkCreateOffers;
window.initContracts       = initContracts;
window.setCoStageFilter    = setCoStageFilter;
window.setCoCat            = setCoCat;
window.setCoView           = setCoView;
window.coSort              = coSort;
window.openCoModal         = openCoModal;
window.closeCoModal        = closeCoModal;
window.closeCoModalIfOutside = closeCoModalIfOutside;
window.coUpdateSubtype     = coUpdateSubtype;
window.coUpdateEditSubtype = coUpdateEditSubtype;
window.coUpdateCrewEmail   = coUpdateCrewEmail;
window.saveCoOffer         = saveCoOffer;
window.saveCoEdit          = saveCoEdit;
window.advanceCoStage      = advanceCoStage;
window.deleteCoOffer       = deleteCoOffer;
window.openCoEditInline    = openCoEditInline;
window.renderSmartSuggest       = renderSmartSuggest;
window.toggleCoArchive          = toggleCoArchive;
window.renderContracts          = renderContracts;
window.renderCoSummary          = renderCoSummary;
window.renderCoDetailModal      = renderCoDetailModal;
window.updateCoPipelineTabCount = updateCoPipelineTabCount;
