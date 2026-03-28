/* ── render.js — Render principal, plages, carousel ── */
/* ═══════════════════════════════════════════════
   BUILD UI (scénarios dynamiques)
═══════════════════════════════════════════════ */
function rebuildUI(){
  if(!LINE){ showEmptyState && showEmptyState(); return; }
  // Topbar
  document.getElementById('topEtude').textContent=LINE.meta.etude||'Arte-board';
  document.getElementById('topBadge').textContent=LINE.meta.badge||'';
  document.getElementById('topBadge').style.display=LINE.meta.badge?'':'none';
  document.getElementById('footerLine').textContent=LINE.meta.nomLigne||'';
  // Direction buttons avec noms terminus
  updateDirBtnLabels();

  // Scénario buttons
  const bar=document.getElementById('scBar');
  bar.innerHTML='<span class="scenario-bar-label" id="scBarLabel">Scénario</span>';
  LINE.scenarios.forEach((sc,i)=>{
    const btn=document.createElement('button');
    btn.className='sc-btn'+(i===0?' active':'');
    btn.textContent=sc.label;
    btn.onclick=()=>setScenario(i);
    bar.appendChild(btn);
  });
}


/* ═══════════════════════════════════════════════
   PLAGES HORAIRES HP / HC (configurables via Excel)
   Format : {type:'HP'|'HC'|'HS', debut:h*60+m, fin:h*60+m}
   HS = Hors Service (nuit, non opéré)
═══════════════════════════════════════════════ */
// GLOBAL_IMAGE_MAP declared in core.js

// PLAGES declared in core.js

const C_HP = () => BRAND.primaire1;  // violet — paramétrable via feuille COLOR
const C_HS = () => getComputedStyle(document.documentElement).getPropertyValue('--bg4').trim() || '#2d3449';

// Palette HC : lavande clair (bien distinct du violet vif HP)
/* HC_PALETTE générée à partir de primaire1 — recalculée dans applyBrandColors() */
let HC_PALETTE = ['#a78bfa','#b99ffb','#cdb4fc','#dfc8fd','#eedcfe','#f5eeff'];

