// ── profile.js — crew profile panel ─────────────────────────────────────────
import { state } from './state.js';
import { classBadge, statusBadge, showToast } from './utils.js';
import { upsertCrew, dbDeleteCrew } from './db.js';
import { renderCrew } from './crew.js';
import { getSetting } from './settings.js';

let _profId  = null;
let _profTab = 'overview';

const PROF_COLORS = ['#ff7f45','#4da8f7','#a78bfa','#3de8a0','#f6a623','#ff6b7a','#2dcdc4','#e879f9'];

function profColor(name) {
  let h = 0; for (const c of (name || '')) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return PROF_COLORS[h % PROF_COLORS.length];
}

function profInitials(name) {
  const parts = (name || '').split(' ').filter(Boolean);
  return parts.length >= 2 ? parts[0][0] + parts[parts.length-1][0] : parts[0]?.[0] || '?';
}

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

export function openProfile(crewId) {
  _profId  = crewId;
  _profTab = 'overview';
  const overlay = document.getElementById('profile-overlay');
  overlay.classList.add('open');
  renderProfilePanel();
  document.querySelectorAll('.profile-tab').forEach((t, i) => t.classList.toggle('active', i === 0));
}

export function closeProfile() {
  document.getElementById('profile-overlay').classList.remove('open');
  _profId = null;
}

export function switchProfileTab(tab, el) {
  _profTab = tab;
  document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  renderProfileBody();
}

function renderProfilePanel() {
  const c = state.crew.find(x => x.id === _profId);
  if (!c) return;
  const pos  = state.positions.find(p => p.id == c.posId);
  const ship = state.ships.find(s => s.id == c.shipId);
  const col  = profColor(c.name);
  const initials = profInitials(c.name);

  const av = document.getElementById('prof-avatar');
  if (c.photo) {
    av.textContent = '';
    av.style.background = `url(${c.photo}) center/cover`;
    av.style.color  = 'transparent';
    av.style.border = '.5px solid rgba(255,255,255,.15)';
  } else {
    av.textContent      = initials;
    av.style.background = col + '22';
    av.style.color      = col;
    av.style.border     = `.5px solid ${col}55`;
  }

  document.getElementById('prof-name').textContent = c.name;
  const SHIP_CLASS_MAP = window.SHIP_CLASS_MAP || {};
  document.getElementById('prof-meta').innerHTML = `
    ${pos ? `<span class="badge badge-gray" style="font-size:9px;">${pos.abbr}</span>` : ''}
    ${ship ? classBadge(ship.shipClass) : ''}
    ${statusBadge(c.status)}
    <span style="color:var(--text2);">${c.nat || ''}</span>
    <span style="color:var(--text2);">ID #${c.id}</span>`;

  const now      = new Date();
  const daysLeft = c.end ? Math.round((new Date(c.end) - now) / 86400000) : null;
  const tenureYrs = c.tenure ? c.tenure.toFixed(1) : null;
  document.getElementById('prof-stats-wrap').innerHTML = `
    <div class="prof-stat-row">
      <div class="prof-stat">
        <div class="prof-stat-val">${tenureYrs ?? '—'}</div>
        <div class="prof-stat-lbl">Tenure yrs</div>
      </div>
      <div class="prof-stat">
        <div class="prof-stat-val" style="color:${daysLeft !== null && daysLeft < 30 ? 'var(--red-t)' : daysLeft !== null && daysLeft < 60 ? '#f6a623' : 'var(--green-t)'};">
          ${daysLeft !== null ? (daysLeft > 0 ? daysLeft + 'd' : 'Exp.') : '—'}
        </div>
        <div class="prof-stat-lbl">Contract left</div>
      </div>
      <div class="prof-stat">
        <div class="prof-stat-val">${c.vacDays ?? 0}</div>
        <div class="prof-stat-lbl">Vac days</div>
      </div>
      <div class="prof-stat">
        <div class="prof-stat-val">${c.daysOffboard ?? 0}</div>
        <div class="prof-stat-lbl">Days offboard</div>
      </div>
      <div class="prof-stat">
        <div class="prof-stat-val" style="font-size:13px;">${c.hasShipExp === 'YES' ? '✓' : '✗'}</div>
        <div class="prof-stat-lbl">Ship exp.</div>
      </div>
    </div>`;
  renderProfileBody();
}

