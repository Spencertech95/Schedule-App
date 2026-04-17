// ── reports.js — reports page ─────────────────────────────────────────────────
import { state } from './state.js';
import { upsertOffer } from './db.js';

const SC2NAME  = {'ML':'Millennium','IN':'Infinity','SM':'Summit','CS':'Constellation','SL':'Solstice','EQ':'Equinox','EC':'Eclipse','SI':'Silhouette','RF':'Reflection','EG':'Edge','AX':'Apex','BY':'Beyond','AT':'Ascent','XC':'Xcel'};
const SC2CLS   = {'ML':'MILLENNIUM CLASS','IN':'MILLENNIUM CLASS','SM':'MILLENNIUM CLASS','CS':'MILLENNIUM CLASS','SL':'SOLSTICE CLASS','EQ':'SOLSTICE CLASS','EC':'SOLSTICE CLASS','SI':'SOLSTICE CLASS','RF':'SOLSTICE CLASS','EG':'EDGE CLASS','AX':'EDGE CLASS','BY':'EDGE CLASS','AT':'EDGE CLASS','XC':'EDGE CLASS'};
const CLS2BADGE = {'MILLENNIUM CLASS':'badge-teal','SOLSTICE CLASS':'badge-blue','EDGE CLASS':'badge-purple'};
let rptWindow = 30;

export function initReports() {
  const ships = [...new Set(state.crew.map(c => c.recentShipCode).filter(Boolean))].sort();
  ['rf-ship','rf-cert-ship'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<option value="">All ships</option>' + ships.map(s => `<option value="${s}">${s} — ${SC2NAME[s]||s}</option>`).join('');
  });
  const posEl = document.getElementById('rf-pos');
  if (posEl) posEl.innerHTML = '<option value="">All positions</option>' + state.positions.map(p => `<option value="${p.id}">${p.abbr}</option>`).join('');
  renderReportSummary();
  renderReport();
}

