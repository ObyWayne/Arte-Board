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
    // Ignorer les scénarios non nominaux (SP) — ils n'ont pas forcément de stations complètes
      if((sc.type||'NOMINAL').toUpperCase() !== 'NOMINAL') return;
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
      const moyMontees   = LINE.stations.reduce((a,s)=>a+(s.montees||0),0) / nSt;
      const moyDescentes = LINE.stations.reduce((a,s)=>a+(s.descentes||0),0) / nSt;
      const nStations    = nSt;
      const distInterMoy = LINE.inter.length > 0
        ? +(LINE.inter.reduce((a,b)=>a+b.dist,0) / LINE.inter.length).toFixed(0)
        : 0;
      // Ne conserver que les scénarios nominaux dans le tableau comparatif
if ((sc.type || 'NOMINAL').toUpperCase() !== 'NOMINAL') return;

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

  // ── Montées/Descentes : sélection unique ──
  if(bubbleActiveSc === null || bubbleActiveSc >= all.length)
  bubbleActiveSc = 0;

  _buildBubbleScPills(all);

  const radarFiltered  = all.filter((_,i)=>radarActiveScenarios.has(i));

  try { renderRadar(all, radarFiltered); } catch(e){ console.error('[renderComparatif] renderRadar:', e); }
  try { renderBubbleChart(all, bubbleActiveSc); } catch(e){ console.error('[renderComparatif] renderBubbleChart:', e); }
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

/* ── HISTOGRAMME CHARGES (barres superposées) ── */
// Constantes formule de charge
const NB_PORTE    = 16;
const TECH_TIME   = 10; // secondes

function calcDwCharge(dw, freqMin){
  // Charge = (2400 × nb_porte × (dw - technical_time)) / freq_s
  return (2400 * NB_PORTE * (dw - TECH_TIME)) / (freqMin * 60);
}

function renderBubbleChart(all, scIdx){
  const canvas = document.getElementById('chargeCanvas');
  if(!canvas) return;
  window._lastBubbleAll = all;
  window._lastBubbleSc  = scIdx;
  renderBubbleChartOnCanvas(canvas, null, null, all, scIdx);
}

