// ── DATABASE LAYER ────────────────────────────────────────────────────────────
// All Supabase CRUD. Mutations are fire-and-forget (state already updated
// in-memory before the async call, so the UI never waits).
import { supabase } from './supabase.js';
import { state } from './state.js';
import { POSITIONS } from './data.js';

function onError(op, err) {
  const msg = `DB error [${op}]: ${err.message}`;
  console.error(msg, err);
  // Show for 8 seconds with a numeric duration so the toast actually stays visible
  try { window._showToast(msg, 8000); } catch(_) {}
}

// ── LOAD ALL ─────────────────────────────────────────────────────────────────
export async function loadAll() {
  const [crewR, offersR, rotR, shipsR, posR, compR, metaR] = await Promise.all([
    supabase.from('crew').select('*'),
    supabase.from('offers').select('*'),
    supabase.from('rotations').select('*'),
    supabase.from('ships').select('*'),
    supabase.from('positions').select('*'),
    supabase.from('compliance').select('*'),
    supabase.from('app_meta').select('*'),
  ]);

  if (crewR.data?.length)       state.crew       = crewR.data.map(fromDbCrew);
  if (offersR.data?.length)     state.offers     = offersR.data.map(fromDbOffer);
  if (shipsR.data?.length)      state.ships      = shipsR.data.map(fromDbShip);
  if (posR.data?.length) {
    state.positions = posR.data.map(fromDbPosition);
    // Ensure all 7 canonical positions are present — re-seed any that are missing
    POSITIONS.forEach(def => {
      if (!state.positions.find(p => p.id === def.id)) {
        const restored = { ...def };
        state.positions.push(restored);
        upsertPosition(restored);
      }
    });
    state.positions.sort((a, b) => a.id - b.id);
  } else {
    // Nothing in DB — seed all defaults
    POSITIONS.forEach(def => upsertPosition({ ...def }));
  }
  if (compR.data?.length)       state.compliance = compR.data.map(fromDbCompliance);

  if (rotR.data?.length) {
    state.rotations = {};
    rotR.data.forEach(r => {
      if (!state.rotations[r.ship]) state.rotations[r.ship] = [];
      state.rotations[r.ship].push(fromDbRotation(r));
    });
  }

  const nextIdRow   = metaR.data?.find(r => r.key === 'nextId');
  if (nextIdRow) state.nextId = parseInt(nextIdRow.value, 10);

  const manningRow  = metaR.data?.find(r => r.key === 'manning');
  if (manningRow) {
    try {
      const saved = JSON.parse(manningRow.value);
      ['Millennium','Solstice','Edge'].forEach(cls => {
        if (saved[cls]) {
          Object.entries(saved[cls]).forEach(([k, v]) => {
            state.manning[cls][parseInt(k)] = parseInt(v);
          });
        }
      });
    } catch(e) { console.warn('Failed to parse manning data', e); }
  }

  const shipManningRow = metaR.data?.find(r => r.key === 'shipManning');
  if (shipManningRow) {
    try {
      const saved = JSON.parse(shipManningRow.value);
      Object.entries(saved).forEach(([code, posMap]) => {
        state.shipManning[code] = {};
        Object.entries(posMap).forEach(([k, v]) => {
          state.shipManning[code][parseInt(k)] = parseInt(v);
        });
      });
    } catch(e) { console.warn('Failed to parse shipManning data', e); }
  }
}

// ── CREW ─────────────────────────────────────────────────────────────────────
export async function upsertCrew(c) {
  const { error } = await supabase.from('crew').upsert(toDbCrew(c));
  if (error) onError('upsertCrew', error);
}
export async function dbDeleteCrew(id) {
  const { error } = await supabase.from('crew').delete().eq('id', id);
  if (error) onError('deleteCrew', error);
}

// ── SHIPS ─────────────────────────────────────────────────────────────────────
export async function upsertShip(s) {
  const { error } = await supabase.from('ships').upsert(toDbShip(s));
  if (error) onError('upsertShip', error);
}
export async function dbDeleteShip(id) {
  const { error } = await supabase.from('ships').delete().eq('id', id);
  if (error) onError('deleteShip', error);
}

// ── POSITIONS ─────────────────────────────────────────────────────────────────
export async function upsertPosition(p) {
  const { error } = await supabase.from('positions').upsert(toDbPosition(p));
  if (error) onError('upsertPosition', error);
}
export async function dbDeletePosition(id) {
  const { error } = await supabase.from('positions').delete().eq('id', id);
  if (error) onError('deletePosition', error);
}

