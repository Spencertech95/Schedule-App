// ── import.js — bulk roster import (XLSX) ─────────────────────────────────────
import { state, uid } from './state.js';
import { showToast } from './utils.js';
import { replaceAllCrew, upsertCrew } from './db.js';

let _importParsed = [];
let _importDiff   = null;
let _diffTab      = 'new';

// Column name mapping (handles minor variations in export format)
function colVal(row, ...keys) {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== '') return String(row[k]).trim();
  }
  return '';
}

function fmtDate(v) {
  if (!v) return '';
  const s = String(v).trim();
  const m = s.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
  const m2 = s.match(/(\d{1,2})[\/](\d{1,2})[\/](\d{4})/);
  if (m2) return `${m2[3]}-${m2[1].padStart(2,'0')}-${m2[2].padStart(2,'0')}`;
  return s;
}

function parseImportRow(row) {
  const POS_ORDER         = window.POS_ORDER || ['SPM','VPM','ETDC','EOF','EOS','EOL','ESS','EOMC'];
  const SHIP_CODES_ORDERED = window.SHIP_CODES_ORDERED || ['ML','IN','SM','CS','SL','EQ','EC','SI','RF','EG','AX','BY','AT','XC'];

  const id         = parseInt(colVal(row,'Employee ID','ID','EmployeeID')) || 0;
  const name       = colVal(row,'Employee Name','Name','EmployeeName');
  const shipCode   = colVal(row,'Ship Code','ShipCode','Recent Ship Code');
  const shipName   = colVal(row,'Ship Name','ShipName','Recent Assign Ship');
  const recentShipCode = colVal(row,'Recent Ship Code','RecentShipCode','Ship Code');
  const recentShipName = colVal(row,'Recent Assign Ship','RecentAssignShip','Ship Name');
  const abbr       = colVal(row,'Job Code','JobCode','Job Code Type','JobCodeType');
  const posTitle   = colVal(row,'Job Code Description','JobCodeDescription','Job Code Type Description');
  const status     = colVal(row,'Crew Status','CrewStatus','Status').toLowerCase().includes('onboard') ? 'Onboard' : 'Offboard';
  const category   = colVal(row,'Category','Crew Category','CrewCategory');
  const nat        = colVal(row,'Permanent Address Country Name','Nationality','Country');
  const airport    = colVal(row,'Gateway','Airport');
  const start      = fmtDate(colVal(row,'Recent Assign Sign On','SignOn','Start'));
  const end        = fmtDate(colVal(row,'Recent Assign Sign Off','SignOff','End'));
  const futureOn   = fmtDate(colVal(row,'Future Assign On','FutureOn'));
  const futureOff  = fmtDate(colVal(row,'Future Assign Off','FutureOff'));
  const futureShip = colVal(row,'Future Ship Code','FutureShipCode');
  const futureName = colVal(row,'Future Ship Name','FutureShipName','Future Assign Ship');
  const signOnReason  = colVal(row,'Recent Sign On Reason Code','SignOnReason');
  const signOffReason = colVal(row,'Recent Sign Off Reason Code','SignOffReason');
  const tenure     = parseFloat(colVal(row,'Tenure')) || 0;
  const vacDays    = parseInt(colVal(row,'Vacation Days Left','VacDays')) || 0;
  const daysOffboard = parseFloat(colVal(row,'Number of Days Last Sign Off','DaysOffboard')) || 0;
  const readyToJoin = colVal(row,'Is Ready To Join?','ReadyToJoin') || 'NO';
  const hasShipExp  = colVal(row,'Has Experience in Ship?','HasShipExp') || 'NO';
  const hasClassExp = colVal(row,'Has Experience In Class?','HasClassExp') || 'NO';

  const posMatch = POS_ORDER.indexOf(abbr);
  const posId    = posMatch >= 0 ? posMatch + 1 : 0;
  const shipIdx  = SHIP_CODES_ORDERED.indexOf(recentShipCode || shipCode);
  const shipId   = shipIdx >= 0 ? shipIdx + 1 : 0;

  return {
    id, name, nat, posId, abbr, posTitle,
    shipId, shipCode: recentShipCode || shipCode, shipName: recentShipName || shipName,
    recentShipCode: recentShipCode || shipCode, recentShipName: recentShipName || shipName,
    status, category, start, end,
    futureOn, futureOff, futureShip, futureName,
    airport, signOnReason, signOffReason,
    tenure, vacDays, daysOffboard, readyToJoin, hasShipExp, hasClassExp,
    passport:'', medical:'', certs:[], notes:'', email:'',
  };
}

export function openImport() {
  document.getElementById('import-overlay').classList.remove('hidden');
  importReset();
}

export function closeImport() {
  document.getElementById('import-overlay').classList.add('hidden');
}

