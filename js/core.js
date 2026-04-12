/* ── core.js — État global, init ── */
/* ═══════════════════════════════════════════════
   DONNÉES
═══════════════════════════════════════════════ */
let LINE     = null; // Données projet principal
let LINE_REF = null; // Données version de référence (comparaison inter-projets)

/* ═══════════════════════════════════════════════
   ÉTAT NAVIGATION
═══════════════════════════════════════════════ */
let currentDir = 'aller';
let currentSc  = 0;
let currentTab = 'parcours'; // mis à jour par switchTab()

/* ═══════════════════════════════════════════════
   ÉTAT UI
═══════════════════════════════════════════════ */
let isDark = true;
let isEN   = false;
let _settingsOpen = false;
let _kpiSticky    = false;    // KPIs figés

/* ═══════════════════════════════════════════════
   PRÉFÉRENCES D'AFFICHAGE
═══════════════════════════════════════════════ */
let _cycleShowPct = false;
let _occupShowPct = false;
let _speedUnit    = 'km/h';   // 'km/h' | 'm/s' | 'mi/h'
let _decTime      = 1;        // décimales temps
let _decDist      = 2;        // décimales distance
let _decSpd       = 1;        // décimales vitesse

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
/* ═══════════════════════════════════════════════
   ÉTAT GRAPHIQUES COMPARATIF
═══════════════════════════════════════════════ */
let radarActiveScenarios = null;
let bubbleActiveSc       = null;  // index du scénario affiché dans le serpent de charge
let bubbleDir            = 'aller'; // direction affichée dans le serpent de charge
let _chargeView          = 'flux'; // 'flux' | 'charge'
let _dwVisible           = true;   // affichage des temps d'arrêt dans le tableau

/* ═══════════════════════════════════════════════
   CONSTANTES SVG (schéma parcours)
   CX       : centre X de la colonne station
   DOT_R    : rayon des points d'arrêt
   TERM_R   : rayon des terminus (plus grand)
   ROW_H    : hauteur d'une ligne station (px)
   ROW_R    : rayon de la ligne de tracé
   CARREFOUR_RATIO : fraction de ROW_H réservée aux carrefours
═══════════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════════
   PLAGES HORAIRES — valeurs par défaut réseau générique
   Surchargées à l'import si la feuille PLAGES_HORAIRES
   est présente dans le xlsx (via applyPlagesFromWb).
   Bornes en minutes depuis minuit (ex: 420 = 07h00).
═══════════════════════════════════════════════ */
const _PL_HS1_FIN  = 300;  //  05h00 — fin HS nuit
const _PL_HC1_FIN  = 420;  //  07h00 — fin HC matin
const _PL_HP1_FIN  = 540;  //  09h00 — fin HP matin
const _PL_HC2_FIN  = 1020; //  17h00 — fin HC journée
const _PL_HP2_FIN  = 1170; //  19h30 — fin HP soir
const _PL_HC3_FIN  = 1320; //  22h00 — fin HC soir
// _PL_HS2_FIN = 1440 (minuit) — implicite

let PLAGES = [
  {type:'HS', debut:0,            fin:_PL_HS1_FIN, freq:null},
  {type:'HC', debut:_PL_HS1_FIN, fin:_PL_HC1_FIN, freq:null},
  {type:'HP', debut:_PL_HC1_FIN, fin:_PL_HP1_FIN, freq:null},
  {type:'HC', debut:_PL_HP1_FIN, fin:_PL_HC2_FIN, freq:null},
  {type:'HP', debut:_PL_HC2_FIN, fin:_PL_HP2_FIN, freq:null},
  {type:'HC', debut:_PL_HP2_FIN, fin:_PL_HC3_FIN, freq:null},
  {type:'HS', debut:_PL_HC3_FIN, fin:1440,         freq:null},
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