function renderProfileBody() {
  const c = state.crew.find(x => x.id === _profId);
  if (!c) return;
  const body = document.getElementById('prof-body');
  if      (_profTab === 'overview')   body.innerHTML = renderProfOverview(c);
  else if (_profTab === 'documents')  body.innerHTML = renderProfDocuments(c);
  else if (_profTab === 'history')    body.innerHTML = renderProfHistory(c);
  else if (_profTab === 'skills')     body.innerHTML = renderProfSkills(c);
  else if (_profTab === 'emergency')  body.innerHTML = renderProfEmergency(c);
  else if (_profTab === 'notes')      body.innerHTML = renderProfNotes(c);
  document.querySelectorAll('.prof-star').forEach(s => {
    s.onclick = () => {
      const rating = parseInt(s.dataset.val);
      const c2 = state.crew.find(x => x.id === _profId);
      if (c2) { c2.rating = rating; renderProfileBody(); }
    };
  });
}

function renderProfOverview(c) {
  const pos  = state.positions.find(p => p.id == c.posId);
  const ship = state.ships.find(s => s.id == c.shipId);
  const SHIP_DISPLAY = window.SHIP_DISPLAY || {};
  const fship = c.futureShip ? SHIP_DISPLAY[c.futureShip] : {name: c.futureName || '—'};
  const photoBtn = c.photo
    ? `<button class="btn btn-sm btn-danger" onclick="removeProfilePhoto()" style="font-size:10px;padding:2px 8px;">Remove photo</button>`
    : `<button class="btn btn-sm" onclick="triggerPhotoUpload()" style="font-size:10px;padding:2px 8px;">📷 Upload photo</button>`;
  return `
  <div style="display:flex;justify-content:flex-end;margin-bottom:.5rem;">${photoBtn}</div>
  <div class="prof-section">
    <div class="prof-section-title">Personal details</div>
    <div class="prof-grid">
      <div class="prof-field editing"><label>Full name</label><input id="pf-name" value="${esc(c.name)}" placeholder="Full name"/></div>
      <div class="prof-field editing"><label>Nationality</label><input id="pf-nat" value="${esc(c.nat||'')}" placeholder="e.g. Philippines"/></div>
      <div class="prof-field editing"><label>Personal email</label><input id="pf-email" type="email" value="${esc(c.email||'')}" placeholder="crew@example.com"/></div>
      <div class="prof-field editing"><label>Home gateway airport</label><input id="pf-airport" value="${esc(c.airport||'')}" placeholder="e.g. MNL"/></div>
      <div class="prof-field editing"><label>Phone number</label><input id="pf-phone" value="${esc(c.phone||'')}" placeholder="+1 (555) 000-0000"/></div>
      <div class="prof-field editing"><label>Date of birth</label><input id="pf-dob" type="date" value="${c.dob||''}"/></div>
    </div>
  </div>
  <div class="prof-section">
    <div class="prof-section-title">Current assignment</div>
    <div class="prof-grid">
      <div class="prof-field"><label>Position</label><div class="pf-val">${pos ? pos.title : '—'}</div></div>
      <div class="prof-field"><label>Ship</label><div class="pf-val">${ship ? ship.name : c.recentShipName || '—'}</div></div>
      <div class="prof-field"><label>Sign on</label><div class="pf-val ${!c.start?'muted':''}">${c.start||'—'}</div></div>
      <div class="prof-field"><label>Sign off</label><div class="pf-val ${!c.end?'muted':''}">${c.end||'—'}</div></div>
      <div class="prof-field"><label>Sign-on reason</label><div class="pf-val muted">${c.signOnReason||'—'}</div></div>
      <div class="prof-field"><label>Sign-off reason</label><div class="pf-val muted">${c.signOffReason||'—'}</div></div>
    </div>
  </div>
  ${c.futureShip||c.futureOn?`
  <div class="prof-section">
    <div class="prof-section-title">Future assignment</div>
    <div class="prof-grid">
      <div class="prof-field"><label>Ship</label><div class="pf-val">${c.futureName||c.futureShip||'—'}</div></div>
      <div class="prof-field"><label>Sign on</label><div class="pf-val">${c.futureOn||'—'}</div></div>
      <div class="prof-field"><label>Sign off</label><div class="pf-val">${c.futureOff||'—'}</div></div>
    </div>
  </div>`:''}
  <div class="prof-section">
    <div class="prof-section-title">Status &amp; flags</div>
    <div class="prof-grid-3">
      <div class="prof-field"><label>Ready to join</label><div class="pf-val" style="color:${c.readyToJoin==='YES'?'var(--green-t)':'var(--text2)'}">${c.readyToJoin||'NO'}</div></div>
      <div class="prof-field"><label>Ship experience</label><div class="pf-val" style="color:${c.hasShipExp==='YES'?'var(--green-t)':'var(--text2)'}">${c.hasShipExp||'NO'}</div></div>
      <div class="prof-field"><label>Class experience</label><div class="pf-val" style="color:${c.hasClassExp==='YES'?'var(--green-t)':'var(--text2)'}">${c.hasClassExp||'NO'}</div></div>
    </div>
  </div>`;
}

