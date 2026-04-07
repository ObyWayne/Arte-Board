/* ═══════════════════════════════════════════════
   COULEURS MARQUE — externalisées via feuille COLOR
═══════════════════════════════════════════════ */
let BRAND = {
  primaire1 : '#a06bff',   // violet  — HP, schéma, terminus
  primaire2 : '#3ecf6a',   // vert    — flotte, occup OK
  aller     : '#4a9eff',   // bleu    — vitesse aller, KPI aller
  retour    : '#f5a623',   // orange  — vitesse retour, KPI retour, dépôt
  cycle     : '#cf3e9e',   // rose    — KPI cycle
};

/* ── parser.js — Lecture xlsx, construction LINE, KPIs ── */
/* ═══════════════════════════════════════════════
   DONNÉES INITIALES (ligne Dijon T3)
═══════════════════════════════════════════════ */
// LINE declared in core.js

/* ═══════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════ */
function secToMMS(sec){
  const s=Math.round(sec);
  const m=Math.floor(s/60),ss=s%60;
  return `${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
}
function fmtMin(m){const mn=Math.floor(m),s=Math.round((m-mn)*60);return s>0?`${mn}m ${String(s).padStart(2,'0')}s`:`${mn}m`;}
function fmtS(s){const mn=Math.floor(s/60),ss=s%60;return ss>0?`${mn}m ${String(ss).padStart(2,'0')}s`:`${mn}m`;}
function secToStr(s){const mn=Math.floor(s/60),ss=s%60;return `${String(mn).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;}


/* ═══════════════════════════════════════════════
   IMPORT — ZIP uniquement (2 slots)
═══════════════════════════════════════════════ */
function openImport(){
  document.getElementById('importOverlay').classList.add('show');
}
function closeImport(){
  document.getElementById('importOverlay').classList.remove('show');
  _importReset('main');
  _importReset('ref');
}

/* ── Helpers progression ── */
function _importReset(slot){
  const isRef = slot === 'ref';
  const progWrap = document.getElementById(isRef ? 'importProg2' : 'importProg1');
  const barFill  = document.getElementById(isRef ? 'importBar2Fill' : 'importBar1Fill');
  const status   = document.getElementById(isRef ? 'importStatusRef' : 'importStatus');
  if(progWrap) progWrap.style.display = 'none';
  if(barFill)  barFill.style.width = '0%';
  if(status)   status.textContent = '';
}

function _importStart(slot, filename){
  const isRef = slot === 'ref';
  // Masquer zone de dépôt, afficher chip chargé + barre
  const progWrap  = document.getElementById(isRef ? 'importProg2' : 'importProg1');
  const loadedDiv = document.getElementById(isRef ? 'importSlot2Loaded' : 'importSlot1Loaded');
  const nameEl    = document.getElementById(isRef ? 'importSlot2Name' : 'importSlot1Name');
  const barFill   = document.getElementById(isRef ? 'importBar2Fill' : 'importBar1Fill');
  if(nameEl)    nameEl.textContent = filename;
  if(loadedDiv) loadedDiv.style.display = 'none';
  if(progWrap)  progWrap.style.display = 'flex';
  if(barFill)   barFill.style.width = '0%';
}

function _importSetProgress(slot, pct, msg, color){
  const isRef = slot === 'ref';
  const barFill = document.getElementById(isRef ? 'importBar2Fill' : 'importBar1Fill');
  const status  = document.getElementById(isRef ? 'importStatusRef' : 'importStatus');
  if(barFill) barFill.style.width = Math.min(100, pct) + '%';
  if(status){
    status.textContent = msg || '';
    status.style.color = color || 'var(--text2)';
  }
}

function _importFinish(slot, filename, success, msg){
  const isRef   = slot === 'ref';
  const progWrap  = document.getElementById(isRef ? 'importProg2' : 'importProg1');
  const loadedDiv = document.getElementById(isRef ? 'importSlot2Loaded' : 'importSlot1Loaded');
  const nameEl    = document.getElementById(isRef ? 'importSlot2Name' : 'importSlot1Name');
  if(success){
    _importSetProgress(slot, 100, msg, 'var(--green)');
    setTimeout(() => {
      if(progWrap)  progWrap.style.display = 'none';
      if(nameEl)    nameEl.textContent = filename;
      if(loadedDiv) loadedDiv.style.display = 'flex';
    }, 900);
  } else {
    _importSetProgress(slot, 100, msg, 'var(--red)');
  }
}

/* Attend que le DOM de la vue parcours soit prêt (Live Server timing).
   Ne rejette JAMAIS — résout toujours, même si le délai est dépassé.
   Le guard requestAnimationFrame de render() prend le relais si besoin. */
function _waitForView(timeoutMs){
  timeoutMs = timeoutMs || 5000;
  return new Promise(resolve => {
    // Déjà prêt ?
    if(typeof _fragmentsReady !== 'undefined' && _fragmentsReady) return resolve();
    if(document.getElementById('schemaSvg')) return resolve();
    const t0 = Date.now();
    const poll = () => {
      if(typeof _fragmentsReady !== 'undefined' && _fragmentsReady) return resolve();
      if(document.getElementById('schemaSvg')) return resolve();
      if(Date.now() - t0 > timeoutMs){
        // Délai dépassé : on résout quand même, render() retentera via rAF
        console.warn('[Arte-Board] _waitForView : délai dépassé, render() va réessayer.');
        return resolve();
      }
      setTimeout(poll, 50);
    };
    setTimeout(poll, 50);
  });
}

/* Dispatcher — slot = 'main' | 'ref' */
function handleFile(file, slot){
  slot = slot || 'main';
  if(!file) return;
  const name = file.name.toLowerCase();
  if(!name.endsWith('.zip')){
    const statusId = slot === 'ref' ? 'importStatusRef' : 'importStatus';
    const progWrap = document.getElementById(slot === 'ref' ? 'importProg2' : 'importProg1');
    if(progWrap) progWrap.style.display = 'flex';
    _importSetProgress(slot, 0, '⚠ Format non supporté — importez un fichier .zip', 'var(--orange)');
    return;
  }
  handleZip(file, slot);
}

/* ── Stack cycle bar hover ── */
function stackSegEnter(el, evt){
  el.style.filter = 'brightness(1.2) saturate(1.3)';
  const tt  = document.getElementById('pieTooltip');
  const col = el.dataset.col;
  tt.style.background = col;
  document.getElementById('ptIcon').textContent  = el.dataset.icon;
  document.getElementById('ptLabel').textContent = el.dataset.label;
  document.getElementById('ptVal').textContent   = el.dataset.val;
  document.getElementById('ptPct').textContent   = el.dataset.pct + ' %';
  tt.style.display = 'block';
  _movePieTooltip(evt);
  el.addEventListener('mousemove', _movePieTooltip);
}
function stackSegLeave(el){
  el.style.filter = '';
  document.getElementById('pieTooltip').style.display = 'none';
  el.removeEventListener('mousemove', _movePieTooltip);
}

function clockSliceEnter(el, evt){
  el.style.opacity = '1';
  el.style.filter = 'brightness(1.25)';
  const tt  = document.getElementById('pieTooltip');
  const col = el.dataset.col;
  tt.style.background = col;
  document.getElementById('ptIcon').textContent  = '🕐';
  document.getElementById('ptLabel').textContent = el.dataset.label;
  document.getElementById('ptVal').textContent   = el.dataset.hours;
  document.getElementById('ptPct').textContent   = el.dataset.freq;
  tt.style.display = 'block';
  _movePieTooltip(evt);
  el.addEventListener('mousemove', _movePieTooltip);
}
function clockSliceLeave(el){
  el.style.opacity = el.dataset.op || '.80';
  el.style.filter  = '';
  document.getElementById('pieTooltip').style.display = 'none';
  el.removeEventListener('mousemove', _movePieTooltip);
}

/* ── Pie chart interactivity ── */
function pieSliceEnter(el, evt){
  // Grossit la portion
  el.style.transform = 'scale(1.08)';
  el.style.opacity   = '1';
  // Rempli le tooltip
  const tt   = document.getElementById('pieTooltip');
  const col  = el.dataset.col;
  tt.style.background = col;
  document.getElementById('ptIcon').textContent = el.dataset.icon;
  document.getElementById('ptLabel').textContent = el.dataset.label;
  document.getElementById('ptVal').textContent   = el.dataset.val;
  document.getElementById('ptPct').textContent   = el.dataset.pct + ' %';
  tt.style.display = 'block';
  _movePieTooltip(evt);
  el.addEventListener('mousemove', _movePieTooltip);
}
function pieSliceLeave(el){
  el.style.transform = '';
  el.style.opacity   = '.9';
  document.getElementById('pieTooltip').style.display = 'none';
  el.removeEventListener('mousemove', _movePieTooltip);
}
function _movePieTooltip(evt){
  const tt = document.getElementById('pieTooltip');
  const W = tt.offsetWidth || 160, H = tt.offsetHeight || 70;
  let x = evt.clientX + 14, y = evt.clientY - H/2;
  if(x + W > window.innerWidth  - 8) x = evt.clientX - W - 14;
  if(y < 8) y = 8;
  if(y + H > window.innerHeight - 8) y = window.innerHeight - H - 8;
  tt.style.left = x + 'px';
  tt.style.top  = y + 'px';
}

/* ── Fullscreen overlay ── */
function openFullscreen(title, renderFn){
  const ov   = document.getElementById('fsOverlay');
  const body = document.getElementById('fsBody');
  document.getElementById('fsTitle').textContent = title;
  body.innerHTML = '';
  renderFn(body);
  ov.style.display = 'flex';
  requestAnimationFrame(() => ov.classList.add('open'));
  document.addEventListener('keydown', _fsKeyHandler);
}
function closeFullscreen(){
  const ov = document.getElementById('fsOverlay');
  ov.classList.remove('open');
  setTimeout(() => { ov.style.display='none'; document.getElementById('fsBody').innerHTML=''; }, 200);
  document.removeEventListener('keydown', _fsKeyHandler);
}
function _fsKeyHandler(e){ if(e.key==='Escape') closeFullscreen(); }

function fsOpenMarcheType(){
  // Cas 1 : graphique CSV → plein écran via render.marche.js
  const canvas = document.getElementById('mtCanvas');
  if(canvas && canvas.style.display !== 'none' && typeof fsOpenMarcheTypeCanvas === 'function'){
    fsOpenMarcheTypeCanvas(canvas); return;
  }
  // Cas 2 : image PNG (comportement original)
  const img = document.getElementById('mtImg');
  if(!img || !img.src || img.style.display==='none') return;
  openFullscreen(document.getElementById('mtLabel').textContent, body => {
    Object.assign(body.style, {overflow:'auto', alignItems:'flex-start', justifyContent:'center', padding:'1rem'});
    const i = document.createElement('img');
    i.src = img.src; i.alt = 'Marche type';
    i.style.cssText = 'max-width:100%;height:auto;display:block;margin:auto;';
    body.appendChild(i);
  });
}

function fsOpenSchema(){
  const svg = document.getElementById('schemaSvg');
  const tableBody = document.getElementById('tableBody');
  if(!svg || !svg.innerHTML) return;
  openFullscreen(isEN ? 'Line diagram' : 'Schéma de ligne', body => {
    Object.assign(body.style, {overflow:'auto', padding:'0', alignItems:'flex-start', justifyContent:'flex-start'});

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;align-items:flex-start;width:100%;min-height:100%;';

    // Colonne schéma — hauteur naturelle, pas de scroll
    const schemaCol = document.createElement('div');
    schemaCol.style.cssText = 'flex-shrink:0;width:clamp(160px,14vw,240px);border-right:1px solid var(--border);display:flex;flex-direction:column;';

    // ── Boutons Aller / Retour (3.4 / 3.5) ──────────────────────────
    // Cloner les boutons pour que le SVG s'aligne correctement (HEAD_H tient
    // compte de DIR_OFFSET en mode normal — on doit reproduire la même hauteur).
    const dirBtnsOrig = document.querySelector('.schema-dir-btns');
    if(dirBtnsOrig){
      const dirClone = dirBtnsOrig.cloneNode(true);
      // Supprimer le bouton plein-écran du clone (inutile et déjà en plein écran)
      const fsBtn = dirClone.querySelector('.schema-fs-btn-top');
      if(fsBtn) fsBtn.remove();
      // Supprimer les IDs dupliqués et rewirer les onclick
      const btnA = dirClone.querySelector('#dirBtnA');
      const btnR = dirClone.querySelector('#dirBtnR');
      if(btnA){
        btnA.removeAttribute('id');
        btnA.classList.toggle('active', currentDir === 'aller');
        btnA.onclick = () => {
          setDirection('aller');
          // Mettre à jour l'état actif dans les deux boutons du clone
          dirClone.querySelectorAll('.dir-btn').forEach(b => b.classList.remove('active'));
          btnA.classList.add('active');
        };
      }
      if(btnR){
        btnR.removeAttribute('id');
        btnR.classList.toggle('active', currentDir === 'retour');
        btnR.onclick = () => {
          setDirection('retour');
          dirClone.querySelectorAll('.dir-btn').forEach(b => b.classList.remove('active'));
          btnR.classList.add('active');
        };
      }
      // Supprimer les IDs dupliqués des labels
      dirClone.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
      schemaCol.appendChild(dirClone);
    }

    // ── SVG cloné ───────────────────────────────────────────────────
    const svgClone = svg.cloneNode(true);
    svgClone.style.cssText = 'display:block;width:100%;';
    schemaCol.appendChild(svgClone);

    // Colonne tableau
    const tableCol = document.createElement('div');
    tableCol.style.cssText = 'flex:1;overflow-x:auto;';
    if(tableBody){
      const tbl = tableBody.closest('table');
      if(tbl){
        const tblClone = tbl.cloneNode(true);
        tblClone.style.cssText = 'width:100%;';
        tableCol.appendChild(tblClone);
      }
    }

    wrap.appendChild(schemaCol);
    wrap.appendChild(tableCol);
    body.appendChild(wrap);
  });
}

function fsOpenRadar(){
  if(!LINE) return;
  openFullscreen(document.getElementById('compRadarTitle').textContent, body => {
    Object.assign(body.style, {alignItems:'center', justifyContent:'center'});
    const fsW = Math.min(window.innerWidth - 40, 900);
    const fsH = Math.min(window.innerHeight - 80, 860);
    const wrap = document.createElement('div');
    wrap.style.cssText = `width:${fsW}px;height:${fsH}px;`;
    const canvasFs = document.createElement('canvas');
    canvasFs.style.cssText = 'display:block;width:100%;';
    wrap.appendChild(canvasFs);
    body.appendChild(wrap);
    requestAnimationFrame(() => {
      const orig = document.getElementById('radarCanvas');
      if (orig) orig.id = '_radarCanvas_bak';
      canvasFs.id = 'radarCanvas';
      renderRadar(_lastRadarAll, _lastRadarFiltered);
      canvasFs.id = '_radarCanvasFs';
      const bak = document.getElementById('_radarCanvas_bak');
      if (bak) bak.id = 'radarCanvas';
    });
  });
}

function fsOpenBubble() {
  if (!LINE) return;
  openFullscreen(document.getElementById('compBubbleTitle').textContent, body => {
    Object.assign(body.style, {
      overflow: 'hidden',
      padding: '0',
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'stretch',
    });

    const availH = window.innerHeight - 62;

    const axisL = document.createElement('canvas');
    axisL.id = 'chargeAxisCanvas_fs';
    axisL.style.cssText = 'flex-shrink:0;display:block;';

    const scrollWrap = document.createElement('div');
    scrollWrap.style.cssText = `flex:1;min-width:0;overflow-x:auto;overflow-y:hidden;height:${availH}px;`;

    const c2 = document.createElement('canvas');
    c2.id = 'bubbleCanvasFs';
    c2.style.cssText = `display:block;height:${availH}px;`;

    scrollWrap.appendChild(c2);
    body.appendChild(axisL);
    body.appendChild(scrollWrap);

    requestAnimationFrame(() => requestAnimationFrame(() => {
      const oldL = document.getElementById('chargeAxisCanvas');
      if (oldL) oldL.id = '_chargeAxisCanvas_bak';
      axisL.id = 'chargeAxisCanvas';

      renderBubbleChartOnCanvas(c2, null, availH,
        window._lastBubbleAll || [], window._lastBubbleSc ?? 0);

      axisL.id = 'chargeAxisCanvas_fs';
      if (oldL) oldL.id = 'chargeAxisCanvas';
    }));
  });
}

function fsOpenTermImg(imgName, labelDir){
  const lc  = imgName.toLowerCase();
  const src = GLOBAL_IMAGE_MAP[imgName]
    || Object.entries(GLOBAL_IMAGE_MAP).find(([k])=>k.toLowerCase()===lc)?.[1] || null;
  if(!src) return;
  openFullscreen(labelDir, body => {
    Object.assign(body.style, {overflow:'auto', alignItems:'center', justifyContent:'center'});
    const img = document.createElement('img');
    img.src = src; img.alt = labelDir;
    img.style.cssText = 'max-width:100%;max-height:calc(100vh - 80px);object-fit:contain;display:block;';
    body.appendChild(img);
  });
}

/* ── Gantt d'occupation des voies du terminus ── */
function buildTermGantt(ret, nom){
  if(!ret || !ret.params || !ret.params.length) return '';

  const sc       = LINE && LINE.scenarios[currentSc];
  const freqMin  = sc ? (sc.freqHP || sc.freqMin || 6) : 6;
  const freqSec  = freqMin * 60;
  const axisStepMin = (()=>{ const el=document.getElementById('settGanttStep'); return el?(parseInt(el.value)||5):5; })();
  const col      = BRAND.primaire2 || '#3ecf6a';

  const sorted = [...ret.params].sort((a,b)=>{
    if(a.ordre!=null&&b.ordre!=null) return a.ordre-b.ordre; return 0;
  });

  const seqSec   = sorted.reduce((a,p)=>a+p.sec, 0);
  const durationSec = 3600;
  const voiesSet = [...new Set(sorted.map(p=>(p.voie||'').trim()||p.label))];

  // Build slots for one sequence starting at offsetSec
  const buildSeq = (offsetSec, trainIdx) => {
    const slots = [];
    let cursor = offsetSec;
    sorted.forEach(p => {
      const voie = (p.voie||'').trim()||p.label;
      slots.push({voie, start:cursor, end:cursor+p.sec, label:p.label, sec:p.sec, trainIdx});
      cursor += p.sec;
    });
    return slots;
  };

  // All trains over 1h
  const trains = [];
  for(let t=0, idx=0; t<durationSec; t+=freqSec, idx++)
    trains.push(buildSeq(t, idx));

  // ── Per-voie conflict detection ──
  // For each voie, find the time range occupied by each train
  // Conflict if train[i] ends on voie V after train[i+1] starts on voie V
  const voieConflictZones = {}; // voie → [{start,end}]
  const voieHasConflict   = {}; // voie → bool
  voiesSet.forEach(voie => {
    voieConflictZones[voie] = [];
    voieHasConflict[voie]   = false;
    for(let i=0; i<trains.length-1; i++){
      const curSlots  = trains[i].filter(s=>s.voie===voie);
      const nextSlots = trains[i+1].filter(s=>s.voie===voie);
      if(!curSlots.length || !nextSlots.length) continue;
      const curEnd   = Math.max(...curSlots.map(s=>s.end));
      const nextStart= Math.min(...nextSlots.map(s=>s.start));
      if(curEnd > nextStart && nextStart < durationSec){
        voieConflictZones[voie].push({start:nextStart, end:Math.min(curEnd, durationSec)});
        voieHasConflict[voie] = true;
      }
    }
  });

  const anyConflict = Object.values(voieHasConflict).some(Boolean);

  // Dimensions
  const availPx  = Math.max(600, (window.innerWidth||1400)-320);
  const CELL     = availPx / durationSec;
  const toX      = sec => sec * CELL;
  const LABEL_W  = 80;
  const PCT_W    = 46;
  const ROW_MAIN = 20;
  const ROW_SUB  = 15;
  const HEADER_H = 26;

  // Occupation per voie
  const voieOccup = {};
  voiesSet.forEach(v=>{ voieOccup[v]=0; });
  trains.forEach(slots => slots.forEach(s=>{
    const dur = Math.min(s.end,durationSec)-Math.max(s.start,0);
    if(dur>0) voieOccup[s.voie]=(voieOccup[s.voie]||0)+dur;
  }));

  // Ticks
  const tickStepSec = axisStepMin*60;
  const ticks=[];
  for(let s=0; s<=durationSec; s+=tickStepSec) ticks.push(s);

  // Header ticks + global conflict markers on axis (union of all voie conflicts)
  const allConflictZones = [];
  voiesSet.forEach(v => voieConflictZones[v].forEach(z => allConflictZones.push(z)));

  const headerTicks = ticks.map(s=>{
    const min=Math.floor(s/60), sec2=s%60;
    const lbl=sec2?`${min}:${String(sec2).padStart(2,'0')}`:`${min}min`;
    return `<div style="position:absolute;left:${toX(s).toFixed(1)}px;top:0;display:flex;flex-direction:column;align-items:center;">
      <div style="width:1px;height:10px;background:var(--border);"></div>
      <div style="font-size:7px;font-weight:700;color:var(--text2);font-family:var(--fontb);transform:translateX(-50%);white-space:nowrap;margin-top:1px;">${lbl}</div>
    </div>`;
  }).join('');

  const conflictMarkers = allConflictZones.map(z=>
    `<div style="position:absolute;left:${toX(z.start).toFixed(1)}px;top:0;width:${toX(z.end-z.start).toFixed(1)}px;height:100%;pointer-events:none;">
      <div style="position:absolute;left:0;top:2px;font-size:9px;">⚠️</div>
    </div>`
  ).join('');

  // Rows per voie
  const rows = voiesSet.map(voie => {
    const pct     = Math.round((voieOccup[voie]||0)/durationSec*100);
    const pctCol  = occColorHex(Math.min(pct,100));
    const hasC    = voieHasConflict[voie];
    const cZones  = voieConflictZones[voie];
    const rowH    = hasC ? ROW_MAIN + ROW_SUB + 2 : ROW_MAIN;

    const vticks = ticks.map(s=>
      `<div style="position:absolute;left:${toX(s).toFixed(1)}px;top:0;width:1px;height:100%;background:var(--border);opacity:.2;"></div>`
    ).join('');

    const cZoneBg = cZones.map(z=>
      `<div style="position:absolute;left:${toX(z.start).toFixed(1)}px;top:0;width:${toX(z.end-z.start).toFixed(1)}px;height:100%;background:#ef444418;"></div>`
    ).join('');

    // Get slots for this voie grouped by train, assign sub-line by alternating trainIdx
    const voieSlots = trains.flatMap(t=>t).filter(s=>s.voie===voie&&s.start<durationSec);

    const segHtml = voieSlots.map(s=>{
      // Sub-line: alternate by trainIdx (0,2,4=top; 1,3,5=bottom)
      const subLine = hasC ? (s.trainIdx % 2) : 0;
      const yTop    = subLine===0 ? 1 : ROW_MAIN + 2;
      const segH    = subLine===0 ? ROW_MAIN-2 : ROW_SUB-2;

      // Is this slot in a conflict zone for this voie?
      const inConflict = cZones.some(z=>s.start<z.end&&s.end>z.start);
      const segCol = inConflict ? '#ef4444' : col;
      const x = toX(s.start).toFixed(1);
      const w = Math.max(1, toX(Math.min(s.end,durationSec)-s.start)-0.5).toFixed(1);

      return `<div style="position:absolute;left:${x}px;top:${yTop}px;width:${w}px;height:${segH}px;
        background:${segCol};opacity:${inConflict?'.9':'.82'};border-radius:2px;cursor:pointer;"
        data-label="${s.label}"
        data-total="${secToStr(s.sec)}"
        data-start="${Math.floor(s.start/60)}min${String(s.start%60).padStart(2,'0')}s"
        data-end="${Math.floor(Math.min(s.end,durationSec)/60)}min${String(Math.min(s.end,durationSec)%60).padStart(2,'0')}s"
        data-col="${segCol}"
        onmouseenter="ganttSegEnter(this,event)" onmouseleave="ganttSegLeave(this)"></div>`;
    }).join('');

    return `<div style="display:flex;align-items:stretch;border-bottom:1px solid var(--border);">
      <div style="width:${LABEL_W}px;flex-shrink:0;font-size:.52rem;font-family:var(--fontb);font-weight:800;
        color:var(--text);padding:0 .4rem;display:flex;align-items:center;border-right:1px solid var(--border);">${voie}</div>
      <div style="position:relative;width:${toX(durationSec).toFixed(1)}px;flex-shrink:0;height:${rowH}px;background:var(--bg4);">
        ${vticks}${cZoneBg}${segHtml}
      </div>
      <div style="width:${PCT_W}px;flex-shrink:0;font-size:.6rem;font-weight:800;color:${pctCol};
        font-family:var(--fontb);display:flex;align-items:center;justify-content:center;border-left:1px solid var(--border);">${pct}%</div>
    </div>`;
  }).join('');

  const totalW  = LABEL_W + toX(durationSec) + PCT_W;
  const ganttId = 'gantt_'+nom.replace(/[^a-z0-9]/gi,'_');

  const conflictBanner = anyConflict
    ? `<div style="display:flex;align-items:center;gap:.4rem;background:#ef444418;border:1px solid #ef444444;
        border-radius:4px;padding:.2rem .5rem;margin-bottom:.35rem;font-size:.52rem;font-family:var(--fontb);color:#ef4444;">
        ⚠️ ${isEN?'Conflict':'Conflit'} : séquence ${Math.round(seqSec/60*10)/10}min › fréquence ${freqMin}min
       </div>`
    : '';

  const header = `<div style="display:flex;border-bottom:2px solid var(--border);">
    <div style="width:${LABEL_W}px;flex-shrink:0;border-right:1px solid var(--border);"></div>
    <div style="position:relative;width:${toX(durationSec).toFixed(1)}px;flex-shrink:0;height:${HEADER_H}px;">
      ${headerTicks}${conflictMarkers}
    </div>
    <div style="width:${PCT_W}px;flex-shrink:0;font-size:6px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
      color:var(--text3);font-family:var(--fontb);display:flex;align-items:flex-end;justify-content:center;
      padding-bottom:3px;border-left:1px solid var(--border);">Occ.</div>
  </div>`;

  return `<div class="term-gantt-wrap" id="${ganttId}">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.3rem;">
      <div class="term-gantt-title" style="margin:0;">${isEN?'Track occupancy':'Occupation des voies'} — ${nom}</div>
      <div style="display:flex;align-items:center;gap:.4rem;">
        <div style="font-size:.43rem;color:var(--text3);font-family:var(--fontb);">f=${freqMin}min · séq=${Math.round(seqSec/60*10)/10}min</div>
        <button class="fs-btn" onclick="fsOpenGantt('${ganttId.replace(/'/g,"\\'")}','${nom.replace(/'/g,"\\'")}')">⛶</button>
      </div>
    </div>
    ${conflictBanner}
    <div style="overflow-x:auto;">
      <div style="min-width:${totalW.toFixed(0)}px;border:1px solid var(--border);border-radius:4px;overflow:hidden;">
        ${header}${rows}
      </div>
    </div>
  </div>`;
}

function ganttSegEnter(el, evt){
  el.style.opacity = '1';
  el.style.filter  = 'brightness(1.25)';
  const tt = document.getElementById('pieTooltip');
  tt.style.background = el.dataset.col;
  document.getElementById('ptIcon').textContent  = '🚉';
  document.getElementById('ptLabel').textContent = el.dataset.label;
  document.getElementById('ptVal').textContent   = el.dataset.total;
  document.getElementById('ptPct').textContent   = el.dataset.start + ' → ' + el.dataset.end;
  tt.style.display = 'block';
  _movePieTooltip(evt);
  el.addEventListener('mousemove', _movePieTooltip);
}
function ganttSegLeave(el){
  el.style.opacity = '.82';
  el.style.filter  = '';
  document.getElementById('pieTooltip').style.display = 'none';
  el.removeEventListener('mousemove', _movePieTooltip);
}

/* ── Fullscreen Gantt ── */
function fsOpenGantt(ganttId, nom){
  const el = document.getElementById(ganttId);
  if(!el) return;
  openFullscreen((isEN?'Track occupancy':'Occupation des voies') + ' — ' + nom, body => {
    Object.assign(body.style, {overflow:'auto', alignItems:'flex-start', padding:'1rem'});
    const clone = el.cloneNode(true);
    clone.style.cssText = 'width:100%;';
    // Remove fs-btn from clone to avoid nested buttons
    clone.querySelectorAll('.fs-btn').forEach(b=>b.remove());
    body.appendChild(clone);
  });
}

function fsOpenTermHisto(svgHtml, title){
  openFullscreen(title, body => {
    Object.assign(body.style, {alignItems:'center', justifyContent:'center'});
    const fsW = Math.min(window.innerWidth - 60, 1400);
    const wrap = document.createElement('div');
    wrap.style.cssText = `width:${fsW}px;`;
    wrap.innerHTML = svgHtml;
    const svg = wrap.querySelector('svg');
    if(svg){
      // Conserve le viewBox original pour une résolution parfaite
      const vb = svg.getAttribute('viewBox') || '0 0 220 140';
      svg.setAttribute('viewBox', vb);
      svg.style.cssText = 'width:100%;height:auto;display:block;';
    }
    body.appendChild(wrap);
  });
}

/* ── OpenStreetMap (Leaflet) ── */
let _map = null;
let _lastRadarAll = [], _lastRadarFiltered = [];
let _mapTileType = 'standard';
let _mapTileObj  = null;

const _MAP_TILES = {
  standard:  { url:'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attr:'© OpenStreetMap' },
  satellite: { url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr:'© Esri' },
  transport: { url:'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', attr:'© CartoDB' },
};

function setMapTile(type){
  _mapTileType = type;
  document.querySelectorAll('.map-tile-btn').forEach(b=>b.classList.toggle('active',b.dataset.tile===type));
  if(!_map) return;
  if(_mapTileObj){ _map.removeLayer(_mapTileObj); }
  const t = _MAP_TILES[type]||_MAP_TILES.standard;
  _mapTileObj = L.tileLayer(t.url,{maxZoom:19,attribution:t.attr}).addTo(_map);
}

let _mapLayers = {route: null, markers: null, geojson: null};
let _mapGeoJSON = null;

function initMap(){
  if(_map) return;
  const el = document.getElementById('osmMap');
  if(!el) return;
  el.innerHTML = '';
  _map = L.map('osmMap', {zoomControl:true, attributionControl:true});
  const _t = _MAP_TILES[_mapTileType]||_MAP_TILES.standard;
  _mapTileObj = L.tileLayer(_t.url,{maxZoom:19,attribution:_t.attr}).addTo(_map);
  _map.setView([46.5, 2.3], 6);
}
function renderMap(){
  initMap();
  const col  = BRAND.primaire1 || '#a06bff';
  const col2 = BRAND.aller     || '#4a9eff';

  // Nettoie les couches précédentes
  ['route','markers','geojson'].forEach(k => {
    if(_mapLayers[k]){ _map.removeLayer(_mapLayers[k]); _mapLayers[k]=null; }
  });

  // ── 1. GeoJSON tracé précis (depuis ZIP) ──────────────────────────
  if(_mapGeoJSON){
    _mapLayers.geojson = L.geoJSON(_mapGeoJSON, {
      style: f => f.geometry.type === 'LineString'
        ? { color: col, weight: 5, opacity: .9 }
        : {},
      pointToLayer: (f, latlng) => {
        const isT = f.properties.type === 'terminus';
        return L.circleMarker(latlng, {
          radius: isT ? 9 : 6,
          fillColor: isT ? col : '#fff',
          color: col, weight: 2.5, opacity: 1,
          fillOpacity: isT ? 1 : .95
        });
      },
      onEachFeature: (f, layer) => {
        if(f.properties.name) layer.bindTooltip(f.properties.name, {
          permanent: false, direction: 'top', className: 'map-tooltip'
        });
      }
    }).addTo(_map);
    _map.fitBounds(_mapLayers.geojson.getBounds(), {padding:[28,28]});
  }

  // ── 2. Stations depuis LAT/LON dans la feuille STATIONS ───────────
  if(!LINE || !LINE.stations || !LINE.stations.length) return;

  const pts = LINE.stations.map(s => {
    const lat = parseFloat(s.lat||s.latitude||s.LAT||'');
    const lon = parseFloat(s.lon||s.lng||s.longitude||s.LON||'');
    return (!isNaN(lat)&&!isNaN(lon)) ? {lat,lon,nom:s.nom} : null;
  }).filter(Boolean);

  if(!pts.length){
    if(!_mapGeoJSON){
      document.getElementById('osmMap').innerHTML =
        `<div class="map-no-data"><div class="map-no-data-icon">📍</div>
         <div>${isEN?'Add LAT/LON columns in STATIONS sheet or a trace.geojson in ZIP':'Ajoutez LAT/LON dans la feuille STATIONS ou un fichier trace.geojson dans le ZIP'}</div></div>`;
    }
    return;
  }

  const latlngs = pts.map(p => [p.lat, p.lon]);

  // Tracé uniquement si pas déjà un GeoJSON
  if(!_mapGeoJSON){
    _mapLayers.route = L.polyline(latlngs, {color:col, weight:4, opacity:.85}).addTo(_map);
  }

  // Marqueurs stations
  const group = L.layerGroup();
  pts.forEach((p, i) => {
    const isT = (i===0 || i===pts.length-1);
    L.circleMarker([p.lat,p.lon], {
      radius: isT ? 8 : 5,
      fillColor: isT ? col : '#fff',
      color: col, weight:2, opacity:1, fillOpacity: isT ? 1 : .9
    }).bindTooltip(p.nom, {permanent:false, direction:'top', className:'map-tooltip'})
      .addTo(group);
  });
  _mapLayers.markers = group.addTo(_map);

  if(!_mapGeoJSON && _mapLayers.route)
    _map.fitBounds(_mapLayers.route.getBounds(), {padding:[24,24]});
}

function fsOpenSP(){
  const card = document.querySelector('.comp-sp-card');
  if(!card) return;
  openFullscreen(document.getElementById('compSPTitle').textContent, body => {
    Object.assign(body.style, {alignItems:'flex-start', padding:'1.5rem', overflow:'auto'});
    const container = document.getElementById('spMatrixContainer') || card;
    const clone = container.cloneNode(true);
    clone.style.cssText = 'width:auto;overflow:visible;';
    // Remove any max-height restrictions
    clone.querySelectorAll('*').forEach(el=>{
      if(el.style.maxHeight) el.style.maxHeight='none';
      if(el.style.overflow==='auto'||el.style.overflow==='scroll') el.style.overflow='visible';
    });
    body.appendChild(clone);
  });
}

function fsOpenCompTable(){
  const tbl = document.getElementById('compTable');
  if(!tbl) return;
  openFullscreen(document.getElementById('compTableTitle').textContent, body => {
    Object.assign(body.style, {overflow:'auto', alignItems:'flex-start', padding:'1.5rem', flexDirection:'column'});
    // Col picker in fullscreen
    const pickerWrap = document.createElement('div');
    pickerWrap.style.cssText = 'display:flex;align-items:center;gap:.5rem;margin-bottom:.75rem;align-self:flex-end;';
    pickerWrap.innerHTML = `<span style="font-size:.6rem;color:var(--text3);font-family:var(--fontb);">Colonnes visibles :</span>`
      + ALL_COMP_COLS.map((col,i)=>
        `<label style="display:flex;align-items:center;gap:.25rem;font-size:.6rem;color:var(--text2);cursor:pointer;font-family:var(--fontb);">
          <input type="checkbox" ${col.visible?'checked':''} style="accent-color:var(--blue);"
            onchange="ALL_COMP_COLS[${i}].visible=this.checked; renderCompTable(window._lastCompAll||[]); const t=document.getElementById('compTable'); if(t) document.getElementById('fsTblWrap').innerHTML=''; document.getElementById('fsTblWrap').appendChild(t.cloneNode(true));">
          ${col.label}
        </label>`
      ).join('');
    body.appendChild(pickerWrap);
    const wrap = document.createElement('div');
    wrap.id = 'fsTblWrap';
    wrap.style.cssText = 'overflow-x:auto;width:100%;';
    const clone = tbl.cloneNode(true);
    clone.style.cssText = 'width:100%;font-size:.72rem;border-collapse:collapse;';
    wrap.appendChild(clone);
    body.appendChild(wrap);
  });
}

function fsOpenMap(){
  openFullscreen(document.getElementById('compMapTitle').textContent, body => {
    Object.assign(body.style, {padding:'0', overflow:'hidden'});
    const wrap = document.createElement('div');
    wrap.style.cssText = 'width:100%;height:100%;min-height:400px;';
    wrap.id = 'osmMapFs';
    body.appendChild(wrap);
    // Attend que le DOM soit rendu avant d'init Leaflet
    setTimeout(()=>{
      const fsMap = L.map('osmMapFs', {zoomControl:true, attributionControl:true});
      const _ft = _MAP_TILES[_mapTileType] || _MAP_TILES.standard;
      L.tileLayer(_ft.url, {maxZoom:19, attribution:_ft.attr}).addTo(fsMap);
      const col = BRAND.primaire1 || '#a06bff';
      if(LINE && LINE.stations){
        const pts = LINE.stations
          .map(s=>({lat:parseFloat(s.lat||s.latitude||s.LAT||''),lon:parseFloat(s.lon||s.lng||s.longitude||s.LON||''),nom:s.nom}))
          .filter(p=>!isNaN(p.lat)&&!isNaN(p.lon));
        if(pts.length){
          const poly = L.polyline(pts.map(p=>[p.lat,p.lon]),{color:col,weight:5,opacity:.85}).addTo(fsMap);
          pts.forEach((p,i)=>{
            const isT=i===0||i===pts.length-1;
            L.circleMarker([p.lat,p.lon],{radius:isT?10:6,fillColor:isT?col:'#fff',color:col,weight:2,fillOpacity:isT?1:.9})
             .bindTooltip(p.nom,{permanent:false,direction:'top'}).addTo(fsMap);
          });
          fsMap.fitBounds(poly.getBounds(),{padding:[32,32]});
        } else if(_mapGeoJSON){
          const layer = L.geoJSON(_mapGeoJSON,{style:{color:col,weight:5}}).addTo(fsMap);
          fsMap.fitBounds(layer.getBounds(),{padding:[32,32]});
        } else {
          fsMap.setView([46.5,2.3],6);
        }
      } else {
        fsMap.setView([46.5,2.3],6);
      }
      fsMap.invalidateSize();
    }, 150);
  });
}

/* ── Settings panel ── */
function toggleSettingsPanel(){
  _settingsOpen = !_settingsOpen;
  document.getElementById('settingsPanel').classList.toggle('open', _settingsOpen);
  document.getElementById('settingsOverlay').classList.toggle('show', _settingsOpen);
  document.getElementById('settingsTabArrow').textContent = _settingsOpen ? '&gt;' : '&lt;';
  document.getElementById('settingsTabArrow').innerHTML  = _settingsOpen ? '&gt;' : '&lt;';
  document.getElementById('hamburgerBtn').classList.toggle('active', _settingsOpen);
}

function applyKpiSticky(){
  const banner = document.querySelector('.kpi-banner');
  const view   = document.getElementById('view-parcours');
  if(!banner) return;
  if(_kpiSticky){
    banner.style.cssText = 'position:sticky;top:0;z-index:200;background:transparent;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);padding-top:.4rem;padding-bottom:.4rem;margin-bottom:.5rem;';
  } else {
    banner.style.cssText = '';
  }
}

function applySettings(){
  // Unité de vitesse
  const su = document.getElementById('settSpeedUnit');
  if(su) _speedUnit = su.value;
  // Décimales
  const dt = document.getElementById('settDecimals');
  if(dt) _decTime = parseInt(dt.value)||1;
  const dd = document.getElementById('settDecimalsKm');
  if(dd) _decDist = parseInt(dd.value)||2;
  const ds = document.getElementById('settDecimalsSpd');
  if(ds) _decSpd  = parseInt(ds.value)||1;
  // Libellé unité vitesse dans le settings
  const lbl = document.getElementById('settLblDecimalsSpd');
  if(lbl) lbl.textContent = `Décimales vitesse (${_speedUnit})`;
  // Seuils occupation
  const s1 = parseFloat(document.getElementById('settOccupS1').value)||20;
  const s2 = parseFloat(document.getElementById('settOccupS2').value)||30;
  window.SETT_OCCUP_S1 = s1;
  window.SETT_OCCUP_S2 = s2;
  // KPIs sticky
  const sk = document.getElementById('settKpiSticky');
  if(sk) _kpiSticky = sk.checked;
  applyKpiSticky();
  // Re-render
  if(LINE && typeof render === 'function') render();
  if(LINE && typeof renderTerminus === 'function') renderTerminus();
}

/* Lit une valeur de setting (avec valeur par défaut) */
function getSett(id, def){ const el=document.getElementById(id); return el ? (parseFloat(el.value)||def) : def; }

/* ── Login popup ── */
function openLogin(){document.getElementById('loginOverlay').classList.add('show');}
function closeLogin(){document.getElementById('loginOverlay').classList.remove('show');document.getElementById('loginStatus').textContent='';}
function submitLogin(){
  const u = document.getElementById('loginUser').value.trim();
  const p = document.getElementById('loginPwd').value;
  const st = document.getElementById('loginStatus');
  if(!u||!p){ st.textContent = 'Veuillez remplir les deux champs.'; st.style.color='var(--orange)'; return; }
  // Placeholder — pas d'auth réelle pour l'instant
  st.textContent = '✓ Connexion simulée (non implémentée)';
  st.style.color = 'var(--green)';
  setTimeout(closeLogin, 1500);
}

/* ── Drag & drop sur les 2 zones ── */
(function(){
  function bindDrop(dropId, slot){
    const el = document.getElementById(dropId);
    if(!el) return;
    el.addEventListener('dragover',  e => { e.preventDefault(); el.classList.add('dragover'); });
    el.addEventListener('dragleave', ()  => el.classList.remove('dragover'));
    el.addEventListener('drop', e => {
      e.preventDefault();
      el.classList.remove('dragover');
      const f = e.dataTransfer.files[0];
      if(f) handleFile(f, slot);
    });
  }
  bindDrop('importDrop',    'main');
  bindDrop('importDropRef', 'ref');
})();

// Import ZIP multi-fichiers :
//   master.xlsx       → META, POINTS_CLES
//   *.xlsx (autres)   → 1 scénario chacun (nom fichier = label scénario)
//   images/           → photos carousel
//   marche_type/      → Graphique CSV

/* ── Parse un CSV marche type ── */
function parseMTCsv(text){
  if(!text || text.length < 10) return null;
  const lines = text.split('\n');
  if(lines.length < 3) return null;
  const header = lines[0].split(',').map(h => h.trim());
  const iPK = header.indexOf('PK');
  const iT  = header.indexOf('T');
  const iV2 = header.indexOf('V2');
  if(iPK < 0 || iT < 0 || iV2 < 0){ console.warn('[MT CSV] colonnes PK/T/V2 introuvables'); return null; }
  // Sous-échantillonnage : 0.05s × 20 = 1s de résolution (~1 800 pts pour 30 min)
  const STEP = 20;
  const pk = [], t = [], v2 = [];
  for(let i = 1; i < lines.length; i += STEP){
    if(!lines[i]) continue;
    const row = lines[i].split(',');
    const pkV = parseFloat(row[iPK]);
    const tV  = parseFloat(row[iT]);
    const v2V = parseFloat(row[iV2]);
    if(!isNaN(pkV) && !isNaN(tV) && !isNaN(v2V)){
      pk.push(pkV / 1000);   // m → km
      t.push(tV);             // secondes
      v2.push(v2V);           // km/h (déjà)
    }
  }
  return t.length > 5 ? { pk, t, v2 } : null;
}
async function handleZip(file, slot){
  slot = slot || 'main';
  const isRef = slot === 'ref';
  _importStart(slot, file.name);
  try{
    _importSetProgress(slot, 5, 'Extraction du ZIP…');
    const zip = await JSZip.loadAsync(file);

    // Détecter préfixe racine (dossier créé par macOS/Windows)
    const allPaths = [];
    zip.forEach((path, entry)=>{ if(!entry.dir) allPaths.push(path); });
    const rootPrefix = (()=>{
      const firstSlash = allPaths[0] ? allPaths[0].indexOf('/') : -1;
      if(firstSlash > 0){
        const candidate = allPaths[0].substring(0, firstSlash+1);
        if(allPaths.every(p => p.startsWith(candidate))) return candidate;
      }
      return '';
    })();

    const rel = path => path.startsWith(rootPrefix) ? path.slice(rootPrefix.length) : path;

    // ── Images carousel (images/) ──
    const imageMap = {};
    const imgExts = /\.(png|jpg|jpeg|gif|webp|svg)$/i;
    const imgPromises = [];
    zip.forEach((path, entry)=>{
      const r = rel(path);
      if(!entry.dir && /^images\//i.test(r) && imgExts.test(r)){
        const fname = r.replace(/^images\//i,'');
        imgPromises.push(entry.async('base64').then(b64=>{
          const ext = fname.split('.').pop().toLowerCase();
          const mime = ext==='svg' ? 'image/svg+xml'
                     : ext==='png' ? 'image/png'
                     : ext==='gif' ? 'image/gif'
                     : ext==='webp'? 'image/webp'
                     : 'image/jpeg';
          imageMap[fname] = `data:${mime};base64,${b64}`;
        }));
      }
    });

    // ── Images marche type (marche_type/) ──
    const mtImageMap = {};
    zip.forEach((path, entry)=>{
      const r = rel(path);
      if(!entry.dir && /^marche_type\//i.test(r) && imgExts.test(r)){
        const fname = r.replace(/^marche_type\//i,'');
        imgPromises.push(entry.async('base64').then(b64=>{
          const ext = fname.split('.').pop().toLowerCase();
          const mime = ext==='svg' ? 'image/svg+xml' : ext==='png' ? 'image/png' : 'image/jpeg';
          mtImageMap[fname] = `data:${mime};base64,${b64}`;
        }));
      }
    });
// ── CSV marche type (MT/) ──
    const csvMap = {};
    zip.forEach((path, entry)=>{
      const r = rel(path);
      if(!entry.dir && /^MT\//i.test(r) && /\.csv$/i.test(r)){
        const fname = r.replace(/^MT\//i,'');
        imgPromises.push(entry.async('string').then(txt=>{ csvMap[fname]=txt; }));
      }
    });
    await Promise.all(imgPromises);
    GLOBAL_IMAGE_MAP = Object.assign({}, imageMap, mtImageMap);
    _importSetProgress(slot, 30, `${Object.keys(imageMap).length} image(s) chargée(s)`);

    // ── GeoJSON tracé (trace.geojson à la racine du ZIP) ──
    _mapGeoJSON = null;
    const gjEntry = zip.file(rootPrefix + 'trace.geojson') || zip.file(rootPrefix + 'trace.json');
    if(gjEntry){
      try {
        const gjText = await gjEntry.async('string');
        _mapGeoJSON = JSON.parse(gjText);
      } catch(e){ console.warn('GeoJSON invalide:', e); }
    }

    // ── Collecter les fichiers xlsx ──
    const xlsxEntries = {}; // nom_sans_ext → entry
    zip.forEach((path, entry)=>{
      const r = rel(path);
      // Seulement à la racine (pas dans sous-dossiers)
      if(!entry.dir && /^[^/]+\.xlsx$/i.test(r)){
        const label = r.replace(/\.xlsx$/i,'');
        xlsxEntries[label] = entry;
      }
    });

    if(Object.keys(xlsxEntries).length === 0) throw new Error(T('noXlsx'));

    _importSetProgress(slot, 45, 'Lecture du master…');
    // ── Lire master.xlsx (META + carousel) ──
    let masterMeta = {departH:6,departM:5,serviceHeures:18};
    let masterCarousel = [];
    let masterInfra = [];
    let LINE_PROGRAMME_MOE = {};
    const masterEntry = xlsxEntries['master'];
    if(masterEntry){
      const masterBuf = await masterEntry.async('arraybuffer');
      const masterWb  = XLSX.read(masterBuf, {type:'array'});
      masterMeta = parseMeta(masterWb);
      parseCarouselSheet(masterWb, imageMap);
      masterCarousel = [...CAROUSEL_SLIDES];
      masterInfra = parseInfraSchema(masterWb); // feuille INFRA dans master
      LINE_PROGRAMME_MOE = parseProgrammeMOE(masterWb);
      parseColors(masterWb);
      applyBrandColors();
    }

    // ── Lire chaque fichier scénario (tous sauf master) ──
    const scLabels = Object.keys(xlsxEntries)
      .filter(l => l !== 'master')
      .sort();

    if(scLabels.length === 0) throw new Error(T('noScenarioFile'));

    const scenarios = [];
    const scenariosData = []; // données complètes par scénario

    for(const [idx, label] of scLabels.entries()){
      _importSetProgress(slot, 55 + Math.round(idx/scLabels.length*25), `Scénario ${idx+1}/${scLabels.length} — ${label}`);
      const buf = await xlsxEntries[label].async('arraybuffer');
      const wb  = XLSX.read(buf, {type:'array'});
      const sc  = parseSingleScenario(wb, label);
      const tm  = parseTempsMarche(wb, sc);

      const stations_  = parseStations(wb);
      const inter_     = parseInter(wb);
      const infra_     = masterInfra.length > 0 ? masterInfra : parseInfraSchema(wb);
      // Peuple inter[i].c / tpsA / tpsR depuis les CARREFOUR de l'infra
      enrichInterFromInfra(inter_, stations_, infra_);

      scenariosData.push({
        stations:     stations_,
        inter:        inter_,
        retournement: parseRetournement(wb),
        tendu:        {[sc.id]: tm.tendu},
        tenduR:       {[sc.id]: tm.tenduR},
        detenteA:     tm.detenteA,
        detenteR:     tm.detenteR,
        infra:        infra_,
        csvA:         parseMTCsv(csvMap[sc.mtA] || ''),
        csvR:         parseMTCsv(csvMap[sc.mtR] || ''),
      });
      scenarios.push(sc);

      // Plages horaires + MT images du 1er scénario comme référence
      if(scenariosData.length === 1){
        applyPlagesFromWb(wb);
        parseColors(wb);
        applyBrandColors();
        applyMTImagesFromWb(wb, {...imageMap, ...mtImageMap});
      }
    }

    const d0 = scenariosData[0];
    const newLine = {
      meta:         masterMeta,
      scenarios,
      scenariosData,
      stations:     d0.stations,
      inter:        d0.inter,
      retournement: d0.retournement,
      tendu:        d0.tendu,
      tenduR:       d0.tenduR,
      detenteA:     d0.detenteA,
      detenteR:     d0.detenteR,
      infra:        d0.infra || [],
    };

    if(isRef){
      // ── Slot référence : stocke dans LINE_REF, n'affecte pas les pages ──
      LINE_REF = newLine;
      _importFinish(slot, file.name, true,
        `✓ ${scLabels.length} scénario(s) — ${LINE_REF.meta.nomLigne || file.name}`);
    } else {
      // ── Slot principal : comportement habituel ──
      LINE = newLine;
      if(masterEntry) CAROUSEL_SLIDES = masterCarousel;
      currentSc = 0;
      radarActiveScenarios  = null;
      chargeActiveScenarios = null;

      _importSetProgress(slot, 85, 'Chargement de l\'interface…');
      rebuildUI();

      // Attendre que les fragments soient dans le DOM (Live Server)
      await _waitForView(4000);

      _importSetProgress(slot, 95, 'Rendu…');
      render();
      if(typeof currentTab !== 'undefined'){
        if(currentTab==='terminus'   && typeof renderTerminus  ==='function') renderTerminus();
        if(currentTab==='comparatif' && typeof renderComparatif==='function') renderComparatif();
        if(currentTab==='synthese'   && typeof renderScorecard ==='function') renderScorecard();
      }
      _importFinish(slot, file.name, true,
        `✓ ${scLabels.length} scénario(s) — ${LINE.meta.nomLigne || T('lineImported')}`);
    }

  } catch(err){
    _importFinish(slot, file.name, false, '⚠ ' + err.message);
    console.error(err);
  }
}


// ── Parseurs atomiques ──




/* Lit la feuille COLOR : colonnes A=clé, B=libellé, C=hex */
function parseColors(wb){
  const ws = wb.Sheets['COLOR'];
  if(!ws) return;
  const KEY_MAP = {
    'primaire1':'primaire1','couleur primaire 1':'primaire1','primary1':'primaire1',
    'primaire2':'primaire2','couleur primaire 2':'primaire2','primary2':'primaire2',
    'aller':'aller','outbound':'aller',
    'retour':'retour','inbound':'retour',
    'cycle':'cycle','kpi cycle':'cycle',
  };
  XLSX.utils.sheet_to_json(ws,{header:1,defval:null}).forEach(r => {
    if(!r[0]) return;
    const k   = String(r[0]).trim().toLowerCase();
    const hex = r[2] ? String(r[2]).trim() : (r[1] ? String(r[1]).trim() : '');
    const mapped = KEY_MAP[k];
    if(mapped && /^#[0-9a-fA-F]{3,8}$/.test(hex)) BRAND[mapped] = hex;
  });
}

/* Injecte les couleurs BRAND comme CSS variables sur :root */
function applyBrandColors(){
  const r = document.documentElement;
  r.style.setProperty('--purple',  BRAND.primaire1);
  r.style.setProperty('--blue',    BRAND.aller);
  r.style.setProperty('--orange',  BRAND.retour);
  r.style.setProperty('--tchoo',   BRAND.retour);
  r.style.setProperty('--green',   BRAND.primaire2);
  r.style.setProperty('--pink',    BRAND.cycle);
  // Dérivées automatiques (légèrement assombries)
  r.style.setProperty('--purple2', shadeColor(BRAND.primaire1, -20));
  r.style.setProperty('--purple3', shadeColor(BRAND.primaire1,  30));
  r.style.setProperty('--green2',  shadeColor(BRAND.primaire2, -15));
  r.style.setProperty('--blue2',   shadeColor(BRAND.aller,     -20));
  // Composantes RGB pour les rgba() dynamiques dans CSS
  const toRgb = hex => { const h=hex.replace('#',''); return `${parseInt(h.substr(0,2),16)},${parseInt(h.substr(2,2),16)},${parseInt(h.substr(4,2),16)}`; };
  r.style.setProperty('--green-rgb',  toRgb(BRAND.primaire2));
  r.style.setProperty('--purple-rgb', toRgb(BRAND.primaire1));
  r.style.setProperty('--aller-rgb',  toRgb(BRAND.aller));
  r.style.setProperty('--retour-rgb', toRgb(BRAND.retour));
  // Palette HC : dégradé depuis primaire1 (plus clair à chaque plage)
  window._HC_PALETTE = [
    shadeColor(BRAND.primaire1,  35),
    shadeColor(BRAND.primaire1,  50),
    shadeColor(BRAND.primaire1,  62),
    shadeColor(BRAND.primaire1,  73),
    shadeColor(BRAND.primaire1,  82),
    shadeColor(BRAND.primaire1,  90),
  ];
  // Synchronise la variable globale HC_PALETTE utilisée par getHcColors() / plageColor()
  if(typeof rebuildHcPalette === 'function') rebuildHcPalette();
  // Redessine les éléments qui dépendent des couleurs BRAND
  if(typeof drawClock === 'function')          drawClock();
  if(typeof updateClockLegend === 'function')  updateClockLegend();
  if(LINE && typeof render === 'function') render();
}

/* Utilitaire : éclaircit/assombrit une couleur hex (pct: -100..+100) */
function shadeColor(hex, pct){
  const h = hex.replace('#','');
  const r = parseInt(h.substr(0,2),16), g=parseInt(h.substr(2,2),16), b=parseInt(h.substr(4,2),16);
  const clamp = v => Math.min(255,Math.max(0,Math.round(v+v*pct/100)));
  return '#'+[clamp(r),clamp(g),clamp(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
}

function parseProgrammeMOE(wb) {
  const ws = wb.Sheets['P_MOE'];
  if (!ws) return {};
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  const result = {};
  rows.forEach(r => {
    if (!r[0] || r[1] == null) return;
    const key = String(r[0]).trim();
    result[key] = r[1];
  });
  return result;
}

function parseMeta(wb){
  // Parse PARAMETRE sheet (categories B2:BXX)
  const wsParam = wb.Sheets['PARAMETRE'];
  if(wsParam){
    const prows = XLSX.utils.sheet_to_json(wsParam,{header:1,defval:null});
    const cats = [];
    for(let i=1; i<prows.length; i++){
      const v = prows[i][1]; // col B
      if(v!=null && String(v).trim()) cats.push(String(v).trim());
    }
    if(cats.length) TERM_CATEGORIES = cats;
  }
  const wsMeta = wb.Sheets['META'];
  const meta = {departH:6,departM:5,serviceHeures:18};
  if(!wsMeta) return meta;
  XLSX.utils.sheet_to_json(wsMeta,{header:1,defval:null}).forEach(r=>{
    if(!r[0]) return;
    if(r[0]==='NOM_LIGNE')   meta.nomLigne=String(r[1]);
    if(r[0]==='BADGE')       meta.badge=String(r[1]);
    if(r[0]==='ETUDE')       meta.etude=String(r[1]);
    if(r[0]==='DIST_TOTALE') meta.distTotale=parseFloat(r[1]);
    if(r[0]==='DEPART_H')    meta.departH=parseInt(r[1]);
    if(r[0]==='DEPART_M')    meta.departM=parseInt(r[1]);
    if(r[0]==='SERVICE_H')   meta.serviceHeures=parseFloat(r[1]);
    if(r[0]==='MT_ALLER')    meta.mtAller=String(r[1]||'').trim();
    if(r[0]==='MT_RETOUR')   meta.mtRetour=String(r[1]||'').trim();
    // Synthèse — matériel roulant
    if(r[0]==='MR_TYPE')              meta.mrType=String(r[1]||'').trim().toLowerCase();
    // Synthèse — scorecard fiche opérationnelle
    if(r[0]==='SCORECARD_GLOBAL')     meta.scorecardGlobal=parseFloat(r[1])||null;
    if(r[0]==='SCORECARD_FREQUENCE')  meta.scorecardFrequence=parseFloat(r[1])||null;
    if(r[0]==='SCORECARD_REGULARITE') meta.scorecardRegularite=parseFloat(r[1])||null;
  });
  return meta;
}

function parseStations(wb){
  const ws = wb.Sheets['STATIONS'];
  const stations = [];
  if(!ws) return stations;
  const rows = XLSX.utils.sheet_to_json(ws,{header:1,defval:null});
  for(let i=2;i<rows.length;i++){
    const r=rows[i];
    if(!r[0]||typeof r[0]!=='string') continue;
    stations.push({
  nom:    r[0].trim(),
  arretA: parseInt(r[1])||0,
  arretR: parseInt(r[2])||0,
  type:   String(r[3]||'normal').trim().toLowerCase(),
  occup:  parseFloat(r[4])||null,
  monteesA:   parseFloat(r[5])||null,
  descentesA: parseFloat(r[6])||null,
  monteesR:   parseFloat(r[7])||null,
  descentesR: parseFloat(r[8])||null,
});
  }
  return stations;
}

function parseInter(wb){
  const ws = wb.Sheets['INTERSTATIONS'];
  const inter = [];
  if(!ws) return inter;
  const rows = XLSX.utils.sheet_to_json(ws,{header:1,defval:null});
  for(let i=2;i<rows.length;i++){
    const r=rows[i];
    if(!r[0]||typeof r[0]!=='string') continue;
    const dist=parseFloat(r[2]);
    if(isNaN(dist)) continue;
    // c, tpsA, tpsR seront peuplés depuis INFRA par enrichInterFromInfra()
    inter.push({dist, c:[], tpsA:0, tpsR:0});
  }
  return inter;
}

function parseRetournement(wb){
  const ws = wb.Sheets['RETOURNEMENT'];
  const retournement = {};
  const _def = {totalSec:420, params:[{label:'Manœuvre',sec:240},{label:'Attente',sec:180}]};
  retournement._default = _def;
  if(!ws) return retournement;
  XLSX.utils.sheet_to_json(ws,{header:1,defval:null}).forEach(r=>{
    if(!r[0]) return;
    const col0=String(r[0]).trim(), col1=r[1]!=null?String(r[1]).trim():'', col2=parseInt(r[2]);
    if(col1 && !isNaN(col2)){
      const key=col0.toLowerCase();
      if(!retournement[key]) retournement[key]={totalSec:0,params:[]};
      const col3 = r[3]!=null?String(r[3]).trim():'';
      const col4 = r[4]!=null?String(r[4]).trim():'';
      const col5 = r[5]!=null?parseInt(r[5]):null;
      const col6 = r[6]!=null?String(r[6]).trim():'';
      const col7 = r[7];
      const isCompressible = col7===true || col7===1 ||
      (typeof col7==='string' && ['true','vrai','1'].includes(col7.toLowerCase().trim()));
      retournement[key].params.push({label:col1, sec:col2, occ:col3, voie:col4, ordre:col5, categorie:col6, compressible:isCompressible});
      retournement[key].totalSec+=col2;
    } else if(!isNaN(parseInt(r[1]))){
      const val=parseInt(r[1])||0;
      if(col0==='MANOEUVRE_SEC') _def.params[0].sec=val;
      if(col0==='ATTENTE_SEC')   _def.params[1].sec=val;
      _def.totalSec=_def.params.reduce((a,p)=>a+p.sec,0);
    }
  });
  return retournement;
}

// Parse feuille INFRA (schéma de ligne) — optionnelle dans le fichier scénario
function parseInfraSchema(wb){
  const ws = wb.Sheets['INFRA'];
  if(!ws) return [];
  const rows = XLSX.utils.sheet_to_json(ws, {defval:''});
  const bool = v => String(v).trim().toUpperCase() === 'OUI';
  const num  = v => (v===''||v==null) ? undefined : parseFloat(v);
  const str  = v => String(v||'').trim();
  return rows.map(r=>{
    const o = {type: str(r['TYPE'])};
    if(str(r['ST_DEB']))  o.stDeb = str(r['ST_DEB']);
    if(str(r['ST_FIN']))  o.stFin = str(r['ST_FIN']);
    if(str(r['ST_ID']))   o.stId  = str(r['ST_ID']);
    if(!o.stId && ['TERMINUS_AVG','TERMINUS_ARG','RETOUR_BUTEE'].includes(o.type))
      o.stId = o.stDeb || o.stFin;
    const pos=num(r['POS']); if(pos!==undefined) o.pos=pos;
    const pd=num(r['POS_DEBUT']); if(pd!==undefined) o.posDebut=pd;
    const pf=num(r['POS_FIN']);   if(pf!==undefined) o.posFin=pf;
    if(str(r['COTE']))   o.cote   = str(r['COTE']).toUpperCase();
    if(str(r['SENS']))   o.sens   = str(r['SENS']).toLowerCase();
    if(str(r['LABEL']))  o.label  = str(r['LABEL']);
    if(str(r['TUBE']))   o.tube   = str(r['TUBE']).toLowerCase();
    if(str(r['MOTEUR'])) o.moteur = bool(r['MOTEUR']);
    if(str(r['DESC']))   o.desc   = str(r['DESC']);
    // Champs spécifiques CARREFOUR : temps d'arrêt aller/retour en secondes
    if(o.type === 'CARREFOUR'){
      o.tpsA = num(r['TPS_A']) || 0;  // secondes
      o.tpsR = num(r['TPS_R']) || 0;
    }
    return o;
  }).filter(o=>o.type);
}

// Peuple inter[i].c (positions carrefours) et inter[i].tpsA/tpsR
// depuis les éléments CARREFOUR de l'infra.
// stations = LINE.stations (sens aller), inter = LINE.inter (sens aller)
function enrichInterFromInfra(inter, stations, infra){
  // Reset
  inter.forEach(seg=>{ seg.c=[]; seg.tpsA=0; seg.tpsR=0; });
  const carrefours = infra.filter(e=>e.type==='CARREFOUR');
  carrefours.forEach(el=>{
    const iDeb = stations.findIndex(s=>s.nom===el.stDeb);
    if(iDeb < 0 || iDeb >= inter.length) return;
    const pos = el.pos !== undefined ? el.pos : 0.5;
    inter[iDeb].c.push(pos);
    inter[iDeb].tpsA += (el.tpsA||0);
    inter[iDeb].tpsR += (el.tpsR||0);
  });
}

// Parse 1 scénario depuis un fichier xlsx scénario (1 ligne SCENARIOS + TEMPS_MARCHE)
function parseSingleScenario(wb, label){
  const ws = wb.Sheets['SCENARIOS'];
  let sc = {
  id:label, label, type:'NOMINAL', coeff:1.1,
  freqMin:10, freqHP:10, freqHC:15,
  debutBloc:'', finBloc:'', mtA:'', mtR:'', labelSP:'',
  smrCapacite: null  
};
  if(ws){
    const rows = XLSX.utils.sheet_to_json(ws,{header:1,defval:null});
    // Cherche la 1ère ligne de données (après 2 lignes d'en-tête)
    for(let i=2;i<rows.length;i++){
      const r=rows[i];
      if(!r[0]||typeof r[0]!=='string') continue;
      sc.id        = r[0];
      sc.type      = String(r[1]||'NOMINAL').trim().toUpperCase();
      sc.freqHP    = parseInt(r[2])||10;
      sc.freqHC    = parseInt(r[3])||15;
      sc.coeff     = parseFloat(r[4])||1.1;
      sc.debutBloc = r[5]?String(r[5]).trim():'';
      sc.finBloc   = r[6]?String(r[6]).trim():'';
      sc.mtA       = r[7]?String(r[7]).trim():'';
      sc.mtR       = r[8]?String(r[8]).trim():'';
      sc.terA      = r[9]?String(r[9]).trim():'';
      sc.terR      = r[10]?String(r[10]).trim():'';
      sc.labelSP   = r[11]?String(r[11]).trim():'';
      sc.smrCapacite = r[12] !== null && r[12] !== undefined ? r[12] : null;
      sc.label     = sc.labelSP || label;
      sc.freqMin   = sc.freqHP;
      
      break;
    }
  }
  return sc;
}

// Parse TEMPS_MARCHE pour un scénario donné
function parseTempsMarche(wb, sc){
  const parseDuree = v => {
    if(v===null||v===undefined||v==='') return NaN;
    const s=String(v).trim();
    const mmss=s.match(/^(\d+):(\d{2})$/);
    if(mmss) return parseInt(mmss[1])+parseInt(mmss[2])/60;
    const f=parseFloat(s); return isNaN(f)?NaN:f;
  };
  const ws = wb.Sheets['TEMPS_MARCHE'];
  const tendu=[], tenduR=[], detenteA=[], detenteR=[];
  if(ws){
    const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:null});
    for(let i=2;i<rows.length;i++){
      const r=rows[i];
      if(r[0]&&typeof r[0]==='string'){
        const vT=parseDuree(r[2]),vD=parseDuree(r[3]);
        if(!isNaN(vT)){ tendu.push(vT); detenteA.push(isNaN(vD)?0:vD); }
      }
      if(r[7]&&typeof r[7]==='string'){
        const vT=parseDuree(r[9]),vD=parseDuree(r[10]);
        if(!isNaN(vT)){ tenduR.push(vT); detenteR.push(isNaN(vD)?0:vD); }
      }
    }
  }
  return {tendu, tenduR, detenteA, detenteR};
}

// Rétrocompatibilité : 1 seul fichier xlsx (ancien format)
function parseXlsxMaster(wb){
  return {
    meta:         parseMeta(wb),
    stations:     parseStations(wb),
    inter:        parseInter(wb),
    retournement: parseRetournement(wb),
    scenarios:    [], tendu:{}, tenduR:{}, detenteA:[], detenteR:[],
  };
}


/* Résout le retournement d'un terminus par son nom → {totalSec, params:[{label,sec}]} */
function getRetournement(stationNom){
  const fallback = {totalSec:420, params:[{label:'Manœuvre',sec:240},{label:'Attente',sec:180}]};
  if(!LINE||!LINE.retournement) return fallback;
  const key = (stationNom||'').trim().toLowerCase();
  return LINE.retournement[key] || LINE.retournement._default || fallback;
}

/* Retourne le label court (≤6 car) d'un paramètre de retournement */
function retLabel(lbl){ return lbl.length>7 ? lbl.slice(0,6)+'.' : lbl; }

/* Formate la ligne de détail : "Mano. 4m + Att. 3m · Σ 7m" */
function retDetailStr(ret){
  const detail = ret.params.map(p=>`${retLabel(p.label)} ${fmtS(p.sec)}`).join(' + ');
  return `${detail} · Σ ${fmtMin(ret.totalSec/60)}`;
}

/* Résout les terminus actifs d'un scénario (première et dernière station non bloquée)
   Retourne :
   - nominal / SP fin : { termA, termR, retA, retR }
   - SP milieu        : { termA, termR, retA, retR,   ← terminus ligne entière (cycle global)
                          troncons: [{termA, termR, retA, retR}, ...] } ← par tronçon */
function getTerminusForSc(scIdx){
  const sc  = LINE.scenarios[scIdx];
  const sp  = computeSPTroncons(sc, LINE);
  const N   = LINE.stations.length;
  const mk  = (iA, iR) => {
    const tA = LINE.stations[iA].nom, tR = LINE.stations[iR].nom;
    return { termA:tA, termR:tR, retA:getRetournement(tA), retR:getRetournement(tR) };
  };

  if(!sp.isSP){
    return mk(N-1, 0);
  } else if(sp.isFinDeLigne){
    const iMin = sp.idxDebutBloc, iMax = sp.idxFinBloc;
    return iMin===0 ? mk(N-1, iMax+1) : mk(iMin-1, 0);
  } else {
    // SP milieu — 2 tronçons
    const iMin = sp.idxDebutBloc, iMax = sp.idxFinBloc;
    // Tronçon A : stations 0 … iMin-1
    const trA = mk(iMin-1, 0);
    // Tronçon B : stations iMax+1 … N-1
    const trB = mk(N-1, iMax+1);
    // Pour le cycle global on utilise les terminus de ligne entière
    return { ...mk(N-1, 0), troncons: [trA, trB] };
  }
}


/* ═══════════════════════════════════════════════
   SP — Calcul des tronçons
   Retourne {isSP, isFinDeLigne, troncons:[{stations,inter,tenduA,tenduR,detenteA,detenteR,idxStart,idxEnd}],
             idxDebutBloc, idxFinBloc}
═══════════════════════════════════════════════ */
function computeSPTroncons(sc, line){
  if(!sc || sc.type !== 'SP' || !sc.debutBloc || !sc.finBloc){
    return {isSP:false};
  }
  const stNames = line.stations.map(s=>s.nom.trim().toLowerCase());
  const idxDB = stNames.indexOf(sc.debutBloc.trim().toLowerCase());
  const idxFB = stNames.indexOf(sc.finBloc.trim().toLowerCase());
  if(idxDB < 0 || idxFB < 0) return {isSP:false}; // stations introuvables → fallback nominal

  const idxMin = Math.min(idxDB, idxFB);
  const idxMax = Math.max(idxDB, idxFB);
  const N = line.stations.length;

  // Fin de ligne : bloc commence à la 1ère station ou finit à la dernière
  const isFinDeLigne = (idxMin === 0 || idxMax === N-1);

  function sliceData(arr, from, to){
    // to exclusif pour inter (to-from interstations pour from..to stations)
    return arr ? arr.slice(from, to) : [];
  }

  const getTenduA = id => (line.tendu&&line.tendu[id])||[];
  const getTenduR = id => (line.tenduR&&line.tenduR[id])||[];
  const getDetA   = () => (line.detenteA&&line.detenteA.length)?line.detenteA:[];
  const getDetR   = () => (line.detenteR&&line.detenteR.length)?line.detenteR:[];

  const troncons = [];

  if(isFinDeLigne){
    // Un seul tronçon actif
    let from, to;
    if(idxMin === 0){
      // Bloc au début → tronçon actif = idxMax+1 … N-1
      from = idxMax + 1; to = N;
    } else {
      // Bloc à la fin → tronçon actif = 0 … idxMin-1
      from = 0; to = idxMin;
    }
    const stSlice   = line.stations.slice(from, to);
    const interSlice= line.inter.slice(from, to-1);
    const tA = sliceData(getTenduA(sc.id), from, to-1);
    const tR = sliceData(getTenduR(sc.id), from, to-1);
    const dA = sliceData(getDetA(), from, to-1);
    const dR = sliceData(getDetR(), from, to-1);
    troncons.push({stations:stSlice, inter:interSlice,
      tenduA:tA, tenduR:tR, detenteA:dA, detenteR:dR,
      idxStart:from, idxEnd:to-1, label:T('tronconUnique')});
  } else {
    // Deux tronçons
    // Tronçon A : 0 … idxMin-1
    const fromA=0, toA=idxMin;
    if(toA > 0){
      troncons.push({
        stations: line.stations.slice(fromA, toA),
        inter:    line.inter.slice(fromA, toA-1),
        tenduA:   sliceData(getTenduA(sc.id), fromA, toA-1),
        tenduR:   sliceData(getTenduR(sc.id), fromA, toA-1),
        detenteA: sliceData(getDetA(), fromA, toA-1),
        detenteR: sliceData(getDetR(), fromA, toA-1),
        idxStart:fromA, idxEnd:toA-1,
        label: `${line.stations[0].nom} ↔ ${line.stations[toA-1].nom}`
      });
    }
    // Tronçon B : idxMax+1 … N-1
    const fromB=idxMax+1, toB=N;
    if(fromB < N){
      troncons.push({
        stations: line.stations.slice(fromB, toB),
        inter:    line.inter.slice(fromB, toB-1),
        tenduA:   sliceData(getTenduA(sc.id), fromB, toB-1),
        tenduR:   sliceData(getTenduR(sc.id), fromB, toB-1),
        detenteA: sliceData(getDetA(), fromB, toB-1),
        detenteR: sliceData(getDetR(), fromB, toB-1),
        idxStart:fromB, idxEnd:toB-1,
        label: `${line.stations[fromB].nom} ↔ ${line.stations[N-1].nom}`
      });
    }
  }

  return {isSP:true, isFinDeLigne, troncons, idxDebutBloc:idxMin, idxFinBloc:idxMax};
}

/* Appliquer les plages depuis un xlsx chargé si l'onglet existe */
function applyPlagesFromWb(wb){
  if(!wb.Sheets['PLAGES_HORAIRES']) return;
  const rows=XLSX.utils.sheet_to_json(wb.Sheets['PLAGES_HORAIRES'],{header:1,defval:null});
  const newPlages=[];
  for(let i=1;i<rows.length;i++){
    const r=rows[i];
    if(!r[0]||typeof r[0]!=='string') continue;
    const type=r[0].trim().toUpperCase();
    const debut=hmToMin(r[1]);
    const fin=hmToMin(r[2]);
    if(debut===null||fin===null) continue;
    // Col 3 : fréquence HH:MM ou MM (nouveau format)
    // Si absente : null → sera résolu à l'affichage via freqHP/freqHC du scénario (rétrocompat)
    const freqRaw = r[3]!=null ? mmssToMin(r[3]) : null;
    const freq = (type==='HS') ? null : freqRaw;
    newPlages.push({type, debut, fin, freq});
  }
  if(newPlages.length>0){
    PLAGES=newPlages;
    console.log('PLAGES chargées:', PLAGES.map(p=>`${p.type} ${p.debut}→${p.fin} freq=${p.freq}`));
    drawClock();
    updateClockLegend();
  }
}
function hmToMin(v){
  // Interprète HH:MM → minutes depuis minuit
  // - nombre décimal Excel (ex: 0.291666 = 07:00) → * 1440
  // - string "07:00" → 420
  if(v===null||v===undefined) return null;
  if(typeof v === 'number'){
    if(v >= 0 && v < 1) return Math.round(v * 1440);
    return Math.round(v); // déjà en minutes
  }
  const s=String(v).trim();
  const parts=s.split(':');
  if(parts.length<2) return null;
  return parseInt(parts[0])*60+parseInt(parts[1]);
}
function mmssToMin(v){
  // Interprète la fréquence depuis Excel :
  // - nombre décimal Excel (ex: 0.004166 = 6min) → multiplier par 1440 (min/jour)
  // - string "06:00" → MM:SS → 6.0 min
  // - string "6" ou nombre entier → minutes directes
  if(v===null||v===undefined) return null;
  if(typeof v === 'number'){
    // Si < 1 : fraction de jour Excel (format heure)
    if(v > 0 && v < 1) return v * 1440;
    // Sinon : nombre de minutes directement
    return v;
  }
  const s = String(v).trim();
  if(!s || s==='-') return null;
  if(s.includes(':')){
    const parts = s.split(':');
    const mm = parseInt(parts[0]), ss = parseInt(parts[1]);
    if(isNaN(mm)||isNaN(ss)) return null;
    return mm + ss/60;
  }
  const f = parseFloat(s);
  return isNaN(f) ? null : f;
}



/* ═══════════════════════════════════════════════
   IMPORT IMAGES MARCHE TYPE
═══════════════════════════════════════════════ */

function updateMTImage(){
  const img=document.getElementById('mtImg');
  const ph=document.getElementById('mtPlaceholder');
  const lbl=document.getElementById('mtSensLabel');

  // ── Déléguer au graphique CSV si données disponibles ──
  if(LINE && typeof renderMarcheType === 'function'){
    const d = LINE.scenariosData ? LINE.scenariosData[currentSc] : null;
    if(d && (currentDir==='aller' ? d.csvA : d.csvR)){
      if(lbl) lbl.textContent = currentDir==='aller' ? `↓ ${T('dirOutbound')}` : `↑ ${T('dirInbound')}`;
      renderMarcheType();
      return;
    }
  }

  // Priorité : image du scénario courant > image META > rien
  const sc = LINE.scenarios[currentSc];
  let src = '';
  if(sc && sc.type==='SP'){
    const key = currentDir==='aller' ? sc.mtA : sc.mtR;
    if(key) src = MT_IMAGES['sc_'+key] || MT_IMAGES[key] || '';
  }
  if(!src) src = MT_IMAGES[currentDir] || '';

  if(src){
    img.src=src;
    img.style.display='block';
    ph.style.display='none';
  } else {
    img.style.display='none';
    ph.style.display='flex';
  }
  lbl.textContent=currentDir==='aller'?`↓ ${T('dirOutbound')}`:`↑ ${T('dirInbound')}`;
}


/* ═══════════════════════════════════════════════
   CALCUL KPIs
═══════════════════════════════════════════════ */
function computeKPIs(scIdx){
  const sc = LINE.scenarios[scIdx];
  const sp = computeSPTroncons(sc, LINE);

  // Cherche les temps marche par sc.id, sinon prend la 1ère clé disponible
  const tenduByKey = LINE.tendu && (LINE.tendu[sc.id] || LINE.tendu[Object.keys(LINE.tendu)[0]]) || [];
  const tenduRByKey= LINE.tenduR && (LINE.tenduR[sc.id] || LINE.tenduR[Object.keys(LINE.tenduR)[0]]) || [];
  const tenduArr  = tenduByKey;
  const tenduRArr = tenduRByKey.length ? tenduRByKey : [...tenduArr].reverse();
  const detA = LINE.detenteA&&LINE.detenteA.length ? LINE.detenteA : tenduArr.map(v=>v*(sc.coeff-1));
  const detR = LINE.detenteR&&LINE.detenteR.length ? LINE.detenteR : tenduRArr.map(v=>v*(sc.coeff-1));

  const freqHP = sc.freqHP || sc.freqMin;
  const freqHC = sc.freqHC || (sc.freqMin*2);
  const termSc = getTerminusForSc(scIdx);
  const tRetCycleMin = (termSc.retA.totalSec + termSc.retR.totalSec) / 60;
  const tRetMin = tRetCycleMin / 2;

  // ── Helper : calcule KPIs d'un tronçon (stations + tendu/det slices) ──
  // retAObj/retRObj : retournements propres au tronçon (passés explicitement en SP milieu)
  const kpiTroncon = (tr, retAObj, retRObj) => {
    const rA = retAObj || termSc.retA;
    const rR = retRObj || termSc.retR;
    const tRetTr = (rA.totalSec + rR.totalSec) / 60;
    const dA = tr.detenteA.length ? tr.detenteA : tr.tenduA.map(v=>v*(sc.coeff-1));
    const dR = tr.detenteR.length ? tr.detenteR : tr.tenduR.map(v=>v*(sc.coeff-1));
    const mA = tr.tenduA.reduce((a,b)=>a+b,0);
    const mR = tr.tenduR.reduce((a,b)=>a+b,0);
    const dSA = dA.reduce((a,b)=>a+b,0);
    const dSR = dR.reduce((a,b)=>a+b,0);
    const nSt = tr.stations.length;
    const aA = tr.stations.reduce((a,s)=>a+s.arretA,0)/60 - tr.stations[nSt-1].arretA/60;
    const aR = tr.stations.reduce((a,s)=>a+s.arretR,0)/60 - tr.stations[0].arretR/60;
    const tA = mA + dSA + aA;
    const tR = mR + dSR + aR;
    const dist = LINE.inter.slice(tr.idxStart, tr.idxEnd).reduce((a,b)=>a+b.dist,0)/1000;
    const tCyc = tA + tR + tRetTr;
    const flotteNec = Math.ceil(tCyc / sc.freqMin);
    return { tA, tR, dist, tCyc, flotteNec,
             vitA: +(dist/(tA/60)).toFixed(1),
             vitR: +(dist/(tR/60)).toFixed(1),
             label: tr.label };
  };

  let tAllerMin, tRetourMin, totalDistKm, flotteNec, flotteTot, vitA, vitR, tCycleMin;
  let tronconKPIs = null; // uniquement pour SP milieu

  if(sp.isSP && !sp.isFinDeLigne && sp.troncons.length >= 2){
    // SP MILIEU — KPIs par tronçon avec les bons terminus de chaque branche
    const trs = termSc.troncons || [];
    tronconKPIs = sp.troncons.map((tr, i) => {
      const trRet = trs[i] || {};
      return kpiTroncon(tr, trRet.retA, trRet.retR);
    });
    tAllerMin   = tronconKPIs.reduce((a,t)=>a+t.tA, 0);
    tRetourMin  = tronconKPIs.reduce((a,t)=>a+t.tR, 0);
    totalDistKm = tronconKPIs.reduce((a,t)=>a+t.dist, 0);
    flotteNec   = tronconKPIs.reduce((a,t)=>a+t.flotteNec, 0);
    flotteTot   = Math.ceil(flotteNec * 1.15);
    vitA        = +(totalDistKm/(tAllerMin/60)).toFixed(1);
    vitR        = +(totalDistKm/(tRetourMin/60)).toFixed(1);
    tCycleMin   = tAllerMin + tRetourMin + tRetCycleMin;
  } else if(sp.isSP){
    // SP FIN DE LIGNE — 1 tronçon
    const tr = sp.troncons[0];
    const k = kpiTroncon(tr, termSc.retA, termSc.retR);
    tAllerMin=k.tA; tRetourMin=k.tR; totalDistKm=k.dist;
    flotteNec=k.flotteNec; flotteTot=Math.ceil(flotteNec*1.15);
    vitA=k.vitA; vitR=k.vitR; tCycleMin=k.tCyc;
  } else {
    // NOMINAL
    totalDistKm = LINE.inter.reduce((a,b)=>a+b.dist,0)/1000;
    const mA = tenduArr.reduce((a,b)=>a+b,0);
    const mR = tenduRArr.reduce((a,b)=>a+b,0);
    const dSA = detA.reduce((a,b)=>a+b,0);
    const dSR = detR.reduce((a,b)=>a+b,0);
    const N = LINE.stations.length;
    tAllerMin  = mA + dSA + LINE.stations.reduce((a,s)=>a+s.arretA,0)/60 - LINE.stations[N-1].arretA/60;
    tRetourMin = mR + dSR + LINE.stations.reduce((a,s)=>a+s.arretR,0)/60 - LINE.stations[0].arretR/60;
    tCycleMin  = tAllerMin + tRetourMin + tRetCycleMin;
    flotteNec  = Math.ceil(tCycleMin / sc.freqMin);
    flotteTot  = Math.ceil(flotteNec * 1.15);
    vitA = +(totalDistKm/(tAllerMin/60)).toFixed(1);
    vitR = +(totalDistKm/(tRetourMin/60)).toFixed(1);
  }

  const tauxUtil = Math.round((flotteNec/flotteTot)*100);
  const serviceH = sc.serviceHeures || LINE.meta.serviceHeures || 18;
  let coursesJour = 0;
  PLAGES.forEach(p=>{
    if(p.type==='HS') return;
    const freq = p.freq || (p.type==='HP' ? freqHP : freqHC);
    if(!freq) return;
    coursesJour += Math.floor((p.fin-p.debut)/freq);
  });
  coursesJour *= 2;

  const tArretTotalA = LINE.stations.reduce((a,s)=>a+s.arretA,0)/60;
  const tArretTotalR = LINE.stations.reduce((a,s)=>a+s.arretR,0)/60;
  const tArretTotal  = +(tArretTotalA + tArretTotalR).toFixed(2);
  const kmCom        = +(coursesJour * totalDistKm).toFixed(0);

  // Mouvements dépôt : delta veh entre plages consécutives
  const depotMouvements = [];
  let sorties = 0, entrees = 0;
  const vehParPlage = PLAGES.map(p => {
    if(p.type==='HS' || !p.freq) return 0;
    const freq = p.freq || (p.type==='HP' ? freqHP : freqHC);
    return Math.ceil(tCycleMin / freq);
  });
  for(let i=1; i<PLAGES.length; i++){
    const delta = vehParPlage[i] - vehParPlage[i-1];
    if(delta===0) continue;
    depotMouvements.push({debut:PLAGES[i].debut, delta, veh:vehParPlage[i]});
    if(delta>0) sorties += delta;
    else entrees += Math.abs(delta);
  }
  // Rentrée finale forcée : si le dernier veh en service > 0 (pas de HS de fin)
  const dernierVeh = vehParPlage[vehParPlage.length - 1];
  if(dernierVeh > 0){
    const derniereFin = PLAGES[PLAGES.length - 1].fin;
    depotMouvements.push({debut: derniereFin, delta: -dernierVeh, veh: 0});
    entrees += dernierVeh;
  }

  return {tAllerMin,tRetourMin,tRetMin,tCycleMin,flotteNec,flotteTot,vitA,vitR,
          freqHP,freqHC,tauxUtil,coursesJour,totalDistKm,serviceH,tronconKPIs,
          tArretTotal,kmCom,sorties,entrees,depotMouvements,vehParPlage};
}

function renderOccupKPI(){
  if(!LINE) return;
  const set = (id,v)=>{ const el=document.getElementById(id); if(el) el.innerHTML=v; };
  const setTxt = (id,v)=>{ const el=document.getElementById(id); if(el) el.textContent=v; };
  const sts = LINE.stations;
  const stA = sts[0], stR = sts[sts.length-1];

  const fmtCell = (st, valId) => {
    // Temps de retournement
    const ret = st ? getRetournement(st.nom) : null;
    const retVal = ret ? `<span style="color:var(--pink)">${fmtMin(ret.totalSec/60)}</span>` : `<span style="color:var(--text3)">—</span>`;

    // Taux d'occupation en sub
    let occupSub = '';
    if(st && st.occup !== null && st.occup !== undefined){
      const pct = st.occup <= 1 ? Math.round(st.occup*100) : Math.round(st.occup);
      occupSub = `${pct}% occup.`;
    }
    return { retVal, occupSub };
  };

  const oA = fmtCell(stA, 'kpiOccupA');
  const oR = fmtCell(stR, 'kpiOccupR');
  setTxt('kpiOccupALabel', stA ? stA.nom : 'Term. A');
  setTxt('kpiOccupRLabel', stR ? stR.nom : 'Term. R');
  set('kpiOccupA', oA.retVal);
  set('kpiOccupR', oR.retVal);
  set('kpiOccupASub', oA.occupSub);
  set('kpiOccupRSub', oR.occupSub);
}

function renderKPIs(scIdx){
  if(!LINE) return;
  const k  = computeKPIs(scIdx);
  const sc = LINE.scenarios[scIdx];
  const sp = computeSPTroncons(sc, LINE);
  const isSPMilieu = sp.isSP && !sp.isFinDeLigne && sp.troncons.length >= 2;
  const set = (id,v)=>{ const el=document.getElementById(id); if(el) el.innerHTML=v; };

  if(isSPMilieu && k.tronconKPIs){
    const [tA, tB] = k.tronconKPIs;
    const COL_A = BRAND.primaire2,      COL_B = BRAND.primaire2;
    const COL_VA = BRAND.aller,          COL_VR = BRAND.retour;

    // A1/B1 Temps aller / retour
    set('kpiTpsA',
  `<div style="line-height:1.4">
    <span style="font-size:1.45rem;font-weight:800;color:${COL_VA}">${fmtMin(tA.tA)}</span>
    <span style="font-size:.56rem;font-weight:700;color:${COL_VA};margin-left:.3rem">${tA.label}</span>
  </div>
  <div style="line-height:1.4;margin-top:.2rem">
    <span style="font-size:1.45rem;font-weight:800;color:${COL_VA}">${fmtMin(tB.tA)}</span>
    <span style="font-size:.56rem;font-weight:700;color:${COL_VA};margin-left:.3rem">${tB.label}</span>
  </div>`);
set('kpiTpsASub', '');
set('kpiTpsR',
  `<div style="line-height:1.4">
    <span style="font-size:1.45rem;font-weight:800;color:${COL_VR}">${fmtMin(tA.tR)}</span>
    <span style="font-size:.56rem;font-weight:700;color:${COL_VR};margin-left:.3rem">${tA.label}</span>
  </div>
  <div style="line-height:1.4;margin-top:.2rem">
    <span style="font-size:1.45rem;font-weight:800;color:${COL_VR}">${fmtMin(tB.tR)}</span>
    <span style="font-size:.56rem;font-weight:700;color:${COL_VR};margin-left:.3rem">${tB.label}</span>
  </div>`);
set('kpiTpsRSub', '');

    // A1 Flotte nécessaire — 2 lignes, couleur par tronçon
    set('kpiFlotte',
      `<div style="line-height:1.4">
        <span style="font-size:1.45rem;font-weight:800;color:${COL_A};letter-spacing:-.01em">${tA.flotteNec}</span>
        <span class="kpi-unit">veh</span>
        <span style="font-size:.56rem;font-weight:700;color:${COL_A};margin-left:.3rem">${tA.label}</span>
      </div>
      <div style="line-height:1.4;margin-top:.2rem">
        <span style="font-size:1.45rem;font-weight:800;color:${COL_B};letter-spacing:-.01em">${tB.flotteNec}</span>
        <span class="kpi-unit">veh</span>
        <span style="font-size:.56rem;font-weight:700;color:${COL_B};margin-left:.3rem">${tB.label}</span>
      </div>`);
    set('kpiFlotteSub', `<span style="color:var(--green)">+${k.flotteTot - k.flotteNec}</span> en réserve`);
    set('kpiSMR', sc.smrCapacite != null ? `<span style="color:var(--green)">${sc.smrCapacite}</span><span class="kpi-unit">veh</span>` : '—');
    set('kpiSMRSub', '');

    // A2 Vit. Aller — valeur + tronçon inline, même couleur
    set('kpiVitA',
      `<div style="line-height:1.4">
        <span style="font-size:1.45rem;font-weight:800;color:${COL_VA};letter-spacing:-.01em">${cvtSpd(tA.vitA)}</span>
        <span class="kpi-unit">${spdUnit()}</span>
        <span style="font-size:.56rem;font-weight:700;color:${COL_VA};margin-left:.3rem">${tA.label}</span>
      </div>
      <div style="line-height:1.4;margin-top:.2rem">
        <span style="font-size:1.45rem;font-weight:800;color:${COL_VA};letter-spacing:-.01em">${cvtSpd(tB.vitA)}</span>
        <span class="kpi-unit">${spdUnit()}</span>
        <span style="font-size:.56rem;font-weight:700;color:${COL_VA};margin-left:.3rem">${tB.label}</span>
      </div>`);
    set('kpiVitASub', '');

    // B2 Vit. Retour
    set('kpiVitR',
      `<div style="line-height:1.4">
        <span style="font-size:1.45rem;font-weight:800;color:${COL_VR};letter-spacing:-.01em">${cvtSpd(tA.vitR)}</span>
        <span class="kpi-unit">${spdUnit()}</span>
        <span style="font-size:.56rem;font-weight:700;color:${COL_VR};margin-left:.3rem">${tA.label}</span>
      </div>
      <div style="line-height:1.4;margin-top:.2rem">
        <span style="font-size:1.45rem;font-weight:800;color:${COL_VR};letter-spacing:-.01em">${cvtSpd(tB.vitR)}</span>
        <span class="kpi-unit">${spdUnit()}</span>
        <span style="font-size:.56rem;font-weight:700;color:${COL_VR};margin-left:.3rem">${tB.label}</span>
      </div>`);
    set('kpiVitRSub', '');

    // C Cycle — les 2 tronçons en haut, occup terminus en bas
    set('kpiCycleLabel', `${T('kpiLabelCycle')} · ${tA.label} / ${tB.label}`);
    set('kpiCycle',   `${fmtMin(tA.tCyc)} · ${fmtMin(tB.tCyc)}`);
    renderOccupKPI();
    renderDepotKPI(k);
  } else {
    set('kpiTpsA',      fmtMin(k.tAllerMin));
    set('kpiTpsASub',   `${k.totalDistKm.toFixed(_decDist)} km`);
    set('kpiTpsR',      fmtMin(k.tRetourMin));
    set('kpiTpsRSub',   `${k.totalDistKm.toFixed(_decDist)} km`);
    set('kpiFlotte',    `<span style="color:var(--green)">${k.flotteNec}</span><span class="kpi-unit">veh</span>`);
    set('kpiFlotteSub', `+<span style="color:var(--green);font-size:1.25rem;font-weight:800">${k.flotteTot - k.flotteNec}</span> en réserve`);
    set('kpiSMR',       sc.smrCapacite != null ? `<span style="color:var(--green)">${sc.smrCapacite}</span><span class="kpi-unit">veh</span>` : '—');
    set('kpiSMRSub',    '');
    set('kpiVitA',      `${cvtSpd(k.vitA)}<span class="kpi-unit">${spdUnit()}</span>`);
    set('kpiVitASub',   `${k.totalDistKm.toFixed(_decDist)} km · ${fmtMin(k.tAllerMin)}`);
    set('kpiVitR',      `${cvtSpd(k.vitR)}<span class="kpi-unit">${spdUnit()}</span>`);
    set('kpiVitRSub',   `${k.totalDistKm.toFixed(_decDist)} km · ${fmtMin(k.tRetourMin)}`);
    set('kpiCycleLabel', T('kpiLabelCycle'));
    set('kpiCycle',     fmtMin(k.tCycleMin));
    renderOccupKPI();
    renderDepotKPI(k);
  }
  // Bandeau freq HP dans l'horloge — sc.freqHP est la source de vérité
  const freqHPval = (sc && sc.freqHP) || (()=>{ const f=PLAGES.filter(p=>p.type==='HP'&&p.freq).map(p=>p.freq); return f.length?Math.min(...f):k.freqHP; })();
  const elCFHP = document.getElementById('clockFreqHP');
  const elCFHPV = document.getElementById('clockFreqHPVeh');
  if(elCFHP) elCFHP.textContent = `${fmtFreq(freqHPval)} min`;
  if(elCFHPV) elCFHPV.textContent = `· ${k.flotteNec} veh`;
  // Légende horloge
  const legHP = document.getElementById('clockLegHP');
  if(legHP) legHP.textContent = `· ${fmtFreq(freqHPval)} min`;
  updateClockLegend();
  // G Courses
  set('kpiCourses',    `${k.coursesJour}`);
  set('kpiCoursesSub', T('ofService').replace('{n}',k.serviceH));
  set('kpiKmCom',      `${k.kmCom.toLocaleString('fr-FR')} km`);
  set('kpiKmComSub',   `${k.coursesJour} ${T('tripsKm').replace('{d}',k.totalDistKm.toFixed(1))}`  );
}