function rebuildHcPalette(){
  // 6 teintes : de la couleur primaire1 légèrement éclaircie à très éclaircie
  const steps = [10, 22, 34, 45, 54, 62];
  const palette = steps.map(p => shadeColor(BRAND.primaire1, p));
  // Validation basique — si un résultat est invalide, on garde l'ancienne palette
  if(palette.every(c => /^#[0-9a-fA-F]{6}$/.test(c))) HC_PALETTE = palette;
}

function getHcColors(){
  // Trie les plages HC par fréquence croissante (plus petit = plus fréquent = plus foncé)
  const hcFreqs = PLAGES.filter(p=>p.type==='HC'&&p.freq!=null)
    .map(p=>p.freq).filter((v,i,a)=>a.indexOf(v)===i).sort((a,b)=>a-b);
  const map = {};
  hcFreqs.forEach((f,i)=>{ map[f] = HC_PALETTE[Math.min(i, HC_PALETTE.length-1)]; });
  return map;
}

function plageColor(p){
  if(p.type==='HP') return C_HP();
  if(p.type==='HS') return C_HS();
  // HC : couleur selon fréquence
  const map = getHcColors();
  return (p.freq!=null && map[p.freq]) ? map[p.freq] : HC_PALETTE[2];
}

/* ── Horloge statique 24h ── */
function drawClock(){
  const svg = document.getElementById('clockSvg');
  if(!svg) return;

  // R=94  : bord externe du cadran
  // R_SEG=72 : bord interne des secteurs colorés (anneau large)
  // R_FACE=68 : disque blanc/fond central avec les chiffres
  // R_NUM=58  : rayon où placer les chiffres
  const CX=100, CY=100;
  const R=94, R_SEG=70, R_FACE=68, R_NUM=56;
  const R_TICK_OUT=68, R_TICK_MAJ=60, R_TICK_MIN=64;

  const _css = getComputedStyle(document.documentElement);
  const _bg   = _css.getPropertyValue('--bg').trim()   || '#181c28';
  const _bg3  = _css.getPropertyValue('--bg3').trim()  || '#252b3b';
  const _bdr2 = _css.getPropertyValue('--border2').trim() || '#3d4560';
  const _txt  = _css.getPropertyValue('--text').trim() || '#e8eaf0';
  const _txt2 = _css.getPropertyValue('--text2').trim()|| '#a0a8c0';
  const _txt3 = _css.getPropertyValue('--text3').trim()|| '#4a5270';
  let html = '';

  /* 1. Fond extérieur */
  html += `<circle cx="${CX}" cy="${CY}" r="${R}" fill="${_bg3}" stroke="${_bdr2}" stroke-width="2"/>`;

  /* 2. Secteurs colorés plages (anneau entre R_SEG et R) */
  PLAGES.forEach(p => {
    const aS = (p.debut/1440)*360 - 90;
    const aE = (p.fin  /1440)*360 - 90;
    const op = p.type==='HS' ? '.25' : '.80';
    const col = plageColor(p);
    const freqLabel = p.freq ? ` · ${fmtFreq(p.freq)} min` : '';
    const label = `${p.type === 'HP' ? (isEN?'Peak':'HP') : p.type === 'HC' ? (isEN?'Off-peak':'HC') : (isEN?'Out of service':'HS')}`;
    const hours = `${minToHM(p.debut)} – ${minToHM(p.fin)}`;
    const freqTxt = p.freq ? `${fmtFreq(p.freq)} min` : '—';
    html += `<path class="clock-slice" d="${arcPath(CX,CY,R_SEG,R-1,aS,aE)}"
      fill="${col}" opacity="${op}"
      data-label="${label}" data-hours="${hours}" data-freq="${freqTxt}" data-col="${col}" data-op="${op}"
      style="cursor:pointer;transition:opacity .15s;"
      onmouseenter="clockSliceEnter(this,event)" onmouseleave="clockSliceLeave(this)"/>`;
  });

  /* 3. Démarcations entre plages — traits noirs nets */
  const seenMin = new Set();
  PLAGES.forEach(p => {
    [p.debut, p.fin].forEach(min => {
      if(seenMin.has(min)) return; seenMin.add(min);
      const rad = ((min/1440)*360 - 90) * Math.PI/180;
      const x1 = CX + R_SEG*Math.cos(rad), y1 = CY + R_SEG*Math.sin(rad);
      const x2 = CX + (R-1) *Math.cos(rad), y2 = CY + (R-1) *Math.sin(rad);
      html += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"
        stroke="${_bg}" stroke-width="3"/>`;
    });
  });

  /* 4. Disque face centrale */
  html += `<circle cx="${CX}" cy="${CY}" r="${R_FACE}" fill="var(--bg2)" stroke="var(--border2)" stroke-width="1.5"/>`;

  /* 5. Graduations sur le bord de R_FACE (pointant vers l'extérieur) */
  for(let h=0; h<24; h++){
    const rad = ((h/24)*360 - 90) * Math.PI/180;
    const isMaj6  = (h%6===0);
    const isMaj3  = (h%3===0);
    const rIn  = isMaj6 ? R_TICK_MAJ : isMaj3 ? R_TICK_MAJ+4 : R_TICK_MIN;
    const rOut = R_TICK_OUT;
    const x1=CX+rIn *Math.cos(rad), y1=CY+rIn *Math.sin(rad);
    const x2=CX+rOut*Math.cos(rad), y2=CY+rOut*Math.sin(rad);
    html += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"
      stroke="${isMaj6?_txt:isMaj3?_txt2:_txt3}" stroke-width="${isMaj6?2.5:isMaj3?1.5:.8}"/>`;
  }

  /* 6. Chiffres — tous les 3h sur R_NUM */
  for(let h=0; h<24; h+=3){
    const rad = ((h/24)*360 - 90) * Math.PI/180;
    const tx=CX+R_NUM*Math.cos(rad), ty=CY+R_NUM*Math.sin(rad);
    const isMaj = (h%6===0);
    html += `<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="middle" dominant-baseline="middle"
      font-family="Barlow Condensed,sans-serif"
      font-size="${isMaj?14:10}" font-weight="${isMaj?800:600}"
      fill="${isMaj?_txt:_txt2}">${String(h).padStart(2,'0')}</text>`;
  }

  /* 7. Centre */
  html += `<circle cx="${CX}" cy="${CY}" r="5" fill="${_bdr2}"/>`;
  html += `<circle cx="${CX}" cy="${CY}" r="2.5" fill="${_txt2}"/>`;

  svg.innerHTML = html;

}

function updateClockLegend(){
  const container = document.getElementById('clockLegHCItems');
  if(!container) return;
  const hcMap = getHcColors();
  const freqsSorted = Object.keys(hcMap).map(Number).sort((a,b)=>a-b);
  container.innerHTML = freqsSorted.map(f=>{
    const color = hcMap[f];
    return `<div class="clock-leg-item">
      <div class="clock-leg-dot" style="background:${color}"></div>
      <span style="color:var(--text2)">HC · ${fmtFreq(f)} min</span>
    </div>`;
  }).join('');
}

function arcPath(cx,cy,r1,r2,aStart,aEnd){
  const toRad=a=>a*Math.PI/180;
  const x1o=cx+r2*Math.cos(toRad(aStart)), y1o=cy+r2*Math.sin(toRad(aStart));
  const x2o=cx+r2*Math.cos(toRad(aEnd)),   y2o=cy+r2*Math.sin(toRad(aEnd));
  const x1i=cx+r1*Math.cos(toRad(aEnd)),   y1i=cy+r1*Math.sin(toRad(aEnd));
  const x2i=cx+r1*Math.cos(toRad(aStart)), y2i=cy+r1*Math.sin(toRad(aStart));
  const large=(aEnd-aStart)>180?1:0;
  return `M${x1o.toFixed(2)} ${y1o.toFixed(2)} A${r2} ${r2} 0 ${large} 1 ${x2o.toFixed(2)} ${y2o.toFixed(2)} L${x1i.toFixed(2)} ${y1i.toFixed(2)} A${r1} ${r1} 0 ${large} 0 ${x2i.toFixed(2)} ${y2i.toFixed(2)} Z`;
}

function minToHM(m){ return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`; }
function fmtFreq(f){
  // Convertit minutes décimales → MM:SS  ex: 7.5 → "7:30", 6 → "6:00"
  if(!f&&f!==0) return '—';
  const mm=Math.floor(f), ss=Math.round((f-mm)*60);
  return ss>0 ? `${mm}:${String(ss).padStart(2,'0')}` : `${mm}`;
}


/* Maps segment label keywords → emoji icon */
function pieIcon(label){
  const l = label.toLowerCase();
  if(l.includes('priorit') || l.includes('carrefour') || l.includes('priority')) return '🔄';
  if(l.includes('arr') || l.includes('station') || l.includes('dwell'))          return '🚏';
  if(l.includes('détente') || l.includes('detente') || l.includes('recovery'))   return '🍃';
  return '🛣️'; // marche tendue / run time
}

/* ═══════════════════════════════════════════════
   RENDER PRINCIPAL
═══════════════════════════════════════════════ */
function render(){
  if(!LINE){ showEmptyState(); return; }
  const sc     = LINE.scenarios[currentSc];
  const sp     = computeSPTroncons(sc, LINE);
  const isRetour = currentDir === 'retour';
  const {termA, termR, retA, retR} = getTerminusForSc(currentSc);
  // Terminus dans le sens courant
  const ret       = isRetour ? retR : retA;
  const retDurMin = ret.totalSec / 60;
  const N_ALL  = LINE.stations.length;

  // ── Données complètes ──
  const tenduAll  = LINE.tendu[sc.id]||[];
  const tenduRAll = (LINE.tenduR&&LINE.tenduR[sc.id])||[...tenduAll].reverse();
  const detA_all  = LINE.detenteA&&LINE.detenteA.length ? LINE.detenteA : tenduAll.map(v=>v*(sc.coeff-1));
  const detR_all  = LINE.detenteR&&LINE.detenteR.length ? LINE.detenteR : tenduRAll.map(v=>v*(sc.coeff-1));

  // ── Stations dans le sens courant ──
  const stationsAll = isRetour ? [...LINE.stations].reverse() : LINE.stations;
  const interAll    = isRetour ? [...LINE.inter].reverse()    : LINE.inter;
  const tenduDir    = isRetour ? tenduRAll : tenduAll;
  const detenteDir  = isRetour ? detR_all  : detA_all;

  // ── Indices de la zone bloquée EN SENS COURANT ──
  // sp.idxDebutBloc / sp.idxFinBloc sont toujours en indices Aller (LINE.stations)
  // On les convertit ici dans le sens d'affichage courant
  let blocMin=-1, blocMax=-1;
  if(sp.isSP){
    const iMin = sp.idxDebutBloc, iMax = sp.idxFinBloc;
    if(isRetour){
      blocMin = N_ALL - 1 - iMax;
      blocMax = N_ALL - 1 - iMin;
    } else {
      blocMin = iMin; blocMax = iMax;
    }
  }

  // ── Dernière station active de chaque tronçon (en sens courant) ──
  // Tronçon 1 : stations 0 … blocMin-1  → dernière active = blocMin-1
  // Tronçon 2 : stations blocMax+1 … N_ALL-1 → dernière active = N_ALL-1
  // SP fin de ligne :
  //   si bloc à la fin (blocMax===N_ALL-1) → dernière active = blocMin-1
  //   si bloc au début (blocMin===0) → dernière active = N_ALL-1
  const getLastActiveIdx = () => {
    if(!sp.isSP) return N_ALL-1;
    if(sp.isFinDeLigne){
      return blocMax === N_ALL-1 ? blocMin-1 : N_ALL-1;
    }
    return N_ALL-1; // milieu : retournement au vrai terminus de ligne
  };
  const lastActiveIdx = getLastActiveIdx();

  // ── Terminus provisoires (en sens courant) ──
  // En aller : terminus prov tronçon 1 = blocMin-1, tronçon 2 = blocMax+1
  // En retour (indices inversés) : idem mais avec les nouveaux blocMin/blocMax
  const isTermProv = (i) => {
    if(!sp.isSP) return false;
    if(sp.isFinDeLigne){
      // 1 seul terminus provisoire = limite du tronçon actif
      return blocMax === N_ALL-1 ? i === blocMin-1 : i === blocMax+1;
    }
    // Milieu : 2 terminus provisoires
    return i === blocMin-1 || i === blocMax+1;
  };

  // ── Calcul des temps par tronçon ──
  let timeClock = [];
  {
    let timeCumSec = 0;
    for(let i=0; i<N_ALL; i++){
      const isBloc = sp.isSP && i >= blocMin && i <= blocMax;
      // Remet la clock à 0 au début de chaque tronçon actif
      const isFirstOfTroncon = !isBloc && (i===0 || (sp.isSP && i===blocMax+1));
      if(isFirstOfTroncon) timeCumSec = 0;
      if(isBloc){
        timeClock.push(null);
      } else {
        const arretSec  = isRetour ? stationsAll[i].arretR : stationsAll[i].arretA;
        const arriveSec = timeCumSec;
        const departSec = arriveSec + arretSec;
        timeClock.push({ arrivee: isFirstOfTroncon ? null : secToMMS(arriveSec),
                         depart: null, arriveSec, departSec });
        if(i < N_ALL-1){
          const nextIsBloc = sp.isSP && (i+1)>=blocMin && (i+1)<=blocMax;
          if(!nextIsBloc){
            const t   = tenduDir[i];
            const det = detenteDir[i]!==undefined ? detenteDir[i] : t*(sc.coeff-1);
            if(t) timeCumSec = departSec + (t+det)*60;
          }
        }
      }
    }
    // Remplir depart (null pour dernière station de chaque tronçon)
    for(let i=0; i<N_ALL; i++){
      if(!timeClock[i]) continue;
      // Fin tronçon A = station juste avant les bloqués = blocMin-1 (dans indices courants)
      const isLastTroncon1 = sp.isSP && !sp.isFinDeLigne && i===blocMin-1;
      const isLastTroncon2 = i===N_ALL-1;
      const isLastFin      = sp.isSP && sp.isFinDeLigne && i===lastActiveIdx;
      timeClock[i].depart = (isLastTroncon1||isLastTroncon2||isLastFin) ? null : secToMMS(timeClock[i].departSec);
    }
  }

  const termSc = getTerminusForSc(currentSc);
  const tronconRets = termSc.troncons || null; // null si pas SP milieu

  // Retournement à afficher selon la position dans le tableau
  // En SP milieu : tronçon A → tronconRets[0], tronçon B → tronconRets[1]
  // Autrement : retA (sens aller) ou retR (sens retour)
  const getRetForPos = (isSPMilieuTrA) => {
    if(tronconRets){
      // SP milieu — tronçon A = fin du premier tronçon courant
      // En Aller  : trA = tronconRets[0] (terminus = dernier actif du tronçon 0)
      //             trB = tronconRets[1]
      // En Retour : l'ordre des tronçons est inversé
      const tr = isSPMilieuTrA
        ? (isRetour ? tronconRets[1] : tronconRets[0])
        : (isRetour ? tronconRets[0] : tronconRets[1]);
      return { ret: isRetour ? tr.retR : tr.retA,
               retDur: (isRetour ? tr.retR : tr.retA).totalSec/60 };
    }
    return { ret, retDurMin };
  };
  const thead = document.querySelector('table thead');
  const HEAD_H_raw = thead ? thead.getBoundingClientRect().height : 68;
  // Les boutons schema-dir-btns sont AU-DESSUS du SVG mais pas au-dessus du tableau
  // → on soustrait leur hauteur pour que le schéma reste aligné avec les lignes du tableau
  const dirBtns = document.querySelector('.schema-dir-btns');
  const DIR_OFFSET = dirBtns ? dirBtns.getBoundingClientRect().height : 0;
  const HEAD_H = Math.max(0, HEAD_H_raw - DIR_OFFSET);

  // Nombre de lignes tr-retournement insérées AVANT la station i :
  // - 1 si SP milieu et i > blocMin  (ligne partialReversal insérée avant blocMin)
  // - +1 si i > lastActiveIdx        (ligne terminalReversal insérée après lastActiveIdx)
  const retRowsBefore = i => {
    let n = 0;
    if(sp.isSP && !sp.isFinDeLigne && i >= blocMin) n++; // retournement tronçon A
    if(i > lastActiveIdx) n++;                           // retournement terminus
    return n;
  };
  const stY = i => HEAD_H + i*ROW_H + retRowsBefore(i)*ROW_R + ROW_H/2;

  // retY = après la dernière station active + décalage des lignes retournement avant elle
  const retY  = HEAD_H + lastActiveIdx*ROW_H + retRowsBefore(lastActiveIdx)*ROW_R + ROW_H + ROW_R/2;
  const totalH = HEAD_H + N_ALL*ROW_H + (sp.isSP && !sp.isFinDeLigne ? 2 : 1)*ROW_R;
  const svg = document.getElementById('schemaSvg');
  svg.setAttribute('height', totalH);

  // ══════════════════════════════════════════════════════════════════
  //  MOTEUR SCHÉMA COMPLET (voie double + infra)
  //  Constantes préfixées SC_ pour éviter conflits avec le reste du dashboard
  // ══════════════════════════════════════════════════════════════════
  const SC_CX      = 110;
  const SC_VD      = 8;    // demi-écartement voie double
  const SC_DOT_R   = 5;
  const SC_TERM_R  = 9;
  const SC_PW      = SC_VD*2 + 10;  // largeur pilule station
  const SC_PH      = 10;
  const SC_PR      = SC_PH/2;

  // Infra de la ligne (si disponible dans LINE.infra)
  const SC_INFRA = (LINE && LINE.infra) ? LINE.infra : [];

  // Helpers SVG locaux (pas de conflits)
  const scLine = (x1,y1,x2,y2,col,w,dash='') =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="${w}"${dash?` stroke-dasharray="${dash}"`:''}/>`;
  const scCirc = (cx,cy,r,fill,stroke='',sw=0) =>
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"${stroke?` stroke="${stroke}" stroke-width="${sw}"`:''}/>`;
  const scTxt = (x,y,t,sz,col,anchor='middle',fw=600) =>
    `<text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="middle" font-family="'Barlow Condensed',sans-serif" font-size="${sz}" font-weight="${fw}" fill="${col}">${t}</text>`;

  // Coordonnée Y d'une station par index (aligne sur la table)
  const scStY = i => stY(i);
  // Coordonnée Y interpolée entre station i et i+1
  const scInterY = (i, pos) => {
    if(i < 0 || i >= N_ALL-1) return scStY(Math.max(0, Math.min(i, N_ALL-1)));
    return scStY(i) + pos * (scStY(i+1) - scStY(i));
  };
  // Index d'une station dans le tableau courant (stationsAll, potentiellement inversé)
  // L'infra référence toujours les noms dans le sens géographique (aller),
  // donc on cherche d'abord l'index dans LINE.stations (aller), puis on convertit.
  const N_ORIG = LINE.stations.length;
  const scIdxByNom = nom => {
    const iOrig = LINE.stations.findIndex(s => s.nom === nom);
    if(iOrig < 0) return -1;
    return isRetour ? (N_ORIG - 1 - iOrig) : iOrig;
  };

  // ── Panneau tramway (réutilisé) ───────────────────────────────────
  const scSpeedSign = (cx, cy) =>
    `<g transform="translate(${cx+14},${cy-9}) scale(0.038)">
      <title>Attention tramway</title>
      <polygon points="285,20 560,490 10,490" fill="white" stroke="#e8453c" stroke-width="48" stroke-linejoin="round"/>
      <line x1="80" y1="260" x2="490" y2="260" stroke="#111" stroke-width="18"/>
      <line x1="270" y1="260" x2="295" y2="310" stroke="#111" stroke-width="14"/>
      <rect x="95" y="310" width="385" height="110" rx="22" fill="#111"/>
      <rect x="115" y="326" width="55" height="60" rx="6" fill="white" opacity=".85"/>
      <rect x="182" y="326" width="55" height="60" rx="6" fill="white" opacity=".85"/>
      <rect x="249" y="326" width="55" height="60" rx="6" fill="white" opacity=".85"/>
      <rect x="316" y="326" width="55" height="60" rx="6" fill="white" opacity=".85"/>
      <rect x="383" y="326" width="75" height="60" rx="6" fill="white" opacity=".85"/>
      <circle cx="160" cy="430" r="22" fill="#111"/>
      <circle cx="415" cy="430" r="22" fill="#111"/>
    </g>`;

  const bgCol = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#181c28';
  let h = '';
  let hSt = ''; // stations dessinées après l'infra (au-dessus)

  // ── 1. VOIES ──────────────────────────────────────────────────────
  // Voie unique si élément VU_DEBUT/VU_FIN dans SC_INFRA (par nom de station)
  const vuSections = SC_INFRA.filter(e=>e.type==='VU_DEBUT').map(e=>{
    let iD = scIdxByNom(e.stDeb), iF = scIdxByNom(e.stFin);
    if(iD > iF){ const tmp=iD; iD=iF; iF=tmp; } // normalise
    return { iDeb:iD, iFin:iF };
  });
  const isVU = i => vuSections.some(s => i >= s.iDeb && i < s.iFin);

  for(let i=0; i<N_ALL-1; i++){
    const y1 = scStY(i), y2 = scStY(i+1);
    const isBloc   = sp.isSP && i>=blocMin && i<=blocMax;
    const nextBloc = sp.isSP && (i+1)>=blocMin && (i+1)<=blocMax;

    if(isBloc || nextBloc){
      // Section hors-service : tireté rouge mono-voie centré
      h += scLine(SC_CX, y1, SC_CX, y2, '#e8453c', 2.5, '5,4');
    } else if(isVU(i)){
      h += scLine(SC_CX, y1, SC_CX, y2, '#6040b0', 2, '6,4');
      const mid=(y1+y2)/2;
      h += `<polygon points="${SC_CX},${mid-5} ${SC_CX-3},${mid+2} ${SC_CX+3},${mid+2}" fill="#6040b0" opacity=".6"/>`;
    } else {
      h += scLine(SC_CX-SC_VD, y1, SC_CX-SC_VD, y2, '#a06bff', 2);
      h += scLine(SC_CX+SC_VD, y1, SC_CX+SC_VD, y2, '#a06bff', 2);
    }
  }
  // Ligne retournement (sous le dernier terminus actif)
  h += scLine(SC_CX, scStY(lastActiveIdx), SC_CX, retY, '#a06bff', 1.5, '4,3');

  // ── 2. INFRA (depuis SC_INFRA ou carrefours du ZIP) ───────────────
  if(SC_INFRA.length > 0){
    // Infra fourni explicitement (fichier SCHEMA_LIGNE)
    SC_INFRA.forEach(el => {
      // Helper pour trouver l'index par nom (stDeb / stFin)
      const iDeb = el.stDeb ? scIdxByNom(el.stDeb) : -1;
      const iStId = el.stId ? scIdxByNom(el.stId) : -1;

      if(iDeb < 0 && iStId < 0) return;

      // En mode retour, l'interstation stDeb→stFin (sens aller) est représentée
      // dans le tableau inversé par iDeb → iDeb-1 (vers le haut).
      // pos vient toujours du sens aller (0=début, 1=fin).
      // En retour : pos=0 → au niveau de iDeb (stDeb), pos=1 → iDeb-1 (stFin)
      // donc pas besoin d'inverser pos, mais iNext = iDeb-1 au lieu de iDeb+1.
      const elInterY = (i, pos) => {
        if(isRetour){
          const iPrev = i - 1;
          if(i < 0 || iPrev < 0) return scStY(Math.max(0, i));
          return scStY(i) + pos * (scStY(iPrev) - scStY(i));
        } else {
          const iNext = i + 1;
          if(i < 0 || iNext >= N_ALL) return scStY(Math.max(0, Math.min(i, N_ALL-1)));
          return scStY(i) + pos * (scStY(iNext) - scStY(i));
        }
      };

      // ── TERMINUS_AVG
      // ── AIGUILLE_S
      if(el.type==='AIGUILLE_S'){
        const y=elInterY(iDeb, el.pos||0.5);
        const cD=el.cote==='D'?1:-1;
        // xV = rail du côté déclaré (ex: cote:'D' → rail droit)
        const xV = SC_CX + cD*SC_VD;
        // La branche s'arrête exactement sur le rail opposé
        const xBr = SC_CX - cD*SC_VD;
        // En retour, la branche part vers le haut
        const yBr = y + (isRetour ? -14 : 14);
        const col = el.moteur!==false ? '#f5a623' : '#a06bff';
        const aL  = 6;
        const bDx = xBr-xV, bDy = yBr-y, bL = Math.sqrt(bDx*bDx+bDy*bDy);
        h+=`<g class="sc-infra" title="${el.desc||'Aiguille'}">`;
        h+=scLine(xV, y, xBr, yBr, '#a06bff', 2);
        // Pointe colorée à la jonction (xV, y)
        const ptDir = isRetour ? aL : -aL;
        h+=scLine(xV, y+ptDir, xV, y, col, 2.5);
        h+=scLine(xV, y, xV+bDx/bL*aL, y+bDy/bL*aL, col, 2.5);
        h+=scCirc(xV, y, 2, col);
        h+=`</g>`;
      }
      // ── AIGUILLE_D (TJD)
      if(el.type==='AIGUILLE_D'){
        const y=elInterY(iDeb, el.pos||0.5);
        const xG=SC_CX-SC_VD,xD=SC_CX+SC_VD,off=10;
        const isRet=el.stDeb===el.stFin;
        const colR=isRet?'#3ecf6a':'#a06bff'; const colA=isRet?'#3ecf6a':el.moteur!==false?'#f5a623':'#a06bff';
        const dx=xD-xG,dy=2*off,dl=Math.sqrt(dx*dx+dy*dy),ux=dx/dl,uy=dy/dl; const aL=5;
        h+=`<g class="sc-infra" title="${el.desc||'TJD'}">`;
        h+=scLine(xG,y-off,xD,y+off,colR,1.8); h+=scLine(xD,y-off,xG,y+off,colR,1.8);
        [[xG,y-off,1],[xD,y-off,-1],[xG,y+off,1],[xD,y+off,-1]].forEach(([x,yp,s])=>{
          h+=scLine(x,yp,x,yp-s*aL,colA,2.5);
          h+=scLine(x,yp,x+s*ux*aL,yp+s*uy*aL,colA,2.5);
          h+=scCirc(x,yp,1.8,colA);
        });
        h+=`</g>`;
      }
      // ── AIGUILLE_CROIS
      if(el.type==='AIGUILLE_CROIS'){
        const y=elInterY(iDeb, el.pos||0.5);
        const xG=SC_CX-SC_VD,xD=SC_CX+SC_VD,off=9;
        const col=el.moteur!==false?'#f5a623':'#a06bff'; const aL=6;
        const xTop=el.sens==='GD'?xG:xD, xBot=el.sens==='GD'?xD:xG;
        const dx=xBot-xTop,dy=2*off,dl=Math.sqrt(dx*dx+dy*dy);
        h+=`<g class="sc-infra" title="${el.desc||'Croisement'}">`;
        h+=scLine(xTop,y-off,xBot,y+off,'#a06bff',1.8);
        h+=scLine(xTop,y-off-aL,xTop,y-off,col,2.5);
        h+=scLine(xTop,y-off,xTop+dx/dl*aL,y-off+dy/dl*aL,col,2.5);
        h+=scCirc(xTop,y-off,1.8,col);
        h+=scLine(xBot,y+off,xBot,y+off+aL,col,2.5);
        h+=scLine(xBot,y+off,xBot-dx/dl*aL,y+off-dy/dl*aL,col,2.5);
        h+=scCirc(xBot,y+off,1.8,col);
        h+=`</g>`;
      }
      // ── DEBRANCH_VD
      if(el.type==='DEBRANCH_VD'){
        const y=elInterY(iDeb, el.pos||0.5);
        const cD=el.cote==='D'?1:-1;
        // En retour, pointe ↔ talon s'inversent
        const sensEff = isRetour ? (el.sens==='pointe'?'talon':'pointe') : (el.sens||'pointe');
        const sign=sensEff==='pointe'?-1:1;
        const xG=SC_CX-SC_VD,xD=SC_CX+SC_VD;
        const brDist=20, yBrc=y+sign*brDist;
        const yBrInner=yBrc-sign*SC_VD, yBrOuter=yBrc+sign*SC_VD;
        const yBrG=cD<0?yBrInner:yBrOuter, yBrD=cD<0?yBrOuter:yBrInner;
        const xBr=SC_CX+cD*42;
        h+=`<g class="sc-infra" title="${el.desc||'Débranchement VD'}">`;
        h+=`<path d="M ${xG} ${y} C ${xG} ${yBrG} ${xBr} ${yBrG} ${xBr} ${yBrG}" fill="none" stroke="#a06bff" stroke-width="2"/>`;
        h+=`<path d="M ${xD} ${y} C ${xD} ${yBrD} ${xBr} ${yBrD} ${xBr} ${yBrD}" fill="none" stroke="#a06bff" stroke-width="2"/>`;
        const lbl=el.label||''; const lblW=lbl.length*5.5+8;
        const lblX=xBr+cD*4; const lblRX=cD>0?lblX:lblX-lblW;
        h+=`<rect x="${lblRX}" y="${yBrc-7}" width="${lblW}" height="14" rx="3" fill="var(--bg2)" stroke="#a06bff" stroke-width="1.2"/>`;
        h+=scTxt(lblX+(cD>0?lblW/2:-lblW/2), yBrc, lbl, 7.5, '#a06bff','middle',700);
        h+=`</g>`;
      }
      // ── PONT_DESSUS
      if(el.type==='PONT_DESSUS'){
        const y=elInterY(iDeb, el.pos||0.5);
        const xL=SC_CX-SC_VD-7, xR=SC_CX+SC_VD+7, ch=5, gap=7;
        h+=`<g class="sc-infra" title="${el.desc||'Pont dessus'}">`;
        h+=`<rect x="${xL-1}" y="${y-gap-3}" width="${xR-xL+2}" height="${(gap+3)*2}" fill="${bgCol}"/>`;
        h+=`<polyline points="${xL-ch},${y-gap-ch} ${xL},${y-gap} ${xR},${y-gap} ${xR+ch},${y-gap-ch}" fill="none" stroke="#8890aa" stroke-width="2" stroke-linejoin="round"/>`;
        h+=`<polyline points="${xL-ch},${y+gap+ch} ${xL},${y+gap} ${xR},${y+gap} ${xR+ch},${y+gap+ch}" fill="none" stroke="#8890aa" stroke-width="2" stroke-linejoin="round"/>`;
        h+=`</g>`;
      }
      // ── PONT_DESSOUS
      if(el.type==='PONT_DESSOUS'){
        const y=elInterY(iDeb, el.pos||0.5);
        const xL=SC_CX-SC_VD-7, xR=SC_CX+SC_VD+7, ch=5, gap=7;
        h+=`<g class="sc-infra" title="${el.desc||'Pont dessous'}">`;
        h+=`<rect x="${xL-1}" y="${y-gap-3}" width="${xR-xL+2}" height="${(gap+3)*2}" fill="${bgCol}"/>`;
        h+=`<polyline points="${xL-ch},${y-gap+ch} ${xL},${y-gap} ${xR},${y-gap} ${xR+ch},${y-gap+ch}" fill="none" stroke="#8890aa" stroke-width="2" stroke-linejoin="round"/>`;
        h+=`<polyline points="${xL-ch},${y+gap-ch} ${xL},${y+gap} ${xR},${y+gap} ${xR+ch},${y+gap-ch}" fill="none" stroke="#8890aa" stroke-width="2" stroke-linejoin="round"/>`;
        h+=`</g>`;
      }
      // ── TUNNEL
      if(el.type==='TUNNEL'){
        let y1t=elInterY(iDeb, el.posDebut!==undefined?el.posDebut:0.1);
        let y2t=elInterY(iDeb, el.posFin!==undefined?el.posFin:0.9);
        if(y1t > y2t){ const tmp=y1t; y1t=y2t; y2t=tmp; } // toujours y1t < y2t
        const xG=SC_CX-SC_VD, xD=SC_CX+SC_VD, tube=el.tube||'bi', pbi=4, pc=7;
        h+=`<g class="sc-infra" title="${el.desc||'Tunnel'}">`;
        h+=`<rect x="${xG-3}" y="${y1t}" width="6" height="${y2t-y1t}" fill="${bgCol}"/>`;
        h+=`<rect x="${xD-3}" y="${y1t}" width="6" height="${y2t-y1t}" fill="${bgCol}"/>`;
        h+=scLine(xG,y1t,xG,y2t,'#a06bff',1.5,'5,4');
        h+=scLine(xD,y1t,xD,y2t,'#a06bff',1.5,'5,4');
        if(tube==='bi'){
          [[xG],[xD]].forEach(([x])=>{
            h+=`<path d="M ${x-pbi} ${y1t} Q ${x} ${y1t+pbi} ${x+pbi} ${y1t}" fill="none" stroke="#8890aa" stroke-width="1.8"/>`;
            h+=`<path d="M ${x-pbi} ${y2t} Q ${x} ${y2t-pbi} ${x+pbi} ${y2t}" fill="none" stroke="#8890aa" stroke-width="1.8"/>`;
          });
        } else {
          h+=`<path d="M ${xG-3} ${y1t} Q ${SC_CX} ${y1t+pc} ${xD+3} ${y1t}" fill="none" stroke="#8890aa" stroke-width="1.8"/>`;
          h+=`<path d="M ${xG-3} ${y2t} Q ${SC_CX} ${y2t-pc} ${xD+3} ${y2t}" fill="none" stroke="#8890aa" stroke-width="1.8"/>`;
        }
        h+=`</g>`;
      }
      // ── P+R
      if(el.type==='PR'){
        const y=elInterY(iDeb, el.pos||0.5);
        const cD=el.cote==='D'?1:-1; const xR=SC_CX+cD*SC_VD;
        const armL=16, xA=xR+cD*armL; const bW=24,bH=16,bX=cD>0?xA:xA-bW;
        h+=`<g class="sc-infra" title="${el.desc||'P+R'}">`;
        h+=scLine(xR,y,xA,y,'#f5a623',1.5);
        h+=scCirc(xR,y,3,'#f5a623');
        h+=`<rect x="${bX}" y="${y-bH/2}" width="${bW}" height="${bH}" rx="3" fill="var(--bg2)" stroke="#f5a623" stroke-width="1.5"/>`;
        h+=scTxt(bX+bW/2, y, 'P+R', 7.5, '#f5a623','middle',800);
        h+=`</g>`;
      }
      // ── DEPOT
      if(el.type==='DEPOT'){
        const y=elInterY(iDeb, el.pos||0.5);
        const cD=el.cote==='D'?1:-1; const xM=SC_CX+cD*SC_VD; const xD2=xM+cD*24;
        h+=`<g class="sc-infra" title="${el.desc||'Dépôt'}">`;
        h+=scLine(xM,y,xD2,y,'#f5a623',1.8);
        h+=`<rect x="${xD2-(cD>0?0:12)}" y="${y-6}" width="12" height="12" rx="2" fill="rgba(245,166,35,.15)" stroke="#f5a623" stroke-width="1.5"/>`;
        h+=scTxt(xD2+cD*(-6+3), y+1, 'D', 6.5, '#f5a623','middle',700);
        h+=`</g>`;
      }
      // ── CARREFOUR
      if(el.type==='CARREFOUR'){
        const y=elInterY(iDeb, el.pos||0.5);
        h+=`<g class="sc-infra" title="${el.desc||'Carrefour'}">`;
        h+=scSpeedSign(SC_CX, y);
        h+=`</g>`;
      }
    });
  } else {
    // Pas d'infra explicite — on affiche les carrefours du ZIP (LINE.inter[i].c)
    const carrefoursDir = isRetour
      ? [...LINE.inter].reverse().map(seg=>seg.c.map(p=>1-p).reverse())
      : LINE.inter.map(seg=>seg.c);
    for(let i=0; i<N_ALL-1; i++){
      const isBloc   = sp.isSP && i>=blocMin && i<=blocMax;
      const nextBloc = sp.isSP && (i+1)>=blocMin && (i+1)<=blocMax;
      if(isBloc || nextBloc) continue;
      const y1c=scStY(i), y2c=scStY(i+1);
      (carrefoursDir[i]||[]).forEach(pos=>{ h+=scSpeedSign(SC_CX, y1c+pos*(y2c-y1c)); });
    }
  }

  // ── 3. STATIONS (dessinées après l'infra pour être au-dessus) ──────
  for(let i=0; i<N_ALL; i++){
    const cy       = scStY(i);
    const st       = stationsAll[i];
    const isBloc   = sp.isSP && i>=blocMin && i<=blocMax;
    const isTProv  = isTermProv(i);
    const isT      = (i===0 || i===N_ALL-1);
    const isImp    = st.type==='important';
    const px       = SC_CX - SC_PW/2;
    const py       = cy - SC_PH/2;

    if(isBloc){
      hSt+=`<rect x="${px}" y="${py}" width="${SC_PW}" height="${SC_PH}" rx="${SC_PR}" fill="#2a2f42" stroke="#e8453c" stroke-width="1.5" opacity=".5"/>`;
      hSt+=scLine(SC_CX-4,cy-4,SC_CX+4,cy+4,'#e8453c',1.5);
      hSt+=scLine(SC_CX+4,cy-4,SC_CX-4,cy+4,'#e8453c',1.5);
    } else if(isTProv){
      hSt+=`<rect x="${px-2}" y="${py-2}" width="${SC_PW+4}" height="${SC_PH+4}" rx="${SC_PR+2}" fill="none" stroke="#3ecf6a" stroke-width="1" opacity=".4"/>`;
      hSt+=`<rect x="${px}" y="${py}" width="${SC_PW}" height="${SC_PH}" rx="${SC_PR}" fill="#3ecf6a" stroke="#3ecf6a" stroke-width="1.5"/>`;
      hSt+=scLine(SC_CX+SC_PW/2+2,cy-9,SC_CX+SC_PW/2+2,cy+5,'#3ecf6a',1.5);
      hSt+=`<polygon points="${SC_CX+SC_PW/2+2},${cy-9} ${SC_CX+SC_PW/2+9},${cy-5} ${SC_CX+SC_PW/2+2},${cy-1}" fill="#3ecf6a"/>`;
    } else if(isT){
      hSt+=`<rect x="${px-2}" y="${py-2}" width="${SC_PW+4}" height="${SC_PH+4}" rx="${SC_PR+2}" fill="none" stroke="#3ecf6a" stroke-width="1" opacity=".35"/>`;
      hSt+=`<rect x="${px}" y="${py}" width="${SC_PW}" height="${SC_PH}" rx="${SC_PR}" fill="#3ecf6a" stroke="#3ecf6a" stroke-width="1.5"/>`;
      const termLbl = i===0 ? 'AV' : 'AR';
      hSt+=scTxt(SC_CX, cy+1, termLbl, 7, '#0e1018', 'middle', 800);
    } else if(isImp){
      hSt+=`<rect x="${px}" y="${py}" width="${SC_PW}" height="${SC_PH}" rx="${SC_PR}" fill="#a06bff" stroke="#a06bff" stroke-width="1.5"/>`;
    } else {
      hSt+=`<rect x="${px}" y="${py}" width="${SC_PW}" height="${SC_PH}" rx="${SC_PR}" fill="var(--bg)" stroke="#a06bff" stroke-width="1.5"/>`;
    }

    // Ligne pointillée de raccord vers le tableau (bord droit du SVG)
    const lineCol = isBloc ? '#e8453c44' : isT||isTProv ? '#3ecf6a44' : isImp ? '#a06bff44' : '#a06bff33';
    hSt+=scLine(px + SC_PW + 2, cy, svg.getBoundingClientRect().width||220, cy, lineCol, 1, '3,3');
  }

  // Stations au-dessus de tout
  h += hSt;

  // ── Symbole retournement terminus ──────────────────────────────────
  h+=`<g transform="translate(${SC_CX},${retY})">
    <circle r="7" fill="rgba(160,107,255,.15)" stroke="#a06bff" stroke-width="1.5"/>
    <path d="M -9 -7 Q -18 0 -9 7" fill="none" stroke="#a06bff" stroke-width="2" stroke-linecap="round"/>
    <polygon points="-9,7 -5,3 -13,4" fill="#a06bff"/>
  </g>`;

  svg.innerHTML = h;

  let distCum = 0;
  let tableHTML = '';
  for(let i=0; i<N_ALL; i++){
    const st      = stationsAll[i];
    const isBloc  = sp.isSP && i>=blocMin && i<=blocMax;
    const isT     = st.type==='terminus';
    const isTProv = isTermProv(i);
    const seg     = i>0 ? interAll[i-1] : null;
    const arretSec= isRetour ? st.arretR : st.arretA;
    const tc      = timeClock[i];
    if(seg) distCum += seg.dist/1000;

    const isAfterTronconA = sp.isSP && !sp.isFinDeLigne && i===blocMin;
    if(isAfterTronconA){
      const {ret:rTrA, retDur:rDurA} = getRetForPos(true);
      tableHTML+=`<tr class="tr-retournement" style="background:rgba(160,107,255,.08)">
        <td class="td-station" colspan="2" style="font-size:.6rem;color:var(--purple)">${T('partialReversal')}</td>
        <td colspan="5" style="font-size:.6rem;color:var(--purple)">${retDetailStr(rTrA)}</td>
        <td colspan="1" style="font-size:.6rem;color:var(--purple);font-weight:700">${fmtMin(rDurA)}</td>
      </tr>`;
    }

    if(isBloc){
      tableHTML+=`<tr style="opacity:.4;background:repeating-linear-gradient(45deg,rgba(232,69,60,.05),rgba(232,69,60,.05) 4px,transparent 4px,transparent 8px)">
        <td class="td-station" style="color:var(--red);text-decoration:line-through">${st.nom}</td>
        <td class="td-mono"><span class="empty">—</span></td>
        <td><span class="empty">—</span></td>
        <td class="td-mono"><span class="empty">—</span></td>
        <td class="td-mono"><span class="empty">—</span></td>
        <td class="td-mono"><span class="empty">—</span></td>
        <td><span class="empty">—</span></td>
        <td><span class="empty">—</span></td>
      </tr>`;
    } else {
      const tendu_v = i>0 ? tenduDir[i-1] : null;
      const delta_v = tendu_v ? (detenteDir[i-1]!==undefined ? detenteDir[i-1] : +(tendu_v*(sc.coeff-1)).toFixed(3)) : null;
      const stClass = isT ? ' terminus' : isTProv ? ' terminus-partiel' : '';
      tableHTML+=`<tr>
        <td class="td-station${stClass}">${st.nom}${isTProv?'<span class="sp-flag"> ⊳</span>':''}</td>
        <td class="td-mono">${seg?seg.dist.toLocaleString('fr-FR')+' m':'<span class="empty">—</span>'}</td>
        <td>${seg?`<span class="badge badge-cumul${currentDir==='retour'?' retour':''}">${distCum.toFixed(2)} km</span>`:'<span class="empty">—</span>'}</td>
        <td class="td-mono">${tendu_v?fmtMin(tendu_v):'<span class="empty">—</span>'}</td>
        <td class="td-mono" style="color:var(--orange)">${delta_v?'+'+fmtMin(delta_v):'<span class="empty">—</span>'}</td>
        <td class="td-mono">${arretSec?secToStr(arretSec):'<span class="empty">—</span>'}</td>
        <td>${tc&&tc.arrivee?'<span class="badge badge-arrivee">'+tc.arrivee+'</span>':'<span class="empty">—</span>'}</td>
        <td>${tc&&tc.depart?'<span class="badge badge-depart">'+tc.depart+'</span>':'<span class="empty">—</span>'}</td>
      </tr>`;
    }

    if(i === lastActiveIdx){
      const {ret:rTerm, retDur:rDurTerm} = getRetForPos(false);
      tableHTML+=`<tr class="tr-retournement">
        <td class="td-station" style="font-size:.63rem">${T('terminalReversal')}${sp.isSP&&sp.isFinDeLigne?T('provisional'):''}</td>
        <td colspan="5" style="color:var(--purple);font-size:.6rem;text-align:left">${retDetailStr(rTerm)}</td>
        <td colspan="1" style="color:var(--purple);font-weight:700">${fmtMin(rDurTerm)}</td>
        <td><span class="empty">—</span></td>
      </tr>`;
    }
  }

  document.getElementById('tableBody').innerHTML = tableHTML;

  // ── Badge SP ──
  let spBadgeEl = document.getElementById('spBadge');
  if(sp.isSP){
    if(!spBadgeEl){
      spBadgeEl = document.createElement('span');
      spBadgeEl.id = 'spBadge';
      spBadgeEl.style.cssText='background:var(--red);color:#fff;font-size:.6rem;font-weight:800;letter-spacing:.08em;padding:.2rem .5rem;border-radius:3px;text-transform:uppercase;margin-left:.4rem';
      document.getElementById('scLabel').after(spBadgeEl);
    }
    spBadgeEl.textContent = 'SP';
    spBadgeEl.style.display='inline-block';
  } else {
    if(spBadgeEl) spBadgeEl.style.display='none';
  }

  document.getElementById('scLabel').textContent = sc.label;
  renderKPIs(currentSc);
  renderCharts(currentSc);
  updateMTImage();
}


/* ═══════════════════════════════════════════════
   CAROUSEL
═══════════════════════════════════════════════ */
let CAROUSEL_SLIDES = [];
let carouselIdx = 0;
let _slideImgB64 = ''; // image en attente d'ajout

function carouselRender(){
  const track   = document.getElementById('carouselTrack');
  const empty   = document.getElementById('carouselEmpty');
  const dots    = document.getElementById('carouselDots');
  const counter = document.getElementById('carouselCounter');
  const btnP    = document.getElementById('carouselPrev');
  const btnN    = document.getElementById('carouselNext');
  const n = CAROUSEL_SLIDES.length;

  if(n === 0){
    track.style.display = 'none';
    empty.style.display = 'flex';
    dots.innerHTML = '';
    counter.textContent = '';
    btnP.disabled = true;
    btnN.disabled = true;
    return;
  }
  empty.style.display = 'none';
  track.style.display = 'flex';
  carouselIdx = Math.max(0, Math.min(carouselIdx, n-1));

  track.innerHTML = CAROUSEL_SLIDES.map((s,i) => `
    <div class="carousel-slide">
      ${s.img
        ? `<img src="${s.img}" alt="slide ${i+1}">`
        : s.imgName
          ? `<div style="width:100%;height:80px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.3rem;background:var(--bg4);border-radius:3px;border:1px dashed var(--orange);color:var(--orange)"><span style="font-size:1.2rem">📷</span><span style="font-size:.55rem;font-family:var(--fontb)">Image attendue : ${s.imgName}</span><span style="font-size:.5rem;color:var(--text3)">Importez un ZIP avec images/</span></div>`
          : ''}
      ${s.txt ? `<div class="carousel-slide-txt">${s.txt}</div>` : ''}
    </div>`).join('');

  track.style.transform = `translateX(-${carouselIdx * 100}%)`;

  dots.innerHTML = CAROUSEL_SLIDES.map((_, i) =>
    `<div class="carousel-dot${i===carouselIdx?' active':''}" onclick="carouselGo(${i})"></div>`
  ).join('');

  counter.textContent = `${carouselIdx+1} / ${n}`;
  btnP.disabled = false;
  btnN.disabled = false;
}

function carouselMove(dir){
  const n = CAROUSEL_SLIDES.length;
  if(n === 0) return;
  carouselIdx = (carouselIdx + dir + n) % n;
  carouselRender();
}
function carouselGo(idx){ carouselIdx = idx; carouselRender(); }

// Prévisualisation image dans le formulaire
function slidePreviewImg(input){
  if(!input.files[0]) return;
  const reader = new FileReader();
  reader.onload = e => {
    _slideImgB64 = e.target.result;
    const drop = document.getElementById('slideImgDrop');
    // Supprimer ancienne preview
    const old = drop.querySelector('img.preview');
    if(old) old.remove();
    const img = document.createElement('img');
    img.className = 'preview';
    img.src = _slideImgB64;
    img.style = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:2px;';
    drop.appendChild(img);
    document.getElementById('slideImgIcon').style.display = 'none';
    document.getElementById('slideImgLbl').style.display = 'none';
  };
  reader.readAsDataURL(input.files[0]);
}

// Ajouter une slide depuis le formulaire
function slideAdd(){
  const txt = document.getElementById('slideTxtInput').value.trim();
  if(!_slideImgB64 && !txt){ alert('Ajoutez au moins une image ou un texte.'); return; }
  CAROUSEL_SLIDES.push({ img: _slideImgB64, txt: txt.replace(/\n/g,'<br>') });
  carouselIdx = CAROUSEL_SLIDES.length - 1;
  carouselRender();
  slidesListRender();
  // Reset formulaire
  _slideImgB64 = '';
  document.getElementById('slideTxtInput').value = '';
  const drop = document.getElementById('slideImgDrop');
  const old = drop.querySelector('img.preview');
  if(old) old.remove();
  document.getElementById('slideImgIcon').style.display = '';
  document.getElementById('slideImgLbl').style.display = '';
  document.getElementById('slideImgInput').value = '';
}

// Supprimer une slide
function slideDel(i){
  CAROUSEL_SLIDES.splice(i, 1);
  carouselIdx = Math.max(0, Math.min(carouselIdx, CAROUSEL_SLIDES.length-1));
  carouselRender();
  slidesListRender();
}

// Liste des slides dans l'overlay
function slidesListRender(){
  const el = document.getElementById('slidesList');
  if(!el) return;
  if(CAROUSEL_SLIDES.length === 0){ el.innerHTML = ''; return; }
  el.innerHTML = CAROUSEL_SLIDES.map((s,i) => `
    <div class="slide-list-item">
      ${s.img
        ? `<img class="slide-list-thumb" src="${s.img}">`
        : `<div class="slide-list-thumb" style="display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:.6rem;gap:1px;color:${s.imgName?'var(--orange)':'var(--text3)'}">🖼${s.imgName?`<span style="font-size:.45rem;max-width:52px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${s.imgName}">⏳ ${s.imgName}</span>`:''}</div>`}
      <span class="slide-list-txt">${s.txt || '<em style="color:var(--text3)">Sans texte</em>'}</span>
      <button class="slide-list-del" onclick="slideDel(${i})" title="Supprimer">✕</button>
    </div>`).join('');
}

function applyMTImagesFromWb(wb, imageMap){
  imageMap = imageMap || {};
  const wsMeta = wb.Sheets['META'];
  if(!wsMeta) return;
  const metaRows = XLSX.utils.sheet_to_json(wsMeta, {header:1, defval:null});
  let mtAller = '', mtRetour = '';
  metaRows.forEach(r=>{
    if(!r[0]) return;
    if(r[0]==='MT_ALLER')  mtAller  = String(r[1]||'').trim();
    if(r[0]==='MT_RETOUR') mtRetour = String(r[1]||'').trim();
  });
  function resolveImg(name){
    if(!name) return '';
    let src = imageMap[name] || imageMap[name.toLowerCase()] || '';
    if(!src){
      const base = name.replace(/\.[^.]+$/,'').toLowerCase();
      for(const k of Object.keys(imageMap)){
        if(k.replace(/\.[^.]+$/,'').toLowerCase() === base){ src = imageMap[k]; break; }
      }
    }
    return src;
  }
  const srcAller  = resolveImg(mtAller);
  const srcRetour = resolveImg(mtRetour);
  if(srcAller)  MT_IMAGES.aller  = srcAller;
  if(srcRetour) MT_IMAGES.retour = srcRetour;

  // Images MT des scénarios SP (MT_A / MT_R dans SCENARIOS)
  if(LINE && LINE.scenarios){
    LINE.scenarios.forEach(sc=>{
      if(sc.type==='SP'){
        if(sc.mtA){ const s=resolveImg(sc.mtA); if(s) MT_IMAGES['sc_'+sc.mtA]=s; }
        if(sc.mtR){ const s=resolveImg(sc.mtR); if(s) MT_IMAGES['sc_'+sc.mtR]=s; }
      }
    });
  }

  updateMTImage();
}

function parseCarouselSheet(wb, imageMap){
  imageMap = imageMap || {};
  if(!wb.Sheets['CAROUSEL']) return;
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['CAROUSEL'], {header:1, defval:''});
  const slides = [];
  for(let i=1; i<rows.length; i++){
    const r = rows[i];
    if(!r[0] && !r[1] && !r[2]) continue;
    const titre   = String(r[0]||'').trim();
    const texte   = String(r[1]||'').trim();
    const imgName = String(r[2]||'').trim();
    // Ignorer les lignes d'instruction
    if(!titre && !texte && !imgName) continue;
    if(titre.startsWith("Mode d'emploi") || titre.startsWith('→') || titre==='TITRE' || titre.toUpperCase()==='TITRE') continue;
    const txt = [titre?`<strong>${titre}</strong>`:'', texte].filter(Boolean).join('<br>');
    // Chercher l'image dans la map (insensible à la casse)
    let imgSrc = '';
    if(imgName){
      imgSrc = imageMap[imgName] || imageMap[imgName.toLowerCase()] || '';
      if(!imgSrc){
        // Correspondance partielle sans extension
        const base = imgName.replace(/\.[^.]+$/,'').toLowerCase();
        for(const k of Object.keys(imageMap)){
          if(k.replace(/\.[^.]+$/,'').toLowerCase() === base){ imgSrc = imageMap[k]; break; }
        }
      }
    }
    // Stocker aussi le nom de fichier attendu (pour affichage statut)
    const slideMeta = { img: imgSrc, txt, imgName: imgSrc ? '' : imgName };
    if(txt || imgSrc || imgName) slides.push(slideMeta);
  }
  if(slides.length > 0){
    CAROUSEL_SLIDES = [...CAROUSEL_SLIDES, ...slides];
    carouselIdx = 0;
    carouselRender();
    slidesListRender();
  }
}

