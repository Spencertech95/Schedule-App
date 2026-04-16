// ── contracts.js — contracts & offers page ───────────────────────────────────
import { state } from './state.js';
import { uid } from './state.js';
import { showToast } from './utils.js';
import { upsertOffer, dbDeleteOffer } from './db.js';
import { saveCrewEmail, getCrewEmail } from './crew.js';
import { openEmailCompose } from './email.js';

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
  const SCM  = SHIP_CLASS_MAP();
  const CB   = CLASS_BADGE();
  const SNM  = SHIP_NAME_MAP();
  const SD   = SHIP_DISPLAY();
  const SCO  = SHIP_CODES_ORDERED();
  const PO   = POS_ORDER();
  const PC   = POS_COLORS();
  initSSFilters();
  const now        = new Date();
  const windowDays = _ssWindow;
  const vacWeeks   = Math.max(1, parseInt(document.getElementById('ss-vac-weeks')?.value) || 6);
  const vacDays    = vacWeeks * 7;
  const posF       = document.getElementById('ss-pos-filter')?.value  || '';
  const clsF       = document.getElementById('ss-class-filter')?.value || '';
  const viewMode   = document.getElementById('ss-view-mode')?.value    || 'by-crew';

  const openings = [];
  SCO.forEach(sc => {
    const shipCls = SCM[sc] || '';
    if (clsF && shipCls !== clsF) return;
    PO.forEach(abbr => {
      if (posF && abbr !== posF) return;
      const vacating = state.crew.filter(c =>
        (c.recentShipCode === sc || c.shipCode === sc) &&
        c.abbr === abbr && c.status === 'Onboard' && c.end &&
        (new Date(c.end) - now) / 864e5 >= 0 &&
        (new Date(c.end) - now) / 864e5 <= windowDays
      );
      vacating.forEach(vacCrew => {
        const openDate   = new Date(vacCrew.end);
        const hasRelief  = state.crew.some(x =>
          x.futureShip === sc && x.abbr === abbr && x.id !== vacCrew.id &&
          x.futureOn && Math.abs((new Date(x.futureOn) - openDate) / 864e5) < 21
        );
        const candidates    = ssBuildCandidates(abbr, sc, shipCls, openDate, vacDays, vacCrew.id);
        const existingOffer = state.offers.find(o =>
          o.ship === sc && o.crewId &&
          state.crew.find(c => c.id == o.crewId)?.abbr === abbr &&
          !['Confirmed','Declined'].includes(o.stage)
        );
        openings.push({sc, shipCls, abbr, vacCrew, openDate,
          daysUntil: Math.round((openDate - now) / 864e5),
          hasRelief, candidates, existingOffer});
      });
    });
  });
  openings.sort((a, b) => a.daysUntil - b.daysUntil);

  const urgent     = openings.filter(o => o.daysUntil <= 14 && !o.hasRelief).length;
  const needsOffer = openings.filter(o => !o.hasRelief && !o.existingOffer).length;
  const inProgress = openings.filter(o => o.existingOffer).length;
  const covered    = openings.filter(o => o.hasRelief).length;
  document.getElementById('ss-kpi').innerHTML = `
    <div class="co-stat"><div class="co-stat-label">Openings in ${windowDays}d</div><div class="co-stat-val">${openings.length}</div></div>
    <div class="co-stat" style="border-color:rgba(255,107,122,.25)"><div class="co-stat-label" style="color:var(--red-t);">⚠ Urgent (≤14d)</div><div class="co-stat-val" style="color:var(--red-t);">${urgent}</div></div>
    <div class="co-stat" style="border-color:rgba(255,107,122,.2)"><div class="co-stat-label" style="color:var(--red-t);">Needs offer</div><div class="co-stat-val" style="color:var(--red-t);">${needsOffer}</div></div>
    <div class="co-stat" style="border-color:rgba(77,168,247,.2)"><div class="co-stat-label" style="color:var(--blue-t);">In progress</div><div class="co-stat-val" style="color:var(--blue-t);">${inProgress}</div></div>
    <div class="co-stat" style="border-color:rgba(61,232,160,.2)"><div class="co-stat-label" style="color:var(--green-t);">Covered</div><div class="co-stat-val" style="color:var(--green-t);">${covered}</div></div>`;

  const badge = document.getElementById('cotab-suggest-count');
  if (badge) { badge.textContent = needsOffer || ''; badge.style.display = needsOffer ? '' : 'none'; }
  ssUpdateBulkBar();

  const body = document.getElementById('ss-body');
  if (!openings.length) {
    body.innerHTML = `<div class="card" style="padding:2.5rem;text-align:center;color:var(--text2);">
      <div style="font-size:28px;margin-bottom:10px;">✓</div>
      <div style="font-size:14px;font-weight:500;color:#fff;">No openings in the next ${windowDays} days</div>
      <div style="font-size:12px;margin-top:6px;">All positions have crew signed on through this window.</div>
    </div>`;
    return;
  }
  viewMode === 'by-ship' ? renderSSByShip(openings, SC, CB, SNM, SD, SCO, PO, PC) : renderSSByCrew(openings, vacWeeks, SCM, CB, SNM, SCO, PO, PC);
}

