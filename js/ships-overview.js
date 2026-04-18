// ── ships-overview.js — All Ships Gantt chart ───────────────────────────────
import { state } from './state.js';
import { SHIP_CODES_ORDERED, SHIP_DISPLAY } from './ship.js';

const POS_ABBRS = ['SPM','VPM','ETDC','EOF','EOS','EOL','ESS','EOMC'];
const MS_DAY    = 86_400_000;

// ── View configs ──────────────────────────────────────────────────────────────
const VIEWS = {
  day: {
    totalDays: 30,
    pxPerDay:  40,
    tickEvery: 1,           // days
    tickFmt: d => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
  },
  week: {
    totalDays: 91,
    pxPerDay:  80 / 7,      // ~11.4 px/day
    tickEvery: 7,
    tickFmt: d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  },
  month: {
    totalDays: 365,
    pxPerDay:  3.5,
    tickEvery: 'month',
    tickFmt: d => d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
  },
  quarter: {
    totalDays: 730,
    pxPerDay:  1.9,
    tickEvery: 'quarter',
    tickFmt: d => `Q${Math.floor(d.getMonth() / 3) + 1} \u2019${String(d.getFullYear()).slice(2)}`,
  },
};

let _view    = 'month';
let _startMs = 0;

// ── Helpers ───────────────────────────────────────────────────────────────────
function today0() {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime();
}

function dateMs(s) {
  return s ? new Date(s + 'T00:00:00').getTime() : null;
}

function barCls(sc) {
  const c = SHIP_DISPLAY[sc]?.cls;
  if (c === 'Millennium') return 'gantt-mil';
  if (c === 'Solstice')   return 'gantt-sol';
  return 'gantt-edge';
}

// Returns the first tick >= startMs aligned to natural boundary
function firstTick(startMs, view) {
  const d = new Date(startMs);
  const ev = VIEWS[view].tickEvery;
  if (typeof ev === 'number') {
    if (ev === 7) {
      const day = d.getDay();
      const toMon = day === 0 ? 1 : (8 - day) % 7 || 7;
      return startMs + toMon * MS_DAY;
    }
    return startMs;
  }
  if (ev === 'month') {
    d.setDate(1);
    if (d.getTime() < startMs) d.setMonth(d.getMonth() + 1);
    return d.getTime();
  }
  // quarter
  const qm = Math.floor(d.getMonth() / 3) * 3;
  d.setMonth(qm); d.setDate(1);
  if (d.getTime() < startMs) d.setMonth(d.getMonth() + 3);
  return d.getTime();
}

function nextTick(ms, view) {
  const ev = VIEWS[view].tickEvery;
  if (typeof ev === 'number') return ms + ev * MS_DAY;
  const d = new Date(ms);
  if (ev === 'month')   { d.setMonth(d.getMonth() + 1);   return d.getTime(); }
  /* quarter */           d.setMonth(d.getMonth() + 3);   return d.getTime();
}

function tickWidthPx(tickMs, view) {
  return (nextTick(tickMs, view) - tickMs) / MS_DAY * VIEWS[view].pxPerDay;
}

function px(ms, view) {
  return (ms - _startMs) / MS_DAY * VIEWS[view].pxPerDay;
}

// ── Data ──────────────────────────────────────────────────────────────────────
function buildRows() {
  // Build posId → abbr map so manually-added crew (who lack c.abbr) still resolve
  const posIdToAbbr = {};
  for (const p of state.positions) posIdToAbbr[p.id] = p.abbr;

  // Build shipId → sc map so manually-added crew (who lack c.shipCode) still resolve
  const shipIdToSc = {};
  for (const sc of SHIP_CODES_ORDERED) {
    const d = SHIP_DISPLAY[sc];
    const s = d && state.ships.find(sh => sh.name === d.name);
    if (s) shipIdToSc[s.id] = sc;
  }

  // Debug: log first crew member's key fields so we can spot mismatches
  if (state.crew.length) {
    const s = state.crew[0];
    console.log('[Gantt] sample crew[0]', {
      name: s.name, abbr: s.abbr, posId: s.posId,
      shipCode: s.shipCode, recentShipCode: s.recentShipCode, shipId: s.shipId,
      start: s.start, end: s.end, status: s.status,
    });
  }
  console.log('[Gantt] total crew:', state.crew.length);

  const ships = [];

  for (const sc of SHIP_CODES_ORDERED) {
    const posRows = [];

    for (const abbr of POS_ABBRS) {
      const bars = [];

      for (const c of state.crew) {
        // Match ship — by code string OR by derived shipId
        const onShip = c.recentShipCode === sc || c.shipCode === sc
          || (c.shipId && shipIdToSc[c.shipId] === sc);
        if (!onShip) continue;

        // Match position — by abbr string OR by posId → abbr
        const crewAbbr = c.abbr || posIdToAbbr[c.posId] || '';
        if (crewAbbr !== abbr) continue;

        // Require at least one of start/end
        const sMs = dateMs(c.start);
        const eMs = dateMs(c.end);
        if (!sMs && !eMs) continue;

        bars.push({
          name: c.name, crewId: c.id, sc,
          startMs: sMs ?? (eMs - 180 * MS_DAY),
          endMs:   eMs ?? (sMs + 180 * MS_DAY),
          future: false,
        });
      }

      // Future assignments
      for (const c of state.crew) {
        if (!c.futureOn) continue;
        const fsc = c.futureShip || (c.futureShipId && shipIdToSc[c.futureShipId]);
        if (fsc !== sc) continue;
        const crewAbbr = c.abbr || posIdToAbbr[c.posId] || '';
        if (crewAbbr !== abbr) continue;
        const endMs = dateMs(c.futureOff) || (dateMs(c.futureOn) + 180 * MS_DAY);
        bars.push({
          name: c.futureName || c.name, crewId: c.id, sc,
          startMs: dateMs(c.futureOn), endMs, future: true,
        });
      }

      posRows.push({ abbr, bars });
    }

    if (posRows.some(r => r.bars.length)) {
      ships.push({ sc, posRows });
    }
  }

  const totalBars = ships.reduce((n, s) => n + s.posRows.reduce((m, r) => m + r.bars.length, 0), 0);
  console.log('[Gantt] rendered:', ships.length, 'ships,', totalBars, 'bars');

  return ships;
}

