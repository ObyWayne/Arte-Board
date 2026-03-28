/* ── render.comparatif.js — Radar, SP, table, terminus comparison ── */
/* ═══════════════════════════════════════════════
   COMPARATIF
═══════════════════════════════════════════════ */
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
      const moyMontees   = LINE.stations.reduce((a,s)=>a+(s.chargeA||0),0) / nSt;
      const moyDescentes = LINE.stations.reduce((a,s)=>a+(s.chargeR||0),0) / nSt;
      const nStations    = nSt;
      const distInterMoy = LINE.inter.length > 0
        ? +(LINE.inter.reduce((a,b)=>a+b.dist,0) / LINE.inter.length).toFixed(0)
        : 0;
      results.push({...k, sc, scIdx:i, tPrioA, tPrioR, tPrioTotal:tPrioA+tPrioR,
                    moyMontees, moyDescentes, nStations, distInterMoy});
    } catch(e){
      console.warn(`computeKPIsAll: erreur scénario ${i} (${sc.id})`, e);
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
  if(!LINE) return;
  const all = computeKPIsAll();
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

  // ── Charge : tous scénarios ──
  if(!chargeActiveScenarios || chargeActiveScenarios.size === 0)
    chargeActiveScenarios = new Set(all.map((_,i)=>i));
  for(const idx of chargeActiveScenarios)
    if(idx>=all.length) chargeActiveScenarios.delete(idx);

  const chargeSel = document.getElementById('chargeScSelector');
  chargeSel.innerHTML = all.map((k,i)=>{
    const col=SC_COLORS[i%SC_COLORS.length], on=chargeActiveScenarios.has(i);
    return `<button class="radar-sc-btn${on?' on':''}" style="border-color:${col};color:${col};${on?`background:${col}22`:''}" onclick="toggleChargeSc(${i})">${k.sc.label}</button>`;
  }).join('');

  const radarFiltered  = all.filter((_,i)=>radarActiveScenarios.has(i));
  const chargeFiltered = all.filter((_,i)=>chargeActiveScenarios.has(i));

  renderRadar(all, radarFiltered);
  renderChargeChart(all, chargeFiltered);
  renderCompTable(all);
  renderSPMatrix();
  renderCompTerminus(all);
}

function toggleRadarSc(idx){
  if(!radarActiveScenarios) radarActiveScenarios = new Set();
  if(radarActiveScenarios.has(idx)){ if(radarActiveScenarios.size>1) radarActiveScenarios.delete(idx); }
  else radarActiveScenarios.add(idx);
  if(LINE) renderComparatif();
}

