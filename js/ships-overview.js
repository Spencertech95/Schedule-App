// ── ships-overview.js — All Ships Gantt chart ───────────────────────────────
import { state } from './state.js';
import { SHIP_CODES_ORDERED, SHIP_DISPLAY, POS_ORDER, POS_COLORS } from './ship.js';

const MS_DAY = 86_400_000;

// ── View configs ──────────────────────────────────────────────────────────────
const VIEWS = {
  day: {
    totalDays: 30,
    pxPerDay:  40,
    tickEvery: 1,
    tickFmt: d => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
  },
  week: {
    totalDays: 91,
    pxPerDay:  80 / 7,
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
  if (!s) return null;
  const t = new Date(s).getTime();
  return isNaN(t) ? null : t;
}

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
  const qm = Math.floor(d.getMonth() / 3) * 3;
  d.setMonth(qm); d.setDate(1);
  if (d.getTime() < startMs) d.setMonth(d.getMonth() + 3);
  return d.getTime();
}

function nextTick(ms, view) {
  const ev = VIEWS[view].tickEvery;
  if (typeof ev === 'number') return ms + ev * MS_DAY;
  const d = new Date(ms);
  if (ev === 'month') { d.setMonth(d.getMonth() + 1); return d.getTime(); }
  d.setMonth(d.getMonth() + 3); return d.getTime();
}

function tickWidthPx(tickMs, view) {
  return (nextTick(tickMs, view) - tickMs) / MS_DAY * VIEWS[view].pxPerDay;
}

function px(ms, view) {
  return (ms - _startMs) / MS_DAY * VIEWS[view].pxPerDay;
}

// ── Data ──────────────────────────────────────────────────────────────────────
function buildRows(winStartMs, winEndMs) {
  const posIdToAbbr = {};
  for (const p of state.positions) posIdToAbbr[p.id] = p.abbr;

  const ships = [];

  for (const sc of SHIP_CODES_ORDERED) {
    const members = [];

    for (const c of state.crew) {
      if (c.status !== 'Onboard') continue;
      if (c.recentShipCode !== sc && c.shipCode !== sc) continue;

      const sMs = dateMs(c.start);
      const eMs = dateMs(c.end);

      // Require at least one date; skip bars with no date info
      if (!sMs && !eMs) continue;

      // Use window boundaries as fallbacks, matching ship.js renderTimeline
      const startMs = sMs ?? winStartMs;
      const endMs   = eMs ?? winEndMs;

      // Skip if bar is entirely outside the visible window
      if (endMs < winStartMs || startMs > winEndMs) continue;

      members.push({
        name: c.name, crewId: c.id,
        abbr: c.abbr || posIdToAbbr[c.posId] || '',
        startMs, endMs,
        startLabel: c.start || null,
        endLabel:   c.end   || null,
      });
    }

    if (!members.length) continue;

    members.sort((a, b) => {
      const ai = POS_ORDER.indexOf(a.abbr);
      const bi = POS_ORDER.indexOf(b.abbr);
      const pd = (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
      return pd !== 0 ? pd : a.name.localeCompare(b.name);
    });

    ships.push({ sc, members });
  }

  return ships;
}

// ── Render ────────────────────────────────────────────────────────────────────
function renderGantt() {
  const ganttBody = document.querySelector('.gantt-body');
  if (ganttBody) {
    const top = ganttBody.getBoundingClientRect().top;
    ganttBody.style.height = Math.max(300, window.innerHeight - top - 24) + 'px';
  }

  const v      = VIEWS[_view];
  const endMs  = _startMs + v.totalDays * MS_DAY;
  const totPx  = Math.round(v.totalDays * v.pxPerDay);
  const today  = today0();
  const rows   = buildRows(_startMs, endMs);

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

  // Ship groups — one row per crew member
  for (const ship of rows) {
    const shipName = SHIP_DISPLAY[ship.sc]?.name || ship.sc;

    labHtml += `<div class="gantt-ship-label">${shipName} <span style="opacity:.5;font-weight:400;">(${ship.members.length})</span></div>`;
    rowHtml += `<div class="gantt-ship-spacer"></div>`;

    for (const m of ship.members) {
      const col = POS_COLORS[m.abbr] || '#4dd4a0';

      labHtml += `<div class="gantt-pos-label" title="${m.name}">
        <span class="badge badge-gray" style="font-size:9px;width:34px;text-align:center;flex-shrink:0;">${m.abbr || '—'}</span>
        <span style="font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${m.name}</span>
      </div>`;

      const lPx  = Math.round(px(m.startMs, _view));
      const rPx  = Math.round(px(m.endMs,   _view));
      const left  = Math.max(0, lPx);
      const width = Math.max(4, Math.min(totPx, rPx) - left);

      rowHtml += `<div class="gantt-row">
        <div class="gantt-bar"
          style="left:${left}px;width:${width}px;background:${col};"
          title="${m.name} · ${m.abbr} · ${m.startLabel || '?'} → ${m.endLabel || '?'}"
          onclick="openProfile(${m.crewId})">${width > 30 ? m.name : ''}</div>
      </div>`;
    }
  }

  if (!rows.length) {
    rowHtml += `<div class="gantt-empty">No onboard crew found</div>`;
  }

  rowHtml += `</div>`;

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

  const timeline  = document.getElementById('gantt-timeline');
  const labsRows  = document.getElementById('gantt-labels-rows');
  if (timeline && labsRows && !timeline._scrollBound) {
    timeline.addEventListener('scroll', () => { labsRows.scrollTop = timeline.scrollTop; });
    timeline._scrollBound = true;
  }

  renderGantt();

  if (!window._ganttResizeBound) {
    window.addEventListener('resize', () => {
      const gb = document.querySelector('.gantt-body');
      if (!gb || !document.getElementById('page-all-ships')?.classList.contains('active')) return;
      gb.style.height = Math.max(300, window.innerHeight - gb.getBoundingClientRect().top - 24) + 'px';
    });
    window._ganttResizeBound = true;
  }
}

window.ganttSetView  = v   => { _view = v; goToToday(); };
window.ganttNavigate = dir => {
  const v = VIEWS[_view];
  _startMs += dir * Math.round(v.totalDays * 0.4) * MS_DAY;
  renderGantt();
};
window.ganttToday = () => goToToday();