// ── Render ────────────────────────────────────────────────────────────────────
function renderGantt() {
  const v      = VIEWS[_view];
  const endMs  = _startMs + v.totalDays * MS_DAY;
  const totPx  = Math.round(v.totalDays * v.pxPerDay);
  const today  = today0();
  const rows   = buildRows();

  // View tab active state
  document.querySelectorAll('.gantt-tab')
    .forEach(b => b.classList.toggle('active', b.dataset.view === _view));

  // ── Timeline header ──
  let hHtml = '';
  let t = firstTick(_startMs, _view);
  while (t < endMs) {
    const leftPx = Math.round(px(t, _view));
    const wPx    = Math.round(tickWidthPx(t, _view));
    const isWknd = v.tickEvery === 1 && [0, 6].includes(new Date(t).getDay());
    const isTdy  = v.tickEvery === 1 && Math.abs(t - today) < MS_DAY;
    hHtml += `<div class="gantt-tick${isTdy ? ' gt-today' : isWknd ? ' gt-weekend' : ''}" style="left:${leftPx}px;width:${wPx}px;">${v.tickFmt(new Date(t))}</div>`;
    t = nextTick(t, _view);
  }

  // ── Rows ──
  let labHtml = '';
  let rowHtml = `<div style="position:relative;width:${totPx}px;min-height:100%;">`;

  // Grid column backgrounds
  t = firstTick(_startMs, _view);
  while (t < endMs) {
    const leftPx = Math.round(px(t, _view));
    const wPx    = Math.round(tickWidthPx(t, _view));
    const isWknd = v.tickEvery === 1 && [0, 6].includes(new Date(t).getDay());
    rowHtml += `<div class="gantt-col-bg${isWknd ? ' gantt-weekend-bg' : ''}" style="left:${leftPx}px;width:${wPx}px;"></div>`;
    t = nextTick(t, _view);
  }

  // Today marker
  const todayLeft = Math.round(px(today, _view));
  if (todayLeft >= 0 && todayLeft <= totPx) {
    rowHtml += `<div class="gantt-today-marker" style="left:${todayLeft}px;"></div>`;
  }

  // Ship groups
  for (const ship of rows) {
    const shipName = SHIP_DISPLAY[ship.sc]?.name || ship.sc;
    const cls      = barCls(ship.sc);

    labHtml += `<div class="gantt-ship-label">${shipName}</div>`;
    rowHtml += `<div class="gantt-ship-spacer"></div>`;

    for (const row of ship.posRows) {
      labHtml += `<div class="gantt-pos-label">${row.abbr}</div>`;
      rowHtml += `<div class="gantt-row">`;

      for (const bar of row.bars) {
        if (!bar.startMs) continue;
        const lPx = Math.round(px(bar.startMs, _view));
        const rPx = Math.round(px(bar.endMs, _view));
        if (rPx <= 0 || lPx >= totPx) continue;
        const left  = Math.max(0, lPx);
        const width = Math.max(4, Math.min(totPx, rPx) - left);
        rowHtml += `<div class="gantt-bar ${cls}${bar.future ? ' gantt-future' : ''}"
          style="left:${left}px;width:${width}px;"
          title="${bar.name}${bar.future ? ' (upcoming)' : ''}"
          onclick="openProfile(${bar.crewId})">
          <span class="gantt-bar-name">${bar.name}</span>
        </div>`;
      }

      rowHtml += `</div>`;
    }
  }

  if (!rows.length) {
    rowHtml += `<div class="gantt-empty">No crew assignments found in view window</div>`;
  }

  rowHtml += `</div>`;

  // Inject
  const headerEl  = document.getElementById('gantt-header');
  const labRowsEl = document.getElementById('gantt-labels-rows');
  const rowsEl    = document.getElementById('gantt-rows');
  if (!headerEl || !labRowsEl || !rowsEl) return;

  headerEl.innerHTML  = `<div style="position:relative;height:36px;width:${totPx}px;">${hHtml}</div>`;
  labRowsEl.innerHTML = labHtml;
  rowsEl.innerHTML    = rowHtml;
}

// ── Public API ────────────────────────────────────────────────────────────────
function goToToday(andRender = true) {
  const v  = VIEWS[_view];
  _startMs = today0() - Math.round(v.totalDays * 0.25) * MS_DAY;
  if (andRender) renderGantt();
}

export function initAllShips() {
  if (!_startMs) goToToday(false);

  // Sync label panel scroll with timeline scroll
  const timeline  = document.getElementById('gantt-timeline');
  const labsRows  = document.getElementById('gantt-labels-rows');
  if (timeline && labsRows && !timeline._scrollBound) {
    timeline.addEventListener('scroll', () => { labsRows.scrollTop = timeline.scrollTop; });
    timeline._scrollBound = true;
  }

  renderGantt();
}

window.ganttSetView  = v   => { _view = v; goToToday(); };
window.ganttNavigate = dir => {
  const v = VIEWS[_view];
  _startMs += dir * Math.round(v.totalDays * 0.4) * MS_DAY;
  renderGantt();
};
window.ganttToday = () => goToToday();
