/* ── render.comparatif.js — Radar, SP, table, terminus comparison ── */
/* ═══════════════════════════════════════════════
   COMPARATIF
═══════════════════════════════════════════════ */
/* ── Utilitaires de formatage (tableau comparatif) ── */

// Convertit des minutes en "mm:ss"
// Ex : 45.5 min → "45:30"
function fmtMmSs(minutes) {
  if (!minutes && minutes !== 0) return '—';
  const totalSec = Math.round(minutes * 60);
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  return `${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
}

// Convertit des minutes en "hh:mm:ss"
// Ex : 90.5 min → "01:30:30"
function fmtHhMmSs(minutes) {
  if (!minutes && minutes !== 0) return '—';
  const totalSec = Math.round(minutes * 60);
  const hh = Math.floor(totalSec / 3600);
  const mm = Math.floor((totalSec % 3600) / 60);
  const ss = totalSec % 60;
  return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
}

// Formate la valeur SMR :
// - si c'est un nombre pur → affiché tel quel (capacité passagers)
// - si c'est une durée en minutes → format mm:ss
function fmtSmr(val) {
  if (val === null || val === undefined || val === '') return '—';
  const n = parseFloat(val);
  if (isNaN(n)) return String(val);
  // Heuristique : si < 300, probablement une capacité (passagers)
  // si >= 300 ou si val contient ":", c'est un temps en secondes/minutes
  if (typeof val === 'string' && val.includes(':')) return fmtMmSs(n);
  return String(n); // capacité numérique pure, pas d'unité
}




function computeKPIsAll(){
  if(!LINE || !LINE.scenarios || LINE.scenarios.length === 0) return [];

  const savedStations     = LINE.stations;
  const savedInter        = LINE.inter;
  const savedRetournement = LINE.retournement;
  const savedTendu        = LINE.tendu;
  const savedTenduR       = LINE.tenduR;
  const savedDetenteA     = LINE.detenteA;
  const savedDetenteR     = LINE.detenteR;

  const results = [];
  LINE.scenarios.forEach((sc, i) => {
    
    try {
      // Injecter les données du scénario i
      if(LINE.scenariosData && LINE.scenariosData[i]){
        const d = LINE.scenariosData[i];
        LINE.stations     = d.stations;
        LINE.inter        = d.inter;
        LINE.retournement = d.retournement;
        LINE.tendu        = d.tendu;
        LINE.tenduR       = d.tenduR;
        LINE.detenteA     = d.detenteA;
        LINE.detenteR     = d.detenteR;
      }
      const k = computeKPIs(i);
      const tPrioA = LINE.inter.reduce((a,seg)=>a+(seg.tpsA||0),0)/60;
      const tPrioR = LINE.inter.reduce((a,seg)=>a+(seg.tpsR||0),0)/60;
      const nSt = LINE.stations.length || 1;
      const moyMontees   = LINE.stations.reduce((a,s)=>a+(s.monteesA||0),0) / nSt;
      const moyDescentes = LINE.stations.reduce((a,s)=>a+(s.descentesA||0),0) / nSt;
      const nStations    = nSt;
      const distInterMoy = LINE.inter.length > 0
        ? +(LINE.inter.reduce((a,b)=>a+b.dist,0) / LINE.inter.length).toFixed(0)
        : 0;

results.push({
  ...k, sc, scIdx:i,
  tPrioA, tPrioR, tPrioTotal: tPrioA + tPrioR,
  moyMontees, moyDescentes, nStations, distInterMoy,
  smrCapacite: sc.smrCapacite ?? null 
});
    } catch(e){
      console.error(`[computeKPIsAll] erreur scénario ${i} (${sc?.id}):`, e);
    }
  });

  // Restaurer les données du scénario courant
  LINE.stations     = savedStations;
  LINE.inter        = savedInter;
  LINE.retournement = savedRetournement;
  LINE.tendu        = savedTendu;
  LINE.tenduR       = savedTenduR;
  LINE.detenteA     = savedDetenteA;
  LINE.detenteR     = savedDetenteR;

  return results;
}

function renderComparatif(){
  if(!LINE){ console.warn('[renderComparatif] LINE is null'); return; }
  let all;
  try { all = computeKPIsAll(); } catch(e){ console.error('[renderComparatif] computeKPIsAll threw:', e); return; }
  console.log('[renderComparatif] all.length =', all.length, '| scenarios =', LINE.scenarios.length);
  if(all.length === 0){
    document.getElementById('radarScSelector').innerHTML  = '';
    document.getElementById('chargeScSelector').innerHTML = '';
    const el=document.getElementById('radarSvg');
    if(el) el.innerHTML=`<text x="160" y="140" text-anchor="middle" font-family="Barlow Condensed,sans-serif" font-size="11" fill="var(--text3)">Aucune donnée disponible</text>`;
    return;
  }

  const SC_COLORS = [BRAND.aller, BRAND.retour, BRAND.primaire2, BRAND.cycle, BRAND.primaire1,'#e8453c'];

  // ── Radar : nominaux uniquement ──
  if(!radarActiveScenarios || radarActiveScenarios.size === 0)
    radarActiveScenarios = new Set(all.map((_,i)=>i).filter(i=>all[i].sc.type==='NOMINAL'));
  for(const idx of radarActiveScenarios)
    if(idx>=all.length||all[idx].sc.type!=='NOMINAL') radarActiveScenarios.delete(idx);

  const radarSel = document.getElementById('radarScSelector');
  radarSel.innerHTML = all.map((k,i)=>{
    if(k.sc.type !== 'NOMINAL') return '';
    const col=SC_COLORS[i%SC_COLORS.length], on=radarActiveScenarios.has(i);
    return `<button class="radar-sc-btn${on?' on':''}" style="border-color:${col};color:${col};${on?`background:${col}22`:''}" onclick="toggleRadarSc(${i})">${k.sc.label}</button>`;
  }).join('');

  const SPFiltered  = all.filter((_,i)=>radarActiveScenarios.has(i));
  const allNominal = all.filter(d => (d.sc.type||'NOMINAL').toUpperCase() === 'NOMINAL');
  
  // ── Montées/Descentes : sélection unique ──
  if (bubbleActiveSc === null || bubbleActiveSc >= allNominal.length) bubbleActiveSc = 0;
  _buildBubbleScPills(allNominal);

  


  try { renderRadar(all, SPFiltered); } catch(e){ console.error('[renderComparatif] renderRadar:', e); }
  try { renderBubbleChart(allNominal, bubbleActiveSc); } catch(e){ console.error('[renderComparatif] renderBubbleChart:', e); }
  try { renderCompTable(all); } catch(e){ console.error('[renderComparatif] renderCompTable:', e); }
  try { renderSPMatrix(); } catch(e){ console.error('[renderComparatif] renderSPMatrix:', e); }
  try { renderCompTerminus(all); } catch(e){ console.error('[renderComparatif] renderCompTerminus:', e); }
}

function toggleRadarSc(idx){
  if(!radarActiveScenarios) radarActiveScenarios = new Set();
  if(radarActiveScenarios.has(idx)){ if(radarActiveScenarios.size>1) radarActiveScenarios.delete(idx); }
  else radarActiveScenarios.add(idx);
  if(LINE) renderComparatif();
}

function selectBubbleSc(idx){
  bubbleActiveSc = idx;
  _buildBubbleScPills(window._lastBubbleAll || []);
  if(LINE) renderBubbleChart(window._lastBubbleAll || [], bubbleActiveSc);
}
function setBubbleDir(dir){
  bubbleDir = dir;
  // Mise à jour visuelle des boutons
  const btnA = document.getElementById('bubbleDirBtnA');
  const btnR = document.getElementById('bubbleDirBtnR');
  if(btnA){ btnA.classList.toggle('active', dir === 'aller'); }
  if(btnR){ btnR.classList.toggle('active', dir === 'retour'); }
  // Recalcul avec la nouvelle direction
  if(LINE) renderBubbleChart(window._lastBubbleAll || [], bubbleActiveSc);
}

function _buildBubbleScPills(all){
  const sel = document.getElementById('chargeScSelector');
  if(!sel) return;
  sel.innerHTML = all.map((k,i)=>`
    <div class="sc-pill${i===bubbleActiveSc?' on':''}"
         onclick="selectBubbleSc(${i})">${k.sc.label}</div>
  `).join('');
}

/* ── MATRICE SP ── */
function renderSPMatrix(){
  const el = document.getElementById('spMatrixContainer');
  if(!el || !LINE) return;

  const stations = LINE.stations;
  const N = stations.length;
  const infra = LINE.infra || [];

  // Collecter tous les scénarios SP avec leur bloc
  const spScenarios = LINE.scenarios.map((sc, i) => {
    if(sc.type !== 'SP' || !sc.debutBloc || !sc.finBloc) return null;
    const names = stations.map(s => s.nom.trim().toLowerCase());
    const iA = names.indexOf(sc.debutBloc.trim().toLowerCase());
    const iB = names.indexOf(sc.finBloc.trim().toLowerCase());
    if(iA < 0 || iB < 0) return null;
    return { sc, i, blocMin: Math.min(iA,iB), blocMax: Math.max(iA,iB) };
  }).filter(Boolean);

  if(spScenarios.length === 0){
    el.innerHTML = `<div style="color:var(--text3);font-size:.65rem;padding:.75rem;text-align:center">${T('noSPLoaded')}</div>`;
    return;
  }

  // Dépôts depuis LINE.infra — chaque dépôt est rattaché à une station (stDeb)
  // On détermine son index de station pour savoir s'il est dans le bloc ou non
  const names = stations.map(s => s.nom.trim().toLowerCase());
  const depots = infra
    .filter(e => e.type === 'DEPOT')
    .map(e => {
      const stIdx = names.indexOf((e.stDeb||'').trim().toLowerCase());
      return { label: e.label || e.desc || 'Dépôt', stIdx };
    })
    .filter(d => d.stIdx >= 0);

  // Pour chaque station-incident i, trouver le SP le plus serré qui la couvre
  function spForIncident(i){
    let best = null, bestSize = Infinity;
    for(const sp of spScenarios){
      if(i >= sp.blocMin && i <= sp.blocMax){
        const size = sp.blocMax - sp.blocMin;
        if(size < bestSize){ best = sp; bestSize = size; }
      }
    }
    return best;
  }

  // En-tête : stations + séparateur + dépôts
  let h = `<table class="sp-matrix"><thead><tr>`;
  h += `<th class="row-hdr col-hdr" style="min-width:80px;width:80px">${isEN?'Incident station':'Station (incident)'}</th>`;
  for(let j=0; j<N; j++){
    const nm = stations[j].nom;
    h += `<th class="col-hdr" title="${nm}">${nm}</th>`;
  }
  // Séparateur visuel + colonnes dépôts
  if(depots.length > 0){
    h += `<th class="col-hdr" style="min-width:6px;background:var(--bg2);border-left:2px solid var(--border2)"></th>`;
    depots.forEach(d => {
      h += `<th class="col-hdr sp-depot-hdr" title="${d.label}">${d.label}</th>`;
    });
  }
  h += `</tr></thead><tbody>`;

  for(let i=0; i<N; i++){
    const sp = spForIncident(i);
    h += `<tr>`;
    h += `<th class="row-hdr" title="${stations[i].nom}">${stations[i].nom}</th>`;
    // Colonnes stations
    for(let j=0; j<N; j++){
      if(!sp){
        h += `<td class="sp-none"></td>`;
      } else if(j === i){
        h += `<td class="sp-red" title="${stations[j].nom}">✕</td>`;
      } else if(j >= sp.blocMin && j <= sp.blocMax){
        h += `<td class="sp-orange" title="${stations[j].nom}"></td>`;
      } else {
        h += `<td class="sp-green" title="${stations[j].nom}"></td>`;
      }
    }
    // Colonnes dépôts
    if(depots.length > 0){
      h += `<td style="border-left:2px solid var(--border2);background:var(--bg2)"></td>`;
      depots.forEach(d => {
        if(!sp){
          h += `<td class="sp-none" title="${d.label}"></td>`;
          return;
        }
        const inBloc = d.stIdx >= sp.blocMin && d.stIdx <= sp.blocMax;
        const isFinDeLigne = sp.blocMin === 0 || sp.blocMax === N - 1;

        if(inBloc){
          // Dépôt dans le bloc → totalement coupé
          h += `<td class="sp-orange" title="${d.label} — coupé"></td>`;
        } else if(isFinDeLigne){
          // Bloc en bout de ligne → un seul tronçon actif, dépôt forcément accessible
          h += `<td class="sp-depot-ok" title="${d.label} — ${T('depotAccessible')}"></td>`;
        } else {
          // SP milieu : 2 tronçons (A = 0..blocMin-1, B = blocMax+1..N-1)
          const onA = d.stIdx < sp.blocMin;
          const onB = d.stIdx > sp.blocMax;
          if(onA && onB){
            // Impossible mais sécurité
            h += `<td class="sp-depot-ok" title="${d.label} — accessible"></td>`;
          } else if(onA){
            // Accessible depuis tronçon A seulement → moitié bleu (A, gauche) / moitié orange (B, droite)
            h += `<td class="sp-depot-split sp-depot-split-a" title="${d.label} — ${T('depotAccessA')}"></td>`;
          } else {
            // Accessible depuis tronçon B seulement → moitié orange (A, gauche) / moitié bleu (B, droite)
            h += `<td class="sp-depot-split sp-depot-split-b" title="${d.label} — ${T('depotAccessB')}"></td>`;
          }
        }
      });
    }
    h += `</tr>`;
  }

  h += `</tbody></table>`;
  el.innerHTML = h;

  const title = document.getElementById('compSPTitle');
  if(title) title.textContent = T('compSPTitle');
}

/* ── RADAR ── */
function renderRadar(all, filtered){
  _lastRadarAll = all; _lastRadarFiltered = filtered;
  const svg = document.getElementById('radarSvg');
  if(!svg) return;
  if(!filtered || filtered.length === 0) filtered = all;
  const SC_COLORS = [BRAND.aller, BRAND.retour, BRAND.primaire2, BRAND.cycle, BRAND.primaire1,'#e8453c'];
  const CX=160, CY=145, R=105;
  const AXES = [
    {key:'vitA',        label: isEN?'Speed Out':'Vit. Aller',    higher:true},
    {key:'vitR',        label: isEN?'Speed In':'Vit. Retour',    higher:true},
    {key:'tArretTotal', label: isEN?'Stops (min)':'Arrêts (min)',higher:false},
    {key:'tCycleMin',   label: isEN?'Cycle':'Cycle',             higher:false},
    {key:'tPrioTotal',  label: isEN?'Priority':'Priorité',       higher:false},
  ];

  // Exclure les scénarios SP de l'araignée
  const nominalAll = all.filter(k => k.sc.type === 'NOMINAL');
  const nominalFiltered = filtered.filter(k => k.sc.type === 'NOMINAL');
  if(nominalAll.length === 0){ svg.innerHTML = `<text x="160" y="140" text-anchor="middle" font-family="Barlow Condensed,sans-serif" font-size="11" fill="var(--text3)">${T('noNominalSc')}</text>`; return; }

  // Normalisation sur min/max globaux (tous scénarios nominaux, sélectionnés ou non)
  const allVals = AXES.map(ax => nominalAll.map(k => k[ax.key]||0));
  const gmins = allVals.map(v => Math.min(...v));
  const gmaxs = allVals.map(v => Math.max(...v));
  const norm = (v, i) => {
    const mn = gmins[i], mx = gmaxs[i];
    if(mx === mn) return 0.7;
    const n = (v - mn) / (mx - mn);
    return AXES[i].higher ? n : 1 - n;
  };

  const angle = i => (i/AXES.length)*2*Math.PI - Math.PI/2;
  const pt = (r,i) => [CX + r*Math.cos(angle(i)), CY + r*Math.sin(angle(i))];

  let h = '';
  // Grilles
  [0.25,0.5,0.75,1].forEach(f=>{
    const pts = AXES.map((_,i)=>pt(R*f,i).join(',')).join(' ');
    h += `<polygon points="${pts}" fill="none" stroke="var(--border)" stroke-width="${f===1?1.5:.7}" opacity=".6"/>`;
  });
  // Axes
  AXES.forEach((_,i)=>{
    const [x,y]=pt(R,i);
    h += `<line x1="${CX}" y1="${CY}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="var(--border)" stroke-width=".7" opacity=".7"/>`;
  });
  // Labels axes
  AXES.forEach((ax,i)=>{
    const [x,y]=pt(R+18,i);
    const anchor = x<CX-5?'end':x>CX+5?'start':'middle';
    h += `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}" dominant-baseline="middle"
      font-family="Barlow Condensed,sans-serif" font-size="9.5" font-weight="700" fill="var(--text3)">${ax.label}</text>`;
  });

  // Polygones — nominaux sélectionnés uniquement
  nominalFiltered.forEach(k=>{
    const si  = all.indexOf(k);
    const col = SC_COLORS[si%SC_COLORS.length];
    const isActive = si===currentSc;
    const norms = AXES.map((ax,i)=>norm(k[ax.key]||0,i));
    const pts = norms.map((n,i)=>pt(R*Math.max(0.02,n),i).map(v=>v.toFixed(1)).join(',')).join(' ');
    h += `<polygon points="${pts}" fill="${col}" fill-opacity="${isActive?.22:.08}" stroke="${col}" stroke-width="${isActive?2.5:1.2}" opacity="${isActive?1:.7}"/>`;
  });

  // Points + tooltips sur le scénario actif nominal visible
  const kA = nominalFiltered.find(k=>all.indexOf(k)===currentSc) || nominalFiltered[0];
  if(kA){
    const siA = all.indexOf(kA);
    const col = SC_COLORS[siA%SC_COLORS.length];
    AXES.forEach((ax,i)=>{
      const n = norm(kA[ax.key]||0,i);
      const [x,y] = pt(R*Math.max(0.02,n),i);
      const rawVal = kA[ax.key]||0;
      const disp = ax.key==='tArretTotal'||ax.key==='tCycleMin'||ax.key==='tPrioTotal' ? `${rawVal.toFixed(1)} min`
                 : `${rawVal.toFixed(1)} km/h`;
      h += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="${col}" stroke="#181c28" stroke-width="1.5"><title>${ax.label}: ${disp}</title></circle>`;
    });
  }

  // Légende — nominaux uniquement, SP absents
  nominalAll.forEach(k=>{
    const si  = all.indexOf(k);
    const col = SC_COLORS[si%SC_COLORS.length];
    const on  = radarActiveScenarios ? radarActiveScenarios.has(si) : true;
    const isActive = si===currentSc;
    const lx=8, ly=12+nominalAll.indexOf(k)*16;
    h += `<rect x="${lx}" y="${ly-5}" width="10" height="10" rx="2" fill="${col}" opacity="${on?1:.2}"/>`;
    h += `<text x="${lx+14}" y="${ly+0.5}" dominant-baseline="middle" font-family="Barlow Condensed,sans-serif" font-size="9" font-weight="${isActive?800:500}" fill="${on?(isActive?col:'var(--text2)'):'var(--border)'}">${k.sc.label}</text>`;
  });

  svg.innerHTML = h;
}

/* ══════════════════════════════════════════════════════════════════════════════
   SERPENT DE CHARGE — v3
   Vue flux : barres montées/descentes + fond charge cumulée
   Vue charge : barre charge unique par station
   DW théorique + lignes seuil (toggle _dwVisible)
══════════════════════════════════════════════════════════════════════════════ */

const NB_PORTE  = 16;
const SIDE      = 2;
const FLOW_RATE = 40;
const TECH_TIME = 10;
const DW_REFS   = [15, 20, 30];
const DW_COLORS = ['#3ecf6a', '#f5d623', '#e8453c'];

function calcFluxFromDw(dw, freqMin) {
  if (dw <= TECH_TIME) return 0;
  return (dw - TECH_TIME) * SIDE * NB_PORTE * FLOW_RATE / freqMin;
}
function calcDwFromFlux(flux, freqMin) {
  return TECH_TIME + (flux * freqMin) / (SIDE * NB_PORTE * FLOW_RATE);
}
function dwColor(dw) {
  if (dw < DW_REFS[0]) return '#3ecf6a';
  if (dw < DW_REFS[1]) return '#f5d623';
  return '#e8453c';
}

function renderBubbleChart(all, scIdx) {
  const canvas = document.getElementById('chargeCanvas');
  if (!canvas) return;
  window._lastBubbleAll = all;
  window._lastBubbleSc  = scIdx;
  renderBubbleChartOnCanvas(canvas, null, null, all, scIdx);
}

function renderBubbleChartOnCanvas(canvas, forcedW, forcedH, all, scIdx) {
  if (!canvas || !all || all.length === 0) return;
  if (scIdx == null || scIdx >= all.length) scIdx = 0;

  const k   = all[scIdx];
  const sc  = k.sc;
  const sts = LINE.scenariosData
    ? LINE.scenariosData[k.scIdx].stations
    : LINE.stations;
  if (!sts || sts.length === 0) return;

  const stationNames = sts.map(s => s.nom);
  const nSt          = stationNames.length;

  const isAller   = (bubbleDir === 'aller');
  const montees   = sts.map(s => isAller ? (s.monteesA   || 0) : (s.monteesR   || 0));
  const descentes = sts.map(s => isAller ? (s.descentesA || 0) : (s.descentesR || 0));

  /* Charge cumulée — aller: avant→arrière ; retour: arrière→avant */
  const chargeCum = [];
  if (isAller) {
    let cur = 0;
    for (let i = 0; i < nSt; i++) { cur += montees[i] - descentes[i]; chargeCum.push(Math.max(0, cur)); }
  } else {
    let cur = 0;
    const tmp = [];
    for (let i = nSt - 1; i >= 0; i--) { cur += montees[i] - descentes[i]; tmp[i] = Math.max(0, cur); }
    chargeCum.push(...tmp);
  }

  const freqMin  = sc.freqHP || sc.freqMin || 6;
  const dwEst    = sts.map((_, i) => calcDwFromFlux(montees[i] + descentes[i], freqMin));
  const dwRefFlux = DW_REFS.map(dw => calcFluxFromDw(dw, freqMin));

  const COL_MONTEES   = BRAND.primaire1 || '#a06bff';
  const COL_DESCENTES = BRAND.primaire2 || '#3ecf6a';
  const COL_CHARGE    = isAller ? (BRAND.aller || '#4a9eff') : (BRAND.retour || '#f5a623');

  /* Dimensions */
  const PAD = { l:54, r:72, t:24, b:80 };
  const scaleFactor = forcedW ? Math.max(1, forcedW / (PAD.l + nSt * 52 + PAD.r)) : 1;
  const BAR_W   = Math.round(20 * Math.min(scaleFactor, 2.5));
  const GRP_GAP = Math.round(10 * Math.min(scaleFactor, 2));
  const ST_GAP  = Math.round(22 * Math.min(scaleFactor, 2));
  const stW     = BAR_W * 2 + GRP_GAP + ST_GAP;

  /* Hauteur verrouillée pour éviter boucle de resize */
  let H;
  if (forcedH) {
    H = forcedH;
    canvas.dataset.lockedH = String(forcedH);
  } else if (canvas.dataset.lockedH) {
    H = parseInt(canvas.dataset.lockedH);
  } else {
    const saved = canvas.style.height;
    canvas.style.height = '0px';
    H = canvas.parentElement ? (canvas.parentElement.clientHeight || 260) : 260;
    canvas.style.height = saved;
    canvas.dataset.lockedH = String(H);
  }
  const W  = forcedW || (PAD.l + nSt * stW + PAD.r);
  const PH = H - PAD.t - PAD.b;

  const dpr = window.devicePixelRatio || 1;
  canvas.width        = W   * dpr;
  canvas.height       = H   * dpr;
  canvas.style.width  = W   + 'px';
  canvas.style.height = H   + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  /* Échelle Y1 : inclut flux DW de référence pour cohérence */
  const allFluxVals = [...montees, ...descentes, ...dwRefFlux, ...chargeCum];
  ['aller','retour'].forEach(dir => {
    sts.forEach(s => {
      allFluxVals.push(dir==='aller' ? (s.monteesA||0) : (s.monteesR||0));
      allFluxVals.push(dir==='aller' ? (s.descentesA||0) : (s.descentesR||0));
    });
  });
  let yMax1 = Math.ceil(Math.max(...allFluxVals, 1) * 1.15 / 10) * 10;
  const py1 = v => PAD.t + PH - (v / yMax1) * PH;
  const bH1 = v => (v / yMax1) * PH;

  /* Échelle Y2 : DW aligné sur Y1 via py2 = py1∘calcFluxFromDw */
  const DW_Y2_MIN = TECH_TIME;
  const DW_Y2_MAX = Math.max(...DW_REFS) * 1.1;
  const py2 = dw => py1(calcFluxFromDw(dw, freqMin));

  /* Grille */
  ctx.lineWidth = 0.9;
  for (let t = 0; t <= 5; t++) {
    ctx.strokeStyle = 'rgba(160,160,200,.12)';
    ctx.beginPath();
    ctx.moveTo(PAD.l, py1(yMax1/5*t));
    ctx.lineTo(W - PAD.r, py1(yMax1/5*t));
    ctx.stroke();
  }

  _renderBubbleYAxis(PAD, H, PH, yMax1, py1, dpr, _chargeView);

  /* Barres */
  stationNames.forEach((nom, si) => {
    const xBase   = PAD.l + si * stW;
    const xCenter = xBase + BAR_W + GRP_GAP / 2;
    const barW2   = BAR_W * 2 + GRP_GAP;

    if (_chargeView === 'flux') {
      /* Fond charge */
      const vc = chargeCum[si];
      if (vc > 0) {
        ctx.fillStyle   = COL_CHARGE + '44';
        ctx.fillRect(xBase, py1(vc), barW2, bH1(vc));
        ctx.strokeStyle = COL_CHARGE; ctx.lineWidth = 1;
        ctx.strokeRect(xBase, py1(vc), barW2, bH1(vc));
      }
      /* Montées */
      const vA = montees[si];
      if (vA > 0) {
        ctx.fillStyle   = COL_MONTEES + '55';
        ctx.fillRect(xBase, py1(vA), BAR_W, bH1(vA));
        ctx.strokeStyle = COL_MONTEES; ctx.lineWidth = 1.5;
        ctx.strokeRect(xBase, py1(vA), BAR_W, bH1(vA));
        ctx.fillStyle = 'rgba(200,210,230,.85)';
        ctx.font = 'bold 11px "Barlow Condensed",sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('↑', xBase + BAR_W/2, py1(vA) - 3);
      }
      /* Descentes */
      const vR = descentes[si];
      const xR = xBase + BAR_W + GRP_GAP;
      if (vR > 0) {
        ctx.fillStyle   = COL_DESCENTES + '55';
        ctx.fillRect(xR, py1(vR), BAR_W, bH1(vR));
        ctx.strokeStyle = COL_DESCENTES; ctx.lineWidth = 1.5;
        ctx.strokeRect(xR, py1(vR), BAR_W, bH1(vR));
        ctx.fillStyle = 'rgba(200,210,230,.85)';
        ctx.font = 'bold 11px "Barlow Condensed",sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('↓', xR + BAR_W/2, py1(vR) - 3);
      }
    } else {
      /* Vue charge : barre unique */
      const vc = chargeCum[si];
      if (vc > 0) {
        ctx.fillStyle   = COL_CHARGE + '44';
        ctx.fillRect(xBase, py1(vc), barW2, bH1(vc));
        ctx.strokeStyle = COL_CHARGE; ctx.lineWidth = 1.5;
        ctx.strokeRect(xBase, py1(vc), barW2, bH1(vc));
        ctx.fillStyle = COL_CHARGE;
        ctx.font = '700 9px "Barlow Condensed",sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(vc, xBase + barW2/2, py1(vc) - 3);
      }
    }

    /* Label station incliné */
    ctx.save();
    ctx.translate(xCenter, PAD.t + PH + 7);
    ctx.rotate(-Math.PI / 3.5);
    ctx.fillStyle = 'rgba(180,190,220,.65)';
    ctx.font = '600 10px "Barlow Condensed",sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(nom.length > 13 ? nom.slice(0,12) + '…' : nom, 0, 0);
    ctx.restore();
  });

  /* DW (lignes + courbe) — seulement si _dwVisible */
  if (_dwVisible) {
    /* Lignes horizontales DW_REFS */
    DW_REFS.forEach((dw, di) => {
      const y = py2(dw);
      if (y < PAD.t || y > PAD.t + PH) return;
      ctx.beginPath(); ctx.moveTo(PAD.l, y); ctx.lineTo(W - PAD.r, y);
      ctx.strokeStyle = DW_COLORS[di]; ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 3]); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = DW_COLORS[di];
      ctx.font = '700 9px "Barlow Condensed",sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(`${dw}s`, W - PAD.r + 4, y + 3);
    });

    /* Courbe DW théorique */
    if (nSt >= 2) {
      for (let si = 0; si < nSt - 1; si++) {
        const x1 = PAD.l + si       * stW + BAR_W + GRP_GAP/2;
        const x2 = PAD.l + (si + 1) * stW + BAR_W + GRP_GAP/2;
        ctx.beginPath(); ctx.moveTo(x1, py2(dwEst[si])); ctx.lineTo(x2, py2(dwEst[si+1]));
        ctx.strokeStyle = 'rgba(180,140,255,.85)'; ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round'; ctx.setLineDash([]); ctx.stroke();
      }
      stationNames.forEach((_, si) => {
        const xc = PAD.l + si * stW + BAR_W + GRP_GAP/2;
        ctx.beginPath(); ctx.arc(xc, py2(dwEst[si]), 3, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(180,140,255,.85)'; ctx.fill();
      });
    }
  }

  /* Axe Y2 — graduation DW_Y2_MIN → DW_Y2_MAX */
  const isLight  = document.body.classList.contains('light-mode');
  const textColY = isLight ? 'rgba(60,70,90,.6)' : 'rgba(180,190,220,.45)';
  ctx.fillStyle = textColY;
  ctx.font = '600 9px "Barlow Condensed",sans-serif'; ctx.textAlign = 'left';
  for (let t = 0; t <= 5; t++) {
    const dw = DW_Y2_MIN + (DW_Y2_MAX - DW_Y2_MIN) / 5 * t;
    const y  = py2(dw);
    if (y < PAD.t - 4 || y > PAD.t + PH + 4) continue;
    ctx.fillText(`${Math.round(dw)}s`, W - PAD.r + 4, y + 3);
    ctx.strokeStyle = 'rgba(160,160,200,.18)'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(W - PAD.r, y); ctx.lineTo(W - PAD.r + 3, y); ctx.stroke();
  }
  ctx.save();
  ctx.translate(W - 9, PAD.t + PH/2); ctx.rotate(Math.PI/2);
  ctx.fillStyle = isLight ? 'rgba(60,70,90,.35)' : 'rgba(180,190,220,.3)';
  ctx.font = '600 9px "Barlow Condensed",sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('Dwell time (s)', 0, 0); ctx.restore();

  /* Légendes */
  const legY = H - 9;
  ctx.setLineDash([]);
  ctx.font = '700 8.5px "Barlow Condensed",sans-serif'; ctx.textAlign = 'left';
  if (_chargeView === 'flux') {
    ctx.fillStyle = COL_MONTEES + 'dd'; ctx.fillRect(PAD.l, legY-7, 10, 7);
    ctx.fillStyle = 'rgba(180,190,220,.85)'; ctx.fillText(isEN?'Boardings ↑':'Montées ↑', PAD.l+13, legY);
    ctx.fillStyle = COL_DESCENTES + 'dd'; ctx.fillRect(PAD.l+82, legY-7, 10, 7);
    ctx.fillStyle = 'rgba(180,190,220,.85)'; ctx.fillText(isEN?'Alightings ↓':'Descentes ↓', PAD.l+95, legY);
    ctx.fillStyle = COL_CHARGE + 'cc'; ctx.fillRect(PAD.l+185, legY-7, 10, 7);
    ctx.fillStyle = 'rgba(180,190,220,.85)'; ctx.fillText(isEN?'Load':'Charge', PAD.l+198, legY);
  } else {
    ctx.fillStyle = COL_CHARGE + 'cc'; ctx.fillRect(PAD.l, legY-7, 10, 7);
    ctx.strokeStyle = COL_CHARGE; ctx.lineWidth = 1; ctx.strokeRect(PAD.l, legY-7, 10, 7);
    ctx.fillStyle = 'rgba(180,190,220,.85)'; ctx.fillText(isEN?'Load (cumul.)':'Charge cumulée', PAD.l+13, legY);
  }
  if (_dwVisible) {
    let legOff = _chargeView === 'flux' ? PAD.l+238 : PAD.l+138;
    DW_REFS.forEach((dw, di) => {
      ctx.strokeStyle = DW_COLORS[di]; ctx.lineWidth = 1.5;
      ctx.setLineDash([4,2]);
      ctx.beginPath(); ctx.moveTo(legOff, legY-4); ctx.lineTo(legOff+12, legY-4); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(180,190,220,.85)'; ctx.fillText(`${dw}s`, legOff+15, legY);
      legOff += 48;
    });
    ctx.strokeStyle = 'rgba(180,140,255,.85)'; ctx.lineWidth = 2.5; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(legOff, legY-4); ctx.lineTo(legOff+24, legY-4); ctx.stroke();
    ctx.fillStyle = 'rgba(180,190,220,.85)'; ctx.fillText(isEN?'DW est.':'DW théo.', legOff+27, legY);
  }

  /* Tooltip */
  canvas.onmousemove = (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx   = (e.clientX - rect.left) * (W / rect.width);
    let best = -1, bestDist = Infinity;
    stationNames.forEach((_, si) => {
      const d = Math.abs(mx - (PAD.l + si*stW + BAR_W + GRP_GAP/2));
      if (d < bestDist) { bestDist = d; best = si; }
    });
    if (best < 0 || bestDist > stW) { _hideBubbleTooltip(); return; }
    _showBubbleTooltip(e, stationNames[best], montees[best], descentes[best], chargeCum[best], dwEst[best]);
  };
  canvas.onmouseleave = () => _hideBubbleTooltip();
}

/* Tooltip */
function _getBubbleTooltip() {
  let t = document.getElementById('_bubbleTooltip');
  if (!t) {
    t = document.createElement('div');
    t.id = '_bubbleTooltip';
    t.style.cssText = [
      'position:fixed;z-index:9999;pointer-events:none;display:none',
      'background:var(--bg2);border:1px solid var(--border)',
      'border-radius:6px;padding:7px 10px',
      'font-family:"Barlow Condensed",sans-serif;font-size:11px;min-width:155px',
    ].join(';');
    document.body.appendChild(t);
  }
  return t;
}
function _showBubbleTooltip(e, nom, monteesV, descentesV, charge, dw) {
  const t = _getBubbleTooltip();
  const dwR   = Math.round(dw * 10) / 10;
  const dwCol = dwColor(dw);
  const dwLbl = dw < DW_REFS[0] ? 'OK ✓' : dw < DW_REFS[1] ? (isEN?'Caution':'Attention ⚠') : (isEN?'Critical !':'Critique !');
  const viewRows = _chargeView === 'flux'
    ? `<div style="display:flex;justify-content:space-between;gap:14px;margin:2px 0;">
        <span style="color:var(--text2);">${isEN?'Boardings':'Montées'}</span>
        <span style="color:var(--text);font-weight:700;">${monteesV}</span></div>
       <div style="display:flex;justify-content:space-between;gap:14px;margin:2px 0;">
        <span style="color:var(--text2);">${isEN?'Alightings':'Descentes'}</span>
        <span style="color:var(--text);font-weight:700;">${descentesV}</span></div>` : '';
  t.innerHTML = `
    <div style="font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text3);margin-bottom:5px;">${nom}</div>
    ${viewRows}
    <div style="display:flex;justify-content:space-between;gap:14px;margin:2px 0;">
      <span style="color:var(--text2);">${isEN?'Load':'Charge'}</span>
      <span style="font-weight:700;color:var(--text2);">${charge} pass.</span></div>
    <div style="height:1px;background:var(--border);margin:4px 0;"></div>
    <div style="display:flex;justify-content:space-between;gap:14px;margin:2px 0;">
      <span style="color:var(--text2);">${isEN?'DW est.':'DW théo.'}</span>
      <span style="color:${dwCol};font-weight:800;">${dwR} s</span></div>
    <div style="display:flex;justify-content:space-between;gap:14px;margin:2px 0;">
      <span style="color:var(--text2);">${isEN?'Status':'Statut'}</span>
      <span style="color:${dwCol};font-weight:700;">${dwLbl}</span></div>`;
  t.style.display = 'block';
  t.style.left = (e.clientX + 14) + 'px';
  t.style.top  = (e.clientY - 24) + 'px';
}
function _hideBubbleTooltip() {
  const t = document.getElementById('_bubbleTooltip');
  if (t) t.style.display = 'none';
}

/* Axe Y1 sticky */
function _renderBubbleYAxis(PAD, H, PH, yMax, py, dpr, view) {
  const axisCanvas = document.getElementById('chargeAxisCanvas');
  if (!axisCanvas) return;
  const AW = PAD.l + 2;
  axisCanvas.width        = Math.round(AW * dpr);
  axisCanvas.height       = Math.round(H  * dpr);
  axisCanvas.style.width  = AW + 'px';
  axisCanvas.style.height = H  + 'px';
  const axCtx = axisCanvas.getContext('2d');
  axCtx.scale(dpr, dpr);
  const isLight = document.body.classList.contains('light-mode');
  const bgCol = getComputedStyle(document.body).getPropertyValue('--bg2').trim() || (isLight ? '#f0f2f7' : '#1f2435');
  
  axCtx.fillStyle = bgCol; axCtx.fillRect(0, 0, AW, H);
  const textCol = isLight ? 'rgba(60,70,90,.7)' : 'rgba(180,190,220,.55)';
  axCtx.fillStyle = textCol;
  axCtx.font = '600 11px "Barlow Condensed",sans-serif'; axCtx.textAlign = 'right';
  for (let t = 0; t <= 5; t++) {
    axCtx.fillText(Math.round(yMax/5*t), PAD.l-4, py(yMax/5*t)+3);
  }
  axCtx.strokeStyle = 'rgba(160,160,200,.2)'; axCtx.lineWidth = 1;
  axCtx.beginPath(); axCtx.moveTo(AW-1, PAD.t); axCtx.lineTo(AW-1, PAD.t+PH); axCtx.stroke();
  axCtx.save();
  axCtx.translate(11, PAD.t + PH/2); axCtx.rotate(-Math.PI/2);
  axCtx.fillStyle = isLight ? 'rgba(60,70,90,.4)' : 'rgba(180,190,220,.35)';
  axCtx.font = '600 9px "Barlow Condensed",sans-serif'; axCtx.textAlign = 'center';
  axCtx.fillText(view === 'charge' ? (isEN?'Cumul. load':'Charge cumulée') : (isEN?'Boardings / Alightings':'Montées / Descentes'), 0, 0);
  axCtx.restore();
}


/* ── TABLEAU SYNTHÈSE ── */
/* ── SÉLECTEUR COLONNES TABLEAU SYNTHÈSE ── */
// Toutes les colonnes disponibles avec leur clé et visibilité par défaut
const ALL_COMP_COLS = [
  // ── Colonnes cochées par défaut ──
  // Ordre : tAller, tRetour, Cycle, VitA, VitR, FlotteNec, FlotteTot, FreqHP, Entrées/Sorties, CapSMR, ...
  {key:'tAllerMin',    label:'Temps aller',             labelEN:'Running time out',     higher:false, fmt:v=>fmtMmSs(v),             visible:true},
  {key:'tRetourMin',   label:'Temps retour',            labelEN:'Running time in',      higher:false, fmt:v=>fmtMmSs(v),             visible:true},
  {key:'tCycleMin',    label:'Cycle',                   labelEN:'Cycle',                higher:false, fmt:v=>fmtHhMmSs(v),           visible:true},
  {key:'vitA',         label:'Vit. aller',              labelEN:'Speed out',            higher:true,  fmt:v=>v.toFixed(1),           visible:true},
  {key:'vitR',         label:'Vit. retour',             labelEN:'Speed in',             higher:true,  fmt:v=>v.toFixed(1),           visible:true},
  {key:'flotteNec',    label:'Flotte néc.',             labelEN:'Fleet',                higher:false, fmt:v=>String(v),              visible:true},
  {key:'flotteTot',    label:'Flotte tot.',             labelEN:'Total fleet',          higher:false, fmt:v=>String(v),              visible:true},
  {key:'freqHP',       label:'Fréq cible',              labelEN:'Target freq',          higher:false, fmt:v=>String(v),              visible:true},
  {key:'entrees',      label:'Entrées/Sorties dépôt',  labelEN:'Depot in/out',         higher:false, fmt:(v,k)=>`${v}/${k.sorties}`,visible:true},
  {key:'smrCapacite',  label:'Capacité SMR',            labelEN:'SMR capacity',         higher:false, fmt:(v,k)=>fmtSmr(v),          visible:true},
  // ── Colonnes décochées par défaut ──
  {key:'moyMontees',   label:'Moy. montées/st',         labelEN:'Avg boardings/st',     higher:true,  fmt:v=>v>0?v.toFixed(2):'—',   visible:false},
  {key:'moyDescentes', label:'Moy. descentes/st',       labelEN:'Avg alightings/st',    higher:true,  fmt:v=>v>0?v.toFixed(2):'—',   visible:false},
  {key:'tPrioTotal',   label:'Priorité',                labelEN:'Priority',             higher:false, fmt:v=>v.toFixed(1),           visible:true},
  {key:'coursesJour',  label:'Courses/jour',            labelEN:'Trips/day',            higher:true,  fmt:v=>String(v),              visible:true},
  // ── Colonnes masquées par défaut (existantes) ──
  {key:'nStations',    label:'Nb stations',             labelEN:'Nb stations',          higher:false, fmt:v=>String(v),              visible:false},
  {key:'distInterMoy', label:'Dist. moy. interst. (m)',labelEN:'Avg inter-st (m)',      higher:false, fmt:v=>String(v),              visible:false},
  {key:'kmCom',        label:'km comm./jour',           labelEN:'Comm. km/day',         higher:true,  fmt:v=>String(v),              visible:false},
  {key:'tArretTotal',  label:'Arrêts tot.',             labelEN:'Total dwell',          higher:false, fmt:v=>v.toFixed(1),           visible:false},
  {key:'totalDistKm',  label:'Distance ligne (km)',     labelEN:'Line length (km)',     higher:false, fmt:v=>v.toFixed(2),           visible:false},
];

let _colPickerBuilt = false;
function buildColPickerDropdown(){
  // Reconstruire à chaque appel pour refléter l'état visible actuel
  _colPickerBuilt = false; // ← forcer la reconstruction
  if(_colPickerBuilt) return;
  _colPickerBuilt = true;
  const dd = document.getElementById('colPickerDropdown');
  if(!dd) return;
  dd.innerHTML = ALL_COMP_COLS.map((c,i)=>
    `<label class="col-picker-item">
      <input type="checkbox" ${c.visible?'checked':''} onchange="toggleCompCol(${i},this.checked)">
      ${isEN ? c.labelEN : c.label}
    </label>`
  ).join('');
}

function toggleCompCol(idx, checked){
  ALL_COMP_COLS[idx].visible = checked;
  if(LINE) renderCompTable(window._lastCompAll || []);
}

function toggleColPicker(e){
  e.stopPropagation();
  const dd = document.getElementById('colPickerDropdown');
  const r = e.currentTarget.getBoundingClientRect();
  dd.style.top=(r.bottom+4)+'px'; dd.style.left=r.left+'px';
  if(dd) dd.classList.toggle('open');
}

document.addEventListener('click', e=>{
  const dd = document.getElementById('colPickerDropdown');
  if(dd && !dd.closest('.col-picker-wrap').contains(e.target)) dd.classList.remove('open');
});


/* ═══════════════════════════════════════════════
   COMPARAISON TERMINUS
═══════════════════════════════════════════════ */

let _termCmpTermFilter = null;
let _termCmpScFilter   = null;
let TERM_CATEGORIES = []; // from master PARAMETRE sheet B2:BXX

/* Collecte toutes les données terminus pour tous les scénarios */
function _getScTermData(all){
  const saved = {stations:LINE.stations, inter:LINE.inter, retournement:LINE.retournement,
    tendu:LINE.tendu, tenduR:LINE.tenduR, detenteA:LINE.detenteA, detenteR:LINE.detenteR};
  const result = [];
  all.forEach(k => {
    try {
      if(LINE.scenariosData && LINE.scenariosData[k.scIdx]){
        const d = LINE.scenariosData[k.scIdx];
        LINE.stations=d.stations; LINE.inter=d.inter; LINE.retournement=d.retournement;
        LINE.tendu=d.tendu; LINE.tenduR=d.tenduR; LINE.detenteA=d.detenteA; LINE.detenteR=d.detenteR;
      }
      const tsc = getTerminusForSc(k.scIdx);
      result.push({sc:k.sc, scIdx:k.scIdx, termA:tsc.termA, retA:tsc.retA, termR:tsc.termR, retR:tsc.retR});
    } catch(e) {
      console.warn('[_getScTermData] skip scénario', k.scIdx, e.message);
    }
  });
  Object.assign(LINE, saved); 
  return result;
}

/* Occ → style */
function _occStyle(occ, label){
  const k=(occ||label||'').toLowerCase();
  if(k.includes('arriv')||k.includes('descent')) return {emoji:'🚶',col:BRAND.aller||'#4a9eff'};
  if(k.includes('depart')||k.includes('départ')||k.includes('monter')||k.includes('montée')) return {emoji:'🚶',col:BRAND.primaire2||'#3ecf6a'};
  if(k.includes('manoe')||k.includes('manoeu')||k.includes('retour')) return {emoji:'🔧',col:BRAND.primaire1||'#a06bff'};
  if(k.includes('pause')||k.includes('attente')) return {emoji:'⏸',col:BRAND.retour||'#f5a623'};
  return {emoji:'🕐',col:BRAND.cycle||'#cf3e9e'};
}

/* ═══ Treemap hiérarchique catégorie > sous-catégorie ═══ */

// Category color palettes: each cat gets a hue, sub-cats get variants
const _CAT_PALETTES = [
  ['#3b82f6','#60a5fa','#93c5fd','#bfdbfe'],  // blue family
  ['#10b981','#34d399','#6ee7b7','#a7f3d0'],  // green family
  ['#f59e0b','#fbbf24','#fcd34d','#fde68a'],  // amber family
  ['#8b5cf6','#a78bfa','#c4b5fd','#ddd6fe'],  // violet family
  ['#ef4444','#f87171','#fca5a5','#fecaca'],  // red family
  ['#06b6d4','#22d3ee','#67e8f9','#a5f3fc'],  // cyan family
  ['#ec4899','#f472b6','#f9a8d4','#fbcfe8'],  // pink family
  ['#84cc16','#a3e635','#bef264','#d9f99d'],  // lime family
];
const _CAT_EMOJIS = ['🚶','🔧','⏸','🚌','🔄','🏁','⚡','🛤️'];

function _buildTreemap(ret){
  const W=220, H=110;
  if(!ret||!ret.params||!ret.totalSec)
    return `<div style="width:${W}px;height:${H}px;background:var(--bg4);border-radius:4px;display:flex;align-items:center;justify-content:center;color:var(--text3);font-size:.55rem;">—</div>`;

  const total  = ret.totalSec;
  const params = ret.params.filter(p=>p.sec>0);

  // Group by category (col G) or fallback to Occ
  const catOrder = TERM_CATEGORIES.length ? TERM_CATEGORIES : [];
  const catMap   = new Map(); // catName → {sec, subs:[{label,sec,col}]}

  params.forEach(p=>{
    const cat = (p.categorie||p.occ||p.label||'Autre').trim() || 'Autre';
    if(!catMap.has(cat)) catMap.set(cat, {sec:0, subs:[]});
    const entry = catMap.get(cat);
    entry.sec  += p.sec;
    entry.subs.push({label:p.label, sec:p.sec});
  });

  // Order categories: first by TERM_CATEGORIES order, then remainder
  const orderedCats = [];
  catOrder.forEach(n=>{ if(catMap.has(n)) orderedCats.push(n); });
  catMap.forEach((_,n)=>{ if(!orderedCats.includes(n)) orderedCats.push(n); });

  // Assign palette per category
  const catStyles = {};
  orderedCats.forEach((n,i)=>{
    const pal = _CAT_PALETTES[i % _CAT_PALETTES.length];
    const emoji = _CAT_EMOJIS[i % _CAT_EMOJIS.length];
    catStyles[n] = {pal, emoji};
  });

  /* ── Squarified-style layout (simplified row algorithm) ──
     Splits horizontally by category weight, then vertically for sub-cats */
  let html = '';
  let xCursor = 0;

  orderedCats.forEach(catName => {
    const entry  = catMap.get(catName);
    const catW   = W * (entry.sec / total);
    const style  = catStyles[catName];
    const catPct = Math.round(entry.sec/total*100);
    const catTip = `${style.emoji} ${catName}: ${fmtMin(entry.sec/60)} (${catPct}%)`;

    // Draw category label bar (top 14px)
    const catLblH = 18;
    const innerH  = H - catLblH;
    const fs      = Math.min(11, Math.max(7, Math.floor(catW/catName.length*1.4)));

    html += `<div style="position:absolute;left:${xCursor.toFixed(1)}px;top:0;width:${catW.toFixed(1)}px;height:${catLblH}px;
      background:${style.pal[0]};display:flex;align-items:center;justify-content:center;
      border-right:1px solid var(--bg2);box-sizing:border-box;cursor:pointer;transition:opacity .12s,filter .12s;"
      data-label="${catName}"
      data-val="${fmtMin(entry.sec/60)}"
      data-pct="${catPct}"
      data-col="${style.pal[0]}"
      data-icon="${style.emoji}"
      onmouseenter="termTreeEnter(this,event)" onmouseleave="termTreeLeave(this)">
      <span style="font-size:${fs}px;font-weight:800;color:#fff;overflow:hidden;white-space:nowrap;
        text-overflow:ellipsis;padding:0 2px;pointer-events:none;">
        ${catW>30?style.emoji+' ':''}${catW>50?catName:''}
      </span>
    </div>`;

    // Sub-categories: stack vertically
    let yCursor = catLblH;
    const subs  = entry.subs.filter(s=>s.sec>0);
    subs.forEach((sub, si) => {
      const subH   = si<subs.length-1 ? innerH*(sub.sec/entry.sec) : (H - yCursor);
      const subCol = style.pal[Math.min(si+1, style.pal.length-1)];
      const subPct = Math.round(sub.sec/total*100);
      const subTip = `${style.emoji} ${catName} › ${sub.label}: ${fmtMin(sub.sec/60)} (${subPct}%)`;

      html += `<div style="position:absolute;left:${xCursor.toFixed(1)}px;top:${yCursor.toFixed(1)}px;
        width:${catW.toFixed(1)}px;height:${subH.toFixed(1)}px;
        background:${subCol};opacity:.9;box-sizing:border-box;
        border-right:1px solid var(--bg2);border-bottom:1px solid var(--bg2);
        display:flex;align-items:center;justify-content:center;cursor:pointer;transition:opacity .12s,filter .12s;"
        data-label="${catName} › ${sub.label}"
        data-val="${fmtMin(sub.sec/60)}"
        data-pct="${subPct}"
        data-col="${subCol}"
        data-icon="${style.emoji}"
        onmouseenter="termTreeEnter(this,event)" onmouseleave="termTreeLeave(this)">
        ${subH>18&&catW>28?`<span style="font-size:8px;font-weight:700;pointer-events:none;color:rgba(0,0,0,.75);overflow:hidden;white-space:nowrap;text-overflow:ellipsis;padding:0 3px;">${catW>50?sub.label:''}</span>`:''}
      </div>`;
      yCursor += subH;
    });

    xCursor += catW;
  });

  return `<div style="position:relative;width:${W}px;height:${H}px;border-radius:4px;overflow:hidden;border:1px solid var(--border);">${html}</div>`;
}


function termTreeEnter(el, evt){
  el.style.opacity='1';
  el.style.filter='brightness(1.25)';
  const tt=document.getElementById('pieTooltip');
  tt.style.background=el.dataset.col;
  document.getElementById('ptIcon').textContent=el.dataset.icon;
  document.getElementById('ptLabel').textContent=el.dataset.label;
  document.getElementById('ptVal').textContent=el.dataset.val;
  document.getElementById('ptPct').textContent=el.dataset.pct+'%';
  tt.style.display='block';
  _movePieTooltip(evt);
  el.addEventListener('mousemove',_movePieTooltip);
}
function termTreeLeave(el){
  el.style.opacity='.82';
  el.style.filter='';
  document.getElementById('pieTooltip').style.display='none';
  el.removeEventListener('mousemove',_movePieTooltip);
}

function renderCompTerminus(all){
  const el=document.getElementById('compTermContent');
  if(!el)return;
  if(!all||!all.length||!LINE){el.innerHTML='<div style="color:var(--text3);font-size:.6rem;padding:.5rem;">—</div>';return;}

  const scTermData=_getScTermData(all);

  // All unique terminus names
  const allTermNames=[];
  const seenT=new Set();
  scTermData.forEach(d=>[d.termA,d.termR].forEach(n=>{if(!seenT.has(n)){seenT.add(n);allTermNames.push(n);}}));

  // Apply filters
  const termNames=_termCmpTermFilter?allTermNames.filter(n=>_termCmpTermFilter.has(n)):allTermNames;
  const scData=_termCmpScFilter?scTermData.filter(d=>_termCmpScFilter.has(d.scIdx)):scTermData;

  // SC colors
  const SC_COLORS=[BRAND.aller,BRAND.retour,BRAND.primaire2,BRAND.cycle,BRAND.primaire1,'#e8453c'];

  // ── Global legend by category ──
  const catLegMap = new Map();
  scTermData.forEach(d=>[d.retA,d.retR].forEach(ret=>{
    if(!ret||!ret.params)return;
    ret.params.forEach(p=>{
      const catName=(p.categorie||p.occ||p.label||'Autre').trim()||'Autre';
      const catOrder2=TERM_CATEGORIES.length?TERM_CATEGORIES:[];
      const ordIdx=catOrder2.indexOf(catName)>=0?catOrder2.indexOf(catName):[...catLegMap.keys()].length;
      const pal=_CAT_PALETTES[ordIdx%_CAT_PALETTES.length];
      const emoji=_CAT_EMOJIS[ordIdx%_CAT_EMOJIS.length];
      if(!catLegMap.has(catName)) catLegMap.set(catName,{emoji,col:pal[0],subs:new Map()});
      const catEntry=catLegMap.get(catName);
      if(!catEntry.subs.has(p.label)){
        const subIdx=catEntry.subs.size;
        catEntry.subs.set(p.label,{col:pal[Math.min(subIdx+1,pal.length-1)]});
      }
    });
  }));
  const legend=[...catLegMap.entries()].map(([catName,catData])=>
    `<div style="display:flex;flex-direction:column;gap:.2rem;">
      <div style="display:flex;align-items:center;gap:.3rem;font-size:.55rem;font-weight:800;color:var(--text);font-family:var(--fontb);">
        <div style="width:12px;height:12px;border-radius:2px;background:${catData.col};flex-shrink:0;"></div>${catData.emoji} ${catName}
      </div>
      ${[...catData.subs.keys()].map(subLbl=>
        `<div style="font-size:.48rem;color:var(--text3);font-family:var(--fontb);padding-left:.9rem;line-height:1.5;">• ${subLbl}</div>`
      ).join('')}
    </div>`
  ).join('');

  // ── Filter dropdowns — use absolute positioned dropdown inside relative wrapper ──
  const termOpts=allTermNames.map(n=>{
    const chk=(!_termCmpTermFilter||_termCmpTermFilter.has(n))?'checked':'';
    return `<label class="col-picker-item"><input type="checkbox" ${chk} onchange="_termCmpTermCh(event,'${n.replace(/'/g,"\\'").replace(/"/g,"&quot;")}')"> ${n}</label>`;
  }).join('');
  const scOpts=all.map((d,i)=>{
    const chk=(!_termCmpScFilter||_termCmpScFilter.has(d.scIdx))?'checked':'';
    return `<label class="col-picker-item"><input type="checkbox" ${chk} onchange="_termCmpScCh(event,${d.scIdx})"> ${d.sc.label}</label>`;
  }).join('');

  const filters=`<div style="display:flex;gap:.75rem;flex-wrap:wrap;margin-bottom:.6rem;">
    <div class="col-picker-wrap">
      <button class="col-picker-btn" onclick="_toggleTermPicker(event,'_tcp1')">🚉 Terminus ▾</button>
      <div class="col-picker-dropdown" id="_tcp1">${termOpts}</div>
    </div>
    <div class="col-picker-wrap">
      <button class="col-picker-btn" onclick="_toggleTermPicker(event,'_tcp2')">📋 Scénarios ▾</button>
      <div class="col-picker-dropdown" id="_tcp2">${scOpts}</div>
    </div>
  </div>`;

  // Table
  const thead=`<tr>
    <th class="row-hdr" style="min-width:110px;position:sticky;left:0;z-index:3;background:var(--bg4);">${isEN?'Terminus':'Terminus'}</th>
    ${scData.map((d,i)=>`<th style="color:${SC_COLORS[all.indexOf(d)%SC_COLORS.length]};min-width:195px;padding:.4rem;">${d.sc.label}</th>`).join('')}
  </tr>`;

  const tbody=termNames.map(tNom=>
    `<tr>
      <td style="font-size:.6rem;font-weight:800;font-family:var(--fontb);color:var(--text);white-space:nowrap;padding:.4rem .5rem;position:sticky;left:0;z-index:1;background:var(--bg2);">${tNom}</td>
      ${scData.map(d=>{
        const ret=(d.termA===tNom)?d.retA:(d.termR===tNom)?d.retR:null;
        return `<td style="padding:.4rem .5rem;">
          <div style="display:inline-block;">
            ${ret?`<div style="width:220px;font-size:.85rem;font-weight:800;font-family:var(--fontb);color:var(--text);text-align:center;background:var(--bg4);border-radius:4px 4px 0 0;padding:.2rem .3rem;box-sizing:border-box;">${fmtMin(ret.totalSec/60)}</div>`:''}
            ${_buildTreemap(ret)}
          </div>
        </td>`;
      }).join('')}
    </tr>`
  ).join('');

  el.innerHTML=`${filters}
    <div class="comp-term-scroll">
      <table class="term-cmp-table"><thead>${thead}</thead><tbody>${tbody}</tbody></table>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:.5rem;margin-top:.6rem;padding-top:.4rem;border-top:1px solid var(--border);">${legend}</div>`;
}

