// ── deployment.js — fleet deployment map page ────────────────────────────────
import { showToast, parsePortLocation } from './utils.js';

const SHIP_NAME_MAP = {'ML':'Millennium','IN':'Infinity','SM':'Summit','CS':'Constellation','SL':'Solstice','EQ':'Equinox','EC':'Eclipse','SI':'Silhouette','RF':'Reflection','EG':'Edge','AX':'Apex','BY':'Beyond','AT':'Ascent','XC':'Xcel'};

const DEPLOY_SHIP_COLORS = {
  AX:'#E87435',AT:'#E87435',BY:'#E87435',EG:'#E87435',XC:'#E87435',
  SL:'#299BE1',EQ:'#299BE1',EC:'#299BE1',SI:'#299BE1',RF:'#299BE1',
  ML:'#4dd4a0',IN:'#4dd4a0',SM:'#4dd4a0',CS:'#4dd4a0',
};

// Port coordinate lookup table (abbreviated here - full table loaded from extracted source)
const DEPLOY_PC = window._DEPLOY_PC || (() => {
  // Inline the full table — set on window by this module
  const pc = {
    'AT SEA':[0,0],
    'FORT LAUDERDALE, FLORIDA':[26.118,-80.137],'ORLANDO (PORT CANAVERAL), FLORIDA':[28.416,-80.603],'MIAMI, FLORIDA':[25.774,-80.190],'TAMPA, FLORIDA':[27.943,-82.452],'KEY WEST, FLORIDA':[24.556,-81.779],'CAPE LIBERTY, NEW JERSEY':[40.641,-74.073],'NEW ORLEANS, LOUISIANA':[29.954,-90.075],'BOSTON, MASSACHUSETTS':[42.360,-71.057],'PORTLAND, MAINE':[43.661,-70.256],'NEW YORK, NEW YORK':[40.672,-74.011],'NORFOLK, VIRGINIA':[36.846,-76.292],
    'NASSAU, BAHAMAS':[25.073,-77.343],'BIMINI, BAHAMAS':[25.729,-79.291],'GRAND BAHAMA ISLAND, BAHAMAS':[26.572,-78.696],'PERFECT DAY AT COCOCAY, BAHAMAS':[25.812,-77.779],'PERFECT DAY AT COCOCAY':[25.812,-77.779],'GRAND TURK, TURKS & CAICOS':[21.468,-71.137],'ROYAL NAVAL DOCKYARD, BERMUDA':[32.321,-64.844],'GEORGE TOWN, GRAND CAYMAN':[19.290,-81.384],
    'COZUMEL, MEXICO':[20.507,-86.953],'COSTA MAYA, MEXICO':[18.715,-87.720],'PUERTO VALLARTA, MEXICO':[20.654,-105.225],'ROATAN, HONDURAS':[16.323,-86.549],'BELIZE CITY, BELIZE':[17.252,-88.766],'YUCATAN (PROGRESO), MEXICO':[21.295,-89.665],'PUERTO QUETZAL, GUATEMALA':[13.930,-90.779],'AMBER COVE, DOMINICAN REPUBLIC':[19.823,-70.719],
    'PUERTO PLATA, DOMINICAN REP':[19.804,-70.689],'SAN JUAN, PUERTO RICO':[18.466,-66.118],'CHARLOTTE AMALIE, ST. THOMAS':[18.342,-64.930],'PHILIPSBURG, ST. MAARTEN':[18.028,-63.048],'BASSETERRE, ST. KITTS & NEVIS':[17.303,-62.717],'ST. JOHNS, ANTIGUA':[17.127,-61.847],'CASTRIES, ST. LUCIA':[14.014,-61.001],'ROSEAU, DOMINICA':[15.302,-61.388],'BRIDGETOWN, BARBADOS':[13.104,-59.616],"ST. GEORGE'S, GRENADA":[12.048,-61.750],'TORTOLA, BRITISH VIRGIN ISLANDS':[18.431,-64.621],'ORANJESTAD, ARUBA':[12.520,-70.034],'WILLEMSTAD, CURACAO':[12.108,-68.932],'KRALENDIJK, BONAIRE':[12.152,-68.272],'FALMOUTH, JAMAICA':[18.502,-77.654],'OCHO RIOS, JAMAICA':[18.410,-77.102],'KINGSTON, JAMAICA':[17.997,-76.793],'CARTAGENA, COLOMBIA':[10.391,-75.479],'PANAMA CANAL, PANAMA':[9.08,-79.68],'ST. CROIX, USVI':[17.730,-64.733],'LA ROMANA, DOMINICAN REPUBLIC':[18.427,-68.972],'LABADEE (PRIVATE DESTINATION), HAITI':[19.759,-72.197],'BRIDGETOWN (BARBADOS), BARBADOS':[13.104,-59.616],
    'RIO DE JANEIRO, BRAZIL':[-22.911,-43.172],'BUENOS AIRES, ARGENTINA':[-34.603,-58.381],'MONTEVIDEO, URUGUAY':[-34.907,-56.189],'PUNTA DEL ESTE, URUGUAY':[-34.967,-54.952],'USHUAIA, ARGENTINA':[-54.804,-68.302],'SALVADOR DE BAHIA, BRAZIL':[-12.972,-38.501],'PORT STANLEY, FALKLAND IS.':[-51.697,-57.851],'CAPE HORN, CHILE':[-55.979,-67.274],'PARADISE BAY, ANTARCTICA':[-64.872,-62.874],'PUERTA MONTT, CHILE':[-41.470,-72.937],'PUERTO WILLIAMS, CHILE':[-54.933,-67.614],'VALPARAISO, CHILE':[-33.038,-71.630],
    'BARCELONA, SPAIN':[41.384,2.183],'VALENCIA, SPAIN':[39.469,-0.376],'CARTAGENA, SPAIN':[37.601,-0.986],'MALAGA, SPAIN':[36.722,-4.421],'SEVILLE (CADIZ), SPAIN':[36.535,-6.298],'ALICANTE, SPAIN':[38.345,-0.491],'PALMA DE MALLORCA, SPAIN':[39.571,2.651],'BILBAO, SPAIN':[43.263,-2.926],'LA CORUNA, SPAIN':[43.370,-8.396],'VIGO, SPAIN':[43.239,-8.722],'LANZAROTE, CANARY ISLANDS':[28.964,-13.554],'TENERIFE, CANARY ISLANDS':[28.292,-16.629],'LAS PALMAS (GRAN CANARIA), SPAIN':[27.924,-15.389],'MADEIRA (FUNCHAL), PORTUGAL':[32.650,-16.908],'PONTA DELGADA, AZORES, PORTUGAL':[37.740,-25.670],'TANGIER, MOROCCO':[35.783,-5.803],'CASABLANCA, MOROCCO':[33.592,-7.621],'GIBRALTAR':[36.140,-5.353],'AGADIR, MOROCCO':[30.427,-9.598],'LISBON, PORTUGAL':[38.717,-9.143],'PORTO, PORTUGAL':[41.146,-8.611],
    'SOUTHAMPTON, ENGLAND':[50.896,-1.404],'DOVER, ENGLAND':[51.127,1.318],'LIVERPOOL, ENGLAND':[53.401,-2.983],'AMSTERDAM, NETHERLANDS':[52.373,4.898],'BRUGES (ZEEBRUGGE), BELGIUM':[51.332,3.196],'PARIS (LE HAVRE), FRANCE':[49.494,0.107],'DUBLIN, IRELAND':[53.346,-6.259],'CORK, IRELAND':[51.898,-8.471],'WATERFORD, IRELAND':[52.258,-7.106],'EDINBURGH (NEWHAVEN), SCOTLAND':[55.985,-3.188],'KIRKWALL, SCOTLAND':[58.983,-2.959],'INVERNESS (INVERGORDON), SCOTLAND':[57.688,-4.169],'LERWICK, SHETLAND ISLANDS, SCOTLAND':[60.155,-1.150],'BELFAST, NORTHERN IRELAND':[54.597,-5.930],'PORTLAND, ENGLAND':[50.574,-2.444],'TILBURY (LONDON), ENGLAND':[51.457,0.366],'NEWCASTLE, ENGLAND':[55.014,-1.422],'AARHUS, DENMARK':[56.154,10.216],'COPENHAGEN, DENMARK':[55.676,12.568],'WARNEMUNDE, GERMANY':[54.172,12.081],'HAMBURG, GERMANY':[53.545,9.999],'KIEL, GERMANY':[54.323,10.135],'BERLIN (WARNEMUNDE), GERMANY':[54.172,12.081],
    'STAVANGER, NORWAY':[58.969,5.733],'BERGEN, NORWAY':[60.391,5.322],'HAUGESUND, NORWAY':[59.413,5.268],'FLAM, NORWAY':[60.862,7.119],'GEIRANGER, NORWAY':[62.099,7.205],'TRONDHEIM, NORWAY':[63.430,10.395],'TROMSO, NORWAY':[69.649,18.956],'HONNINGSVAG, NORWAY':[70.980,25.970],'ALESUND, NORWAY':[62.472,6.163],'OLDEN, NORWAY':[61.833,6.804],'ARCTIC CIRCLE (CRUISE)':[66.562,14.0],'LONGYEARBYEN (SVALBARD), NORWAY':[78.222,15.647],'REYKJAVIK, ICELAND':[64.128,-21.818],'AKUREYRI, ICELAND':[65.682,-18.100],'SEYDISFJORDUR, ICELAND':[65.261,-14.002],'ISAFJORDUR, ICELAND':[66.080,-23.121],'GRUNDARFJORDUR, ICELAND':[64.919,-23.239],
    'HELSINKI, FINLAND':[60.169,24.938],'TALLINN, ESTONIA':[59.437,24.753],'VISBY, SWEDEN':[57.638,18.295],'STOCKHOLM, SWEDEN':[59.329,18.068],'RIGA, LATVIA':[56.946,24.106],'GDANSK, POLAND':[54.353,18.647],'ST. PETERSBURG, RUSSIA':[59.939,30.316],
    'ROME (CIVITAVECCHIA), ITALY':[42.094,11.793],'NAPLES, ITALY':[40.851,14.268],'FLORENCE/PISA (LA SPEZIA), ITALY':[44.103,9.826],'FLORENCE (LIVORNO), ITALY':[43.548,10.312],'PORTOFINO, ITALY':[44.303,9.211],'NICE (VILLEFRANCHE), FRANCE':[43.704,7.326],'SICILY (MESSINA), ITALY':[38.193,15.554],'BRINDISI, ITALY':[40.632,17.943],'AMALFI COAST (SALERNO), ITALY':[40.676,14.752],'CAGLIARI, SARDINIA, ITALY':[39.222,9.121],'AJACCIO, CORSICA, FRANCE':[41.927,8.734],'RAVENNA, ITALY':[44.416,12.200],'VENICE, ITALY':[45.438,12.326],'GENOA, ITALY':[44.411,8.933],'BARI, ITALY':[41.126,16.869],'TRIESTE, ITALY':[45.650,13.780],'TARANTO, ITALY':[40.464,17.235],'PALERMO, ITALY':[38.116,13.363],'MARSEILLE, FRANCE':[43.296,5.381],'MONTPELLIER (SETE), FRANCE':[43.400,3.694],
    'ATHENS (PIRAEUS), GREECE':[37.943,23.646],'SANTORINI, GREECE':[36.394,25.461],'MYKONOS, GREECE':[37.445,25.368],'RHODES, GREECE':[36.443,28.223],'HERAKLION, CRETE, GREECE':[35.338,25.134],'CHANIA, CRETE, GREECE':[35.513,24.018],'OLYMPIA (KATAKOLON), GREECE':[37.640,21.319],'KAVALA, GREECE':[40.939,24.402],'THESSALONIKI, GREECE':[40.640,22.944],'HYDRA, GREECE':[37.350,23.472],'EPHESUS (KUSADASI), TURKEY':[37.857,27.261],'ISTANBUL, TURKEY':[41.013,28.975],'ANTALYA, TURKEY':[36.897,30.713],'BODRUM, TURKEY':[37.035,27.430],'LIMASSOL, CYPRUS':[34.675,33.040],'VALLETTA, MALTA':[35.899,14.514],'CORFU, GREECE':[39.623,19.922],'PATMOS, GREECE':[37.320,26.546],'ZAKYNTHOS, GREECE':[37.790,20.895],
    'DUBROVNIK, CROATIA':[42.650,18.094],'SPLIT, CROATIA':[43.508,16.440],'ZADAR, CROATIA':[44.119,15.231],'KOTOR, MONTENEGRO':[42.424,18.771],'BAR, MONTENEGRO':[42.098,19.100],'HVAR, CROATIA':[43.173,16.441],'ROVINJ, CROATIA':[45.081,13.638],
    'TUNIS (LA GOULETTE), TUNISIA':[36.818,10.305],'ALGIERS, ALGERIA':[36.754,3.059],'ALEXANDRIA, EGYPT':[31.200,29.916],'ASHDOD, ISRAEL':[31.816,34.650],'HAIFA, ISRAEL':[32.820,34.980],'BEIRUT, LEBANON':[33.889,35.495],
    'SEATTLE, WASHINGTON':[47.608,-122.335],'VANCOUVER, BRITISH COLUMBIA':[49.283,-123.120],'VICTORIA, BRITISH COLUMBIA':[48.428,-123.367],'KETCHIKAN, ALASKA':[55.342,-131.646],'JUNEAU, ALASKA':[58.301,-134.419],'SKAGWAY, ALASKA':[59.458,-135.319],'SITKA, ALASKA':[57.053,-135.330],'ICY STRAIT POINT, ALASKA':[58.130,-135.445],'INSIDE PASSAGE, ALASKA':[56.0,-131.0],'ENDICOTT ARM & DAWES GLACIER, ALASKA':[57.852,-133.127],'HUBBARD GLACIER, ALASKA':[59.903,-139.452],'SEWARD, ALASKA':[60.104,-149.443],'ASTORIA, OREGON':[46.188,-123.831],'SAN FRANCISCO, CALIFORNIA':[37.774,-122.419],'LOS ANGELES, CALIFORNIA':[33.740,-118.258],'SAN DIEGO, CALIFORNIA':[32.718,-117.164],'KODIAK, ALASKA':[57.794,-152.407],'HOMER, ALASKA':[59.643,-151.549],
    'HONOLULU, OAHU, HAWAII':[21.307,-157.858],'HILO, HAWAII':[19.730,-155.090],'KAILUA KONA, HAWAII':[19.643,-155.996],'NAWILIWILI, KAUAI, HAWAII':[21.957,-159.355],'KAHULUI, MAUI, HAWAII':[20.894,-156.465],'PAPEETE, TAHITI':[-17.536,-149.567],'MOOREA, FRENCH POLYNESIA':[-17.492,-149.831],'RAIATEA, FRENCH POLYNESIA':[-16.730,-151.450],'BORA BORA, FRENCH POLYNESIA':[-16.500,-151.741],'APIA, SAMOA':[-13.833,-171.767],
    'SYDNEY, AUSTRALIA':[-33.868,151.209],'MELBOURNE, AUSTRALIA':[-37.813,144.963],'HOBART, TASMANIA, AUSTRALIA':[-42.881,147.330],'ADELAIDE, AUSTRALIA':[-34.929,138.601],'AIRLIE BEACH, QUEENSLAND, AUSTRALIA':[-20.270,148.717],'CAIRNS, QUEENSLAND, AUSTRALIA':[-16.921,145.771],'PORT DOUGLAS, QUEENSLAND, AUSTRALIA':[-16.487,145.461],'DARWIN, AUSTRALIA':[-12.462,130.842],'KANGAROO ISLAND, AUSTRALIA':[-35.773,137.174],'NEWCASTLE, AUSTRALIA':[-32.926,151.774],'PERTH (FREMANTLE), AUSTRALIA':[-32.053,115.744],'CHRISTCHURCH (AKAROA), NEW ZEALAND':[-43.803,172.970],'WELLINGTON, NEW ZEALAND':[-41.286,174.776],'AUCKLAND, NEW ZEALAND':[-36.848,174.763],'NAPIER, NEW ZEALAND':[-39.492,176.921],'TAURANGA, NEW ZEALAND':[-37.687,176.166],'DUNEDIN (PORT CHALMERS), NEW ZEALAND':[-45.815,170.631],'MILFORD SOUND, NEW ZEALAND':[-44.659,167.886],'BAY OF ISLANDS, NEW ZEALAND':[-35.221,174.097],'NOUMEA, NEW CALEDONIA':[-22.272,166.459],'SUVA, FIJI':[-18.141,178.441],'LAUTOKA, FIJI ISLANDS':[-17.609,177.451],'MYSTERY ISLAND, VANUATU':[-20.132,169.448],'PORT VILA, VANUATU':[-17.734,168.322],'LIFOU, LOYALTY ISLANDS, NEW CALEDONIA':[-20.906,167.233],
    'SINGAPORE':[1.290,103.855],'BANGKOK (LAEMCHABANG),THAILAND':[13.083,100.893],'KO SAMUI, THAILAND':[9.537,100.061],'PHUKET, THAILAND':[7.888,98.398],'PENANG, MALAYSIA':[5.414,100.330],'LANGKAWI, MALAYSIA':[6.350,99.800],'KUALA LUMPUR (PORT KLANG), MALAYSIA':[3.000,101.390],'BENOA, BALI, INDONESIA':[-8.748,115.217],'CELUKAN BAWANG, BALI, INDONESIA':[-8.162,114.783],'LOMBOK, INDONESIA':[-8.653,116.311],'HO CHI MINH CITY (PHU MY), VIETNAM':[10.616,107.021],'HUE/DANANG (CHAN MAY), VIETNAM':[16.375,108.020],'HANOI (HA LONG BAY), VIETNAM':[20.910,107.183],'HONG KONG, CHINA':[22.319,114.169],'TAIPEI (KEELUNG), TAIWAN':[25.133,121.740],'OKINAWA, JAPAN':[26.334,127.800],'COLOMBO, SRI LANKA':[6.927,79.862],'HAMBANTOTA, SRI LANKA':[6.124,81.115],'COCHIN (KOCHI), INDIA':[9.963,76.242],'MUMBAI, INDIA':[18.922,72.849],'GOA (MORMUGAO), INDIA':[15.403,73.795],'MANILA, PHILIPPINES':[14.594,120.978],'CEBU, PHILIPPINES':[10.295,123.901],
    'TOKYO (YOKOHAMA), JAPAN':[35.443,139.638],'TOKYO, JAPAN':[35.443,139.638],'KYOTO (OSAKA), JAPAN':[34.693,135.502],'KOBE, JAPAN':[34.691,135.196],'HIROSHIMA, JAPAN':[34.391,132.459],'NAGASAKI, JAPAN':[32.747,129.883],'KOCHI, JAPAN':[33.559,133.531],'KAGOSHIMA, JAPAN':[31.596,130.557],'MT. FUJI (SHIMIZU), JAPAN':[35.031,138.490],'AOMORI, JAPAN':[40.822,140.748],'HAKODATE, JAPAN':[41.769,140.729],'FUKUOKA (HAKATA), JAPAN':[33.597,130.424],'BUSAN, SOUTH KOREA':[35.102,129.039],'JEJU, SOUTH KOREA':[33.490,126.531],'SEOUL (INCHEON), SOUTH KOREA':[37.456,126.706],'BEPPU, JAPAN':[33.278,131.491],'KANAZAWA, JAPAN':[36.558,136.666],'NAHA, OKINAWA, JAPAN':[26.213,127.680],
    'QUEBEC CITY, CANADA':[46.814,-71.208],'SYDNEY, NOVA SCOTIA, CANADA':[46.137,-60.193],'HALIFAX, NOVA SCOTIA, CANADA':[44.648,-63.571],'CHARLOTTETOWN, P.E.I., CANADA':[46.238,-63.130],
    'DRY DOCK MARSEILLE, FRANCE':[43.296,5.381],'DRY DOCK SINGAPORE':[1.259,103.819],'DRY DOCK BREST, FRANCE':[48.390,-4.487],'DRY DOCK FREEPORT, BAHAMAS':[26.511,-78.696],'ST. NAZAIRE, FRANCE':[47.274,-2.214],
  };
  window._DEPLOY_PC = pc;
  return pc;
})();