export function setReportWindow(w, el) {
  rptWindow = w;
  document.querySelectorAll('.rw-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  const isCert = w === 'cert';
  const isE1   = w === 'e1';
  document.getElementById('report-sign-off-section').style.display = (!isCert && !isE1) ? '' : 'none';
  document.getElementById('report-cert-section').style.display     = isCert  ? '' : 'none';
  document.getElementById('report-e1-section').style.display       = isE1    ? '' : 'none';
  if (isE1)        renderE1Report();
  else if (isCert) renderCertReport();
  else             renderReport();
}

function renderReportSummary() {
  const now = new Date();
  const n30 = state.crew.filter(c => { const d = (new Date(c.end)-now)/864e5; return c.end && d >= 0 && d <= 30; }).length;
  const n60 = state.crew.filter(c => { const d = (new Date(c.end)-now)/864e5; return c.end && d >= 0 && d <= 60; }).length;
  const n90 = state.crew.filter(c => { const d = (new Date(c.end)-now)/864e5; return c.end && d >= 0 && d <= 90; }).length;
  let nc = 0;
  state.crew.forEach(c => {
    if (c.medical  && (new Date(c.medical) -now)/864e5 <= 90 && (new Date(c.medical) -now)/864e5 >= 0) nc++;
    if (c.passport && (new Date(c.passport)-now)/864e5 <= 90 && (new Date(c.passport)-now)/864e5 >= 0) nc++;
  });
  document.getElementById('report-summary-strip').innerHTML = `
    <div class="rsum rsum-30"  onclick="setReportWindow(30,document.querySelectorAll('.rw-tab')[0])"><div class="rsum-label">Signing off — 30 days</div><div class="rsum-value">${n30}</div><div class="rsum-detail">Immediate relief required</div></div>
    <div class="rsum rsum-60"  onclick="setReportWindow(60,document.querySelectorAll('.rw-tab')[1])"><div class="rsum-label">Signing off — 60 days</div><div class="rsum-value">${n60}</div><div class="rsum-detail">Pipeline planning window</div></div>
    <div class="rsum rsum-90"  onclick="setReportWindow(90,document.querySelectorAll('.rw-tab')[2])"><div class="rsum-label">Signing off — 90 days</div><div class="rsum-value">${n90}</div><div class="rsum-detail">Forward visibility</div></div>
    <div class="rsum rsum-cert" onclick="setReportWindow('cert',document.querySelectorAll('.rw-tab')[3])"><div class="rsum-label">Cert / doc alerts</div><div class="rsum-value">${nc}</div><div class="rsum-detail">Expiring within 90 days</div></div>`;
}

function renderReport() {
  const now   = new Date();
  const days  = typeof rptWindow === 'number' ? rptWindow : 90;
  const shipF = document.getElementById('rf-ship').value;
  const clsF  = document.getElementById('rf-class').value;
  const posF  = document.getElementById('rf-pos').value;
  document.getElementById('report-card-title').textContent = `Signing off — next ${days} days`;
  const list = state.crew.filter(c => {
    if (!c.end) return false;
    const d = (new Date(c.end) - now) / 864e5;
    if (d < 0 || d > days) return false;
    if (shipF && c.recentShipCode !== shipF) return false;
    if (clsF  && (SC2CLS[c.recentShipCode]||'') !== clsF) return false;
    if (posF  && String(c.posId) !== posF) return false;
    return true;
  }).sort((a, b) => new Date(a.end) - new Date(b.end));
  document.getElementById('report-card-sub').textContent = `${list.length} crew member${list.length !== 1 ? 's' : ''} signing off in this window`;
  if (!list.length) {
    document.getElementById('report-body').innerHTML = `<div style="padding:2rem 0;text-align:center;color:var(--text2);">No crew signing off in the next ${days} days matching current filters.</div>`;
    return;
  }
  const byShip = {};
  list.forEach(c => { const k = c.recentShipCode || '—'; if (!byShip[k]) byShip[k] = []; byShip[k].push(c); });
  const urgBadge    = d => d <= 30 ? 'badge-red' : d <= 60 ? 'badge-amber' : 'badge-blue';
  const urgFillCls  = d => d <= 30 ? 'urgency-fill-red' : d <= 60 ? 'urgency-fill-amber' : 'urgency-fill-blue';
  let html = `<div class="report-head"><div class="report-head-cell">Crew member</div><div class="report-head-cell">Position</div><div class="report-head-cell">Sign-off date</div><div class="report-head-cell">Relief</div><div class="report-head-cell">Days left</div><div class="report-head-cell">Urgency</div></div>`;
  Object.entries(byShip).forEach(([sc, crew]) => {
    const cb = CLS2BADGE[SC2CLS[sc]] || 'badge-gray';
    html += `<div class="report-group"><div class="report-group-header"><span class="badge ${cb}" style="font-size:10px;">${sc}</span><span style="font-size:13px;font-weight:500;">${SC2NAME[sc]||sc}</span><span style="font-size:11px;color:var(--text2);">${crew.length} signing off</span></div>`;
    crew.forEach(c => {
      const pos = state.positions.find(p => p.id == c.posId);
      const d   = Math.round((new Date(c.end) - now) / 864e5);
      const pct = Math.min(100, Math.round((1 - d / days) * 100));
      const hasOffer = state.offers && state.offers.some(o => o.crewId == c.id);
      const rel = hasOffer ? `<span class="relief-ok">✓ Offer logged</span>`
        : d <= 14 ? `<span class="relief-none">✕ No cover</span>`
        : d <= 30 ? `<span class="relief-warn">⚠ Check relief</span>`
        : `<span style="color:var(--text2);font-size:11px;">— Pending</span>`;
      const hwAlert = pos && d <= pos.handover ? `<span class="badge badge-red" style="font-size:9px;margin-left:4px;">Handover!</span>` : '';
      html += `<div class="report-row">
        <div class="report-cell"><div style="font-weight:500">${c.name} <span style="font-size:10px;color:var(--text2);">${c.nat}</span></div><div style="font-size:10px;color:var(--text2);">${c.airport||''}</div></div>
        <div class="report-cell"><span class="badge badge-gray" style="font-size:10px;">${pos?pos.abbr:'—'}</span>${hwAlert}</div>
        <div class="report-cell" style="white-space:nowrap;">${c.end}</div>
        <div class="report-cell">${rel}</div>
        <div class="report-cell"><span class="badge ${urgBadge(d)}" style="font-size:10px;">${d}d</span></div>
        <div class="report-cell"><div class="urgency-bar"><div class="${urgFillCls(d)}" style="width:${pct}%"></div></div></div>
      </div>`;
    });
    html += '</div>';
  });
  document.getElementById('report-body').innerHTML = html;
}

function renderCertReport() {
  const now   = new Date();
  const shipF = document.getElementById('rf-cert-ship').value;
  const alerts = [];
  state.crew.forEach(c => {
    if (shipF && c.recentShipCode !== shipF) return;
    ['medical','passport'].forEach(field => {
      if (c[field]) {
        const d = Math.round((new Date(c[field]) - now) / 864e5);
        if (d >= 0 && d <= 90) alerts.push({c, type: field === 'medical' ? 'Medical cert' : 'Passport', expiry: c[field], days: d});
      }
    });
  });
  alerts.sort((a, b) => a.days - b.days);
  const ub = d => d <= 30 ? 'badge-red' : d <= 60 ? 'badge-amber' : 'badge-blue';
  if (!alerts.length) {
    document.getElementById('cert-body').innerHTML = `<div style="padding:2rem 0;text-align:center;color:var(--text2);">No cert or document alerts in the next 90 days.</div>`;
    return;
  }
  document.getElementById('cert-body').innerHTML = alerts.map(a => {
    const pos = state.positions.find(p => p.id == a.c.posId);
    const cb  = CLS2BADGE[SC2CLS[a.c.recentShipCode]] || 'badge-gray';
    return `<div class="cert-row">
      <div class="report-cell"><span style="font-weight:500;">${a.c.name}</span> <span style="font-size:10px;color:var(--text2);">${a.c.nat}</span></div>
      <div class="report-cell"><span class="badge badge-gray" style="font-size:10px;">${pos?pos.abbr:'—'}</span></div>
      <div class="report-cell"><span class="badge ${cb}" style="font-size:9px;">${a.c.recentShipCode||'—'}</span> <span style="font-size:11px;">${a.c.recentShipName||'—'}</span></div>
      <div class="report-cell"><span class="badge ${ub(a.days)}">${a.type}</span></div>
      <div class="report-cell" style="font-size:12px;white-space:nowrap;">${a.expiry} <span style="font-size:10px;color:var(--text2);">(${a.days}d)</span></div>
    </div>`;
  }).join('');
}

// ── E1 UPLOAD REPORT ─────────────────────────────────────────────────────────

function e1PendingOffers() {
  return state.offers.filter(o =>
    ['Accepted'].includes(o.stage) && !o.e1Uploaded
  ).sort((a, b) => (a.created || '').localeCompare(b.created || ''));
}

export function renderE1Report() {
  const today   = new Date().toISOString().slice(0, 10);
  const pending = e1PendingOffers();

  const subEl = document.getElementById('e1-sub');
  if (subEl) subEl.textContent = `${pending.length} accepted offer${pending.length !== 1 ? 's' : ''} pending upload to E1`;

  const confirmBtn = document.getElementById('e1-confirm-btn');

  if (!pending.length) {
    document.getElementById('e1-body').innerHTML =
      `<div style="padding:2rem 0;text-align:center;color:var(--text2);">All accepted contracts have been uploaded to E1.</div>`;
    if (confirmBtn) { confirmBtn.disabled = true; }
    return;
  }

  // Split into today's new acceptances vs older pending
  const todayRows = pending.filter(o => (o.acceptedDate || o.created || '').slice(0, 10) === today);
  const olderRows = pending.filter(o => (o.acceptedDate || o.created || '').slice(0, 10) !== today);

  const headHtml = `<div class="report-head" style="grid-template-columns:28px 1fr 80px 100px 100px 100px 90px;">
    <div></div>
    <div class="report-head-cell">Crew member</div>
    <div class="report-head-cell">Position</div>
    <div class="report-head-cell">Ship</div>
    <div class="report-head-cell">Join date</div>
    <div class="report-head-cell">Leave date</div>
    <div class="report-head-cell">Accepted</div>
  </div>`;

  function rowsHtml(offers) {
    return offers.map(o => {
      const crew    = state.crew.find(c => c.id == o.crewId);
      const shipName = SC2NAME[o.ship] || o.ship || '—';
      const joinDate  = o.dateFrom || '—';
      const leaveDate = o.dateTo   || '—';
      const acceptedOn = (o.acceptedDate || o.created || '').slice(0, 10) || '—';
      return `<div class="report-row e1-row" style="grid-template-columns:28px 1fr 80px 100px 100px 100px 90px;" id="e1-row-${o.id}">
        <div class="report-cell" style="padding-right:0;">
          <input type="checkbox" class="e1-chk" data-id="${o.id}" onchange="e1UpdateConfirmBtn()" style="width:14px;height:14px;cursor:pointer;">
        </div>
        <div class="report-cell">
          <div style="font-weight:500;">${crew?.name || o.crewName || '—'}</div>
          <div style="font-size:10px;color:var(--text2);">${crew?.nat || ''} ${crew?.airport ? '· ' + crew.airport : ''}</div>
        </div>
        <div class="report-cell"><span class="badge badge-gray" style="font-size:10px;">${crew?.abbr || '—'}</span></div>
        <div class="report-cell"><span style="font-size:12px;">Celebrity ${shipName}</span></div>
        <div class="report-cell" style="font-size:12px;white-space:nowrap;">${joinDate}</div>
        <div class="report-cell" style="font-size:12px;white-space:nowrap;">${leaveDate}</div>
        <div class="report-cell" style="font-size:11px;color:var(--text2);">${acceptedOn}</div>
      </div>`;
    }).join('');
  }

  let html = headHtml;
  if (todayRows.length) {
    html += `<div class="report-group"><div class="report-group-header">
      <span class="badge badge-green" style="font-size:10px;">New today</span>
      <span style="font-size:13px;font-weight:500;">${today}</span>
      <span style="font-size:11px;color:var(--text2);">${todayRows.length} contract${todayRows.length !== 1 ? 's' : ''}</span>
    </div>${rowsHtml(todayRows)}</div>`;
  }
  if (olderRows.length) {
    html += `<div class="report-group"><div class="report-group-header">
      <span class="badge badge-amber" style="font-size:10px;">Older pending</span>
      <span style="font-size:13px;font-weight:500;">Not yet uploaded</span>
      <span style="font-size:11px;color:var(--text2);">${olderRows.length} contract${olderRows.length !== 1 ? 's' : ''}</span>
    </div>${rowsHtml(olderRows)}</div>`;
  }

  document.getElementById('e1-body').innerHTML = html;
  if (confirmBtn) confirmBtn.disabled = true;
}

export function e1UpdateConfirmBtn() {
  const any = document.querySelectorAll('.e1-chk:checked').length > 0;
  const btn = document.getElementById('e1-confirm-btn');
  if (btn) btn.disabled = !any;
}

export function confirmE1Upload() {
  const checked = [...document.querySelectorAll('.e1-chk:checked')];
  if (!checked.length) return;
  const today = new Date().toISOString().slice(0, 10);
  checked.forEach(chk => {
    const id    = parseInt(chk.dataset.id);
    const offer = state.offers.find(o => o.id === id);
    if (!offer) return;
    offer.e1Uploaded     = true;
    offer.e1UploadedDate = today;
    offer.stage          = 'Confirmed';
    if (!offer.terminalDate) offer.terminalDate = today;
    offer.history        = offer.history || [];
    offer.history.push({ date: today, note: 'Contract confirmed uploaded to E1 — stage advanced to Confirmed' });
    upsertOffer(offer);
  });
  if (typeof window.renderContracts  === 'function') window.renderContracts();
  if (typeof window.renderCoSummary  === 'function') window.renderCoSummary();
  renderE1Report();
  const n = checked.length;
  if (typeof window.showToast === 'function') window.showToast(`${n} contract${n !== 1 ? 's' : ''} confirmed uploaded to E1`);
}

export function downloadE1Csv() {
  const pending = e1PendingOffers();
  if (!pending.length) { if (typeof window.showToast === 'function') window.showToast('No pending E1 contracts to export'); return; }
  const headers = ['Offer ID','Crew Name','Nationality','Position','Ship Code','Ship Name','Join Date','Leave Date','Contract Type','Accepted Date'];
  const rows = pending.map(o => {
    const crew     = state.crew.find(c => c.id == o.crewId);
    const shipName = SC2NAME[o.ship] || o.ship || '';
    return [
      o.id,
      crew?.name || o.crewName || '',
      crew?.nat  || '',
      crew?.abbr || '',
      o.ship     || '',
      shipName,
      o.dateFrom || '',
      o.dateTo   || '',
      o.type     || 'Offer',
      (o.acceptedDate || o.created || '').slice(0, 10),
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
  });
  const csv  = [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `E1_upload_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

window.setReportWindow    = setReportWindow;
window.renderReport       = renderReport;
window.renderCertReport   = renderCertReport;
window.renderE1Report     = renderE1Report;
window.e1UpdateConfirmBtn = e1UpdateConfirmBtn;
window.confirmE1Upload    = confirmE1Upload;
window.downloadE1Csv      = downloadE1Csv;