export function closeImportIfOutside(e) {
  if (e.target === document.getElementById('import-overlay')) closeImport();
}

export function importReset() {
  _importParsed = [];
  _importDiff   = null;
  document.getElementById('import-step-upload').style.display  = 'block';
  document.getElementById('import-step-preview').style.display = 'none';
  document.getElementById('import-back-btn').style.display     = 'none';
  document.getElementById('import-progress').style.display     = 'none';
  document.getElementById('import-progress-fill').style.width  = '0%';
  document.getElementById('import-parse-msg').textContent      = '';
  document.getElementById('import-action-label').textContent   = '';
  setImportConfirm(false);
  document.getElementById('import-file-input').value = '';
}

export function importDragOver(e) {
  e.preventDefault();
  document.getElementById('import-drop').classList.add('drag-over');
}

export function importDragLeave() {
  document.getElementById('import-drop').classList.remove('drag-over');
}

export function importDrop(e) {
  e.preventDefault();
  document.getElementById('import-drop').classList.remove('drag-over');
  const f = e.dataTransfer.files[0];
  if (f) processImportFile(f);
}

export function importFileSelected(inp) {
  if (inp.files[0]) processImportFile(inp.files[0]);
}

function setImportConfirm(on) {
  const btn = document.getElementById('import-confirm-btn');
  btn.disabled      = !on;
  btn.style.opacity = on ? '1' : '.4';
  btn.style.cursor  = on ? 'pointer' : 'not-allowed';
}

function importSetProgress(pct, msg) {
  const bar = document.getElementById('import-progress');
  bar.style.display = 'block';
  document.getElementById('import-progress-fill').style.width = pct + '%';
  document.getElementById('import-parse-msg').textContent     = msg || '';
}

function processImportFile(file) {
  if (!file.name.match(/\.xlsx?$/i)) {
    document.getElementById('import-parse-msg').textContent = '❌ Please upload an .xlsx file.';
    return;
  }
  importSetProgress(10, 'Reading file…');
  const reader = new FileReader();
  reader.onload = e => {
    try {
      importSetProgress(30, 'Parsing Excel…');
      const wb = XLSX.read(e.target.result, {type:'array', cellDates:true});
      const sheetName = wb.SheetNames.find(n => n.toLowerCase().includes('export')) || wb.SheetNames[0];
      const ws  = wb.Sheets[sheetName];
      const raw = XLSX.utils.sheet_to_json(ws, {defval:'', raw:false});

      importSetProgress(60, 'Processing rows…');

      const parsed = [];
      let skipped = 0;
      raw.forEach(row => {
        const id   = parseInt(String(row['Employee ID'] || row['ID'] || '').trim()) || 0;
        const name = String(row['Employee Name'] || row['Name'] || '').trim();
        if (!id || !name) { skipped++; return; }
        parsed.push(parseImportRow(row));
      });

      if (!parsed.length) {
        importSetProgress(0, '');
        document.getElementById('import-parse-msg').textContent = `❌ No valid crew rows found. Check the file has an "Export" sheet with Employee ID and Employee Name columns.`;
        return;
      }

      _importParsed = parsed;
      importSetProgress(85, 'Computing diff…');
      buildImportDiff(parsed);
      importSetProgress(100, 'Ready.');
      setTimeout(() => {
        document.getElementById('import-progress').style.display = 'none';
        showImportPreview();
      }, 400);

    } catch (err) {
      importSetProgress(0, '');
      document.getElementById('import-parse-msg').textContent = '❌ Error parsing file: ' + err.message;
      console.error(err);
    }
  };
  reader.readAsArrayBuffer(file);
}

function buildImportDiff(incoming) {
  const existingById = new Map(state.crew.map(c => [c.id, c]));
  const incomingIds  = new Set(incoming.map(c => c.id));
  const newCrew = [], updated = [], unchanged = [];

  incoming.forEach(nc => {
    const ex = existingById.get(nc.id);
    if (!ex) {
      newCrew.push({incoming:nc, changes:[]});
    } else {
      const changes = [];
      const fields = [
        ['status','Status'],['end','Sign off'],['start','Sign on'],
        ['recentShipCode','Ship'],['abbr','Position'],
        ['futureShip','Future ship'],['futureOn','Future sign on'],
        ['category','Category'],['signOffReason','Sign off reason'],
      ];
      fields.forEach(([key, label]) => {
        const a = String(ex[key] || '').trim();
        const b = String(nc[key] || '').trim();
        if (a !== b) changes.push({field:label, from:a||'—', to:b||'—'});
      });
      if (changes.length) updated.push({existing:ex, incoming:nc, changes});
      else unchanged.push({existing:ex, incoming:nc, changes:[]});
    }
  });

  const removed = state.crew.filter(c => !incomingIds.has(c.id));
  _importDiff = {newCrew, updated, unchanged, removed};
}