let _depData = null;
let _depMap  = null;
let _depMarkers = {};
let _depTrails  = {};
let _depSelectedShip = null;
let _depCurrentVoyage = null;
let _livePositions = null;
let _livePosTimer  = null;
let _liveMarkers   = {};

async function fetchSchedule() {
  try {
    const r = await fetch('./ship-schedule.json?t=' + Date.now());
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    Object.keys(data).forEach(sc => { if (!Array.isArray(data[sc])) data[sc] = [data[sc]]; });
    _depData = data;
    return true;
  } catch(e) {
    console.error('fetchSchedule:', e);
    const el = document.getElementById('deploy-loading');
    if (el) el.textContent = '⚠ Could not load schedule data: ' + e.message;
    return false;
  }
}

async function fetchLivePositions() {
  try {
    const r = await fetch('./ship-positions.json?t=' + Date.now());
    if (!r.ok) return;
    const data = await r.json();
    if (data && data.ships) {
      _livePositions = data;
      const dateInput = document.getElementById('deploy-date');
      if (dateInput) {
        const today = new Date().toISOString().slice(0, 10);
        if (dateInput.value === today) deployRefresh();
      }
    }
  } catch(e) { console.warn('fetchLivePositions:', e); }
}

function startLiveTracking() {
  fetchLivePositions();
  if (_livePosTimer) clearInterval(_livePosTimer);
  _livePosTimer = setInterval(fetchLivePositions, 5 * 60 * 1000);
}