// ── ROTATIONS ─────────────────────────────────────────────────────────────────
// Rotations are stored per-ship. When the ship's rotation array changes we
// delete all rows for that ship and re-insert.
export async function saveRotations(ship) {
  await supabase.from('rotations').delete().eq('ship', ship);
  const entries = (state.rotations[ship] || []).map(e => toDbRotation(ship, e));
  if (entries.length) {
    const { error } = await supabase.from('rotations').insert(entries);
    if (error) onError('saveRotations', error);
  }
}

// ── OFFERS ────────────────────────────────────────────────────────────────────
export async function upsertOffer(o) {
  const { error } = await supabase.from('offers').upsert(toDbOffer(o));
  if (error) onError('upsertOffer', error);
  return { error };
}
export async function dbDeleteOffer(id) {
  const { error } = await supabase.from('offers').delete().eq('id', id);
  if (error) onError('deleteOffer', error);
}

// ── COMPLIANCE ────────────────────────────────────────────────────────────────
export async function upsertCompliance(c) {
  const { error } = await supabase.from('compliance').upsert(toDbCompliance(c));
  if (error) onError('upsertCompliance', error);
}

// ── META ──────────────────────────────────────────────────────────────────────
export async function saveNextId() {
  const { error } = await supabase.from('app_meta')
    .upsert({ key: 'nextId', value: String(state.nextId) });
  if (error) onError('saveNextId', error);
}

export async function saveManning() {
  const { error } = await supabase.from('app_meta')
    .upsert({ key: 'manning', value: JSON.stringify(state.manning) });
  if (error) onError('saveManning', error);
}

export async function saveShipManning() {
  const { error } = await supabase.from('app_meta')
    .upsert({ key: 'shipManning', value: JSON.stringify(state.shipManning) });
  if (error) onError('saveShipManning', error);
}

// ── BULK CREW REPLACE (import) ────────────────────────────────────────────────
// Returns { ok: true } or { ok: false, message }
export async function replaceAllCrew(crewArray) {
  // Delete all existing rows
  const { error: delErr } = await supabase.from('crew').delete().neq('id', -1);
  if (delErr) { onError('replaceAllCrew.delete', delErr); return { ok: false, message: delErr.message }; }

  // Insert in batches of 50 to avoid request size limits
  const BATCH = 50;
  for (let i = 0; i < crewArray.length; i += BATCH) {
    const rows = crewArray.slice(i, i + BATCH).map(toDbCrew);
    const { error } = await supabase.from('crew').insert(rows);
    if (error) { onError('replaceAllCrew.insert', error); return { ok: false, message: error.message }; }
  }
  return { ok: true };
}

// ── BULK CREW UPSERT (merge import) ──────────────────────────────────────────
export async function upsertManyCrew(crewArray) {
  const BATCH = 50;
  for (let i = 0; i < crewArray.length; i += BATCH) {
    const rows = crewArray.slice(i, i + BATCH).map(toDbCrew);
    const { error } = await supabase.from('crew').upsert(rows);
    if (error) { onError('upsertManyCrew', error); return { ok: false, message: error.message }; }
  }
  return { ok: true };
}

// ── FIELD MAPPERS ─────────────────────────────────────────────────────────────
function toDbCrew(c) {
  return {
    // core
    id: c.id, name: c.name, nat: c.nat || '', airport: c.airport || '',
    email: c.email || '', phone: c.phone || '',
    pos_id: c.posId || null, ship_id: c.shipId || null,
    status: c.status || 'Off',
    sign_on: c.start || c.signOn || '', sign_off: c.end || c.signOff || '',
    contract: c.contract || 6, certs: c.certs || [], notes: c.notes || '',
    // documents
    passport: c.passport || '', passport_no: c.passportNo || '',
    medical: c.medical || '', visa: c.visa || '',
    seaman_book: c.seamanBook || '', seaman_book_exp: c.seamanBookExp || '',
    docs: c.docs || [],
    // personal / medical
    dob: c.dob || '', blood_type: c.bloodType || '',
    allergies: c.allergies || '', med_notes: c.medNotes || '',
    // emergency contact
    ec_name: c.ecName || '', ec_rel: c.ecRel || '',
    ec_phone: c.ecPhone || '', ec_email: c.ecEmail || '', ec_addr: c.ecAddr || '',
    // skills & profile
    training: c.training || '', rating: c.rating || 0, skills: c.skills || {},
    // import / roster data
    abbr: c.abbr || '', ship_code: c.shipCode || c.recentShipCode || '',
    tenure: c.tenure || 0, category: c.category || '',
    future_ship: c.futureShip || '', future_on: c.futureOn || '',
    future_off: c.futureOff || '', future_name: c.futureName || '',
    sign_on_reason: c.signOnReason || '', sign_off_reason: c.signOffReason || '',
    ship_history: c.shipHistory || [],
  };
}
function fromDbCrew(r) {
  return {
    // core
    id: r.id, name: r.name, nat: r.nat || '', airport: r.airport || '',
    email: r.email || '', phone: r.phone || '',
    posId: r.pos_id || null, shipId: r.ship_id || null,
    status: r.status || 'Off',
    start: r.sign_on || '', end: r.sign_off || '',
    contract: r.contract || 6, certs: r.certs || [], notes: r.notes || '',
    // documents
    passport: r.passport || '', passportNo: r.passport_no || '',
    medical: r.medical || '', visa: r.visa || '',
    seamanBook: r.seaman_book || '', seamanBookExp: r.seaman_book_exp || '',
    docs: r.docs || [],
    // personal / medical
    dob: r.dob || '', bloodType: r.blood_type || '',
    allergies: r.allergies || '', medNotes: r.med_notes || '',
    // emergency contact
    ecName: r.ec_name || '', ecRel: r.ec_rel || '',
    ecPhone: r.ec_phone || '', ecEmail: r.ec_email || '', ecAddr: r.ec_addr || '',
    // skills & profile
    training: r.training || '', rating: r.rating || 0, skills: r.skills || {},
    // import / roster data
    abbr: r.abbr || '', shipCode: r.ship_code || '', recentShipCode: r.ship_code || '',
    tenure: r.tenure || 0, category: r.category || '',
    futureShip: r.future_ship || '', futureOn: r.future_on || '',
    futureOff: r.future_off || '', futureName: r.future_name || '',
    signOnReason: r.sign_on_reason || '', signOffReason: r.sign_off_reason || '',
    shipHistory: r.ship_history || [],
  };
}

