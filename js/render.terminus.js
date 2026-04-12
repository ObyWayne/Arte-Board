/* ── render.terminus.js — Page terminus, Gantt, treemap ── */

/* ─ Couleurs occupation — non personnalisables via feuille COLOR ─ */
const OCCUP_COL_OK   = '#22c55e'; // vert  — taux ok
const OCCUP_COL_WARN = '#f59e0b'; // amber — attention
const OCCUP_COL_CRIT = '#ef4444'; // rouge — critique
/* ═══════════════════════════════════════════════
   PAGE TERMINUS
═══════════════════════════════════════════════ */
const occColor    = (pct) => { const s1=window.SETT_OCCUP_S1||20, s2=window.SETT_OCCUP_S2||30; return pct<s1?'var(--green)':pct<s2?'var(--orange)':'var(--red)'; };
const occColorHex = (pct) => { const s1=window.SETT_OCCUP_S1||20, s2=window.SETT_OCCUP_S2||30; return pct<s1?OCCUP_COL_OK:pct<s2?OCCUP_COL_WARN:OCCUP_COL_CRIT; };

/* Taux d'occupation d'une phase (en sec) pour une fréquence donnée (min) */
function termOccupPct(phaseSec, freqMin){
  if(!freqMin || freqMin <= 0) return null;
  return Math.round(phaseSec / (freqMin * 60) * 100);
}

/* Fréquence HP de référence (pire cas — fréquence minimale) */
function refFreqHP(){
  const sc = LINE && LINE.scenarios[currentSc];
  // sc.freqHP est la fréquence cible du scénario — source de vérité pour l'occupation
  if(sc && sc.freqHP) return sc.freqHP;
  const hpFreqs = PLAGES.filter(p => p.type==='HP' && p.freq > 0).map(p => p.freq);
  if(hpFreqs.length) return Math.min(...hpFreqs);
  return sc ? (sc.freqMin || 10) : 10;
}