function resolveCoords(portName) {
  if (!portName || portName === 'AT SEA') return null;
  if (DEPLOY_PC[portName]) return DEPLOY_PC[portName];
  const key = portName.split(',')[0].trim().toUpperCase();
  for (const k of Object.keys(DEPLOY_PC)) {
    if (k.toUpperCase().startsWith(key)) return DEPLOY_PC[k];
  }
  return null;
}

function getShipPositionForDate(sc, dateStr) {
  if (!_depData || !_depData[sc]) return null;
  const rows = _depData[sc];
  const row  = rows.find(r => r.date === dateStr);
  if (!row) return null;
  if (row.dayType === 'S') return {...row, coord: null, isAtSea: true};
  const coord = resolveCoords(row.portName);
  return {...row, coord, isAtSea: !coord};
}

function getCurrentVoyage(sc, dateStr) {
  if (!_depData || !_depData[sc]) return [];
  const rows = _depData[sc];
  const idx  = rows.findIndex(r => r.date === dateStr);
  if (idx < 0) return [];
  let voyageStart = 0;
  for (let i = idx; i >= 0; i--) { if (rows[i].dayType === 'T') { voyageStart = i; break; } }
  let voyageEnd = rows.length - 1;
  for (let i = idx + 1; i < rows.length; i++) { if (rows[i].dayType === 'T') { voyageEnd = i - 1; break; } }
  return rows.slice(voyageStart, voyageEnd + 1);
}