function renderProfDocuments(c) {
  return `
  <div class="prof-section">
    <div class="prof-section-title">Official documents</div>
    <div class="prof-grid">
      <div class="prof-field editing"><label>Passport number</label><input id="pf-passportno" value="${esc(c.passportNo||'')}" placeholder="e.g. A12345678"/></div>
      <div class="prof-field editing"><label>Passport expiry</label><input id="pf-passport" type="date" value="${c.passport||''}"/></div>
      <div class="prof-field editing"><label>Medical cert expiry</label><input id="pf-medical" type="date" value="${c.medical||''}"/></div>
      <div class="prof-field editing"><label>Visa / work permit expiry</label><input id="pf-visa" type="date" value="${c.visa||''}"/></div>
      <div class="prof-field editing"><label>Seafarer's book number</label><input id="pf-seamanbook" value="${esc(c.seamanBook||'')}" placeholder="e.g. SB-00123456"/></div>
      <div class="prof-field editing"><label>Seafarer's book expiry</label><input id="pf-seamanbookexp" type="date" value="${c.seamanBookExp||''}"/></div>
    </div>
  </div>
  <div class="prof-section">
    <div class="prof-section-title">Certifications</div>
    <div class="prof-cert-list" id="prof-cert-list-render">
      ${(c.certs||[]).map((cert,i)=>`
        <span class="prof-cert-tag" title="Click ✕ to remove">
          ${esc(cert)}
          <span onclick="removeProfCert(${i})" style="margin-left:4px;cursor:pointer;opacity:.6;font-size:10px;">✕</span>
        </span>`).join('')}
      <span class="prof-cert-add" onclick="addProfCert()">+ Add cert</span>
    </div>
    <div id="prof-cert-add-form" style="display:none;margin-top:8px;">
      <div style="display:flex;gap:8px;align-items:center;">
        <input id="prof-cert-input" placeholder="e.g. STCW Basic Safety" style="flex:1;font-size:12px;padding:6px 10px;"/>
        <button class="btn btn-sm btn-primary" onclick="confirmAddProfCert()">Add</button>
        <button class="btn btn-sm" onclick="document.getElementById('prof-cert-add-form').style.display='none'">✕</button>
      </div>
    </div>
  </div>
  <div class="prof-section">
    <div class="prof-section-title">Training records</div>
    <div class="prof-field editing" style="grid-column:1/-1;">
      <label>Training notes &amp; course history</label>
      <textarea id="pf-training" placeholder="e.g. Completed Rigging Safety refresher Jan 2026, VSAT certification pending...">${esc(c.training||'')}</textarea>
    </div>
  </div>`;
}

