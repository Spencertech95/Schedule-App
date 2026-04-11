// ── placement.js — placement finder page ─────────────────────────────────────
import { state } from './state.js';

const SC2CLS   = {'ML':'MILLENNIUM CLASS','IN':'MILLENNIUM CLASS','SM':'MILLENNIUM CLASS','CS':'MILLENNIUM CLASS','SL':'SOLSTICE CLASS','EQ':'SOLSTICE CLASS','EC':'SOLSTICE CLASS','SI':'SOLSTICE CLASS','RF':'SOLSTICE CLASS','EG':'EDGE CLASS','AX':'EDGE CLASS','BY':'EDGE CLASS','AT':'EDGE CLASS','XC':'EDGE CLASS'};
const SC2NAME  = {'ML':'Millennium','IN':'Infinity','SM':'Summit','CS':'Constellation','SL':'Solstice','EQ':'Equinox','EC':'Eclipse','SI':'Silhouette','RF':'Reflection','EG':'Edge','AX':'Apex','BY':'Beyond','AT':'Ascent','XC':'Xcel'};
const CLS2BADGE = {'MILLENNIUM CLASS':'badge-teal','SOLSTICE CLASS':'badge-blue','EDGE CLASS':'badge-purple'};

export function initPlacement() {
  const posEl = document.getElementById('pf-pos-filter');
  if (posEl) posEl.innerHTML = '<option value="">All positions</option>' + state.positions.map(p => `<option value="${p.abbr}">${p.abbr} — ${p.title}</option>`).join('');
  renderPlacement();
}