function showImportPreview() {
  const {newCrew, updated, unchanged, removed} = _importDiff;

  document.getElementById('import-step-upload').style.display  = 'none';
  document.getElementById('import-step-preview').style.display = 'block';
  document.getElementById('import-back-btn').style.display     = 'inline-flex';
  setImportConfirm(true);

  document.getElementById('import-diff-summary').innerHTML = `
    <div class="co-stat" style="border-color:rgba(61,232,160,.25);cursor:default">
      <div class="co-stat-label" style="color:var(--green-t);">New crew</div>
      <div class="co-stat-val"  style="color:var(--green-t);">${newCrew.length}</div>
    </div>
    <div class="co-stat" style="border-color:rgba(77,168,247,.25);cursor:default">
      <div class="co-stat-label" style="color:var(--blue-t);">Updated</div>
      <div class="co-stat-val"  style="color:var(--blue-t);">${updated.length}</div>
    </div>
    <div class="co-stat" style="cursor:default">
      <div class="co-stat-label">Unchanged</div>
      <div class="co-stat-val">${unchanged.length}</div>
    </div>
    <div class="co-stat" style="border-color:rgba(255,107,122,.2);cursor:default">
      <div class="co-stat-label" style="color:var(--red-t);">Not in file</div>
      <div class="co-stat-val"  style="color:var(--red-t);">${removed.length}</div>
    </div>
    <div class="co-stat" style="cursor:default">
      <div class="co-stat-label">Total in file</div>
      <div class="co-stat-val">${_importParsed.length}</div>
    </div>`;

  document.getElementById('diff-count-new').textContent       = newCrew.length;
  document.getElementById('diff-count-updated').textContent   = updated.length;
  document.getElementById('diff-count-unchanged').textContent = unchanged.length;
  document.getElementById('diff-count-removed').textContent   = removed.length;

  document.getElementById('import-action-label').textContent =
    `${newCrew.length} new · ${updated.length} updated · ${removed.length} not in file`;

  showDiffTab('new', document.getElementById('diff-tab-new'));
}

export function showDiffTab(tab, btn) {
  _diffTab = tab;
  ['new','updated','unchanged','removed'].forEach(t => {
    document.getElementById(`diff-tab-${t}`)?.classList.toggle('active', t === tab);
  });
  renderDiffTable(tab);
}

function renderDiffTable(tab) {
  const {newCrew, updated, unchanged, removed} = _importDiff;
  const tbody = document.getElementById('import-diff-tbody');
  let rows = [];

  if (tab === 'new') {
    rows = newCrew.map(({incoming:c}) => `
      <tr>
        <td style="padding:7px 10px;color:var(--text2);">${c.id}</td>
        <td style="padding:7px 10px;font-weight:600;">${c.name}</td>
        <td style="padding:7px 10px;"><span class="badge badge-gray" style="font-size:9px;">${c.abbr||'—'}</span></td>
        <td style="padding:7px 10px;">${c.recentShipCode||'—'}</td>
        <td style="padding:7px 10px;"><span class="badge ${c.status==='Onboard'?'badge-green':'badge-amber'}" style="font-size:9px;">${c.status}</span></td>
        <td style="padding:7px 10px;font-size:11px;color:var(--text2);">${c.end||'—'}</td>
        <td style="padding:7px 10px;"><span style="color:var(--green-t);font-size:10px;font-weight:600;">✦ New</span></td>
      </tr>`);
  } else if (tab === 'updated') {
    rows = updated.map(({incoming:c, changes}) => `
      <tr>
        <td style="padding:7px 10px;color:var(--text2);">${c.id}</td>
        <td style="padding:7px 10px;font-weight:600;">${c.name}</td>
        <td style="padding:7px 10px;"><span class="badge badge-gray" style="font-size:9px;">${c.abbr||'—'}</span></td>
        <td style="padding:7px 10px;">${c.recentShipCode||'—'}</td>
        <td style="padding:7px 10px;"><span class="badge ${c.status==='Onboard'?'badge-green':'badge-amber'}" style="font-size:9px;">${c.status}</span></td>
        <td style="padding:7px 10px;font-size:11px;color:var(--text2);">${c.end||'—'}</td>
        <td style="padding:7px 10px;">
          ${changes.map(ch => `<div style="font-size:10px;line-height:1.6;"><span style="color:var(--text2);">${ch.field}:</span> <span style="color:var(--red-t);text-decoration:line-through;">${ch.from}</span> → <span style="color:var(--green-t);">${ch.to}</span></div>`).join('')}
        </td>
      </tr>`);
  } else if (tab === 'unchanged') {
    rows = unchanged.map(({incoming:c}) => `
      <tr>
        <td style="padding:7px 10px;color:var(--text2);">${c.id}</td>
        <td style="padding:7px 10px;">${c.name}</td>
        <td style="padding:7px 10px;"><span class="badge badge-gray" style="font-size:9px;">${c.abbr||'—'}</span></td>
        <td style="padding:7px 10px;">${c.recentShipCode||'—'}</td>
        <td style="padding:7px 10px;"><span class="badge ${c.status==='Onboard'?'badge-green':'badge-amber'}" style="font-size:9px;">${c.status}</span></td>
        <td style="padding:7px 10px;font-size:11px;color:var(--text2);">${c.end||'—'}</td>
        <td style="padding:7px 10px;color:var(--text2);font-size:10px;">No changes</td>
      </tr>`);
  } else {
    rows = removed.map(c => `
      <tr>
        <td style="padding:7px 10px;color:var(--text2);">${c.id}</td>
        <td style="padding:7px 10px;opacity:.6;">${c.name}</td>
        <td style="padding:7px 10px;"><span class="badge badge-gray" style="font-size:9px;">${c.abbr||'—'}</span></td>
        <td style="padding:7px 10px;opacity:.6;">${c.recentShipCode||'—'}</td>
        <td style="padding:7px 10px;opacity:.6;">${c.status}</td>
        <td style="padding:7px 10px;font-size:11px;color:var(--text2);">${c.end||'—'}</td>
        <td style="padding:7px 10px;"><span style="color:var(--red-t);font-size:10px;">Not in upload</span></td>
      </tr>`);
  }

  tbody.innerHTML = rows.length
    ? rows.join('')
    : `<tr><td colspan="7" style="padding:1.5rem;text-align:center;color:var(--text2);font-style:italic;">None in this category</td></tr>`;

  document.getElementById('import-diff-note').textContent =
    tab === 'removed'
      ? 'In Merge mode these crew are kept as-is. In Full Replace mode they will be removed.'
      : '';
}