function toDbShip(s) {
  return {
    id: s.id, name: s.name, ship_class: s.shipClass || '', imo: s.imo || '',
    port: s.port || '', gt: s.gt || '', status: s.status || 'Active', notes: s.notes || '',
  };
}
function fromDbShip(r) {
  return {
    id: r.id, name: r.name, shipClass: r.ship_class || '', imo: r.imo || '',
    port: r.port || '', gt: r.gt || '', status: r.status || 'Active', notes: r.notes || '',
  };
}

function toDbPosition(p) {
  return {
    id: p.id, title: p.title, abbr: p.abbr || '', rank: p.rank || '',
    contract: p.contract || 6, handover: p.handover || 4,
    certs: p.certs || [], description: p.desc || '',
  };
}
function fromDbPosition(r) {
  return {
    id: r.id, title: r.title, abbr: r.abbr || '', rank: r.rank || '',
    contract: r.contract || 6, handover: r.handover || 4,
    certs: r.certs || [], desc: r.description || '',
  };
}

function toDbRotation(ship, e) {
  return {
    ship, pos_id: e.posId, type: e.type || '', date: e.date || '',
    port: e.port || '', crew: e.crew || '', notes: e.notes || '',
  };
}
function fromDbRotation(r) {
  return {
    posId: r.pos_id, type: r.type || '', date: r.date || '',
    port: r.port || '', crew: r.crew || '', notes: r.notes || '',
  };
}

function toDbOffer(o) {
  return {
    id: o.id,
    type: o.type || 'Offer',
    crew_id: o.crewId,
    ship: o.ship || '',
    stage: o.stage || 'Draft',
    start_date: o.dateFrom || o.startDate || '',
    end_date: o.dateTo || o.endDate || '',
    crew_name: o.crewName || '',
    subtype: o.subtype || '',
    approver: o.approver || '',
    created: o.created || '',
    sent_date: o.sentDate || '',
    terminal_date: o.terminalDate || '',
    e1_uploaded: o.e1Uploaded || false,
    e1_uploaded_date: o.e1UploadedDate || '',
    ship_options: o.shipOptions || null,
    ship_option_details: o.shipOptionDetails || null,
    notes: o.notes || '',
    history: o.history || [],
  };
}
function fromDbOffer(r) {
  return {
    id: r.id,
    type: r.type || 'Offer',
    crewId: r.crew_id,
    ship: r.ship || '',
    stage: r.stage || 'Draft',
    dateFrom: r.start_date || '',
    dateTo: r.end_date || '',
    crewName: r.crew_name || '',
    subtype: r.subtype || '',
    approver: r.approver || '',
    created: r.created || '',
    sentDate: r.sent_date || '',
    terminalDate: r.terminal_date || '',
    e1Uploaded: r.e1_uploaded || false,
    e1UploadedDate: r.e1_uploaded_date || '',
    shipOptions: r.ship_options || null,
    shipOptionDetails: r.ship_option_details || null,
    notes: r.notes || '',
    history: r.history || [],
  };
}

function toDbCompliance(c) {
  return { id: c.id, title: c.title, cat: c.cat || '', description: c.desc || '' };
}
function fromDbCompliance(r) {
  return { id: r.id, title: r.title, cat: r.cat || '', desc: r.description || '' };
}