window._toggleTermPicker=function(e,id){
  e.stopPropagation();
  document.querySelectorAll('.col-picker-dropdown').forEach(d=>{if(d.id!==id)d.classList.remove('open');});
  const dd=document.getElementById(id);
  if(!dd)return;
  dd.classList.toggle('open');
  if(dd.classList.contains('open')){
    const r=e.currentTarget.getBoundingClientRect();
    dd.style.top=(r.bottom+4)+'px';
    dd.style.left=r.left+'px';
  }
};
window._termCmpTermCh=function(evt,nom){
  if(!_termCmpTermFilter){
    // Init with ALL terminus names (all checked) before applying this change
    const all=window._lastCompAll||[];
    const data=_getScTermData(all);
    const names=[];const seen=new Set();
    data.forEach(d=>[d.termA,d.termR].forEach(n=>{if(!seen.has(n)){seen.add(n);names.push(n);}}));
    _termCmpTermFilter=new Set(names);
  }
  if(evt.target.checked)_termCmpTermFilter.add(nom);else _termCmpTermFilter.delete(nom);
  if(!_termCmpTermFilter.size)_termCmpTermFilter=null;
  renderCompTerminus(window._lastCompAll||[]);
};
window._termCmpScCh=function(evt,scIdx){
  if(!_termCmpScFilter){
    const all=window._lastCompAll||[];
    _termCmpScFilter=new Set(all.map(d=>d.scIdx));
  }
  if(evt.target.checked)_termCmpScFilter.add(scIdx);else _termCmpScFilter.delete(scIdx);
  if(!_termCmpScFilter.size)_termCmpScFilter=null;
  renderCompTerminus(window._lastCompAll||[]);
};