function renderBubbleChartOnCanvas(canvas, forcedW, forcedH, all, scIdx){
  if(!canvas || !all || all.length === 0) return;
  if(scIdx == null || scIdx >= all.length) scIdx = 0;

  const k   = all[scIdx];
  const sc  = k.sc;
  const sts = LINE.scenariosData ? LINE.scenariosData[k.scIdx].stations : LINE.stations;
  if (!sts || sts.length === 0) return;
  const stationNames = sts.map(s => s.nom);

  // ── Données par station ──
  // Données selon direction sélectionnée
const isAller  = (bubbleDir === 'aller');
const montees   = sts.map(s => isAller ? (s.monteesA   || 0) : (s.monteesR   || 0));
const descentes = sts.map(s => isAller ? (s.descentesA || 0) : (s.descentesR || 0));

// Courbe charge cumulée : part de 0, +montées -descentes
const chargeCum = [];
let cur = 0;
for(let i = 0; i < sts.length; i++){
  cur += montees[i] - descentes[i];
  chargeCum.push(cur);
}

// Montées = primaire1, Descentes = primaire2
const COL_MONTEES   = BRAND.primaire1 || '#a06bff';
const COL_DESCENTES = BRAND.primaire2 || '#3ecf6a';
// Courbe charge = couleur aller ou retour selon direction
const COL_CHARGE    = isAller ? (BRAND.aller || '#4a9eff') : (BRAND.retour || '#f5a623');

  // ── Lignes dw (formule charge) ──
  const freqMin = sc.freqHP || sc.freqMin || 6;
  const dwVals  = [20, 30, 40];
  const dwLines = dwVals.map(dw => calcDwCharge(dw, freqMin));

  // ── Dimensions canvas ──
  const nSt   = stationNames.length;
  const PAD   = {l:54, r:60, t:24, b:80};
  const scaleFactor = forcedW ? Math.max(1, forcedW / (PAD.l + nSt * 52 + PAD.r)) : 1;
  const BAR_W  = Math.round(20 * Math.min(scaleFactor, 2.5));
  const GRP_GAP= Math.round(10 * Math.min(scaleFactor, 2));
  const ST_GAP = Math.round(22 * Math.min(scaleFactor, 2));
  const stW    = BAR_W * 2 + GRP_GAP + ST_GAP;

  // Hauteur : utilise TOUT l'espace disponible du bloc
  const H  = forcedH || (canvas.parentElement ? canvas.parentElement.clientHeight || 260 : 260);
  const PH = H - PAD.t - PAD.b;
  const W  = forcedW || (PAD.l + nSt * stW + PAD.r);

  const dpr = window.devicePixelRatio || 1;
  canvas.width  = W  * dpr;
  canvas.height = H  * dpr;
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  // ── Échelle Y1 (barres montées/descentes) ──
  let yMax1 = Math.max(...montees, ...descentes, 1);
  yMax1 = Math.ceil(yMax1 * 1.15 / 10) * 10;
  const py1 = v => PAD.t + PH - (v / yMax1) * PH;
  const bH1 = v => (v / yMax1) * PH;

  // ── Échelle Y2 (charge cumulée + lignes dw) ──
  // Y2 figé : calculé une seule fois par scénario, pas recalculé au changement de direction
// On prend le max global des deux directions pour figer l'échelle
const allY2vals = [
  ...sts.map(s => s.monteesA||0), ...sts.map(s => s.descentesA||0),
  ...sts.map(s => s.monteesR||0), ...sts.map(s => s.descentesR||0),
];
let cumMax = 0, cumMin = 0, runMax = 0, runMin = 0;
['aller','retour'].forEach(dir => {
  let c = 0;
  sts.forEach((s,i) => {
    c += (dir==='aller' ? (s.monteesA||0) - (s.descentesA||0) : (s.monteesR||0) - (s.descentesR||0));
    cumMax = Math.max(cumMax, c);
    cumMin = Math.min(cumMin, c);
  });
});
const allY2 = [...dwLines, cumMax, cumMin];
let yMax2 = Math.ceil(Math.max(...allY2) * 1.15 / 50) * 50 || 100;
let yMin2 = Math.min(0, Math.floor(Math.min(...allY2) * 1.1 / 50) * 50);
  const py2 = v => PAD.t + PH - ((v - yMin2) / (yMax2 - yMin2)) * PH;

  // ── Grille Y1 (lignes horizontales) ──
  ctx.lineWidth = .7;
  for(let t = 0; t <= 5; t++){
    const v = yMax1 / 5 * t;
    const y = py1(v);
    ctx.strokeStyle = 'rgba(160,160,200,.12)';
    ctx.beginPath(); ctx.moveTo(PAD.l, y); ctx.lineTo(W - PAD.r, y); ctx.stroke();
  }

  // ── Axe Y1 (canvas séparé sticky) ──
  _renderBubbleYAxis(PAD, H, PH, yMax1, py1, dpr);

  // ── Barres : montées (bleu) et descentes (orange) ──
  const COL_A = BRAND.aller   || '#4a9eff';
  const COL_R = BRAND.retour  || '#f5a623';

  stationNames.forEach((nom, si) => {
    const xBase = PAD.l + si * stW;

    // Montées ↑
    const vA = montees[si];
    if(vA > 0){
      ctx.fillStyle = COL_MONTEES + '66';
      ctx.fillRect(xBase, py1(vA), BAR_W, bH1(vA));
      ctx.strokeStyle = COL_MONTEES;
      ctx.strokeRect(xBase, py1(vA), BAR_W, bH1(vA));
      ctx.fillStyle = 'rgba(200,210,230,.8)';
      ctx.font = 'bold 11px "Barlow Condensed",sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('↑', xBase + BAR_W / 2, py1(vA) - 3);
    }

    // Descentes ↓
    const vR = descentes[si];
    const xR = xBase + BAR_W + GRP_GAP;
    if(vR > 0){
      ctx.fillStyle = COL_DESCENTES + '66';
      ctx.fillRect(xR, py1(vR), BAR_W, bH1(vR));
      ctx.strokeStyle = COL_DESCENTES;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(xR, py1(vR), BAR_W, bH1(vR));
      ctx.fillStyle = 'rgba(200,210,230,.8)';
      ctx.font = 'bold 11px "Barlow Condensed",sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('↓', xR + BAR_W / 2, py1(vR) - 3);
    }

    // Label station incliné
    const xCenter = xBase + BAR_W + GRP_GAP / 2;
    ctx.save();
    ctx.translate(xCenter, PAD.t + PH + 7);
    ctx.rotate(-Math.PI / 3.5);
    ctx.fillStyle = 'rgba(180,190,220,.65)';
    ctx.font = '600 10px "Barlow Condensed",sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(nom.length > 13 ? nom.slice(0,12) + '…' : nom, 0, 0);
    ctx.restore();
  });

  // ── Courbe charge cumulée (Y2, violet) ──
  ctx.beginPath();
  stationNames.forEach((_, si) => {
    const xCenter = PAD.l + si * stW + BAR_W + GRP_GAP / 2;
    const y = py2(chargeCum[si]);
    si === 0 ? ctx.moveTo(xCenter, y) : ctx.lineTo(xCenter, y);
  });
  ctx.strokeStyle = COL_CHARGE;
  ctx.lineWidth   = 2.5;
  ctx.lineJoin    = 'round';
  ctx.stroke();

  // Points sur la courbe
  stationNames.forEach((_, si) => {
    const xCenter = PAD.l + si * stW + BAR_W + GRP_GAP / 2;
    ctx.beginPath();
    ctx.arc(xCenter, py2(chargeCum[si]), 3.5, 0, Math.PI * 2);
    ctx.fillStyle = COL_CHARGE;
    ctx.fill();
  });

  // ── 3 lignes dw horizontales (Y2, pointillées) ──
  const DW_COLORS = ['#3ecf6a', '#f5d623', '#e8453c'];
  dwVals.forEach((dw, di) => {
    const y = py2(dwLines[di]);
    ctx.beginPath();
    ctx.moveTo(PAD.l, y);
    ctx.lineTo(W - PAD.r, y);
    ctx.strokeStyle = DW_COLORS[di];
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([6, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
    // Label à droite
    ctx.fillStyle = DW_COLORS[di];
    ctx.font = '600 9px "Barlow Condensed",sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`dw=${dw}s`, W - PAD.r + 3, y + 3);
  });

  // ── Axe Y2 (labels à droite) ──
  const y2Steps = 5;
  ctx.fillStyle = 'rgba(180,190,220,.4)';
  ctx.font = '600 9px "Barlow Condensed",sans-serif';
  ctx.textAlign = 'right';
  for(let t = 0; t <= y2Steps; t++){
    const v = yMin2 + (yMax2 - yMin2) / y2Steps * t;
    const y = py2(v);
    ctx.fillText(Math.round(v), W - 2, y + 3);
  }

  // Légende ↑↓
const legY = H - 9;
ctx.font = '700 8.5px "Barlow Condensed",sans-serif';
ctx.textAlign = 'left';

// Carré montées (primaire1)
ctx.fillStyle = COL_MONTEES + 'dd';
ctx.fillRect(PAD.l, legY-7, 10, 7);
ctx.fillStyle = 'rgba(180,190,220,.85)';
ctx.fillText(isEN ? 'Boardings ↑' : 'Montées ↑', PAD.l + 13, legY);

// Carré descentes (primaire2)
ctx.fillStyle = COL_DESCENTES + 'dd';
ctx.fillRect(PAD.l + 80, legY-7, 10, 7);
ctx.fillStyle = 'rgba(180,190,220,.85)';
ctx.fillText(isEN ? 'Alightings ↓' : 'Descentes ↓', PAD.l + 93, legY);

// Trait courbe charge
ctx.strokeStyle = COL_CHARGE;
ctx.lineWidth = 2;
ctx.beginPath(); ctx.moveTo(PAD.l + 170, legY-3); ctx.lineTo(PAD.l + 182, legY-3); ctx.stroke();
ctx.fillStyle = 'rgba(180,190,220,.85)';
ctx.fillText('Charge', PAD.l + 185, legY);

  // Légende dw
  DW_COLORS.forEach((col, di) => {
    const lx = PAD.l + 235 + di * 62;
    ctx.strokeStyle = col; ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 2]);
    ctx.beginPath(); ctx.moveTo(lx, legY - 4); ctx.lineTo(lx + 12, legY - 4); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(180,190,220,.85)';
    ctx.fillText(`dw=${dwVals[di]}s`, lx + 15, legY);
  });

  // ── Tooltip ──
  canvas.onmousemove = (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx   = (e.clientX - rect.left) * (W / rect.width);
    let   best = -1, bestDist = Infinity;
    stationNames.forEach((_, si) => {
      const xCenter = PAD.l + si * stW + BAR_W + GRP_GAP / 2;
      const d = Math.abs(mx - xCenter);
      if(d < bestDist){ bestDist = d; best = si; }
    });
    if(best < 0 || bestDist > stW) {
      _hideBubbleTooltip(); return;
    }
    _showBubbleTooltip(e, stationNames[best], montees[best], descentes[best], chargeCum[best]);
  };
  canvas.onmouseleave = () => _hideBubbleTooltip();
}