function toggleChargeSc(idx){
  if(!chargeActiveScenarios) chargeActiveScenarios = new Set();
  if(chargeActiveScenarios.has(idx)){ if(chargeActiveScenarios.size>1) chargeActiveScenarios.delete(idx); }
  else chargeActiveScenarios.add(idx);
  if(LINE) renderComparatif();
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
/* ── HISTOGRAMME CHARGES (barres superposées) ── */
function renderChargeChart(all, filtered){
  const canvas = document.getElementById('chargeCanvas');
  if(!canvas) return;
  renderChargeChartOnCanvas(canvas, null, null, all, filtered);
}

function renderChargeChartOnCanvas(canvas, forcedW, forcedH, all, filtered){
  if(!canvas) return;
  if(!all) all = _lastChargeAll || [];
  if(!filtered||filtered.length===0) filtered=all;

  const SC_COLORS=[BRAND.aller, BRAND.retour, BRAND.primaire2, BRAND.cycle, BRAND.primaire1,'#e8453c'];

  // Union ordonnée des stations
  const stationOrder=[], stationSet=new Set();
  filtered.forEach(k=>{
    const sts=LINE.scenariosData?LINE.scenariosData[k.scIdx].stations:LINE.stations;
    sts.forEach(s=>{ if(!stationSet.has(s.nom)){stationSet.add(s.nom);stationOrder.push(s.nom);} });
  });

  const scData=filtered.map(k=>{
    const sts=LINE.scenariosData?LINE.scenariosData[k.scIdx].stations:LINE.stations;
    const map={};
    sts.forEach(s=>{ map[s.nom]={a:s.chargeA||0,r:s.chargeR||0}; });
    return map;
  });

  const nSc=filtered.length, nSt=stationOrder.length;
  const PAD={l:54,r:20,t:24,b:80};
  // En fullscreen on agrandit les barres proportionnellement
  const scaleFactor = forcedW ? Math.max(1, forcedW / (PAD.l + nSt*52 + PAD.r)) : 1;
  const BAR_W = Math.round(20 * Math.min(scaleFactor, 2.5));
  const GRP_GAP = Math.round(10 * Math.min(scaleFactor, 2));
  const ST_GAP  = Math.round(22 * Math.min(scaleFactor, 2));
  const stW = BAR_W*2 + GRP_GAP + ST_GAP;
  const H = forcedH || 228;
  const PH = H - PAD.t - PAD.b;
  const W = forcedW || (PAD.l + nSt*stW + PAD.r);

  const dpr = window.devicePixelRatio||1;
  canvas.width=W*dpr; canvas.height=H*dpr;
  canvas.style.width=W+'px'; canvas.style.height=H+'px';
  const ctx=canvas.getContext('2d');
  ctx.scale(dpr,dpr);
  ctx.clearRect(0,0,W,H);

  let yMax=0;
  scData.forEach(map=>stationOrder.forEach(nom=>{ const d=map[nom]||{a:0,r:0}; yMax=Math.max(yMax,d.a,d.r); }));
  if(yMax===0) yMax=1;
  yMax=Math.ceil(yMax*1.15/10)*10;

  const py=v=>PAD.t+PH-(v/yMax)*PH;
  const bH=v=>(v/yMax)*PH;

  // Grille Y
  ctx.lineWidth=.7;
  for(let t=0;t<=5;t++){
    const v=yMax/5*t, y=py(v);
    ctx.strokeStyle='rgba(160,160,200,.12)';
    ctx.beginPath(); ctx.moveTo(PAD.l,y); ctx.lineTo(W-PAD.r,y); ctx.stroke();
    ctx.fillStyle='rgba(180,190,220,.55)';
    ctx.font='600 11px "Barlow Condensed",sans-serif'; ctx.textAlign='right';
    ctx.fillText(Math.round(v),PAD.l-4,y+3);
  }

  stationOrder.forEach((nom,si)=>{
    const xBase=PAD.l+si*stW;

    ['a','r'].forEach((dir,di)=>{
      const xBar=xBase+di*(BAR_W+GRP_GAP);

      // Trier : plus grande valeur dessinée en premier (en dessous), plus petite en dernier (devant)
      const order=[...Array(nSc).keys()].sort((a,b)=>{
        const va=(scData[a][nom]||{a:0,r:0})[dir];
        const vb=(scData[b][nom]||{a:0,r:0})[dir];
        return vb-va;
      });

      order.forEach(sci=>{
        const val=(scData[sci][nom]||{a:0,r:0})[dir];
        if(val<=0) return;
        const globalIdx=all.indexOf(filtered[sci]);
        const col=SC_COLORS[globalIdx%SC_COLORS.length];
        const isActive=globalIdx===currentSc;
        ctx.fillStyle=col+(isActive?'dd':'88');
        ctx.fillRect(xBar,py(val),BAR_W,bH(val));
        ctx.strokeStyle=col+(isActive?'ff':'bb');
        ctx.lineWidth=isActive?1.5:.6;
        ctx.strokeRect(xBar,py(val),BAR_W,bH(val));
      });

      // ↑ / ↓ au-dessus de la barre la plus haute
      const maxVal=Math.max(...Array(nSc).fill(0).map((_,sci)=>(scData[sci][nom]||{a:0,r:0})[dir]));
      if(maxVal>0){
        ctx.fillStyle='rgba(200,210,230,.75)';
        ctx.font='bold 12px "Barlow Condensed",sans-serif';
        ctx.textAlign='center';
        ctx.fillText(dir==='a'?'↑':'↓', xBar+BAR_W/2, py(maxVal)-3);
      }
    });

    // Label station incliné
    const xCenter=xBase+BAR_W+GRP_GAP/2;
    ctx.save();
    ctx.translate(xCenter,PAD.t+PH+7);
    ctx.rotate(-Math.PI/3.5);
    ctx.fillStyle='rgba(180,190,220,.65)';
    ctx.font='600 10px "Barlow Condensed",sans-serif'; ctx.textAlign='right';
    ctx.fillText(nom.length>13?nom.slice(0,12)+'…':nom,0,0);
    ctx.restore();
  });

  // Légende ↑↓
  const legY=H-9;
  ctx.font='700 8.5px "Barlow Condensed",sans-serif'; ctx.textAlign='left';
  ctx.fillStyle='rgba(200,210,230,.8)';
  ctx.fillText(T('legendBoardings'),PAD.l,legY);
  ctx.fillText(T('legendAlightings'),PAD.l+62,legY);

  // Légende scénarios
  filtered.forEach((k,fi)=>{
    const globalIdx=all.indexOf(k);
    const col=SC_COLORS[globalIdx%SC_COLORS.length];
    const lx=PAD.l+130+fi*70;
    ctx.fillStyle=col+'dd'; ctx.fillRect(lx,legY-7,10,7);
    ctx.fillStyle='rgba(180,190,220,.85)'; ctx.fillText(k.sc.label,lx+13,legY);
  });
}



/* ── TABLEAU SYNTHÈSE ── */
/* ── SÉLECTEUR COLONNES TABLEAU SYNTHÈSE ── */
// Toutes les colonnes disponibles avec leur clé et visibilité par défaut
const ALL_COMP_COLS = [
  {key:'vitA',         label:'Vit. Aller (km/h)',      labelEN:'Speed Out (km/h)',     higher:true,  fmt:v=>v.toFixed(1),           visible:true},
  {key:'vitR',         label:'Vit. Retour (km/h)',     labelEN:'Speed In (km/h)',      higher:true,  fmt:v=>v.toFixed(1),           visible:true},
  {key:'flotteNec',    label:'Flotte néc.',             labelEN:'Fleet',                higher:false, fmt:v=>v+' veh',               visible:true},
  {key:'flotteTot',    label:'Flotte tot.',             labelEN:'Total Fleet',          higher:false, fmt:v=>v+' veh',               visible:true},
  {key:'tCycleMin',    label:'Cycle (min)',             labelEN:'Cycle (min)',          higher:false, fmt:v=>v.toFixed(1),           visible:true},
  {key:'freqHP',       label:'Fréq cible (min)',        labelEN:'Target freq (min)',    higher:false, fmt:v=>v+' min',               visible:true},
  {key:'entrees',      label:'Entrées/Sorties dépôt',  labelEN:'Depot in/out',         higher:false, fmt:(v,k)=>`${v}/${k.sorties}`,visible:true},
  {key:'moyMontees',   label:'Moy. montées/st',         labelEN:'Avg boardings/st',     higher:true,  fmt:v=>v>0?v.toFixed(2):'—',   visible:true},
  {key:'moyDescentes', label:'Moy. descentes/st',       labelEN:'Avg alightings/st',    higher:true,  fmt:v=>v>0?v.toFixed(2):'—',   visible:true},
  {key:'tPrioTotal',   label:'Priorité (min)',          labelEN:'Priority (min)',       higher:false, fmt:v=>v.toFixed(1),           visible:true},
  {key:'coursesJour',  label:'Courses/jour',            labelEN:'Trips/day',            higher:true,  fmt:v=>v,                      visible:true},
  // Colonnes optionnelles
  {key:'nStations',    label:'Nb stations',             labelEN:'Nb stations',          higher:false, fmt:v=>v,                      visible:false},
  {key:'distInterMoy', label:'Dist. moy. interst. (m)',  labelEN:'Avg inter-st (m)',    higher:false, fmt:v=>v+' m',                 visible:false},
  {key:'kmCom',        label:'km comm./jour',           labelEN:'Comm. km/day',         higher:true,  fmt:v=>v+' km',                visible:false},
  {key:'tArretTotal',  label:'Arrêts tot. (min)',       labelEN:'Total dwell (min)',    higher:false, fmt:v=>v.toFixed(1),           visible:false},
  {key:'totalDistKm',  label:'Distance ligne (km)',     labelEN:'Line length (km)',     higher:false, fmt:v=>v.toFixed(2),           visible:false},
];

let _colPickerBuilt = false;
function buildColPickerDropdown(){
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
  const saved={stations:LINE.stations,inter:LINE.inter,retournement:LINE.retournement,
    tendu:LINE.tendu,tenduR:LINE.tenduR,detenteA:LINE.detenteA,detenteR:LINE.detenteR};
  const result = all.map(k=>{
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
      ${[...catData.subs.entries()].map(([subLbl,subData])=>
        `<div style="display:flex;align-items:center;gap:.3rem;font-size:.5rem;color:var(--text2);font-family:var(--fontb);padding-left:.8rem;">
          <div style="width:8px;height:8px;border-radius:1px;background:${subData.col};flex-shrink:0;"></div>${subLbl}
        </div>`
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
    <th class="row-hdr" style="min-width:110px;">${isEN?'Terminus':'Terminus'}</th>
    ${scData.map((d,i)=>`<th style="color:${SC_COLORS[all.indexOf(d)%SC_COLORS.length]};min-width:195px;padding:.4rem;">${d.sc.label}</th>`).join('')}
  </tr>`;

  const tbody=termNames.map(tNom=>
    `<tr>
      <td style="font-size:.6rem;font-weight:800;font-family:var(--fontb);color:var(--text);white-space:nowrap;padding:.4rem .5rem;">${tNom}</td>
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
    <div style="overflow-x:auto;">
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
    clone.style.cssText='width:100%;';
    body.appendChild(clone);
  });
}


function renderCompTable(all){
  window._lastCompAll = all;
  const tbl = document.getElementById('compTable');
  if(!tbl) return;
  buildColPickerDropdown();
  const COLS = ALL_COMP_COLS.filter(c=>c.visible).map(c=>({
    ...c, label: isEN ? c.labelEN : c.label
  }));
  // Meilleur et pire par colonne
  const best = COLS.map(c=>{
    const vs = all.map(k=>k[c.key]||0);
    return c.higher ? Math.max(...vs) : Math.min(...vs);
  });
  const worst = COLS.map(c=>{
    const vs = all.map(k=>k[c.key]||0);
    return c.higher ? Math.min(...vs) : Math.max(...vs);
  });
  let html = `<thead><tr><th>${isEN?'Scenario':'Scénario'}</th>${COLS.map(c=>`<th>${c.label}</th>`).join('')}</tr></thead><tbody>`;
  all.forEach((k,si)=>{
    const isActive = si===currentSc;
    html += `<tr class="${isActive?'active-sc':''}">`;
    html += `<td>${k.sc.label}</td>`;
    COLS.forEach((c,ci)=>{
      const v = k[c.key]||0;
      const cls = v===best[ci]?'best':v===worst[ci]&&all.length>1?'worst':'';
      html += `<td class="${cls}">${c.fmt(v,k)}${v===best[ci]?' ▲':v===worst[ci]&&all.length>1?' ▼':''}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody>';
  tbl.innerHTML = html;
}


let currentTab = 'parcours';

// switchTab() moved to index.html — ⚠️ TODO-VERIFY


/* ═══════════════════════════════════════════════
   PAGE SYNTHESE — SCORECARD
═══════════════════════════════════════════════ */
const SCORECARD_CRITERIA = [
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