function getVoyageRouteCoords(voyageRows) {
  const pts = [];
  voyageRows.forEach(r => { if (r.dayType !== 'S') { const c = resolveCoords(r.portName); if (c) pts.push(c); } });
  return pts;
}

function initDeployMap() {
  if (_depMap) return;
  _depMap = L.map('deploy-map', {center: [20, 10], zoom: 2, scrollWheelZoom: true, worldCopyJump: true});
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap © CARTO', subdomains: 'abcd', maxZoom: 19
  }).addTo(_depMap);
  setTimeout(() => _depMap.invalidateSize(), 120);
  startLiveTracking();
}

export async function initDeployment() {
  if (_depData) {
    setTimeout(() => { if (_depMap) _depMap.invalidateSize(); }, 200);
    return;
  }
  const ok = await fetchSchedule();
  if (!ok) return;
  _showDeployMap();
}

export function _showDeployMap() {
  document.getElementById('deploy-loading').style.display = 'none';
  document.getElementById('deploy-map-section').style.display = 'block';
  if (!document.getElementById('deploy-date').value) {
    document.getElementById('deploy-date').value = new Date().toISOString().slice(0, 10);
  }
  const ships = Object.keys(_depData);
  const dates = ships.flatMap(s => (_depData[s] || []).map(r => r.date));
  const minDate = dates.reduce((a, b) => a < b ? a : b, '');
  const maxDate = dates.reduce((a, b) => a > b ? a : b, '');
  const tCount  = ships.reduce((n, s) => n + (_depData[s] || []).filter(r => r.dayType === 'T').length, 0);
  document.getElementById('deploy-stats').innerHTML = `
    <div class="deploy-stat"><b>${ships.length}</b>Ships</div>
    <div class="deploy-stat"><b>${dates.length.toLocaleString()}</b>Day records</div>
    <div class="deploy-stat"><b>${minDate}</b>From</div>
    <div class="deploy-stat"><b>${maxDate}</b>To</div>
    <div class="deploy-stat"><b style="color:var(--blue-t);">${tCount}</b>Turnarounds</div>`;
  initDeployMap();
  deployRefresh();
}