/* ── Tooltip style projet ── */
function _getBubbleTooltip(){
  let t = document.getElementById('_bubbleTooltip');
  if(!t){
    t = document.createElement('div');
    t.id = '_bubbleTooltip';
    t.style.cssText = [
      'position:fixed;z-index:9999;pointer-events:none;display:none',
      'background:var(--bg2);border:1px solid var(--border)',
      'border-radius:6px;padding:7px 10px',
      'font-family:"Barlow Condensed",sans-serif;font-size:11px;min-width:130px'
    ].join(';');
    document.body.appendChild(t);
  }
  return t;
}
function _showBubbleTooltip(e, nom, montees, descentes, charge){
  const t = _getBubbleTooltip();
  t.innerHTML = `
    <div style="font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text3);margin-bottom:5px;">${nom}</div>
    <div style="display:flex;justify-content:space-between;gap:12px;margin:2px 0;">
      <span style="color:var(--text2);">Montées</span>
      <span style="color:var(--text);font-weight:700;">${montees}</span>
    </div>
    <div style="display:flex;justify-content:space-between;gap:12px;margin:2px 0;">
      <span style="color:var(--text2);">Descentes</span>
      <span style="color:var(--text);font-weight:700;">${descentes}</span>
    </div>
    <div style="display:flex;justify-content:space-between;gap:12px;margin:2px 0;">
      <span style="color:var(--purple);">Charge</span>
      <span style="color:var(--purple);font-weight:700;">${charge} pass.</span>
    </div>`;
  t.style.display = 'block';
  t.style.left = (e.clientX + 12) + 'px';
  t.style.top  = (e.clientY - 20) + 'px';
}
function _hideBubbleTooltip(){
  const t = document.getElementById('_bubbleTooltip');
  if(t) t.style.display = 'none';
}