export function renderPlacement() {
  const now        = new Date();
  const windowDays = parseInt(document.getElementById('pf-window').value) || 60;
  const posFilter  = document.getElementById('pf-pos-filter').value;
  const clsFilter  = document.getElementById('pf-class-filter').value;

  const movers = state.crew.filter(c => {
    if (!c.end) return false;
    const d = (new Date(c.end) - now) / 864e5;
    return d >= 0 && d <= windowDays;
  });
  document.getElementById('pf-count').textContent = `${movers.length} crew signing off in next ${windowDays} days`;

  const SHIP_CODES = ['ML','IN','SM','CS','SL','EQ','EC','SI','RF','EG','AX','BY','AT','XC'];
  const results = [];

  SHIP_CODES.forEach(sc => {
    const cls = SC2CLS[sc] || '';
    if (clsFilter && cls !== clsFilter) return;
    const clsBadge  = CLS2BADGE[cls] || 'badge-gray';
    const shipCrew  = state.crew.filter(c => c.recentShipCode === sc);
    const posOpenings = [];

    state.positions.forEach(pos => {
      if (posFilter && pos.abbr !== posFilter) return;
      const inRole     = shipCrew.filter(c => c.abbr === pos.abbr);
      const signingOff = inRole.filter(c => {
        if (!c.end) return false;
        const d = (new Date(c.end) - now) / 864e5;
        return d >= 0 && d <= windowDays;
      });
      if (!signingOff.length) return;

      signingOff.forEach(vacating => {
        const vacDate   = new Date(vacating.end);
        const daysUntil = Math.round((vacDate - now) / 864e5);
        const hasRelief = state.crew.some(c =>
          c.futureShip === sc && c.abbr === pos.abbr && c.id !== vacating.id &&
          c.futureOn && new Date(c.futureOn) <= new Date(vacDate.getTime() + pos.handover * 864e5)
        );
        const candidates = state.crew
          .filter(c => c.abbr === pos.abbr && c.status === 'Offboard' && c.id !== vacating.id && !c.futureShip)
          .map(c => {
            const gapDays = c.end ? Math.abs((new Date(c.end) - vacDate) / 864e5) : 365;
            let score = gapDays;
            if (c.hasShipExp  === 'YES') score -= 30;
            if (c.hasClassExp === 'YES') score -= 15;
            if (c.readyToJoin === 'YES') score -= 20;
            score += (c.daysOffboard || 0) * 0.15;
            return {...c, score: Math.round(score), gapDays: Math.round(gapDays)};
          }).sort((a, b) => a.score - b.score).slice(0, 3);

        const moverCandidates = movers
          .filter(c => c.abbr === pos.abbr && c.recentShipCode !== sc && !state.crew.some(x => x.futureShip === sc && x.id === c.id))
          .map(c => {
            const gapDays = Math.abs((new Date(c.end) - vacDate) / 864e5);
            let score = gapDays;
            if (c.hasShipExp  === 'YES') score -= 30;
            if (c.hasClassExp === 'YES') score -= 15;
            if (c.hasClassExp !== 'YES' && cls !== SC2CLS[c.recentShipCode]) score += 40;
            return {...c, score: Math.round(score), gapDays: Math.round(gapDays), isMover: true};
          }).sort((a, b) => a.score - b.score).slice(0, 2);

        const allCandidates = [...candidates, ...moverCandidates].sort((a, b) => a.score - b.score).slice(0, 3);
        posOpenings.push({pos, vacating, vacDate, daysUntil, hasRelief, allCandidates, overlapType: hasRelief ? 'overlap' : daysUntil <= 14 ? 'gap' : 'open'});
      });
    });

    if (!posOpenings.length) return;
    const totalGapScore = posOpenings.filter(o => !o.hasRelief).length;
    const coverPct = posOpenings.length ? Math.round((posOpenings.filter(o => o.hasRelief).length / posOpenings.length) * 100) : 0;
    results.push({sc, cls, clsBadge, posOpenings, totalGapScore, coverPct});
  });

  results.sort((a, b) => b.totalGapScore - a.totalGapScore);

  if (!results.length) {
    document.getElementById('pf-body').innerHTML = `<div class="pf-empty">No openings found for the selected filters.</div>`;
    return;
  }

  let html = '';
  results.forEach(({sc, cls, clsBadge, posOpenings, totalGapScore, coverPct}) => {
    const unresolved  = posOpenings.filter(o => !o.hasRelief).length;
    const scoreColour = coverPct >= 80 ? '#4dd4a0' : coverPct >= 50 ? 'var(--highlight)' : '#ff7070';
    const scoreBar    = `<div class="pf-score-bar"><div class="pf-score-fill" style="width:${coverPct}%;background:${scoreColour};height:6px;border-radius:3px;"></div></div>`;
    html += `<div class="pf-ship-card">
      <div class="pf-ship-header">
        <span class="badge ${clsBadge}" style="font-size:10px;">${sc}</span>
        <div>
          <div class="pf-ship-name">${SC2NAME[sc]||sc}</div>
          <div class="pf-ship-meta">${cls.replace(' CLASS','')} class · ${posOpenings.length} opening${posOpenings.length!==1?'s':''} · <span style="color:${unresolved>0?'#ff7070':'#4dd4a0'};">${unresolved} unresolved</span></div>
        </div>
        <div class="pf-vacancy-score">
          <span style="font-size:11px;color:var(--text2);">${coverPct}% covered</span>
          ${scoreBar}
        </div>
      </div>
      <div class="pf-pos-rows">`;

    const byPos = {};
    posOpenings.forEach(o => { if (!byPos[o.pos.abbr]) byPos[o.pos.abbr] = []; byPos[o.pos.abbr].push(o); });

    Object.entries(byPos).forEach(([abbr, openings]) => {
      html += `<div class="pf-pos-row">
        <div class="pf-pos-label"><span class="badge badge-gray" style="font-size:10px;">${abbr}</span></div>
        <div class="pf-slots">`;

      openings.forEach(o => {
        const vcls     = o.overlapType === 'gap' ? 'gap' : o.overlapType === 'overlap' ? 'overlap' : '';
        const urgBadge = o.daysUntil <= 14 ? 'badge-red' : o.daysUntil <= 30 ? 'badge-amber' : 'badge-blue';
        html += `<div class="pf-vacancy ${vcls}">
          <span style="font-weight:500;">${o.vacating.name}</span> signs off
          <span class="badge ${urgBadge}" style="font-size:9px;margin:0 4px;">${o.daysUntil}d</span>
          on ${o.vacating.end}
          ${o.hasRelief ? '<span style="color:#4dd4a0;font-size:10px;margin-left:4px;">✓ Relief confirmed</span>' : '<span style="color:#ff7070;font-size:10px;margin-left:4px;">✕ No relief yet</span>'}
        </div>`;
        if (o.allCandidates.length) {
          html += `<div style="margin-top:3px;margin-bottom:4px;padding-left:4px;border-left:2px solid var(--border);">
            <div style="font-size:10px;color:var(--text2);margin-bottom:3px;padding-left:6px;">Top candidates</div>`;
          o.allCandidates.forEach((cand, ci) => {
            const rank      = ['🥇','🥈','🥉'][ci] || '·';
            const expBadge  = cand.hasShipExp  === 'YES' ? `<span class="badge badge-green" style="font-size:9px;">Ship ✓</span>`
              : cand.hasClassExp === 'YES' ? `<span class="badge badge-teal" style="font-size:9px;">Class ✓</span>` : '';
            const readyBadge = cand.readyToJoin === 'YES' ? `<span class="badge badge-orange" style="font-size:9px;">Ready</span>` : '';
            const moverTag   = cand.isMover ? `<span class="badge badge-blue" style="font-size:9px;">Mover (${cand.recentShipCode})</span>` : `<span style="font-size:9px;color:var(--text2);">Offboard ${cand.daysOffboard>0?cand.daysOffboard+'d':''}</span>`;
            html += `<div class="pf-candidate">
              <span style="font-size:12px;">${rank}</span>
              <span style="font-weight:500;font-size:12px;">${cand.name}</span>
              <span style="font-size:10px;color:var(--text2);">${cand.nat}</span>
              ${expBadge}${readyBadge}${moverTag}
              <span class="pf-match-score" style="color:var(--text2);">Gap: ${cand.gapDays}d</span>
            </div>`;
          });
          html += '</div>';
        } else {
          html += `<div style="font-size:11px;color:var(--text2);padding:3px 6px;font-style:italic;">No candidates found in pool</div>`;
        }
      });
      html += '</div><div></div></div>';
    });
    html += '</div></div>';
  });
  document.getElementById('pf-body').innerHTML = html;
}

window.initPlacement   = initPlacement;
window.renderPlacement = renderPlacement;