function renderProfHistory(c) {
  const entries = [];
  if (c.start && c.end) entries.push({
    ship: c.recentShipName || c.shipName || c.recentShipCode || '—',
    code: c.recentShipCode || '',
    from: c.start, to: c.end,
    reason: c.signOffReason || '',
    current: c.status === 'Onboard',
  });
  if (c.futureOn) entries.push({
    ship: c.futureName || c.futureShip || '—',
    code: c.futureShip || '',
    from: c.futureOn, to: c.futureOff || '',
    reason: '', future: true,
  });
  (c.shipHistory || []).forEach(h => entries.push(h));
  entries.sort((a, b) => b.from.localeCompare(a.from));
  const SHIP_CLASS_MAP = window.SHIP_CLASS_MAP || {};
  return `
  <div class="prof-section">
    <div class="prof-section-title">Assignment timeline</div>
    ${entries.length ? `
    <div class="prof-timeline">
      ${entries.map(e => {
        const col = e.future ? 'var(--blue-t)' : e.current ? 'var(--green-t)' : 'var(--text2)';
        const cls = SHIP_CLASS_MAP[e.code] || '';
        return `<div class="prof-tl-item">
          <div style="position:relative;">
            <div class="prof-tl-dot" style="background:${col};box-shadow:0 0 6px ${col}66;"></div>
            <div class="prof-tl-line"></div>
          </div>
          <div class="prof-tl-body">
            <div class="prof-tl-title">${e.ship} ${cls?`<span class="badge badge-gray" style="font-size:9px;">${cls}</span>`:''} ${e.future?'<span class="badge badge-blue" style="font-size:9px;">Upcoming</span>':e.current?'<span class="badge badge-green" style="font-size:9px;">Current</span>':''}</div>
            <div class="prof-tl-sub">${e.from||'—'} → ${e.to||'Ongoing'} ${e.reason?`· Sign-off: ${e.reason}`:''}</div>
          </div>
        </div>`;
      }).join('')}
    </div>` : `<p style="font-size:12px;color:var(--text2);">No assignment history available from the roster data.</p>`}
  </div>
  <div class="prof-section">
    <div class="prof-section-title">Add historical assignment</div>
    <div class="prof-grid" style="margin-bottom:8px;">
      <div class="prof-field editing"><label>Ship name</label><input id="ph-ship" placeholder="e.g. Celebrity Apex"/></div>
      <div class="prof-field editing"><label>Ship code</label><input id="ph-code" placeholder="e.g. AX" style="max-width:80px;"/></div>
      <div class="prof-field editing"><label>Sign on</label><input id="ph-from" type="date"/></div>
      <div class="prof-field editing"><label>Sign off</label><input id="ph-to" type="date"/></div>
    </div>
    <div class="prof-field editing" style="margin-bottom:8px;">
      <label>Notes</label>
      <input id="ph-note" placeholder="e.g. Production changeover crew"/>
    </div>
    <button class="btn btn-sm btn-primary" onclick="addHistoryEntry()">+ Add entry</button>
  </div>`;
}