function ssBuildCandidates(abbr, targetSc, targetCls, openDate, vacDays, excludeId) {
  const SCM = SHIP_CLASS_MAP();
  const pool = state.crew.filter(c => {
    if (c.abbr !== abbr) return false;
    if (c.id === excludeId) return false;
    if (c.futureShip && c.futureOn) return false;
    if (c.status === 'Offboard') return true;
    if (c.status === 'Onboard' && c.end) {
      const avail = new Date(new Date(c.end).getTime() + vacDays * 864e5);
      return Math.abs((avail - openDate) / 864e5) <= 60;
    }
    return false;
  });
  return pool.map(c => {
    const crewCls  = SCM[c.recentShipCode || c.shipCode] || '';
    const availDate = c.end ? new Date(new Date(c.end).getTime() + vacDays * 864e5) : new Date();
    const dateDiff  = Math.abs((openDate - availDate) / 864e5);
    let score = dateDiff * 0.8;
    if (crewCls === targetCls)        score -= 40;
    else if (c.hasClassExp === 'YES') score -= 20;
    if (c.recentShipCode === targetSc) score -= 55;
    if (c.hasShipExp === 'YES')        score -= 20;
    if (c.readyToJoin === 'YES')       score -= 15;
    score += (c.daysOffboard || 0) * 0.1;
    const fitPct = Math.max(5, Math.min(100, Math.round(((score * -1) + 130) / 2.6)));
    return {c, availDate, availStr: availDate.toISOString().slice(0, 10), dateDiff, score, fitPct, crewCls};
  }).sort((a, b) => a.score - b.score).slice(0, 3);
}

function renderSSByCrew(openings, vacWeeks) {
  const SCM = SHIP_CLASS_MAP(); const CB = CLASS_BADGE(); const SNM = SHIP_NAME_MAP(); const PC = POS_COLORS();
  const byCrewId = {};
  openings.forEach(o => {
    const id = o.vacCrew.id;
    if (!byCrewId[id]) byCrewId[id] = {crew: o.vacCrew, openings: []};
    byCrewId[id].openings.push(o);
  });
  const groups = [
    {label:'Next 30 days', color:'var(--red-t)',   items: Object.values(byCrewId).filter(g => g.openings[0].daysUntil <= 30)},
    {label:'31–60 days',   color:'var(--amber-t)', items: Object.values(byCrewId).filter(g => g.openings[0].daysUntil > 30 && g.openings[0].daysUntil <= 60)},
    {label:'61–90 days',   color:'var(--blue-t)',  items: Object.values(byCrewId).filter(g => g.openings[0].daysUntil > 60)},
  ];
  document.getElementById('ss-body').innerHTML = groups.filter(g => g.items.length).map(g => `
    <div class="ss-window-group">
      <div class="ss-window-header">
        <div class="ss-window-title" style="color:${g.color}">${g.label}</div>
        <span class="badge" style="background:${g.color}22;color:${g.color};border:.5px solid ${g.color}55;font-size:10px;">${g.items.length} crew signing off</span>
      </div>
      ${g.items.map(g2 => ssRenderCrewCard(g2.crew, g2.openings, vacWeeks, SCM, CB, SNM, PC)).join('')}
    </div>`).join('');
}