function fsOpenCompTerminus(){
  const el=document.getElementById('compTermContent');
  if(!el)return;
  openFullscreen(document.getElementById('compTermTitle').textContent,body=>{
    Object.assign(body.style,{overflow:'auto',alignItems:'flex-start',padding:'1.5rem'});
    const clone=el.cloneNode(true);
    clone.style.cssText = 'width:calc(100vw - 3rem);overflow:visible;';
    body.appendChild(clone);
  });
}


/* ── Variable d'état : affichage ligne Programme MOE ── */
let _showProgrammeMOE = true; // cochée par défaut

function toggleProgrammeMOE(checked) {
  _showProgrammeMOE = checked;
  if (LINE) renderCompTable(window._lastCompAll || []);
}

function renderCompTable(all) {
  window._lastCompAll = all;
  
  const tbl = document.getElementById('compTable');
  if (!tbl) return;
  buildColPickerDropdown();

  const COLS = ALL_COMP_COLS.filter(c => c.visible).map(c => ({
    ...c, label: isEN ? c.labelEN : c.label
  }));

  const best = COLS.map(c => {
  const vs = all.filter(k => (k.sc.type||'NOMINAL').toUpperCase() === 'NOMINAL')
                .map(k => parseFloat(k[c.key]) || 0);
  return c.higher ? Math.max(...vs) : Math.min(...vs);
  });
  const worst = COLS.map(c => {
  const vs = all.filter(k => (k.sc.type||'NOMINAL').toUpperCase() === 'NOMINAL')
                .map(k => parseFloat(k[c.key]) || 0);
  return c.higher ? Math.min(...vs) : Math.max(...vs);
  });

  const STK_TH = 'position:sticky;left:0;z-index:3;background:var(--bg4);';
  const STK_TD = 'position:sticky;left:0;z-index:1;background:var(--bg2);font-weight:700;color:var(--text);';
  const STK_TD_MOE = 'position:sticky;left:0;z-index:1;background:var(--bg3);font-weight:700;color:var(--text);';

  let html = `<thead><tr>
    <th style="${STK_TH}">${isEN ? 'Scenario' : 'Scénario'}</th>
    ${COLS.map(c => `<th>${c.label}</th>`).join('')}
  </tr></thead><tbody>`;

  /* ── Ligne Programme MOE en PREMIER ── */
  if (_showProgrammeMOE) {
    html += `<tr style="background:var(--bg3);font-style:italic;opacity:.85;">`;
    html += `<td style="${STK_TD_MOE}background:var(--bg3);">Programme MOE</td>`;
    COLS.forEach(c => {
      const moeVal = (window.LINE_PROGRAMME_MOE || {})[c.key] ?? '—';
      html += `<td style="font-style:italic;color:var(--text2);">${moeVal}</td>`;
    });
    html += '</tr>';
  }

  /* ── Lignes scénarios nominaux + SP ── */
  const nominals = all.filter(k => (k.sc.type || 'NOMINAL').toUpperCase() === 'NOMINAL');
  nominals.forEach((k, si) => {
    const isActive = si === currentSc;
    

    // Ligne nominale
    html += `<tr class="${isActive ? 'active-sc' : ''}">`;
    html += `<td style="${STK_TD}">
      <div style="display:flex;align-items:center;gap:5px;">
        <span>${k.sc.label}</span>
        ${(window._SP_MAP?.[k.scIdx]?.length > 0)
          ? `<button onclick="toggleSPRows(${si})" 
               id="spToggleBtn_${si}"
               style="font-size:.55rem;padding:1px 4px;border-radius:3px;cursor:pointer;
               background:rgba(245,166,35,.15);border:1px solid rgba(245,166,35,.5);
               color:#f5a623;font-weight:700;line-height:1.4;"
               title="Afficher scénarios partiels">SP</button>`
          : ''}
      </div>
    </td>`;
    COLS.forEach((c, ci) => {
      const v = k[c.key];
      const vNum = parseFloat(v) || 0;
      const cls = vNum === best[ci] ? 'best' : vNum === worst[ci] && all.length > 1 ? 'worst' : '';
      const arrow = vNum === best[ci] ? ' ▲' : vNum === worst[ci] && all.length > 1 ? ' ▼' : '';
      html += `<td class="${cls}">${c.fmt(v, k)}${arrow}</td>`;
    });
    html += '</tr>';

    // Lignes SP (masquées par défaut)
    const spIdxs = window._SP_MAP?.[k.scIdx] || [];
    spIdxs.forEach(spIdx => {
      const spSc = LINE.scenarios[spIdx];
      if (!spSc) return;
      html += `<tr class="sp-row sp-row-${si}" style="display:none;
        background:rgba(245,166,35,.08);
        border-left:3px solid rgba(245,166,35,.6);">`;
      html += `<td style="${STK_TD}background:rgba(245,166,35,.1);
        font-style:italic;font-size:.75em;color:#f5a623;font-weight:600;">
        ↳ ${spSc.label}
      </td>`;
      COLS.forEach(c => {
        const spData = all.find(d => d.scIdx === spIdx);
        const v = spData ? spData[c.key] : null;
        html += `<td style="font-style:italic;font-size:.75em;color:var(--text3);">${c.fmt(v, k)}</td>`;
      });
      html += '</tr>';
    });
  });

  html += '</tbody>';
  tbl.innerHTML = html;
}