export function importConfirm() {
  if (!_importDiff) return;
  const mode = document.querySelector('input[name="import-mode"]:checked')?.value || 'merge';
  const {newCrew, updated, unchanged, removed} = _importDiff;

  let finalRoster;
  if (mode === 'replace') {
    const emailMap = new Map(state.crew.filter(c => c.email).map(c => [c.id, c.email]));
    finalRoster = _importParsed.map(c => ({
      ...c,
      email: emailMap.get(c.id) || c.email || '',
    }));
  } else {
    // Merge mode — update existing in place, add new
    updated.forEach(({existing, incoming}) => {
      Object.assign(existing, {
        ...incoming,
        email:    existing.email    || incoming.email    || '',
        notes:    existing.notes    || incoming.notes    || '',
        certs:    existing.certs?.length ? existing.certs : incoming.certs,
        passport: existing.passport || incoming.passport || '',
        medical:  existing.medical  || incoming.medical  || '',
      });
    });

    const addedCrew = newCrew.map(({incoming}) => ({
      ...incoming,
      id: incoming.id || uid(),
    }));

    finalRoster = [...state.crew, ...addedCrew];
    const seen = new Set();
    finalRoster = finalRoster.filter(c => { if (seen.has(c.id)) return false; seen.add(c.id); return true; });
  }

  state.crew = finalRoster;
  if (state.crew.length > state.nextId) state.nextId = Math.max(...state.crew.map(c => c.id)) + 1;

  // Persist to Supabase
  if (mode === 'replace') {
    replaceAllCrew(finalRoster);
  } else {
    // Upsert only changed/new crew
    updated.forEach(({existing}) => upsertCrew(existing));
    newCrew.forEach(({incoming}) => upsertCrew({...incoming, id: incoming.id || uid()}));
  }

  const now2 = new Date().toLocaleString();
  const label = document.getElementById('last-import-label');
  if (label) label.textContent = `Last import: ${now2}`;

  closeImport();

  // Refresh active page
  const activePage = document.querySelector('.page.active')?.id?.replace('page-','');
  if (activePage === 'crew')      { window.populateFilters?.(); window.renderCrew?.(); }
  else if (activePage === 'dashboard') { window.initDashboard?.(); }
  else if (activePage === 'overview')  { window.renderOverview?.(); }

  const added = newCrew.length, upd = updated.length;
  const msg = mode === 'replace'
    ? `✓ Full replace — ${finalRoster.length} crew loaded`
    : `✓ Merged — ${added} added, ${upd} updated, ${removed.length} kept`;
  showToast(msg, 4000);
}

window.openImport          = openImport;
window.closeImport         = closeImport;
window.closeImportIfOutside = closeImportIfOutside;
window.importReset         = importReset;
window.importDragOver      = importDragOver;
window.importDragLeave     = importDragLeave;
window.importDrop          = importDrop;
window.importFileSelected  = importFileSelected;
window.showDiffTab         = showDiffTab;
window.importConfirm       = importConfirm;