function ssRenderCrewCard(crew, openings, vacWeeks, SCM, CB, SNM, PC) {
  const now       = new Date();
  const daysUntil = Math.round((new Date(crew.end) - now) / 864e5);
  const posColor  = PC[crew.abbr] || '#A4A4A7';
  const crewCls   = SCM[crew.recentShipCode || crew.shipCode] || '';
  const crewClsBadge = CB[crewCls] || 'badge-gray';
  const isSelected = _ssSelections.has(crew.id);
  const o = openings[0];
  const urgBadge = daysUntil <= 0  ? `<span class="badge badge-red">Signed off</span>`
    : daysUntil <= 7  ? `<span class="badge badge-red">🔴 ${daysUntil}d</span>`
    : daysUntil <= 14 ? `<span class="badge badge-red">${daysUntil}d</span>`
    : daysUntil <= 30 ? `<span class="badge badge-amber">${daysUntil}d</span>`
    : `<span class="badge badge-blue">${daysUntil}d</span>`;
  const offerBadge = o.existingOffer
    ? `<span class="pipe-badge pipe-${o.existingOffer.stage.toLowerCase()}">${o.existingOffer.stage}</span>
       <button class="btn btn-sm" style="font-size:10px;margin-left:4px;" onclick="openEmailCompose(${o.existingOffer.id})">✉ Email</button>`
    : o.hasRelief ? `<span style="font-size:10px;color:var(--green-t);">✓ Relief assigned</span>`
    : `<span style="font-size:10px;color:var(--red-t);font-style:italic;">No offer yet</span>`;
  const openStr = o.openDate.toISOString().slice(0, 10);
  const shipCards = o.candidates.map((cand, i) => {
    const ddColor  = cand.dateDiff <= 3 ? 'var(--green-t)' : cand.dateDiff <= 10 ? 'var(--amber-t)' : 'var(--text2)';
    const ddLabel  = cand.dateDiff <= 1 ? 'Perfect' : cand.dateDiff <= 3 ? `${Math.round(cand.dateDiff)}d off` : `${Math.round(cand.dateDiff)}d gap`;
    const fitColor = cand.fitPct >= 70 ? 'var(--highlight-grad)' : cand.fitPct >= 45 ? 'linear-gradient(90deg,#ff9f50,#f6a623)' : 'rgba(136,150,184,.4)';
    const fitTxt   = cand.fitPct >= 70 ? 'var(--green-t)' : cand.fitPct >= 45 ? 'var(--amber-t)' : 'var(--text2)';
    const rankBadge = i === 0 ? `<span style="background:var(--highlight-grad);color:#fff;font-size:9px;font-weight:700;padding:1px 7px;border-radius:999px;">BEST FIT</span>`
      : i === 1 ? `<span style="font-size:10px;color:var(--blue-t);font-weight:600;">2nd</span>`
      : `<span style="font-size:10px;color:var(--text2);">3rd</span>`;
    const sameShip  = o.sc === (cand.c.recentShipCode || cand.c.shipCode);
    const sameClass = o.shipCls === cand.crewCls;
    const expTag = sameShip  ? `<span style="color:var(--green-t);font-size:10px;font-weight:600;">✓ Same ship</span>`
      : sameClass ? `<span style="color:var(--teal-t);font-size:10px;">✓ Same class</span>`
      : `<span style="font-size:10px;color:var(--text2);">Diff. class</span>`;
    const candOffer = state.offers.find(oo => oo.crewId == cand.c.id && oo.ship === o.sc && !['Confirmed','Declined'].includes(oo.stage));
    const actionBtn = candOffer
      ? `<button class="btn btn-sm" style="width:100%;justify-content:center;font-size:10px;color:var(--green-t);border-color:rgba(61,232,160,.3);" onclick="openEmailCompose(${candOffer.id})">✉ Offer exists — Email</button>`
      : `<button class="btn btn-primary btn-sm" style="width:100%;justify-content:center;font-size:11px;" onclick="ssCreateAndEmail(${cand.c.id},'${o.sc}','${cand.availStr}','${openStr}')">+ Create offer &amp; email</button>
         <button class="btn btn-sm" style="width:100%;justify-content:center;font-size:10px;margin-top:4px;" onclick="ssCreateDraft(${cand.c.id},'${o.sc}','${cand.availStr}','${openStr}')">Draft only</button>`;
    return `<div class="ss-ship-card rank-${i+1}">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:7px;">
        <div style="font-size:13px;font-weight:600;">${esc(cand.c.name)}</div>${rankBadge}
      </div>
      <div style="margin-bottom:5px;">${expTag}</div>
      <div style="font-size:11px;margin-bottom:2px;"><span style="color:var(--text2);">Available: </span><strong style="color:#fff;">${cand.availStr}</strong></div>
      <div style="font-size:11px;margin-bottom:2px;"><span style="color:var(--text2);">Opening: </span><strong style="color:#fff;">${openStr}</strong></div>
      <div style="font-size:11px;margin-bottom:6px;"><span style="color:var(--text2);">Date diff: </span><strong style="color:${ddColor};">${ddLabel}</strong></div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;">
        <span style="font-size:10px;color:var(--text2);">Fit score</span>
        <span style="font-size:11px;font-weight:700;color:${fitTxt};">${cand.fitPct}%</span>
      </div>
      <div class="ss-fit-bar"><div class="ss-fit-fill" style="width:${cand.fitPct}%;background:${fitColor};"></div></div>
      <div style="display:flex;flex-direction:column;gap:0;">${actionBtn}</div>
    </div>`;
  }).join('');
  return `<div class="ss-crew-card ${o.existingOffer ? 'has-offer' : ''} ${isSelected ? 'ss-selected' : ''}" id="ss-card-${crew.id}">
    <div class="ss-crew-header">
      <div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
          <input type="checkbox" style="width:15px;height:15px;cursor:pointer;accent-color:var(--highlight);" ${isSelected ? 'checked' : ''} onchange="ssToggleSelect(${crew.id},this)"/>
          <div style="font-size:14px;font-weight:700;">${esc(crew.name)}</div>
        </div>
        <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap;">
          <span class="badge" style="background:${posColor}22;color:${posColor};border:.5px solid ${posColor}55;font-size:10px;">${crew.abbr}</span>
          <span class="badge ${crewClsBadge}" style="font-size:9px;">${crew.recentShipCode || '—'}</span>
          ${urgBadge}
          <span style="font-size:11px;color:var(--text2);">Signs off ${crew.end || '—'} on ${SNM[crew.recentShipCode] || crew.recentShipCode || '—'}</span>
          ${crew.hasClassExp === 'YES' ? `<span style="font-size:10px;color:var(--teal-t);">Class exp.</span>` : ''}
          ${crew.hasShipExp  === 'YES' ? `<span style="font-size:10px;color:var(--green-t);">Ship exp.</span>` : ''}
          ${crew.readyToJoin === 'YES' ? `<span style="font-size:10px;color:var(--green-t);">Ready</span>` : ''}
        </div>
      </div>
      <div style="text-align:right;flex-shrink:0;">
        <div style="font-size:10px;color:var(--text2);">Opening on</div>
        <div style="font-size:15px;font-weight:700;color:var(--blue-t);">${SNM[o.sc] || o.sc}</div>
        <div style="font-size:10px;color:var(--text2);">${openStr}</div>
        <div style="margin-top:5px;">${offerBadge}</div>
      </div>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;">${shipCards}</div>
  </div>`;
}

