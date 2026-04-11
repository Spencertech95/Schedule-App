// ── DATABASE LAYER ────────────────────────────────────────────────────────────
// All Supabase CRUD. Mutations are fire-and-forget (state already updated
// in-memory before the async call, so the UI never waits).
import { supabase } from './supabase.js';
import { state } from './state.js';

function onError(op, err) {
  console.error(`db.${op}:`, err.message);
  // showToast imported lazily to avoid circular deps
  try { window._showToast(`DB error: ${err.message}`, 'error'); } catch(_) {}
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
  if (posR.data?.length)        state.positions  = posR.data.map(fromDbPosition);
  if (compR.data?.length)       state.compliance = compR.data.map(fromDbCompliance);

  if (rotR.data?.length) {
    state.rotations = {};
    rotR.data.forEach(r => {
      if (!state.rotations[r.ship]) state.rotations[r.ship] = [];
      state.rotations[r.ship].push(fromDbRotation(r));
    });
  }

  const nextIdRow = metaR.data?.find(r => r.key === 'nextId');
  if (nextIdRow) state.nextId = parseInt(nextIdRow.value, 10);
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
    id: c.id, name: c.name, nat: c.nat || '', airport: c.airport || '',
    email: c.email || '',
    pos_id: c.posId || null, ship_id: c.shipId || null,
    status: c.status || 'Off',
    sign_on: c.start || c.signOn || '', sign_off: c.end || c.signOff || '',
    contract: c.contract || 6, certs: c.certs || [], notes: c.notes || '',
    passport: c.passport || '', medical: c.medical || '', docs: c.docs || [],
  };
}
function fromDbCrew(r) {
  return {
    id: r.id, name: r.name, nat: r.nat || '', airport: r.airport || '',
    email: r.email || '',
    posId: r.pos_id || null, shipId: r.ship_id || null,
    status: r.status || 'Off',
    start: r.sign_on || '', end: r.sign_off || '',
    contract: r.contract || 6, certs: r.certs || [], notes: r.notes || '',
    passport: r.passport || '', medical: r.medical || '', docs: r.docs || [],
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
    id: o.id, type: o.type || 'Offer', crew_id: o.crewId, ship_id: o.shipId,
    pos_id: o.posId, stage: o.stage || 'draft', start_date: o.startDate || '',
    end_date: o.endDate || '', notes: o.notes || '', history: o.history || [],
  };
}
function fromDbOffer(r) {
  return {
    id: r.id, type: r.type || 'Offer', crewId: r.crew_id, shipId: r.ship_id,
    posId: r.pos_id, stage: r.stage || 'draft', startDate: r.start_date || '',
    endDate: r.end_date || '', notes: r.notes || '', history: r.history || [],
  };
}

function toDbCompliance(c) {
  return { id: c.id, title: c.title, cat: c.cat || '', description: c.desc || '' };
}
function fromDbCompliance(r) {
  return { id: r.id, title: r.title, cat: r.cat || '', desc: r.description || '' };
}