export function deployGoToday() {
  document.getElementById('deploy-date').value = new Date().toISOString().slice(0, 10);
  deployRefresh();
}

export function deployResetView() {
  _depSelectedShip = null;
  document.getElementById('voyage-panel').style.display = 'none';
  if (_depMap) _depMap.flyTo([20, 10], 2, {duration: 1});
  deployRefresh();
}

export function deployRefresh() {
  if (!_depData || !_depMap) return;
  const dateStr = document.getElementById('deploy-date').value;
  const classF  = document.getElementById('deploy-class-filter').value;
  if (!dateStr) return;

  Object.values(_depTrails).forEach(l => { if (l) _depMap.removeLayer(l); });
  Object.values(_depMarkers).forEach(m => { if (m) _depMap.removeLayer(m); });
  Object.values(_liveMarkers).forEach(m => { if (m) _depMap.removeLayer(m); });
  _depTrails = {}; _depMarkers = {}; _liveMarkers = {};

  const todayStr = new Date().toISOString().slice(0, 10);
  const isToday  = dateStr === todayStr;
  const ships    = Object.keys(_depData).sort();
  let chipsHtml  = '';

  ships.forEach(sc => {
    const rows = _depData[sc];
    if (!rows || !rows.length) return;
    const cls = rows.find(r => r.cls)?.cls || '';
    if (classF && cls !== classF) return;
    const color      = DEPLOY_SHIP_COLORS[sc] || '#A4A4A7';
    const isSelected = _depSelectedShip === sc;
    const pos        = getShipPositionForDate(sc, dateStr);
    const voyage     = getCurrentVoyage(sc, dateStr);

    if (voyage.length > 0) {
      const pts = getVoyageRouteCoords(voyage);
      if (pts.length > 1) {
        const trail = L.polyline(pts, {
          color, weight: isSelected ? 3 : 1.5,
          opacity: isSelected ? 0.85 : 0.25,
          dashArray: isSelected ? null : '5,6',
          smoothFactor: 1.8,
        }).addTo(_depMap);
        trail.on('click', () => selectDeployShip(sc, dateStr));
        _depTrails[sc] = trail;
      }
    }

    let markerCoord = pos && pos.coord ? pos.coord : null;
    if (!markerCoord) {
      const rowsBefore = rows.filter(r => r.date <= dateStr && r.dayType !== 'S');
      const rowsAfter  = rows.filter(r => r.date > dateStr && r.dayType !== 'S');
      const before     = rowsBefore.length ? rowsBefore[rowsBefore.length - 1] : null;
      const after      = rowsAfter.length ? rowsAfter[0] : null;
      if (before && after) {
        const c1 = resolveCoords(before.portName), c2 = resolveCoords(after.portName);
        if (c1 && c2) {
          const d1 = new Date(before.date), d2 = new Date(after.date), dNow = new Date(dateStr);
          const t  = (dNow - d1) / (d2 - d1);
          markerCoord = [c1[0] + (c2[0] - c1[0]) * t, c1[1] + (c2[1] - c1[1]) * t];
        }
      } else if (before) { markerCoord = resolveCoords(before.portName); }
      else if (after)    { markerCoord = resolveCoords(after.portName); }
    }
    if (!markerCoord) return;

    const livePos = isToday && _livePositions && _livePositions.ships && _livePositions.ships[sc] ? _livePositions.ships[sc] : null;
    let hasLive   = false;
    if (livePos && livePos.lat != null && livePos.lon != null) { markerCoord = [livePos.lat, livePos.lon]; hasLive = true; }

    const isAtSea    = pos ? pos.isAtSea : true;
    const portLabel  = pos ? pos.portName : 'At sea (interpolated)';
    const dayTypeLbl = pos ? pos.dayType : '~';
    const dayTypeLabels = {T:'🔄 Turnaround — new voyage starts',X:'⚓ Port call',S:'🌊 At sea',A:'🛳 Arrival / departure day','~':'📍 Estimated position'};
    const sz = isSelected ? 28 : 20;
    const shipEmoji = cls.includes('EDGE') ? '🛳' : cls.includes('SOLSTICE') ? '⛵' : '⛴';

    const icon = L.divIcon({
      className: '',
      html: `<div style="position:relative;width:${sz+26}px;">
        <div style="font-size:${sz}px;line-height:1;filter:drop-shadow(0 2px 8px rgba(0,0,0,.9));">${shipEmoji}</div>
        <div style="position:absolute;top:-4px;right:0;background:${color};color:#fff;font-size:${isSelected?10:8}px;font-weight:700;padding:1px 4px;border-radius:3px;white-space:nowrap;line-height:1.5;">${sc}</div>
        ${hasLive?`<div style="position:absolute;top:-4px;left:-6px;background:#00ff88;color:#000;font-size:7px;font-weight:800;padding:1px 3px;border-radius:2px;line-height:1.4;animation:livePulse 1.5s ease-in-out infinite;">LIVE</div>`:''}
        ${isSelected?`<div style="position:absolute;top:${sz-2}px;left:0;width:${sz}px;height:2px;background:${color};border-radius:1px;"></div>`:''}
      </div>`,
      iconSize: [sz+26, sz+6], iconAnchor: [4, sz],
    });

    const voyageLen    = voyage.length;
    const dayInVoyage  = voyage.filter(r => r.date <= dateStr).length;
    const pct          = voyageLen > 0 ? Math.round(dayInVoyage / voyageLen * 100) : 0;
    const typeColor    = {T:'#299BE1',X:'#4dd4a0',S:'#A4A4A7',A:'#E87435','~':'#A4A4A7'}[dayTypeLbl] || '#A4A4A7';
    const nextT        = rows.find(r => r.date > dateStr && r.dayType === 'T');
    const liveUpdatedAgo = livePos ? Math.round((Date.now() - new Date(livePos.ts).getTime()) / 60000) : null;

    const popupHtml = `
      <div style="font-size:13px;font-weight:600;margin-bottom:2px;">${sc}
        <span style="background:${color};color:#fff;font-size:9px;padding:1px 5px;border-radius:3px;font-weight:600;margin-left:4px;">${cls.split(' ')[0]}</span>
        ${hasLive?`<span style="background:#00ff88;color:#000;font-size:9px;padding:1px 5px;border-radius:3px;font-weight:800;margin-left:4px;">● LIVE</span>`:''}
      </div>
      <div style="font-size:11px;color:${typeColor};font-weight:500;margin-bottom:5px;">${dayTypeLabels[dayTypeLbl]||dayTypeLbl}</div>
      <div style="font-size:12px;margin-bottom:2px;">${dayTypeLbl==='S'?'🌊 At sea':parsePortLocation(portLabel).city}</div>
      ${pos&&pos.dayType!=='S'?`<div style="font-size:10px;color:rgba(255,255,255,.5);margin-bottom:6px;">${parsePortLocation(portLabel).country}</div>`:''}
      ${pos&&pos.arrival&&pos.dayType!=='S'?`<div style="font-size:10px;color:rgba(255,255,255,.5);">Arrival ${pos.arrival} · Dep. ${pos.dep}</div>`:''}
      ${hasLive?`<div style="font-size:10px;color:#00ff88;margin-top:4px;margin-bottom:2px;">📡 AIS: ${livePos.lat.toFixed(4)}°, ${livePos.lon.toFixed(4)}°${livePos.speed!=null?' · '+livePos.speed+' kn':''}</div><div style="font-size:9px;color:rgba(255,255,255,.35);">Updated ${liveUpdatedAgo!=null?liveUpdatedAgo+' min ago':'recently'}</div>`:''}
      <div style="margin-top:8px;margin-bottom:3px;">
        <div style="display:flex;justify-content:space-between;font-size:9px;color:rgba(255,255,255,.4);margin-bottom:3px;"><span>Voyage progress</span><span>${dayInVoyage}/${voyageLen} days · ${pct}%</span></div>
        <div style="height:4px;background:rgba(255,255,255,.12);border-radius:2px;"><div style="height:4px;width:${pct}%;background:${color};border-radius:2px;"></div></div>
      </div>
      ${nextT?`<div style="font-size:10px;color:rgba(255,255,255,.45);margin-top:5px;">Next turnaround: <b style="color:var(--blue-t);">${nextT.date}</b> — ${parsePortLocation(nextT.portName).city}</div>`:''}
      <div style="margin-top:10px;border-top:.5px solid rgba(255,255,255,.1);padding-top:8px;">
        <button onclick="selectDeployShip('${sc}','${dateStr}')" style="background:${color};color:#fff;border:none;border-radius:5px;padding:5px 12px;font-size:11px;cursor:pointer;width:100%;font-weight:500;">View voyage itinerary →</button>
      </div>`;

    const marker = L.marker(markerCoord, {icon, zIndexOffset: isSelected ? 1000 : 0}).addTo(_depMap);
    marker.bindPopup(L.popup({maxWidth: 300, closeButton: true}).setContent(popupHtml));
    marker.on('click', () => { selectDeployShip(sc, dateStr); setTimeout(() => _depMarkers[sc] && _depMarkers[sc].openPopup(), 200); });
    if (isSelected) { marker.openPopup(); }
    _depMarkers[sc] = marker;

    const shipName = SHIP_NAME_MAP[sc] || sc;
    chipsHtml += `<div class="deploy-chip${isSelected?' active':''}" id="dchip-${sc}" style="${isSelected?`background:${color};border-color:${color};`:''}" onclick="selectDeployShip('${sc}','${dateStr}')">
      <div class="chip-dot" style="background:${color};"></div>${shipName}
      <span style="font-size:10px;opacity:.7;">${dayTypeLbl==='T'?'🔄':dayTypeLbl==='S'?'🌊':'⚓'}</span>
    </div>`;
  });

  document.getElementById('deploy-chips').innerHTML = chipsHtml;

  const liveEl = document.getElementById('deploy-live-status');
  if (liveEl) {
    if (_livePositions && _livePositions.updated && isToday) {
      const minsAgo   = Math.round((Date.now() - new Date(_livePositions.updated).getTime()) / 60000);
      const shipCount = Object.keys(_livePositions.ships || {}).length;
      liveEl.innerHTML = `<span style="color:#00ff88;font-weight:700;">● LIVE</span> ${shipCount} ships · ${minsAgo}m ago`;
    } else { liveEl.innerHTML = ''; }
  }

  const d    = new Date(dateStr + 'T12:00:00');
  const opts = {weekday:'short', year:'numeric', month:'long', day:'numeric'};
  document.querySelector('#page-deployment .page-sub').textContent =
    `Showing positions for ${d.toLocaleDateString('en-US', opts)} — T days mark new voyage starts`;

  if (_depSelectedShip) renderVoyagePanel();
}