function renderProfSkills(c) {
  const skills   = c.skills || {sound:0,lighting:0,rigging:0,video:0,stage:0,leadership:0};
  const skillDefs = [
    {key:'sound',     label:'Sound / AV'},
    {key:'lighting',  label:'Lighting'},
    {key:'rigging',   label:'Rigging / Fly'},
    {key:'video',     label:'Video / Projection'},
    {key:'stage',     label:'Stage management'},
    {key:'leadership',label:'Leadership'},
  ];
  return `
  <div class="prof-section">
    <div class="prof-section-title">Performance rating</div>
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:.5rem;">
      <div class="prof-stars">
        ${[1,2,3,4,5].map(v=>`<span class="prof-star ${(c.rating||0)>=v?'on':''}" data-val="${v}">★</span>`).join('')}
      </div>
      <span style="font-size:12px;color:var(--text2);">${c.rating?`${c.rating}/5`:'Not rated'}</span>
    </div>
  </div>
  <div class="prof-section">
    <div class="prof-section-title">Technical skills</div>
    ${skillDefs.map(sk=>`
      <div class="prof-skill-row">
        <div class="prof-skill-label">${sk.label}</div>
        <div class="prof-skill-bar"><div class="prof-skill-fill" style="width:${(skills[sk.key]||0)*20}%;"></div></div>
        <div class="prof-skill-val">${skills[sk.key]||0}/5</div>
        <div style="display:flex;gap:2px;">
          ${[1,2,3,4,5].map(v=>`<span onclick="setProfSkill('${sk.key}',${v})"
            style="font-size:12px;cursor:pointer;color:${(skills[sk.key]||0)>=v?'var(--highlight)':'var(--border2)'};padding:0 1px;">●</span>`).join('')}
        </div>
      </div>`).join('')}
  </div>
  <div class="prof-section">
    <div class="prof-section-title">Tags &amp; flags</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      ${['High performer','Extension eligible','Flight risk','Medical restriction','Language barrier','Leadership candidate','New joiner','VIP crew'].map(tag=>{
        const on = (c.tags||[]).includes(tag);
        return `<span onclick="toggleProfTag('${tag}')"
          style="padding:4px 11px;border-radius:999px;font-size:11px;font-weight:600;cursor:pointer;transition:all .15s;
                 background:${on?'rgba(255,127,69,.18)':'rgba(255,255,255,.05)'};
                 color:${on?'var(--highlight)':'var(--text2)'};
                 border:.5px solid ${on?'rgba(255,127,69,.4)':'var(--border)'};">${tag}</span>`;
      }).join('')}
    </div>
  </div>`;
}

function renderProfEmergency(c) {
  return `
  <div class="prof-section">
    <div class="prof-section-title">Emergency contact</div>
    <div class="prof-ec-card">
      <div class="prof-grid" style="gap:10px;">
        <div class="prof-field editing" style="background:transparent;border-color:rgba(255,107,122,.2);">
          <label>Contact name</label>
          <input id="pf-ec-name" value="${esc(c.ecName||'')}" placeholder="Full name"/>
        </div>
        <div class="prof-field editing" style="background:transparent;border-color:rgba(255,107,122,.2);">
          <label>Relationship</label>
          <input id="pf-ec-rel" value="${esc(c.ecRel||'')}" placeholder="e.g. Spouse, Parent"/>
        </div>
        <div class="prof-field editing" style="background:transparent;border-color:rgba(255,107,122,.2);">
          <label>Phone number</label>
          <input id="pf-ec-phone" value="${esc(c.ecPhone||'')}" placeholder="+1 (555) 000-0000"/>
        </div>
        <div class="prof-field editing" style="background:transparent;border-color:rgba(255,107,122,.2);">
          <label>Email address</label>
          <input id="pf-ec-email" type="email" value="${esc(c.ecEmail||'')}" placeholder="contact@example.com"/>
        </div>
      </div>
      <div class="prof-field editing" style="margin-top:10px;background:transparent;border-color:rgba(255,107,122,.2);">
        <label>Address</label>
        <textarea id="pf-ec-addr" placeholder="Home address…" style="min-height:55px;">${esc(c.ecAddr||'')}</textarea>
      </div>
    </div>
  </div>
  <div class="prof-section">
    <div class="prof-section-title">Medical information</div>
    <div class="prof-grid">
      <div class="prof-field editing"><label>Blood type</label><input id="pf-blood" value="${esc(c.bloodType||'')}" placeholder="e.g. O+"/></div>
      <div class="prof-field editing"><label>Allergies</label><input id="pf-allergies" value="${esc(c.allergies||'')}" placeholder="e.g. Penicillin"/></div>
    </div>
    <div class="prof-field editing" style="margin-top:10px;">
      <label>Medical notes</label>
      <textarea id="pf-mednotes" placeholder="Any relevant medical conditions, restrictions, or notes for the fleet medical team…" style="min-height:80px;">${esc(c.medNotes||'')}</textarea>
    </div>
  </div>`;
}

function renderProfNotes(c) {
  const comments = (c.comments || []).slice().sort((a, b) => b.id - a.id);
  return `
  <div class="prof-section">
    <div class="prof-section-title">Add note</div>
    <textarea class="prof-notes-input" id="pf-new-comment" placeholder="Add a scheduling note…"></textarea>
    <div style="margin-top:8px;">
      <button class="btn btn-sm btn-primary" onclick="addProfileComment()">+ Save note</button>
    </div>
  </div>
  <div class="prof-section">
    <div class="prof-section-title">Notes log ${comments.length ? `<span style="font-size:11px;color:var(--text2);font-weight:400;text-transform:none;letter-spacing:0;">(${comments.length})</span>` : ''}</div>
    ${comments.length ? comments.map(cm => `
      <div class="prof-comment">
        <div class="prof-comment-meta">
          <span>${esc(cm.author || 'Scheduler')}</span>
          <span class="cm-date">${cm.date}${cm.time ? ' ' + cm.time : ''}</span>
          <button onclick="deleteProfileComment(${cm.id})" style="margin-left:auto;background:none;border:none;color:var(--text2);cursor:pointer;font-size:11px;padding:0;line-height:1;" title="Delete note">✕</button>
        </div>
        <div class="prof-comment-text">${esc(cm.text)}</div>
      </div>`).join('') : `<p style="font-size:12px;color:var(--text2);margin:0;">No notes yet.</p>`}
  </div>`;
}

export function addProfileComment() {
  const c = state.crew.find(x => x.id === _profId);
  if (!c) return;
  const textarea = document.getElementById('pf-new-comment');
  const text = textarea?.value.trim();
  if (!text) { showToast('Enter a note first'); return; }
  if (!c.comments) c.comments = [];
  const now = new Date();
  const author = getSetting('schedulerName') || 'Scheduler';
  c.comments.push({
    id: Date.now(),
    date: now.toISOString().slice(0, 10),
    time: now.toTimeString().slice(0, 5),
    author,
    text,
  });
  upsertCrew(c);
  renderProfileBody();
  showToast('Note saved');
}

export function deleteProfileComment(id) {
  const c = state.crew.find(x => x.id === _profId);
  if (!c) return;
  c.comments = (c.comments || []).filter(cm => cm.id !== id);
  upsertCrew(c);
  renderProfileBody();
}

export function setProfSkill(key, val) {
  const c = state.crew.find(x => x.id === _profId);
  if (!c) return;
  if (!c.skills) c.skills = {};
  c.skills[key] = val;
  renderProfileBody();
}

export function toggleProfTag(tag) {
  const c = state.crew.find(x => x.id === _profId);
  if (!c) return;
  if (!c.tags) c.tags = [];
  const idx = c.tags.indexOf(tag);
  if (idx >= 0) c.tags.splice(idx, 1);
  else c.tags.push(tag);
  renderProfileBody();
}

export function removeProfCert(idx) {
  const c = state.crew.find(x => x.id === _profId);
  if (!c || !c.certs) return;
  c.certs.splice(idx, 1);
  renderProfileBody();
}

export function addProfCert() {
  const form = document.getElementById('prof-cert-add-form');
  if (form) { form.style.display = 'block'; document.getElementById('prof-cert-input')?.focus(); }
}

export function confirmAddProfCert() {
  const input = document.getElementById('prof-cert-input');
  if (!input) return;
  const val = input.value.trim();
  if (!val) return;
  const c = state.crew.find(x => x.id === _profId);
  if (!c) return;
  if (!c.certs) c.certs = [];
  c.certs.push(val);
  renderProfileBody();
}

export function addHistoryEntry() {
  const c = state.crew.find(x => x.id === _profId);
  if (!c) return;
  const ship = document.getElementById('ph-ship')?.value.trim();
  const code = document.getElementById('ph-code')?.value.trim();
  const from = document.getElementById('ph-from')?.value;
  const to   = document.getElementById('ph-to')?.value;
  const note = document.getElementById('ph-note')?.value.trim();
  if (!ship || !from) { showToast('Ship name and sign-on date are required.'); return; }
  if (!c.shipHistory) c.shipHistory = [];
  c.shipHistory.push({ship, code, from, to: to || '', reason: note || ''});
  renderProfileBody();
  showToast('History entry added');
}

export function saveProfile() {
  const c = state.crew.find(x => x.id === _profId);
  if (!c) return;
  const g = id => { const el = document.getElementById(id); return el ? el.value.trim() : null; };
  if (g('pf-name') !== null)          { c.name = g('pf-name') || c.name; }
  if (g('pf-nat') !== null)           c.nat       = g('pf-nat');
  if (g('pf-email') !== null)         c.email     = g('pf-email');
  if (g('pf-airport') !== null)       c.airport   = g('pf-airport');
  if (g('pf-phone') !== null)         c.phone     = g('pf-phone');
  if (g('pf-dob') !== null)           c.dob       = g('pf-dob');
  if (g('pf-passportno') !== null)    c.passportNo = g('pf-passportno');
  if (g('pf-passport') !== null)      c.passport  = g('pf-passport');
  if (g('pf-medical') !== null)       c.medical   = g('pf-medical');
  if (g('pf-visa') !== null)          c.visa      = g('pf-visa');
  if (g('pf-seamanbook') !== null)    c.seamanBook    = g('pf-seamanbook');
  if (g('pf-seamanbookexp') !== null) c.seamanBookExp = g('pf-seamanbookexp');
  if (g('pf-training') !== null)      c.training  = g('pf-training');
  if (g('pf-ec-name') !== null)       c.ecName    = g('pf-ec-name');
  if (g('pf-ec-rel') !== null)        c.ecRel     = g('pf-ec-rel');
  if (g('pf-ec-phone') !== null)      c.ecPhone   = g('pf-ec-phone');
  if (g('pf-ec-email') !== null)      c.ecEmail   = g('pf-ec-email');
  if (g('pf-ec-addr') !== null)       c.ecAddr    = g('pf-ec-addr');
  if (g('pf-blood') !== null)         c.bloodType = g('pf-blood');
  if (g('pf-allergies') !== null)     c.allergies = g('pf-allergies');
  if (g('pf-mednotes') !== null)      c.medNotes  = g('pf-mednotes');
  renderProfilePanel();
  if (document.getElementById('page-crew').classList.contains('active')) renderCrew();
  showToast(`${c.name} — profile saved`);
  upsertCrew(c);
}

export function deleteCrewFromProfile() {
  const c = state.crew.find(x => x.id === _profId);
  if (!c || !confirm(`Remove ${c.name} from the roster?`)) return;
  state.crew = state.crew.filter(x => x.id !== _profId);
  closeProfile();
  if (document.getElementById('page-crew').classList.contains('active')) renderCrew();
  showToast(`${c.name} removed from roster`);
  dbDeleteCrew(_profId);
}

export function triggerPhotoUpload() {
  document.getElementById('prof-photo-input')?.click();
}

export function uploadProfilePhoto(input) {
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const MAX = 240;
      const ratio  = Math.min(MAX / img.width, MAX / img.height, 1);
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width  * ratio);
      canvas.height = Math.round(img.height * ratio);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
      const c = state.crew.find(x => x.id === _profId);
      if (!c) return;
      c.photo = dataUrl;
      upsertCrew(c);
      renderProfilePanel();
      showToast('Photo saved');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
  input.value = '';
}

export function removeProfilePhoto() {
  const c = state.crew.find(x => x.id === _profId);
  if (!c) return;
  delete c.photo;
  upsertCrew(c);
  renderProfilePanel();
  showToast('Photo removed');
}

window.openProfile           = openProfile;
window.closeProfile          = closeProfile;
window.switchProfileTab      = switchProfileTab;
window.saveProfile           = saveProfile;
window.deleteCrewFromProfile = deleteCrewFromProfile;
window.setProfSkill          = setProfSkill;
window.toggleProfTag         = toggleProfTag;
window.removeProfCert        = removeProfCert;
window.addProfCert           = addProfCert;
window.confirmAddProfCert    = confirmAddProfCert;
window.addHistoryEntry       = addHistoryEntry;
window.addProfileComment     = addProfileComment;
window.deleteProfileComment  = deleteProfileComment;
window.triggerPhotoUpload    = triggerPhotoUpload;
window.uploadProfilePhoto    = uploadProfilePhoto;
window.removeProfilePhoto    = removeProfilePhoto;