function renderSSByShip(openings) {
  const SCM = SHIP_CLASS_MAP(); const CB = CLASS_BADGE(); const SNM = SHIP_NAME_MAP();
  const SD  = SHIP_DISPLAY();   const SCO = SHIP_CODES_ORDERED(); const PC = POS_COLORS();
  const byShip = {};
  openings.forEach(o => { if (!byShip[o.sc]) byShip[o.sc] = []; byShip[o.sc].push(o); });
  document.getElementById('ss-body').innerHTML = SCO.filter(sc => byShip[sc]?.length).map(sc => {
    const d   = SD[sc] || {name: sc, icon: '⛴'};
    const cls = SCM[sc] || '';
    const clsBadge = CB[cls] || 'badge-gray';
    const shipOpenings = byShip[sc];
    const needsAction  = shipOpenings.filter(o => !o.hasRelief && !o.existingOffer).length;
    return `<div class="ss-ship-block">
      <div class="ss-ship-block-header">
        <span style="font-size:20px;">${d.icon}</span>
        <div><div style="font-size:14px;font-weight:700;">${d.name}</div>
        <span class="badge ${clsBadge}" style="font-size:9px;">${sc}</span></div>
        <div style="margin-left:auto;display:flex;gap:6px;align-items:center;">
          ${needsAction ? `<span class="badge badge-red" style="font-size:10px;">${needsAction} need${needsAction===1?'s':''} offer</span>` : ''}
          <span style="font-size:11px;color:var(--text2);">${shipOpenings.length} opening${shipOpenings.length!==1?'s':''}</span>
        </div>
      </div>
      <div>
        <div style="display:grid;grid-template-columns:90px 100px 1fr auto;">
          <div class="ss-opening-cell-head">Position</div>
          <div class="ss-opening-cell-head">Opens</div>
          <div class="ss-opening-cell-head">Best candidates (click to create offer)</div>
          <div class="ss-opening-cell-head">Quick action</div>
        </div>
        ${shipOpenings.map(o => {
          const posColor = PC[o.abbr] || '#A4A4A7';
          const openStr  = o.openDate.toISOString().slice(0, 10);
          const statusTag = o.hasRelief ? `<span style="font-size:10px;color:var(--green-t);">✓ Covered</span>`
            : o.existingOffer ? `<span class="pipe-badge pipe-${o.existingOffer.stage.toLowerCase()}">${o.existingOffer.stage}</span>`
            : o.daysUntil <= 14 ? `<span style="font-size:10px;color:var(--red-t);font-weight:600;">⚠ Urgent</span>`
            : `<span style="font-size:10px;color:var(--amber-t);">Open</span>`;
          const chips = o.candidates.map((cand, i) => {
            const fitTxt    = cand.fitPct >= 70 ? 'var(--green-t)' : cand.fitPct >= 45 ? 'var(--amber-t)' : 'var(--text2)';
            const candOffer = state.offers.find(oo => oo.crewId == cand.c.id && oo.ship === sc && !['Confirmed','Declined'].includes(oo.stage));
            return `<span class="ss-candidate-chip" onclick="${candOffer ? 'openEmailCompose('+candOffer.id+')' : `ssCreateAndEmail(${cand.c.id},'${sc}','${cand.availStr}','${openStr}')`}"
              title="${cand.c.name} — avail ${cand.availStr} — fit ${cand.fitPct}%">
              ${i===0?'🏆':''}
              <span style="font-size:11px;font-weight:500;">${esc(cand.c.name)}</span>
              <span style="font-size:10px;color:${fitTxt};">${cand.fitPct}%</span>
              ${candOffer ? `<span style="font-size:9px;color:var(--green-t);">✉</span>` : `<span style="font-size:9px;opacity:.5;">+</span>`}
            </span>`;
          }).join('');
          const actionBtn = o.hasRelief ? '' : o.candidates[0]
            ? `<button class="btn btn-primary btn-sm" style="font-size:10px;white-space:nowrap;" onclick="ssCreateAndEmail(${o.candidates[0].c.id},'${sc}','${o.candidates[0].availStr}','${openStr}')">+ Best fit</button>`
            : `<span style="font-size:10px;color:var(--text2);">No candidates</span>`;
          return `<div style="display:grid;grid-template-columns:90px 100px 1fr auto;border-bottom:.5px solid rgba(255,255,255,.04);align-items:center;">
            <div style="padding:8px 12px;">
              <span class="badge" style="background:${posColor}22;color:${posColor};border:.5px solid ${posColor}55;font-size:9px;">${o.abbr}</span>
              <div style="font-size:10px;color:var(--text2);margin-top:2px;">${esc(o.vacCrew.name)} off</div>
            </div>
            <div style="padding:8px 12px;font-size:11px;">
              <div style="font-weight:600;color:#fff;">${openStr}</div>
              <div style="margin-top:2px;">${statusTag}</div>
            </div>
            <div style="padding:8px 12px;display:flex;flex-wrap:wrap;gap:3px;">${chips || '<span style="font-size:11px;color:var(--text2);">No candidates</span>'}</div>
            <div style="padding:8px 12px;">${actionBtn}</div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }).join('');
}