export function selectDeployShip(sc, dateStr) {
  _depSelectedShip  = sc;
  _depCurrentVoyage = getCurrentVoyage(sc, dateStr || document.getElementById('deploy-date').value);
  deployRefresh();
  const markerCoord = _depMarkers[sc] ? _depMarkers[sc].getLatLng() : null;
  if (markerCoord && _depMap) {
    _depMap.flyTo([markerCoord.lat, markerCoord.lng], Math.max(_depMap.getZoom(), 4), {duration: 0.9});
  }
  document.getElementById('voyage-panel').style.display = 'block';
  renderVoyagePanel();
  document.getElementById('voyage-panel').scrollIntoView({behavior: 'smooth', block: 'nearest'});
}

export function closeVoyagePanel() {
  _depSelectedShip = null;
  document.getElementById('voyage-panel').style.display = 'none';
  deployRefresh();
}

function getNextVoyages(sc, fromDate, count) {
  count = count || 4;
  if (!_depData || !_depData[sc]) return [];
  const rows  = _depData[sc];
  const tIdxs = [];
  rows.forEach((r, i) => { if (r.dayType === 'T') tIdxs.push(i); });
  if (!tIdxs.length) return [];
  let segStart = 0;
  for (let i = tIdxs.length - 1; i >= 0; i--) { if (rows[tIdxs[i]].date <= fromDate) { segStart = i; break; } }
  const voyages = [];
  for (let vi = segStart; vi < tIdxs.length && voyages.length < count; vi++) {
    const vStart = tIdxs[vi];
    const vEnd   = vi + 1 < tIdxs.length ? tIdxs[vi+1] - 1 : rows.length - 1;
    voyages.push(rows.slice(vStart, vEnd + 1));
  }
  return voyages;
}

