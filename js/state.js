// ── state.js — mutable application state ────────────────────────────────────
import { POSITIONS, SHIPS_DATA, CLASS_MANNING } from './data.js';

export const state = {
  positions: POSITIONS.map(p => ({ ...p })),
  ships: SHIPS_DATA.map(s => ({ ...s })),
  manning: {
    Millennium: { ...CLASS_MANNING.Millennium },
    Solstice:   { ...CLASS_MANNING.Solstice },
    Edge:       { ...CLASS_MANNING.Edge },
  },
  shipManning: {}, // per-ship overrides keyed by ship code e.g. { ML: {1:1,2:2,...} }
  crew: [],
  offers: [],
  rotations: {},
  compliance: [
    {id:1,title:"Maximum consecutive sea service",cat:"MLC 2006",desc:"No crew member may serve more than 11 months consecutive sea service without a minimum rest period ashore."},
    {id:2,title:"STCW basic safety — mandatory for all",cat:"STCW",desc:"All crew joining a vessel must hold a valid STCW Basic Safety certificate. No exceptions for technical entertainment positions."},
    {id:3,title:"Handover sign-off before departure",cat:"Company policy",desc:"Outgoing crew in technical roles may not disembark until incoming crew member has been signed off as show-ready by the Stage Production Manager."},
    {id:4,title:"Simultaneous sign-off restriction",cat:"Company policy",desc:"No more than one key technical position (SPM, VPM, ETDC) may sign off within the same 7-day window on any single ship."},
    {id:5,title:"Show changeover blackout",cat:"Company policy",desc:"All technical key positions are locked during production changeovers. No sign-offs or leave approved within 14 days of a scheduled show changeover."}
  ],
  nextId: 500,
  currentYear: '2026',
  currentRotationShip: null,
  rotationMode: 'overview',
};

export function uid() { return ++state.nextId; }
