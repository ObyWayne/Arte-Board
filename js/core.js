let LINE = null; // Aucune donnée — importer un fichier .xlsx ou .zip
/* ── core.js — État global, init ── */
/* ═══════════════════════════════════════════════
   ÉTAT
═══════════════════════════════════════════════ */
let currentDir = 'aller';
let currentSc  = 0;
let isDark = true;
let isEN   = false;
let _settingsOpen = false;
let _cycleShowPct = false;
let _occupShowPct = false;
let _speedUnit    = 'km/h';   // 'km/h' | 'm/s' | 'mi/h'
let _decTime      = 1;        // décimales temps
let _decDist      = 2;        // décimales distance
let _decSpd       = 1;        // décimales vitesse
let _kpiSticky    = false;    // KPIs figés

function toggleCyclePct(){
  _cycleShowPct = !_cycleShowPct;
  const btn = document.getElementById('cyclePctBtn');
  if(btn) btn.classList.toggle('active', _cycleShowPct);
  if(LINE && typeof renderCharts === 'function') renderCharts(currentSc);
}

/* ── Conversion vitesse selon unité choisie ── */
function cvtSpd(kmh){
  if(_speedUnit === 'm/s')  return (kmh / 3.6).toFixed(_decSpd);
  if(_speedUnit === 'mi/h') return (kmh / 1.60934).toFixed(_decSpd);
  return kmh.toFixed(_decSpd);
}
function spdUnit(){ return _speedUnit; }

function toggleOccupPct(){
  _occupShowPct = !_occupShowPct;
  const btn = document.getElementById('occupPctBtn');
  if(btn) btn.classList.toggle('active', _occupShowPct);
  if(LINE && typeof renderOccupKPI === 'function') renderOccupKPI();
}
let radarActiveScenarios  = null;
let bubbleActiveSc       = null;  // index unique du scénario affiché dans le graphique montées/descentes
let bubbleDir            = 'aller'; // direction affichée dans le graphique montées/descentes
let _chargeView          = 'flux'; // 'flux' | 'charge'
let _dwVisible           = true;

const CX=50, DOT_R=8, TERM_R=11, ROW_H=58, ROW_R=40;
const CARREFOUR_RATIO=0.20;

/* ═══════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════ */
function showEmptyState(){
  // Topbar
  document.getElementById('topEtude').textContent = 'Arte-board';
  document.getElementById('topBadge').textContent  = '';
  document.getElementById('topBadge').style.display = 'none';
  document.getElementById('footerLine').textContent = T('footerNoLine');

  // Scénario bar vide
  const nomRow = document.getElementById('scNomRow');
  const spRow  = document.getElementById('scSPRow');
  if(nomRow) nomRow.innerHTML = '';
  if(spRow)  spRow.innerHTML  = '';

  // KPIs vides
  ['kpiA','kpiAR','kpiR','kpiRR','kpiFreq','kpiFlotte','kpiDist'].forEach(id=>{
    const el = document.getElementById(id); if(el) el.textContent='—';
  });

  // SVG vide
  const svg = document.getElementById('schemaSvg');
  if(svg){ svg.setAttribute('height','0'); svg.innerHTML=''; }

  // Tableau vide
  const tb = document.getElementById('tableBody');
  if(tb) tb.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:3rem;color:var(--text3);font-size:.75rem;letter-spacing:.1em;text-transform:uppercase">${T('noData')}</td></tr>`;

  // Charts vides
  const bop  = document.getElementById('bopCard');
  const cyc  = document.getElementById('cycleCard');
  const empty = `<div style="display:flex;align-items:center;justify-content:center;height:80px;color:var(--text3);font-size:.65rem;letter-spacing:.08em;text-transform:uppercase">—</div>`;
  if(bop) bop.innerHTML = empty;
  if(cyc) cyc.innerHTML = empty;

  // Scénario label
  const lbl = document.getElementById('scLabel'); if(lbl) lbl.textContent = '—';
}

let GLOBAL_IMAGE_MAP = {}; // images chargées depuis le ZIP
let PLAGES = [
  {type:'HS', debut:0,    fin:300,  freq:null},
  {type:'HC', debut:300,  fin:420,  freq:null},
  {type:'HP', debut:420,  fin:540,  freq:null},
  {type:'HC', debut:540,  fin:1020, freq:null},
  {type:'HP', debut:1020, fin:1170, freq:null},
  {type:'HC', debut:1170, fin:1320, freq:null},
  {type:'HS', debut:1320, fin:1440, freq:null},
];

/* ── Entry point called after all fragments are loaded ── */
function initApp(){
  rebuildUI();
  requestAnimationFrame(()=>{ if(!LINE){ showEmptyState && showEmptyState(); } else { render(); } });
  if(typeof carouselRender === 'function') carouselRender();
  if(typeof slidesListRender === 'function') slidesListRender();
  if(typeof applyLang === 'function') applyLang();
  if(typeof drawClock === 'function') drawClock();
  if(typeof updateClockLegend === 'function') updateClockLegend();
}

let currentTab = 'parcours';  // onglet actif — mis à jour par switchTab()