export function toggleVoyageCard(idx) {
  const body = document.getElementById('vcb-' + idx);
  const chev = document.getElementById('vcc-' + idx);
  if (!body) return;
  const open = body.classList.toggle('open');
  if (chev) chev.classList.toggle('open', open);
}

function renderVoyagePanel() {
  if (!_depSelectedShip) return;
  const sc       = _depSelectedShip;
  const dateStr  = document.getElementById('deploy-date').value;
  const color    = DEPLOY_SHIP_COLORS[sc] || '#A4A4A7';
  const shipName = SHIP_NAME_MAP[sc] || sc;
  const voyages  = getNextVoyages(sc, dateStr, 4);

  document.getElementById('voyage-panel-title').innerHTML =
    `<span style="font-size:14px;font-weight:600;">${shipName}</span>
     <span style="background:${color};color:#fff;font-size:9px;padding:1px 5px;border-radius:3px;margin-left:6px;">${sc}</span>
     <span style="font-size:11px;color:var(--text2);margin-left:8px;">Next ${voyages.length} voyage${voyages.length!==1?'s':''}</span>`;

  if (!voyages.length) {
    document.getElementById('voyage-cards').innerHTML = '<div style="padding:1.5rem;text-align:center;color:var(--text2);font-size:13px;">No voyage data available.</div>';
    return;
  }

  const DAY_NAMES  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const MONTH_ABB  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const fmtDateShort = ds => { const d = new Date(ds+'T12:00:00'); return `${MONTH_ABB[d.getMonth()]} ${d.getDate()}`; };

  const cardsHtml = voyages.map((vRows, vi) => {
    const isCurrent = vi === 0;
    const tDay      = vRows.find(r => r.dayType === 'T');
    const homeport  = tDay ? tDay.portName.split(',')[0] : '—';
    const vStart    = vRows[0].date;
    const vEnd      = vRows[vRows.length-1].date;
    const dur       = vRows.length;
    const portCalls = vRows.filter(r => r.dayType === 'X' || r.dayType === 'A');
    const seaDays   = vRows.filter(r => r.dayType === 'S').length;

    const portNames = portCalls.map(r => r.portName.toUpperCase());
    let region = '';
    if (portNames.length) {
      const joined = portNames.join(' ');
      if (/ALASKA|JUNEAU|SKAGWAY|KETCHIKAN|SITKA|GLACIER|SEWARD/.test(joined)) region = 'Alaska';
      else if (/ARCTIC|SVALBARD|LONGYEARBYEN|HONNINGSVAG/.test(joined)) region = 'Arctic';
      else if (/NORWAY|BERGEN|FLAM|STAVANGER|TRONDHEIM|GEIRANGER|ALESUND/.test(joined)) region = 'Norway';
      else if (/SWEDEN|FINLAND|DENMARK|ESTONIA|LATVIA|ICELAND|TALLINN|VISBY/.test(joined)) region = 'Northern Europe';
      else if (/JAPAN|TOKYO|OSAKA|YOKOHAMA|NAGASAKI|HIROSHIMA|KOBE/.test(joined)) region = 'Japan';
      else if (/BALI|INDONESIA|LOMBOK|BENOA/.test(joined)) region = 'Indonesia';
      else if (/SINGAPORE|MALAYSIA|PENANG|VIETNAM/.test(joined)) region = 'SE Asia';
      else if (/AUSTRALIA|SYDNEY|MELBOURNE|BRISBANE|CAIRNS|HOBART/.test(joined)) region = 'Australia';
      else if (/NEW ZEALAND|AUCKLAND|WELLINGTON/.test(joined)) region = 'New Zealand';
      else if (/TURKEY|ISTANBUL|KUSADASI|BODRUM|ISRAEL|HAIFA/.test(joined)) region = 'E. Mediterranean';
      else if (/GREECE|ATHENS|SANTORINI|MYKONOS|PIRAEUS|RHODES|CRETE|CORFU/.test(joined)) region = 'Greek Islands';
      else if (/CROATIA|MONTENEGRO|KOTOR|DUBROVNIK|SPLIT/.test(joined)) region = 'Adriatic';
      else if (/ITALY|NAPLES|CIVITAVECCHIA|GENOA|VENICE|LIVORNO|ROME/.test(joined)) region = 'Italy';
      else if (/BARCELONA|SPAIN|MALAGA|PALMA/.test(joined)) region = 'Spain';
      else if (/MARSEILLE|NICE|MONACO|FRANCE/.test(joined)) region = 'French Riviera';
      else if (/LISBON|PORTUGAL|PORTO/.test(joined)) region = 'Iberia';
      else if (/CANARY|GRAN CANARIA|TENERIFE|LANZAROTE/.test(joined)) region = 'Canary Islands';
      else if (/BERMUDA/.test(joined)) region = 'Bermuda';
      else if (/HAWAII|HONOLULU|MAUI|HILO/.test(joined)) region = 'Hawaii';
      else if (/PANAMA|CANAL/.test(joined)) region = 'Panama Canal';
      else if (/MEXICO|COZUMEL|PUERTO VALLARTA/.test(joined)) region = 'Mexico';
      else if (/BAHAMAS|NASSAU|BIMINI|COCOCAY/.test(joined)) region = 'Bahamas';
      else if (/CARIBBEAN|PUERTO RICO|BARBADOS|ANTIGUA|ARUBA|CURACAO|MAARTEN|CAYMAN|LABADEE/.test(joined)) region = 'Caribbean';
      else if (/SOUTHAMPTON|ENGLAND|DOVER|EDINBURGH/.test(joined)) region = 'UK';
      else if (/DUBAI|UAE|ABU DHABI|MUSCAT|OMAN/.test(joined)) region = 'Middle East';
      else region = 'Worldwide';
    }

    const seenPorts = new Set();
    const chips     = [`<span class="vc-chip turnaround">🔄 ${homeport}</span>`];
    seenPorts.add(homeport.toUpperCase());
    portCalls.forEach(r => {
      const pn = r.portName.split(',')[0];
      if (!seenPorts.has(pn.toUpperCase())) {
        chips.push(`<span class="vc-chip${r.date===dateStr?' today':''}">${pn}</span>`);
        seenPorts.add(pn.toUpperCase());
      }
    });

    let lastMonth = '';
    const tableRows = vRows.map(r => {
      const d = new Date(r.date + 'T12:00:00');
      const isRef = r.date === dateStr;
      const monthLabel = `${MONTH_ABB[d.getMonth()]} ${d.getFullYear()}`;
      let sep = '';
      if (monthLabel !== lastMonth) {
        lastMonth = monthLabel;
        sep = `<tr><td colspan="5" style="padding:4px 8px;font-size:9px;font-weight:600;color:var(--text2);letter-spacing:.06em;text-transform:uppercase;background:rgba(255,255,255,.03);border-bottom:.5px solid var(--border);">${monthLabel}</td></tr>`;
      }
      const typeCell  = `<div class="vt-type ${r.dayType}" style="width:18px;height:18px;font-size:8px;">${r.dayType}</div>`;
      const portDisp  = r.dayType === 'S' ? `<span style="color:var(--text2);font-style:italic;font-size:11px;">At sea</span>` : `<span style="font-weight:${r.dayType==='T'?600:400};font-size:12px;">${r.portName.split(',')[0]}</span>`;
      const todayBadge = isRef ? '<span class="vt-today-badge" style="margin-left:4px;">TODAY</span>' : '';
      const arrDep    = (r.dayType !== 'S' && (r.arrival || r.dep)) ? `<span style="font-size:10px;color:var(--text2);">${r.arrival?r.arrival:''}${r.arrival&&r.dep?' / ':''}${r.dep?r.dep:''}</span>` : '';
      return `${sep}<tr style="${isRef?'background:rgba(232,116,53,.08);':''}${r.dayType==='T'?'background:rgba(41,155,225,.05);':''}">
        <td style="white-space:nowrap;font-size:10px;color:var(--text2);">${DAY_NAMES[d.getDay()]} ${fmtDateShort(r.date)}${todayBadge}</td>
        <td style="text-align:center;">${typeCell}</td>
        <td>${portDisp}</td>
        <td style="font-size:10px;color:var(--text2);">${r.country&&r.dayType!=='S'?r.country:''}</td>
        <td>${arrDep}</td>
      </tr>`;
    }).join('');

    const badge = isCurrent ? `<span class="vc-badge current">CURRENT</span>` : `<span class="vc-badge upcoming">Voyage ${vi+1}</span>`;
    return `<div class="voyage-card ${isCurrent?'vc-current':'vc-future'}" id="vc-${vi}">
      <div class="voyage-card-hdr" onclick="toggleVoyageCard(${vi})">
        <div class="voyage-card-hdr-left">
          ${badge}
          <span class="vc-homeport">🔄 ${homeport}</span>
          ${region?`<span class="vc-region">${region}</span>`:''}
        </div>
        <div class="voyage-card-hdr-right">
          <span class="vc-dates">${fmtDateShort(vStart)} – ${fmtDateShort(vEnd)}</span>
          <span class="vc-dur">${dur}d</span>
          <span style="font-size:10px;">⚓${portCalls.length} 🌊${seaDays}</span>
          <span class="vc-chevron${isCurrent?' open':''}" id="vcc-${vi}">▾</span>
        </div>
      </div>
      <div class="voyage-card-body${isCurrent?' open':''}" id="vcb-${vi}">
        <div class="vc-port-chips">${chips.join('')}</div>
        <div style="overflow-x:auto;max-height:360px;overflow-y:auto;border-top:.5px solid var(--border);">
          <table class="voyage-table" style="font-size:11px;">
            <thead><tr>
              <th style="min-width:100px;">Date</th>
              <th style="width:28px;">Type</th>
              <th>Port</th>
              <th>Country</th>
              <th>Arr / Dep</th>
            </tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>
      </div>
    </div>`;
  }).join('');

  document.getElementById('voyage-cards').innerHTML = cardsHtml;
  setTimeout(() => {
    const todayRow = document.querySelector('#vcb-0 .vt-today-badge');
    if (todayRow) todayRow.closest('tr')?.scrollIntoView({behavior: 'smooth', block: 'nearest'});
  }, 80);
}

window.initDeployment   = initDeployment;
window.deployGoToday    = deployGoToday;
window.deployResetView  = deployResetView;
window.deployRefresh    = deployRefresh;
window.selectDeployShip = selectDeployShip;
window.closeVoyagePanel = closeVoyagePanel;
window.toggleVoyageCard = toggleVoyageCard;