function _renderBubbleYAxis(PAD, H, PH, yMax, py, dpr){
  const axisCanvas = document.getElementById('chargeAxisCanvas');
  if(!axisCanvas) return;
  const AW = PAD.l + 2;

  // Dimensions physiques
  axisCanvas.width  = Math.round(AW * dpr);
  axisCanvas.height = Math.round(H  * dpr);
  axisCanvas.style.width  = AW + 'px';
  axisCanvas.style.height = H  + 'px';

  const axCtx = axisCanvas.getContext('2d');
  // scale EN PREMIER, avant tout dessin
  axCtx.scale(dpr, dpr);

  // Fond (couleur bg2 adaptative dark/light)
  const bgCol = getComputedStyle(document.documentElement).getPropertyValue('--bg2').trim() || '#1f2435';
  axCtx.fillStyle = bgCol;
  axCtx.fillRect(0, 0, AW, H);

  // Couleur texte adaptative
  const isLight = document.body.classList.contains('light-mode');
  const textCol = isLight ? 'rgba(60,70,90,.7)' : 'rgba(180,190,220,.55)';

  // Labels valeurs Y
  axCtx.fillStyle = textCol;
  axCtx.font = '600 11px "Barlow Condensed",sans-serif';
  axCtx.textAlign = 'right';
  for(let t = 0; t <= 5; t++){
    const v = yMax / 5 * t;
    axCtx.fillText(Math.round(v), PAD.l - 4, py(v) + 3);
  }

  // Trait de bordure droite
  axCtx.strokeStyle = 'rgba(160,160,200,.2)';
  axCtx.lineWidth = 1;
  axCtx.beginPath();
  axCtx.moveTo(AW - 1, PAD.t);
  axCtx.lineTo(AW - 1, PAD.t + PH);
  axCtx.stroke();

  // Label axe Y rotaté
  axCtx.save();
  axCtx.translate(11, PAD.t + PH / 2);
  axCtx.rotate(-Math.PI / 2);
  axCtx.fillStyle = isLight ? 'rgba(60,70,90,.4)' : 'rgba(180,190,220,.35)';
  axCtx.font = '600 9px "Barlow Condensed",sans-serif';
  axCtx.textAlign = 'center';
  axCtx.fillText('Montées / Descentes', 0, 0);
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
   COMPARAISON TERMINUS — Histogramme empilé
═══════════════════════════════════════════════ */

let _termCmpTermFilter = null; // Set de noms de terminus sélectionnés (null = tous)
let _termCmpScFilter   = null; // Set de scIdx sélectionnés (null = tous nominaux)

// Palettes couleur par catégorie — index stable, même ordre que d'arrivée
const _TERM_CAT_COLORS = [
  '#4a9eff', // bleu
  '#3ecf6a', // vert
  '#f5a623', // orange
  '#a06bff', // violet
  '#cf3e9e', // rose
  '#e8453c', // rouge
  '#22d3ee', // cyan
  '#84cc16', // lime
];

/* Retourne la couleur hex assignée à une catégorie (ordre stable) */
function _termCatColor(catName, orderedCats){
  const idx = orderedCats.indexOf(catName);
  return _TERM_CAT_COLORS[idx >= 0 ? idx : 0];
}

/* Crée un CanvasPattern hachuré pour les segments compressibles */
function _makeHatchPattern(col){
  const c = document.createElement('canvas');
  c.width = 7; c.height = 7;
  const cx = c.getContext('2d');
  // Fond très léger
  cx.fillStyle = col + '22';
  cx.fillRect(0, 0, 7, 7);
  // Diagonales
  cx.strokeStyle = col;
  cx.lineWidth = 1.2;
  cx.beginPath(); cx.moveTo(0,7); cx.lineTo(7,0); cx.stroke();
  cx.beginPath(); cx.moveTo(-1,1); cx.lineTo(1,-1); cx.stroke();
  cx.beginPath(); cx.moveTo(6,8); cx.lineTo(8,6); cx.stroke();
  // Créer le pattern via un canvas temporaire
  const tmp = document.createElement('canvas').getContext('2d');
  return tmp.createPattern(c, 'repeat');
}

/* Collecte toutes les données terminus pour tous les scénarios */
function _getScTermData(all){
  const saved = {
    stations:LINE.stations, inter:LINE.inter, retournement:LINE.retournement,
    tendu:LINE.tendu, tenduR:LINE.tenduR, detenteA:LINE.detenteA, detenteR:LINE.detenteR
  };
  const result = all.map(k => {
    if(LINE.scenariosData && LINE.scenariosData[k.scIdx]){
      const d = LINE.scenariosData[k.scIdx];
      LINE.stations=d.stations; LINE.inter=d.inter; LINE.retournement=d.retournement;
      LINE.tendu=d.tendu; LINE.tenduR=d.tenduR; LINE.detenteA=d.detenteA; LINE.detenteR=d.detenteR;
    }
    const tsc = getTerminusForSc(k.scIdx);
    return {sc:k.sc, scIdx:k.scIdx, termA:tsc.termA, retA:tsc.retA, termR:tsc.termR, retR:tsc.retR};
  });
  Object.assign(LINE, saved);
  return result;
}

/* Rendu principal */
function _termCatCol(catName, orderedCats){
  const i = orderedCats.indexOf(catName);
  return _TERM_CAT_COLS[i >= 0 ? i % _TERM_CAT_COLS.length : 0];
}

/* Variante de couleur : plus sombre pour les sous-catégories successives */
function _shadeHex(hex, pct){
  const n=parseInt(hex.slice(1),16);
  const r=Math.max(0,Math.min(255,((n>>16)&0xff)+pct));
  const g=Math.max(0,Math.min(255,((n>>8)&0xff)+pct));
  const b=Math.max(0,Math.min(255,(n&0xff)+pct));
  return '#'+((1<<24)|(r<<16)|(g<<8)|b).toString(16).slice(1);
}

/* Canvas pattern hachuré (compressible) */
function _termHatchPat(col){
  const c=document.createElement('canvas'); c.width=7; c.height=7;
  const cx=c.getContext('2d');
  cx.fillStyle=col+'18'; cx.fillRect(0,0,7,7);
  cx.strokeStyle=col; cx.lineWidth=1.2;
  cx.beginPath(); cx.moveTo(0,7); cx.lineTo(7,0); cx.stroke();
  cx.beginPath(); cx.moveTo(-1,1); cx.lineTo(1,-1); cx.stroke();
  cx.beginPath(); cx.moveTo(6,8); cx.lineTo(8,6); cx.stroke();
  const tmp=document.createElement('canvas').getContext('2d');
  return tmp.createPattern(c,'repeat')||col+'55';
}

/* Collecte données terminus pour chaque scénario */
function _getScTermData(all){
  const saved={stations:LINE.stations,inter:LINE.inter,retournement:LINE.retournement,
    tendu:LINE.tendu,tenduR:LINE.tenduR,detenteA:LINE.detenteA,detenteR:LINE.detenteR};
  const result=all.map(k=>{
    if(LINE.scenariosData&&LINE.scenariosData[k.scIdx]){
      const d=LINE.scenariosData[k.scIdx];
      LINE.stations=d.stations;LINE.inter=d.inter;LINE.retournement=d.retournement;
      LINE.tendu=d.tendu;LINE.tenduR=d.tenduR;LINE.detenteA=d.detenteA;LINE.detenteR=d.detenteR;
    }
    const tsc=getTerminusForSc(k.scIdx);
    return {sc:k.sc,scIdx:k.scIdx,termA:tsc.termA,retA:tsc.retA,termR:tsc.termR,retR:tsc.retR};
  });
  Object.assign(LINE,saved);
  return result;
}

function renderCompTerminus(all){
  const el=document.getElementById('compTermContent');
  if(!el)return;
  if(!all||!all.length||!LINE){
    el.innerHTML='<div style="color:var(--text3);font-size:.6rem;padding:.5rem;">—</div>';
    return;
  }

  window._lastCompAll=all;
  const scTermData=_getScTermData(all);

  /* ── Noms terminus uniques ── */
  const allTermNames=[];
  const seenT=new Set();
  scTermData.forEach(d=>[d.termA,d.termR].forEach(n=>{
    if(n&&!seenT.has(n)){seenT.add(n);allTermNames.push(n);}
  }));

  /* ── Filtre scénarios : nominaux cochés par défaut, SP décochés ── */
  if(_termCmpScFilter===null){
    _termCmpScFilter=new Set(
      scTermData.filter(d=>(d.sc.type||'NOMINAL').toUpperCase()==='NOMINAL').map(d=>d.scIdx)
    );
  }

  const termNames=_termCmpTermFilter
    ?allTermNames.filter(n=>_termCmpTermFilter.has(n))
    :allTermNames;
  const scData=scTermData.filter(d=>_termCmpScFilter.has(d.scIdx));

  /* ── Collecte sous-catégories uniques (cat × label × compressible) ──
     Un dataset par (cat, sublabel, compressible) → pas de doublon possible */
  const segKeys=[];          // [{cat, label, compressible}]
  const seenSeg=new Set();
  scTermData.forEach(d=>[d.retA,d.retR].forEach(ret=>{
    if(!ret||!ret.params)return;
    ret.params.forEach(p=>{
      const cat=(p.categorie||p.occ||p.label||'Autre').trim()||'Autre';
      const lbl=(p.label||'').trim()||cat;
      const comp=p.compressible===true;
      const key=`${cat}|||${lbl}|||${comp}`;
      if(!seenSeg.has(key)){seenSeg.add(key);segKeys.push({cat,label:lbl,compressible:comp});}
    });
  }));

  /* Ordre stable des catégories */
  const allCats=[];
  segKeys.forEach(s=>{if(!allCats.includes(s.cat))allCats.push(s.cat);});

  /* Nuances de couleur : incompressible = couleur pleine, compressible = plus claire */
  const catSubIdx={}; // {cat: {label: subIndex}}
  segKeys.forEach(s=>{
    if(!catSubIdx[s.cat]) catSubIdx[s.cat]={};
    if(catSubIdx[s.cat][s.label]===undefined)
      catSubIdx[s.cat][s.label]=Object.keys(catSubIdx[s.cat]).length;
  });

  /* ── Labels axe X : (terminus, scénario) par barre + séparateur vide entre terminus ── */
  const xLabels=[];
  const barMeta=[];  // {tNom, scIdx, ret} | null
  termNames.forEach((tNom,ti)=>{
    scData.forEach(d=>{
      const ret=(d.termA===tNom)?d.retA:(d.termR===tNom)?d.retR:null;
      xLabels.push([tNom,d.sc.label]);
      barMeta.push({tNom,scIdx:d.scIdx,ret});
    });
    if(ti<termNames.length-1){xLabels.push('');barMeta.push(null);}
  });

  /* ── Datasets ── */
  const datasets=segKeys.map(sk=>{
    const baseCol=_termCatCol(sk.cat,allCats);
    const subIdx=catSubIdx[sk.cat][sk.label]||0;
    /* Nuances : subIdx 0 = couleur principale, 1 = +20 clair, 2 = +35 clair... */
    const shade=subIdx*18;
    const nuanceCol=_shadeHex(baseCol,shade);

    const bg=sk.compressible?_termHatchPat(nuanceCol):nuanceCol+'cc';

    const data=barMeta.map(m=>{
      if(!m||!m.ret||!m.ret.params)return null;
      const v=m.ret.params
        .filter(p=>{
          const pCat=(p.categorie||p.occ||p.label||'Autre').trim()||'Autre';
          const pLbl=(p.label||'').trim()||pCat;
          const pComp=p.compressible===true;
          return pCat===sk.cat && pLbl===sk.label && pComp===sk.compressible;
        })
        .reduce((a,p)=>a+(p.sec||0),0);
      return v>0?Math.round(v/60*10)/10:null;
    });

    return {
      label:`${sk.cat} › ${sk.label}${sk.compressible?' (comp.)':''}`,
      data, backgroundColor:bg,
      borderColor:nuanceCol, borderWidth:0.6,
      stack:'s',
      _cat:sk.cat, _compressible:sk.compressible,
    };
  });

  /* ── Légende ── */
  const legCats=allCats.map(cat=>{
    const col=_termCatCol(cat,allCats);
    return `<span style="display:flex;align-items:center;gap:4px;font-size:.6rem;color:var(--text2);">
      <span style="width:10px;height:10px;border-radius:2px;background:${col}cc;border:1px solid ${col};flex-shrink:0;"></span>${cat}
    </span>`;
  }).join('');
  const legHatch=`
    <span style="display:flex;align-items:center;gap:4px;font-size:.6rem;color:var(--text3);">
      <span style="width:10px;height:10px;border-radius:2px;flex-shrink:0;
        background:rgba(120,120,120,.1);border:1px dashed #888;
        background-image:repeating-linear-gradient(45deg,#888 0,#888 1px,transparent 0,transparent 50%);
        background-size:5px 5px;"></span>Compressible
    </span>
    <span style="display:flex;align-items:center;gap:4px;font-size:.6rem;color:var(--text3);">
      <span style="width:10px;height:10px;border-radius:2px;background:#888cc;border:1px solid #888;flex-shrink:0;"></span>Incompressible
    </span>`;

  /* ── Dropdowns ── */
  const termOpts=allTermNames.map(n=>{
    const chk=(!_termCmpTermFilter||_termCmpTermFilter.has(n))?'checked':'';
    return `<label class="col-picker-item"><input type="checkbox" ${chk}
      onchange="_termCmpTermCh(event,'${n.replace(/'/g,"\\'").replace(/"/g,'&quot;')}')"> ${n}</label>`;
  }).join('');

  /* Tous les scénarios dans le dropdown, nominaux cochés par défaut, SP décochés */
  const scOpts=scTermData.map(d=>{
    const chk=_termCmpScFilter.has(d.scIdx)?'checked':'';
    const isSP=(d.sc.type||'NOMINAL').toUpperCase()!=='NOMINAL';
    return `<label class="col-picker-item"><input type="checkbox" ${chk}
      onchange="_termCmpScCh(event,${d.scIdx})">
      ${d.sc.label}${isSP?'<span style="opacity:.5;font-size:.85em;margin-left:3px;">SP</span>':''}
    </label>`;
  }).join('');

  /* ── HTML ── */
  el.innerHTML=`
    <div style="display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;margin-bottom:.5rem;">
      <div class="col-picker-wrap">
        <button class="col-picker-btn" onclick="_toggleTermPicker(event,'_tcp1')">🚉 Terminus ▾</button>
        <div class="col-picker-dropdown" id="_tcp1">${termOpts}</div>
      </div>
      <div class="col-picker-wrap">
        <button class="col-picker-btn" onclick="_toggleTermPicker(event,'_tcp2')">📋 Scénarios ▾</button>
        <div class="col-picker-dropdown" id="_tcp2">${scOpts}</div>
      </div>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;margin-left:auto;">
        ${legCats}
        <span style="width:1px;height:12px;background:var(--border);margin:0 2px;"></span>
        ${legHatch}
      </div>
    </div>
    <div style="position:relative;width:100%;height:300px;">
      <canvas id="_termStackChart"></canvas>
    </div>`;

  /* ── Détruire instance précédente ── */
  if(window._termStackInst){window._termStackInst.destroy();window._termStackInst=null;}
  if(typeof Chart==='undefined'){
    el.innerHTML+='<div style="color:var(--text3);font-size:.6rem;padding:.5rem;">Chart.js non chargé</div>';
    return;
  }

  const isLight=document.body.classList.contains('light-mode');
  const tickCol=isLight?'rgba(60,70,90,.7)':'rgba(180,190,220,.65)';
  const gridCol=isLight?'rgba(60,70,90,.07)':'rgba(160,160,200,.1)';

  /* Stocker config pour fullscreen */
  window._termStackConfig={
    type:'bar',
    data:{labels:xLabels,datasets},
    options:{
      responsive:true,maintainAspectRatio:false,
      animation:{duration:220},
      categoryPercentage:0.65,
      barPercentage:1.0,
      plugins:{
        legend:{display:false},
        tooltip:{
          mode:'index',intersect:false,
          backgroundColor:'#1f2435',borderColor:'#323854',borderWidth:1,
          titleColor:'#a0a8c0',bodyColor:'#e8eaf0',
          titleFont:{family:'Barlow Condensed',size:10},
          bodyFont:{family:'Barlow Condensed',size:11},
          filter:item=>item.parsed.y>0,
          callbacks:{
            title:ctx=>{
              const l=ctx[0]?.label;
              return Array.isArray(l)?l.join(' — '):(l||'');
            },
            label:ctx=>` ${ctx.dataset.label}: ${ctx.parsed.y} min`,
            footer:ctx=>{
              const t=ctx.reduce((a,c)=>a+(c.parsed.y||0),0);
              return t>0?`Σ ${Math.round(t*10)/10} min`:'';
            }
          }
        }
      },
      scales:{
        x:{
          stacked:true,
          ticks:{
            font:{size:9,family:'Barlow Condensed'},color:tickCol,
            maxRotation:0,autoSkip:false,
            callback(v){const l=this.getLabelForValue(v);return Array.isArray(l)?l:(l||'');}
          },
          grid:{color:gridCol},
        },
        y:{
          stacked:true,
          title:{display:true,text:isEN?'Time (min)':'Temps (min)',
            font:{size:9,family:'Barlow Condensed'},
            color:isLight?'rgba(60,70,90,.5)':'rgba(180,190,220,.5)'},
          ticks:{font:{size:9},color:tickCol},
          grid:{color:gridCol},
        }
      }
    }
  };

  window._termStackInst=new Chart(document.getElementById('_termStackChart'),window._termStackConfig);
}

/* ── Callbacks filtres ── */
window._toggleTermPicker=function(e,id){
  e.stopPropagation();
  document.querySelectorAll('.col-picker-dropdown').forEach(d=>{if(d.id!==id)d.classList.remove('open');});
  const dd=document.getElementById(id);if(!dd)return;
  dd.classList.toggle('open');
  if(dd.classList.contains('open')){
    const r=e.currentTarget.getBoundingClientRect();
    dd.style.top=(r.bottom+4)+'px';dd.style.left=r.left+'px';
  }
};

window._termCmpTermCh=function(evt,nom){
  if(!_termCmpTermFilter){
    const data=_getScTermData(window._lastCompAll||[]);
    const names=[];const seen=new Set();
    data.forEach(d=>[d.termA,d.termR].forEach(n=>{if(n&&!seen.has(n)){seen.add(n);names.push(n);}}));
    _termCmpTermFilter=new Set(names);
  }
  evt.target.checked?_termCmpTermFilter.add(nom):_termCmpTermFilter.delete(nom);
  if(!_termCmpTermFilter.size)_termCmpTermFilter=null;
  renderCompTerminus(window._lastCompAll||[]);
};

window._termCmpScCh=function(evt,scIdx){
  if(!_termCmpScFilter){
    /* Init : nominaux seulement */
    const all=window._lastCompAll||[];
    const data=_getScTermData(all);
    _termCmpScFilter=new Set(
      data.filter(d=>(d.sc.type||'NOMINAL').toUpperCase()==='NOMINAL').map(d=>d.scIdx)
    );
  }
  evt.target.checked?_termCmpScFilter.add(scIdx):_termCmpScFilter.delete(scIdx);
  if(!_termCmpScFilter.size)_termCmpScFilter=null;
  renderCompTerminus(window._lastCompAll||[]);
};

/* ── Plein écran : re-render dans un canvas dédié ── */
function fsOpenCompTerminus(){
  if(!LINE||!window._termStackConfig)return;
  openFullscreen(document.getElementById('compTermTitle').textContent,body=>{
    Object.assign(body.style,{overflow:'auto',alignItems:'flex-start',padding:'1.5rem'});
    const wrap=document.createElement('div');
    wrap.style.cssText=`width:calc(100vw - 3rem);position:relative;height:${window.innerHeight-130}px;`;
    const cv=document.createElement('canvas');
    cv.id='_termStackFs';
    wrap.appendChild(cv);
    body.appendChild(wrap);
    requestAnimationFrame(()=>{
      /* Cloner la config sans les patterns (CanvasPattern non sérialisable) */
      const cfg=window._termStackConfig;
      const datasetsClone=cfg.data.datasets.map(ds=>({
        ...ds,
        /* Remplacer les patterns par une couleur de fallback */
        backgroundColor:ds._compressible
          ?(_termCatCol(ds._cat,cfg.data.datasets.map(d=>d._cat).filter((c,i,a)=>a.indexOf(c)===i))+'88')
          :ds.backgroundColor,
      }));
      new Chart(cv,{
        type:cfg.type,
        data:{labels:cfg.data.labels,datasets:datasetsClone},
        options:{...cfg.options,animation:{duration:0},responsive:true,maintainAspectRatio:false}
      });
    });
  });
}

function fsOpenCompTerminus(){
  if(!LINE) return;
  openFullscreen(document.getElementById('compTermTitle').textContent, body => {
    Object.assign(body.style, {overflow:'auto', alignItems:'flex-start', padding:'1.5rem'});
    // Re-rendre le graphique dans un conteneur plein écran
    const wrap = document.createElement('div');
    wrap.style.cssText = 'width:calc(100vw - 3rem);';
    const canvasWrap = document.createElement('div');
    canvasWrap.style.cssText = `position:relative;width:100%;height:${window.innerHeight - 160}px;`;
    const cv = document.createElement('canvas');
    cv.id = '_termStackChartFs';
    canvasWrap.appendChild(cv);
    wrap.appendChild(canvasWrap);
    body.appendChild(wrap);
    requestAnimationFrame(() => {
      const inst = window._termStackChartInst;
      if(!inst) return;
      new Chart(cv, {
        type: inst.config.type,
        data: JSON.parse(JSON.stringify(inst.data)),
        options: {...inst.options, animation:{duration:0}}
      });
    });
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

  // Meilleur et pire par colonne (sur nominaux seulement)
  const best = COLS.map(c => {
    const vs = all.map(k => parseFloat(k[c.key]) || 0);
    return c.higher ? Math.max(...vs) : Math.min(...vs);
  });
  const worst = COLS.map(c => {
    const vs = all.map(k => parseFloat(k[c.key]) || 0);
    return c.higher ? Math.min(...vs) : Math.max(...vs);
  });

  const STK_TH = 'position:sticky;left:0;z-index:3;background:var(--bg4);';
  const STK_TD = 'position:sticky;left:0;z-index:1;background:var(--bg2);font-weight:700;color:var(--text);';

  let html = `<thead><tr>
    <th style="${STK_TH}">${isEN ? 'Scenario' : 'Scénario'}</th>
    ${COLS.map(c => `<th>${c.label}</th>`).join('')}
  </tr></thead><tbody>`;

  // Lignes scénarios nominaux
  all.forEach((k, si) => {
    const isActive = si === currentSc;
    html += `<tr class="${isActive ? 'active-sc' : ''}">`;
    html += `<td style="${STK_TD}">${k.sc.label}</td>`;
    COLS.forEach((c, ci) => {
      const v = k[c.key];
      const vNum = parseFloat(v) || 0;
      const cls = vNum === best[ci] ? 'best' : vNum === worst[ci] && all.length > 1 ? 'worst' : '';
      const arrow = vNum === best[ci] ? ' ▲' : vNum === worst[ci] && all.length > 1 ? ' ▼' : '';
      html += `<td class="${cls}">${c.fmt(v, k)}${arrow}</td>`;
    });
    html += '</tr>';
  });

  // Ligne Programme MOE (si checkbox cochée)
  if (_showProgrammeMOE) {
    html += `<tr class="moe-row" style="background:var(--bg3);font-style:italic;">`;
    html += `<td style="${STK_TD};background:var(--bg3);">Programme MOE</td>`;
    COLS.forEach(c => {
      // Valeur MOE : injecter ici la logique métier si disponible
      // Par défaut : cellule vide extensible
      const moeVal = LINE.programmeMOE ? (LINE.programmeMOE[c.key] ?? '—') : '—';
      html += `<td>${moeVal}</td>`;
    });
    html += '</tr>';
  }

  html += '</tbody>';
  tbl.innerHTML = html;
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