/* ─── Mini histogramme SVG pour UNE phase, par plage horaire ─── */
function buildMiniHistoSVG(phaseSec){
  // Résout la fréquence de chaque plage : valeur explicite sinon fallback sur sc.freqHP/HC
  const sc = LINE && LINE.scenarios[currentSc];
  const freqHP = sc ? (sc.freqHP || sc.freqMin || 10) : 10;
  const freqHC = sc ? (sc.freqHC || freqHP * 2) : freqHP * 2;

  // Pour l'occupation terminus on utilise TOUJOURS sc.freqHP/HC (fréquence cible du scénario)
  // PLAGES.freq sert uniquement à l'affichage de l'horloge, pas au calcul d'occupation
  const plagesActives = PLAGES
    .map(p => ({
      ...p,
      freqRes: p.type==='HP' ? freqHP : p.type==='HC' ? freqHC : null
    }))
    .filter(p => p.freqRes && p.freqRes > 0);
  if(!plagesActives.length) return '<div style="font-size:.45rem;color:var(--text3);padding:.5rem">—</div>';

  const W = 220, H = 140;
  const PAD = { top:18, right:8, bottom:38, left:28 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top  - PAD.bottom;

  const vals   = plagesActives.map(p => termOccupPct(phaseSec, p.freqRes) ?? 0);
  const maxVal = Math.max(...vals, 100) * 1.1;  // au moins 100%, marge 10% au-dessus du max

  const yScale = v => plotH - (v / maxVal * plotH);
  const hToY   = v => Math.max(1, v / maxVal * plotH);

  /* Grille légère — graduations jusqu'au max */
  const gridVals = [];
  for(let v=25; v < maxVal; v+=25) gridVals.push(v);
  const grid = gridVals.map(v => {
    const y = PAD.top + yScale(v);
    return `<line x1="${PAD.left}" y1="${y.toFixed(1)}" x2="${PAD.left+plotW}" y2="${y.toFixed(1)}" stroke="currentColor" stroke-width="0.3" opacity="0.1"/>`;
  }).join('');

  /* Seuils 20% et 30% */
  const seuils = [{v:20,c:OCCUP_COL_OK},{v:30,c:OCCUP_COL_WARN}];
  const seuilSVG = seuils.filter(s=>s.v<maxVal).map(s => {
    const y = PAD.top + yScale(s.v);
    return `<line x1="${PAD.left}" y1="${y.toFixed(1)}" x2="${PAD.left+plotW}" y2="${y.toFixed(1)}" stroke="${s.c}" stroke-width="0.7" stroke-dasharray="2,2" opacity="0.6"/>
      <text x="${PAD.left-2}" y="${(y+2.5).toFixed(1)}" text-anchor="end" font-size="6" fill="${s.c}" opacity="0.75">${s.v}%</text>`;
  }).join('');

  /* Axe */
  const axes = `<line x1="${PAD.left}" y1="${PAD.top}" x2="${PAD.left}" y2="${PAD.top+plotH}" stroke="currentColor" stroke-width="0.5" opacity="0.25"/>
    <line x1="${PAD.left}" y1="${PAD.top+plotH}" x2="${PAD.left+plotW}" y2="${PAD.top+plotH}" stroke="currentColor" stroke-width="0.5" opacity="0.25"/>`;

  /* Labels Y */
  const yLabels = gridVals.concat([0]).sort((a,b)=>a-b).map(v => {
    const y = PAD.top + yScale(v);
    return `<text x="${PAD.left-3}" y="${(y+2.5).toFixed(1)}" text-anchor="end" font-size="6" fill="currentColor" opacity="0.4">${v}</text>`;
  }).join('');

  const nBars = plagesActives.length;
  const barW  = Math.max(6, plotW/nBars * 0.55);
  const step  = plotW / nBars;

  let bars = '', xLabels = '';
  plagesActives.forEach((p, i) => {
    const v   = vals[i];
    const cx  = PAD.left + i * step + step/2;
    const bx  = cx - barW/2;
    const bh  = hToY(v);
    const by  = PAD.top + yScale(v);
    const col = occColorHex(v);

    bars += `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" fill="${col}" opacity="0.88" rx="1.5"/>`;
    if(v > 4) bars += `<text x="${cx.toFixed(1)}" y="${(by-2).toFixed(1)}" text-anchor="middle" font-size="6" fill="${col}" font-weight="700">${v}%</text>`;

    /* Label X : freq */
    const h1 = Math.floor(p.debut/60), m1 = p.debut%60;
    const h2 = Math.floor(p.fin/60),   m2 = p.fin%60;
    const t1 = m1 ? `${h1}h${String(m1).padStart(2,'0')}` : `${h1}h`;
    const t2 = m2 ? `${h2}h${String(m2).padStart(2,'0')}` : `${h2}h`;
    xLabels += `<text x="${cx.toFixed(1)}" y="${(PAD.top+plotH+9).toFixed(1)}" text-anchor="middle" font-size="5.5" fill="currentColor" opacity="0.55">${t1}–${t2}</text>`;
    xLabels += `<text x="${cx.toFixed(1)}" y="${(PAD.top+plotH+17).toFixed(1)}" text-anchor="middle" font-size="5.5" fill="currentColor" opacity="0.38">${p.freqRes}min</text>`;
  });

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="color:var(--text)">
    ${grid}${seuilSVG}${axes}${yLabels}${bars}${xLabels}
  </svg>`;
}

/* ─── Panneau image depuis le nom de fichier issu de SCENARIOS ─── */
function buildTermImgSingle(imgName, labelDir){
  if(!imgName){
    return `<div class="term-img-placeholder">
      <div class="term-img-placeholder-icon">🗺</div>
      <div class="term-img-placeholder-text">${T('termNoImgDefined')}</div>
      <div class="term-img-placeholder-hint">${T('termNoImgHint')}</div>
    </div>`;
  }
  /* Recherche insensible à la casse dans GLOBAL_IMAGE_MAP */
  const lc  = imgName.toLowerCase();
  const src = GLOBAL_IMAGE_MAP[imgName]
    || Object.entries(GLOBAL_IMAGE_MAP).find(([k])=>k.toLowerCase()===lc)?.[1]
    || null;

  if(!src){
    return `<div class="term-img-placeholder">
      <div class="term-img-placeholder-icon">🗺</div>
      <div class="term-img-placeholder-text">${T('termImgNotFound')}</div>
      <div class="term-img-placeholder-hint"><code>${imgName}</code></div>
    </div>`;
  }
  return `<div class="term-img-display"><img src="${src}" alt="${labelDir}"/></div>`;
}

/* ─── Labels des 3 phases (position dans ret.params) ─── */
// TERM_PHASE_LABELS_* remplacés par T() dans OCC_KEYS


/* ANCIENNE fonction conservée pour compatibilité — plus utilisée directement */
function buildTermHistoSVG(termList){
  // Plages avec fréquence définie (exclure HS)
  const plagesActives = PLAGES.filter(p => p.freq && p.freq > 0);
  if(!plagesActives.length || !termList.length) return '<div class="term-empty" style="margin:1rem 0">—</div>';

  const W = 400, H = 200;
  const PAD = { top:20, right:12, bottom:46, left:36 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top  - PAD.bottom;

  // Couleurs par terminus
  const COL_A = BRAND.primaire1;
  const COL_R = BRAND.aller;

  // Calcul des données
  const datasets = termList.map((t, i) => ({
    label: t.nom,
    color: i===0 ? COL_A : COL_R,
    vals: plagesActives.map(p => termOccupPct(t.ret.totalSec, p.freq) ?? 0)
  }));

  const maxVal = Math.max(100, ...datasets.flatMap(d => d.vals)) * 1.05;
  const nGroups = plagesActives.length;
  const nBars   = datasets.length;
  const groupW  = plotW / nGroups;
  const barPad  = groupW * 0.12;
  const barW    = (groupW - barPad*2) / nBars - 2;

  const yScale = (v) => plotH - (v / maxVal * plotH);
  const hToY   = (v) => v / maxVal * plotH;

  // Lignes de seuil
  const seuils = [{pct:20,col:OCCUP_COL_OK},{pct:30,col:OCCUP_COL_WARN},{pct:100,col:OCCUP_COL_CRIT}];
  let seuilLines = seuils.map(s => {
    const y = PAD.top + yScale(s.pct);
    if(s.pct > maxVal) return '';
    return `<line x1="${PAD.left}" y1="${y.toFixed(1)}" x2="${PAD.left+plotW}" y2="${y.toFixed(1)}"
      stroke="${s.col}" stroke-width="0.8" stroke-dasharray="3,3" opacity="0.55"/>
      <text x="${PAD.left-2}" y="${(y+3).toFixed(1)}" text-anchor="end" font-size="7" fill="${s.col}" opacity="0.8">${s.pct}%</text>`;
  }).join('');

  // Grille Y légère
  const gridLines = [25,50,75].map(v => {
    if(v >= maxVal) return '';
    const y = PAD.top + yScale(v);
    return `<line x1="${PAD.left}" y1="${y.toFixed(1)}" x2="${PAD.left+plotW}" y2="${y.toFixed(1)}" stroke="currentColor" stroke-width="0.4" opacity="0.12"/>`;
  }).join('');

  // Axe X & Y
  const axes = `
    <line x1="${PAD.left}" y1="${PAD.top}" x2="${PAD.left}" y2="${PAD.top+plotH}" stroke="currentColor" stroke-width="0.6" opacity="0.3"/>
    <line x1="${PAD.left}" y1="${PAD.top+plotH}" x2="${PAD.left+plotW}" y2="${PAD.top+plotH}" stroke="currentColor" stroke-width="0.6" opacity="0.3"/>`;

  // Étiquettes Y
  const yLabels = [0,25,50,75,100].filter(v=>v<=maxVal).map(v => {
    const y = PAD.top + yScale(v);
    return `<text x="${PAD.left-4}" y="${(y+2.5).toFixed(1)}" text-anchor="end" font-size="7" fill="currentColor" opacity="0.45">${v}</text>`;
  }).join('');

  // Barres + étiquettes X
  let bars = '';
  let xLabels = '';
  plagesActives.forEach((p, gi) => {
    const gx = PAD.left + gi * groupW + barPad;
    // Label temps (ex: "7h-9h")
    const h1 = Math.floor(p.debut/60);
    const h2 = Math.floor(p.fin/60);
    const m1 = p.debut % 60;
    const m2 = p.fin % 60;
    const lbl1 = m1 ? `${h1}h${String(m1).padStart(2,'0')}` : `${h1}h`;
    const lbl2 = m2 ? `${h2}h${String(m2).padStart(2,'0')}` : `${h2}h`;
    const lblFreq = `${p.freq}min`;
    const cx = PAD.left + gi * groupW + groupW/2;
    xLabels += `<text x="${cx.toFixed(1)}" y="${(PAD.top+plotH+11).toFixed(1)}" text-anchor="middle" font-size="6.5" fill="currentColor" opacity="0.6">${lbl1}–${lbl2}</text>`;
    xLabels += `<text x="${cx.toFixed(1)}" y="${(PAD.top+plotH+20).toFixed(1)}" text-anchor="middle" font-size="6" fill="currentColor" opacity="0.4">${lblFreq}</text>`;

    datasets.forEach((ds, bi) => {
      const v   = ds.vals[gi];
      const bx  = gx + bi * (barW + 2);
      const bh  = Math.max(1, hToY(v));
      const by  = PAD.top + yScale(v);
      const col = occColorHex(v);
      bars += `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" fill="${col}" opacity="0.85" rx="1"/>`;
      if(v > 5){
        const labelY = by - 2.5;
        bars += `<text x="${(bx+barW/2).toFixed(1)}" y="${labelY.toFixed(1)}" text-anchor="middle" font-size="6.5" fill="${col}" font-weight="700">${v}%</text>`;
      }
    });
  });

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="color:var(--text)">
    ${gridLines}${seuilLines}${axes}${yLabels}${bars}${xLabels}
  </svg>`;
}


/* ── SVG icône tram rempli à X% — double icône si >100% ── */
function buildTrainIcon(pct, col, size=48){
  if(pct > 100){
    const surplus = pct - 100;
    const surplusCol = OCCUP_COL_CRIT;
    return `<div style="display:flex;gap:2px;align-items:flex-end;">${_trainSvg(100, col, size)}${_trainSvg(surplus, surplusCol, size)}</div>`;
  }
  return _trainSvg(pct, col, size);
}
function _trainSvg(pct, col, size=48){
  const id = 'tc_' + Math.random().toString(36).slice(2,7);
  const fillH = Math.min(100, Math.max(0, pct));
  // Tram vu de face : corps + fenêtre + phares + rails
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <clipPath id="${id}">
        <rect x="0" y="${100 - fillH}" width="100" height="${fillH}"/>
      </clipPath>
    </defs>
    <!-- Contour gris (fond) -->
    <g opacity=".18">
      <rect x="18" y="8" width="64" height="62" rx="12" fill="var(--text3)"/>
      <rect x="24" y="16" width="52" height="26" rx="5" fill="var(--bg)"/>
      <circle cx="35" cy="56" r="8" fill="var(--text3)"/>
      <circle cx="65" cy="56" r="8" fill="var(--text3)"/>
      <rect x="22" y="6" width="14" height="5" rx="2.5" fill="var(--text3)"/>
      <rect x="64" y="6" width="14" height="5" rx="2.5" fill="var(--text3)"/>
      <line x1="30" y1="72" x2="18" y2="88" stroke="var(--text3)" stroke-width="6" stroke-linecap="round"/>
      <line x1="70" y1="72" x2="82" y2="88" stroke="var(--text3)" stroke-width="6" stroke-linecap="round"/>
      <line x1="26" y1="84" x2="74" y2="84" stroke="var(--text3)" stroke-width="4" stroke-linecap="round"/>
    </g>
    <!-- Même forme colorée, clippée -->
    <g clip-path="url(#${id})">
      <rect x="18" y="8" width="64" height="62" rx="12" fill="${col}"/>
      <rect x="24" y="16" width="52" height="26" rx="5" fill="var(--bg)" opacity=".7"/>
      <circle cx="35" cy="56" r="8" fill="${col}" stroke="var(--bg)" stroke-width="2"/>
      <circle cx="65" cy="56" r="8" fill="${col}" stroke="var(--bg)" stroke-width="2"/>
      <rect x="22" y="6" width="14" height="5" rx="2.5" fill="${col}"/>
      <rect x="64" y="6" width="14" height="5" rx="2.5" fill="${col}"/>
      <line x1="30" y1="72" x2="18" y2="88" stroke="${col}" stroke-width="6" stroke-linecap="round"/>
      <line x1="70" y1="72" x2="82" y2="88" stroke="${col}" stroke-width="6" stroke-linecap="round"/>
      <line x1="26" y1="84" x2="74" y2="84" stroke="${col}" stroke-width="4" stroke-linecap="round"/>
    </g>
  </svg>`;
}
function renderTerminus(){
  const el = document.getElementById('terminusContent');
  if(!el) return;
  if(!LINE){ el.innerHTML=`<div class="term-empty">${T('termNoLine')}</div>`; return; }

  const sc      = LINE.scenarios[currentSc];
  const termSc  = getTerminusForSc(currentSc);
  const freqRef = refFreqHP();
  const phaseLbls = [T('termPhaseDeparture'), T('termPhaseYard'), T('termPhaseArrival')];

  /* Noms d'images issus de la feuille SCENARIOS */
  const imgNameA = sc.terA || '';
  const imgNameR = sc.terR || '';

  /* Liste des terminus (ordre A puis R) */
  const termList = [];
  const seen = new Set();
  const addTerm = (nom, dir, ret, imgName) => {
    const key = nom+'|'+dir;
    if(seen.has(key)) return;
    seen.add(key);
    termList.push({nom, dir, ret, imgName});
  };
  if(termSc.troncons && termSc.troncons.length){
    termSc.troncons.forEach(tr => {
      addTerm(tr.termA, T('termDirA'), tr.retA, imgNameA);
      addTerm(tr.termR, T('termDirR'), tr.retR, imgNameR);
    });
  } else {
    addTerm(termSc.termA, T('termDirA'), termSc.retA, imgNameA);
    addTerm(termSc.termR, T('termDirR'), termSc.retR, imgNameR);
  }

  const imgTitleLbl   = T('termDiagram');

  /* Construit une ligne complète pour un terminus */
  const buildRow = ({nom, dir, ret, imgName}) => {
    const totalMin = ret.totalSec / 60;
    const occupPct = termOccupPct(ret.totalSec, freqRef) ?? 0;
    const col      = occColor(occupPct);

    /* Card info */
    const paramsHTML = ret.params.map(p =>
      `<div class="term-param-row">
        <span class="term-param-label">${p.label}</span>
        <span class="term-param-val">${fmtMin(p.sec/60)}</span>
      </div>`
    ).join('');

    const card = `<div class="term-card" style="--kpi-color:var(--purple)">
      <div class="term-card-name">${nom}</div>
      <div class="term-card-dir">${dir}</div>
      <div class="term-card-params">${paramsHTML}</div>
      <hr class="term-card-divider">
      <div class="term-total-row">
        <span class="term-total-label">Σ ${T('termTotal')}</span>
        <span><span class="term-total-val">${fmtMin(totalMin)}</span><span class="term-total-unit">mm:ss</span></span>
      </div>
      <div class="term-occup-bar-wrap" style="display:flex;align-items:center;gap:.6rem;margin-top:.35rem;">
        ${buildTrainIcon(occupPct, col, 44)}
        <div style="flex:1;min-width:0;">
          <div style="font-size:.46rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--text3);font-family:var(--fontb);margin-bottom:.1rem;">${T('termOccupCycle')} HP (${freqRef}min)</div>
          <div style="font-size:1.1rem;font-weight:800;color:${col};font-family:var(--fontb);line-height:1;">${occupPct}%</div>
        </div>
      </div>
    </div>`;

    /* 3 mini histogrammes — regroupement par valeur de la colonne Occ */
    const OCC_KEYS = [
      { match: ['arrivées','arrivees','arrivée','arrivee'], key:'termPhaseArrival'   },
      { match: ['retournement','manœuvre','manoeuvre'],      key:'termPhaseYard'      },
      { match: ['départ','depart'],                          key:'termPhaseDeparture' },
    ];
    const histos = OCC_KEYS.map((item) => {
      const match = item.match;
      const title = T(item.key);
      const filtered = ret.params.filter(p => match.includes((p.occ||p.label||'').toLowerCase().trim()));
      const sec = filtered.reduce((a,p)=>a+p.sec, 0);
      /* fallback si aucune Occ définie : on prend tous les params pour le 1er graphique */
      const secFinal = (filtered.length === 0 && match === OCC_KEYS[0].match)
        ? ret.totalSec : sec;
      const detail = filtered.length
        ? filtered.map(p=>`${p.label} ${fmtMin(p.sec/60)}`).join(' + ')
        : (sec===0 ? '—' : '');
      return `<div class="term-histo-col">
        <div class="term-histo-header">
          <div class="term-histo-title">${title}</div>
          <button class="fs-btn" onclick="fsOpenTermHisto(this.closest('.term-histo-col').querySelector('.term-histo-svg-wrap').innerHTML, '${title.replace(/'/g,"\\'")} — ${nom}')" title="${T('fullscreenLabel')}">⛶</button>
        </div>
        <div class="term-histo-svg-wrap">${buildMiniHistoSVG(sec)}</div>
        <div style="font-size:.42rem;color:var(--text3);font-family:var(--fontb);margin-top:.15rem;opacity:.7">${detail || fmtMin(sec/60)}</div>
      </div>`;
    }).join('');

    /* Image */
    const _imgSrc = (() => {
      if(!imgName) return null;
      const lc = imgName.toLowerCase();
      return GLOBAL_IMAGE_MAP[imgName] || Object.entries(GLOBAL_IMAGE_MAP).find(([k])=>k.toLowerCase()===lc)?.[1] || null;
    })();
    const img = `<div class="term-img-col">
      <div class="term-histo-header">
        <div class="term-img-title">${imgTitleLbl}</div>
        ${_imgSrc ? `<button class="fs-btn" onclick="fsOpenTermImg('${imgName.replace(/'/g,"\\'")}','${dir.replace(/'/g,"\\'")}')">⛶</button>` : ''}
      </div>
      ${buildTermImgSingle(imgName, dir)}
    </div>`;

    return `<div class="term-row">${card}${histos}${img}</div>
    ${buildTermGantt(ret, nom)}`;
  };

  el.innerHTML = `<div class="terminus-layout">
    ${termList.map((t,i) => (i>0?'<hr class="term-row-sep">':'')+buildRow(t)).join('')}
  </div>`;
}