export function ssCreateDraft(crewId, shipCode, availFrom, openingDate) {
  const SNM = SHIP_NAME_MAP();
  const crew = state.crew.find(c => c.id == crewId);
  if (!crew) return null;
  const d = new Date(openingDate); d.setMonth(d.getMonth() + 6);
  const offer = {
    id: uid(), crewId, crewName: crew.name, ship: shipCode,
    type: 'Offer', subtype: 'New assignment offer', stage: 'Draft',
    dateFrom: openingDate, dateTo: d.toISOString().slice(0, 10), approver: '',
    notes: `Smart suggest: ${crew.name} available from ${availFrom}. Opening on ${SNM[shipCode] || shipCode} from ${openingDate}.`,
    created: new Date().toISOString().slice(0, 10),
    history: [{date: new Date().toISOString().slice(0, 10), note: 'Created by Smart Suggest engine'}]
  };
  state.offers.push(offer);
  renderCoSummary();
  updateCoPipelineTabCount();
  showToast(`Draft offer — ${crew.name} → ${SNM[shipCode] || shipCode}`);
  renderSmartSuggest();
  upsertOffer(offer);
  return offer;
}

export function ssCreateAndEmail(crewId, shipCode, availFrom, openingDate) {
  const offer = ssCreateDraft(crewId, shipCode, availFrom, openingDate);
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
  const vacDays = (parseInt(document.getElementById('ss-vac-weeks')?.value) || 6) * 7;
  let created = 0;
  _ssSelections.forEach(crewId => {
    const c = state.crew.find(x => x.id == crewId);
    if (!c || !c.end) return;
    if (state.offers.find(o => o.crewId == crewId && !['Confirmed','Declined'].includes(o.stage))) return;
    const openDate = new Date(new Date(c.end).getTime() + vacDays * 864e5);
    const cands    = ssBuildCandidates(c.abbr, null, null, openDate, vacDays, c.id);
    if (!cands.length) return;
    ssCreateDraft(crewId, cands[0].c.recentShipCode || '', openDate.toISOString().slice(0, 10), openDate.toISOString().slice(0, 10));
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

function coFilteredOffers() {
  const q     = (document.getElementById('co-search').value || '').toLowerCase();
  const shipF = document.getElementById('co-filter-ship').value;
  const stageF = document.getElementById('co-filter-stage').value;
  return state.offers.filter(o => {
    if (coCatFilter && o.type !== coCatFilter) return false;
    if (shipF && o.ship !== shipF) return false;
    if (stageF && o.stage !== stageF) return false;
    if (q && !((o.crewName||'').toLowerCase().includes(q) || (o.ship||'').toLowerCase().includes(q) || (o.approver||'').toLowerCase().includes(q))) return false;
    return true;
  }).sort((a, b) => {
    const va = a[coSortKey] || '', vb = b[coSortKey] || '';
    return coSortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
  });
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
    const confirmBtn = isAccepted
      ? `<button class="btn btn-sm" style="font-size:10px;color:var(--green-t);border-color:rgba(61,232,160,.4);white-space:nowrap;" onclick="event.stopPropagation();advanceCoStage(${o.id},'Confirmed')" title="Confirm">✓ Confirm</button>`
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
}

function renderCoBoard() {
  const data   = coFilteredOffers();
  const SCM    = SHIP_CLASS_MAP(); const CB = CLASS_BADGE();
  const visStages = ['Draft','Sent','Acknowledged','Accepted','Declined','Confirmed'];
  const board  = document.getElementById('co-board');
  board.innerHTML = visStages.map(stage => {
    const cards = data.filter(o => o.stage === stage);
    const hdrColor = {Draft:'var(--gray-t)',Sent:'var(--blue-t)',Acknowledged:'var(--purple-t)',Accepted:'var(--green-t)',Declined:'var(--red-t)',Confirmed:'var(--amber-t)'}[stage] || '#fff';
    return `<div class="co-col">
      <div class="co-col-header" style="color:${hdrColor};">${stage}<span class="co-col-count">${cards.length}</span></div>
      <div class="co-col-body">
        ${cards.length ? cards.map(o => {
          const typeColor = o.type === 'Extension' ? 'var(--blue-t)' : o.type === 'Offer' ? 'var(--purple-t)' : 'var(--teal-t)';
          const cls       = SCM[o.ship] || '';
          const clsBadge  = CB[cls] || 'badge-gray';
          return `<div class="co-card" onclick="openCoModal(${o.id})">
            <div class="co-card-name">${o.crewName||'—'}</div>
            <div class="co-card-meta">${o.ship?`<span class="badge ${clsBadge}" style="font-size:9px;margin-right:3px;">${o.ship}</span>`:''}${o.dateFrom||'No date'}</div>
            <div class="co-card-type" style="color:${typeColor};">${CO_TYPE_ICONS[o.type]} ${o.type}${o.subtype?' — '+o.subtype:''}</div>
          </div>`;
        }).join('') : `<div style="font-size:11px;color:var(--text2);text-align:center;padding:1rem;font-style:italic;">Empty</div>`}
      </div>
    </div>`;
  }).join('');
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
    <button class="btn btn-sm" onclick="renderCoDetailModal(state.offers.find(x=>x.id===${id}))">Cancel</button>`;
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
    o.history = o.history || [];
    o.history.push({date: new Date().toISOString().slice(0, 10), note: `Stage changed: ${oldStage} → ${newStage}`});
  }
  renderCoDetailModal(o);
  renderCoSummary();
  renderContracts();
  upsertOffer(o);
}

export function advanceCoStage(id, stage) {
  const o = state.offers.find(x => x.id === id);
  if (!o) return;
  const oldStage = o.stage;
  o.stage = stage;
  o.history = o.history || [];
  o.history.push({date: new Date().toISOString().slice(0, 10), note: `Stage: ${oldStage} → ${stage}`});
  renderCoDetailModal(o);
  renderCoSummary();
  renderContracts();
  upsertOffer(o);
}

export function deleteCoOffer(id) {
  state.offers = state.offers.filter(o => o.id !== id);
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