// Toggle affichage des lignes SP d'un nominal
function toggleSPRows(si) {
  const rows = document.querySelectorAll(`.sp-row-${si}`);
  const btn  = document.getElementById(`spToggleBtn_${si}`);
  const isVisible = rows.length > 0 && rows[0].style.display !== 'none';
  rows.forEach(r => r.style.display = isVisible ? 'none' : '');
  if (btn) {
    btn.style.background   = isVisible ? 'rgba(245,166,35,.15)' : 'rgba(245,166,35,.35)';
    btn.style.borderColor  = isVisible ? 'rgba(245,166,35,.5)'  : '#f5a623';
  }
}

/* ── Export CSV du tableau comparatif ── */
function exportCompTableCSV() {
  const all = window._lastCompAll || [];
  if (!all.length) return;

  // Colonnes visibles uniquement
  const COLS = ALL_COMP_COLS.filter(c => c.visible).map(c => ({
    ...c, label: isEN ? c.labelEN : c.label
  }));

  // En-tête CSV
  const headers = [isEN ? 'Scenario' : 'Scénario', ...COLS.map(c => c.label)];
  const rows = [headers];

  // Lignes scénarios
  all.forEach(k => {
    rows.push([
      k.sc.label,
      ...COLS.map(c => {
        const v = k[c.key];
        // Valeur brute pour CSV (sans ▲▼)
        return c.fmt(v, k).replace(' ▲','').replace(' ▼','');
      })
    ]);
  });

  // Ligne Programme MOE si affichée
  if (_showProgrammeMOE) {
    rows.push([
      'Programme MOE',
      ...COLS.map(c => LINE.programmeMOE ? (LINE.programmeMOE[c.key] ?? '') : '')
    ]);
  }

  // Génération du CSV
  const csv = rows.map(r =>
    r.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(';')
  ).join('\n');

  const blob = new Blob(['\uFEFF' + csv], {type:'text/csv;charset=utf-8;'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'comparaison_scenarios.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}


// currentTab declared in core.js


/* ═══════════════════════════════════════════════
   PAGE SYNTHESE — SCORECARD
═══════════════════════════════════════════════ */
let SCORECARD_CRITERIA = [
  {key:'capacite',    fr:'Capacité',    en:'Capacity',    score:5},
  {key:'regularite',  fr:'Régularité',  en:'Regularity',  score:4},
  {key:'faisabilite', fr:'Faisabilité', en:'Feasibility', score:5},
  {key:'efficacite',  fr:'Efficacité',  en:'Efficiency',  score:4},
];

function renderScorecard(){
  const elCrit = document.getElementById('scorecardCriteria');
  const elGlob = document.getElementById('scGlobalStars');
  const elNum  = document.getElementById('scGlobalNum');
  if(!elCrit||!elGlob||!elNum) return;

  const avg      = SCORECARD_CRITERIA.reduce((a,c)=>a+c.score,0) / SCORECARD_CRITERIA.length;
  const avgRound = Math.round(avg*10)/10;

  // Couleur globale selon score
  const globalColor = avg >= 4.5 ? 'var(--green)' : avg >= 3 ? 'var(--yellow)' : 'var(--orange)';

  // Étoiles globales — pleine / demi / vide
  const fullStars = Math.floor(avg);
  const half      = (avg - fullStars) >= 0.5;
  let starsGlob   = '★'.repeat(fullStars);
  if(half) starsGlob += '½';
  starsGlob += '☆'.repeat(5 - fullStars - (half?1:0));
  elGlob.innerHTML  = starsGlob;
  elGlob.style.color = globalColor;
  elNum.style.color  = globalColor;
  elNum.textContent  = avgRound.toFixed(1);

  // Critères
  elCrit.innerHTML = SCORECARD_CRITERIA.map(c => {
    const lbl   = isEN ? c.en : c.fr;
    const col   = c.score >= 5 ? 'var(--green)' : c.score >= 4 ? 'var(--yellow)' : c.score >= 3 ? 'var(--orange)' : 'var(--red)';
    const starsHTML = [1,2,3,4,5].map(n =>
      `<span class="scorecard-star" data-key="${c.key}" data-n="${n}" onclick="setScore('${c.key}',${n})"
        style="color:${n<=c.score ? col : 'var(--bg4)'};${n<=c.score ? '' : 'opacity:.3'}"
      >${n<=c.score?'★':'☆'}</span>`
    ).join('');
    return `<div class="scorecard-row">
      <span class="scorecard-row-label">${lbl}</span>
      <span class="scorecard-row-stars">${starsHTML}</span>
      <span class="scorecard-row-num" style="color:${col}">${c.score}/5</span>
    </div>`;
  }).join('');
}

function setScore(key, n){
  const crit = SCORECARD_CRITERIA.find(c=>c.key===key);
  if(!crit) return;
  crit.score = n;
  renderScorecard();
}

