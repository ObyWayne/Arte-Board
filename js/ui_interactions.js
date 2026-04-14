/* ── ui_interactions.js — Tooltips, overlays fullscreen, Gantt ── */

/* ═══════════════════════════════════════════════
   CONSTANTES COULEURS (Gantt conflit)
   #ef4444 = rouge conflit — centralisé ici plutôt qu'éparpillé
═══════════════════════════════════════════════ */
const COLOR_CONFLICT     = '#ef4444';
const COLOR_CONFLICT_BG  = 'rgba(239,68,68,0.094)';
const COLOR_CONFLICT_BD  = 'rgba(239,68,68,0.267)';

/* ═══════════════════════════════════════════════
   TOOLTIP PARTAGÉ (_movePieTooltip)
═══════════════════════════════════════════════ */
function _movePieTooltip(evt){
  const tt = document.getElementById('pieTooltip');
  if(!tt) return;
  const W = tt.offsetWidth || 160, H = tt.offsetHeight || 70;
  let x = evt.clientX + 14, y = evt.clientY - H/2;
  if(x + W > window.innerWidth  - 8) x = evt.clientX - W - 14;
  if(y < 8) y = 8;
  if(y + H > window.innerHeight - 8) y = window.innerHeight - H - 8;
  tt.style.left = x + 'px';
  tt.style.top  = y + 'px';
}

/* ── Cycle bar hover ── */
function stackSegEnter(el, evt){
  el.style.filter = 'brightness(1.2) saturate(1.3)';
  const tt = document.getElementById('pieTooltip');
  if(!tt) return;
  tt.style.background = el.dataset.col;
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
  const tt = document.getElementById('pieTooltip');
  if(tt) tt.style.display = 'none';
  el.removeEventListener('mousemove', _movePieTooltip);
}

/* ── Horloge hover ── */
function clockSliceEnter(el, evt){
  el.style.opacity = '1';
  el.style.filter  = 'brightness(1.25)';
  const tt = document.getElementById('pieTooltip');
  if(!tt) return;
  tt.style.background = el.dataset.col;
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
  const tt = document.getElementById('pieTooltip');
  if(tt) tt.style.display = 'none';
  el.removeEventListener('mousemove', _movePieTooltip);
}

/* ── Pie chart hover ── */
function pieSliceEnter(el, evt){
  el.style.transform = 'scale(1.08)';
  el.style.opacity   = '1';
  const tt = document.getElementById('pieTooltip');
  if(!tt) return;
  tt.style.background = el.dataset.col;
  document.getElementById('ptIcon').textContent  = el.dataset.icon;
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
  const tt = document.getElementById('pieTooltip');
  if(tt) tt.style.display = 'none';
  el.removeEventListener('mousemove', _movePieTooltip);
}

/* ── Gantt hover ── */
function ganttSegEnter(el, evt){
  el.style.opacity = '1';
  el.style.filter  = 'brightness(1.25)';
  const tt = document.getElementById('pieTooltip');
  if(!tt) return;
  tt.style.background = el.dataset.col;
  const busNum = el.dataset.bus != null ? ` — Bus N°${el.dataset.bus}` : '';
  document.getElementById('ptIcon').textContent  = '🚉';
  document.getElementById('ptLabel').textContent = el.dataset.label;
  document.getElementById('ptVal').textContent   = el.dataset.total;
  document.getElementById('ptPct').textContent   = el.dataset.start + ' → ' + el.dataset.end;
  tt.style.display = 'block';
  _movePieTooltip(evt);
  el.addEventListener('mousemove', _movePieTooltip);
}
function ganttSegLeave(el){
  el.style.opacity = el.dataset.baseOpacity || '.82';
  el.style.filter  = '';
  const tt = document.getElementById('pieTooltip');
  if(tt) tt.style.display = 'none';
  el.removeEventListener('mousemove', _movePieTooltip);
}

/* ═══════════════════════════════════════════════
   OVERLAY FULLSCREEN
═══════════════════════════════════════════════ */
function openFullscreen(title, renderFn){
  const ov   = document.getElementById('fsOverlay');
  const body = document.getElementById('fsBody');
  if(!ov || !body) return;
  document.getElementById('fsTitle').textContent = title;
  body.innerHTML = '';
  renderFn(body);
  ov.style.display = 'flex';
  requestAnimationFrame(() => ov.classList.add('open'));
  document.addEventListener('keydown', _fsKeyHandler);
}
function closeFullscreen(){
  const ov = document.getElementById('fsOverlay');
  if(!ov) return;
  ov.classList.remove('open');
  setTimeout(() => {
    ov.style.display='none';
    const body = document.getElementById('fsBody');
    if(body) body.innerHTML='';
  }, 200);
  document.removeEventListener('keydown', _fsKeyHandler);
}
function _fsKeyHandler(e){ if(e.key==='Escape') closeFullscreen(); }

/* ── Marche type ── */
function fsOpenMarcheType(){
  // Cas 1 : graphique CSV → plein écran via render_marche.js
  const canvas = document.getElementById('mtCanvas');
  if(canvas && canvas.style.display !== 'none' && typeof fsOpenMarcheTypeCanvas === 'function'){
    fsOpenMarcheTypeCanvas(canvas); return;
  }
  // Cas 2 : image PNG (comportement original)
  const img = document.getElementById('mtImg');
  if(!img || !img.src || img.style.display==='none') return;
  const lbl = document.getElementById('mtLabel');
  openFullscreen(lbl ? lbl.textContent : '', body => {
    Object.assign(body.style, {overflow:'auto', alignItems:'flex-start', justifyContent:'center', padding:'1rem'});
    const i = document.createElement('img');
    i.src = img.src; i.alt = 'Marche type';
    i.style.cssText = 'max-width:100%;height:auto;display:block;margin:auto;';
    body.appendChild(i);
  });
}

/* ── Schéma de ligne ── */
function fsOpenSchema(){
  const svg       = document.getElementById('schemaSvg');
  const tableBody = document.getElementById('tableBody');
  if(!svg || !svg.innerHTML) return;
  openFullscreen(T('lineDiagram'), body => {
    Object.assign(body.style, {overflow:'auto', padding:'0', alignItems:'flex-start', justifyContent:'flex-start'});

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;align-items:flex-start;width:100%;min-height:100%;';

    // Colonne schéma
    const schemaCol = document.createElement('div');
    schemaCol.style.cssText = 'flex-shrink:0;width:clamp(160px,14vw,240px);border-right:1px solid var(--border);display:flex;flex-direction:column;';

    // Cloner les boutons Aller / Retour
    const dirBtnsOrig = document.querySelector('.schema-dir-btns');
    if(dirBtnsOrig){
      const dirClone = dirBtnsOrig.cloneNode(true);
      const fsBtn = dirClone.querySelector('.schema-fs-btn-top');
      if(fsBtn) fsBtn.remove();
      const btnA = dirClone.querySelector('#dirBtnA');
      const btnR = dirClone.querySelector('#dirBtnR');
      if(btnA){
        btnA.removeAttribute('id');
        btnA.classList.toggle('active', currentDir === 'aller');
        btnA.onclick = () => {
          setDirection('aller');
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
      dirClone.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
      schemaCol.appendChild(dirClone);
    }

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

/* ── Radar ── */
function fsOpenRadar(){
  if(!LINE) return;
  const titleEl = document.getElementById('compRadarTitle');
  openFullscreen(titleEl ? titleEl.textContent : T('compRadarTitle'), body => {
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
      if(orig) orig.id = '_radarCanvas_bak';
      canvasFs.id = 'radarCanvas';
      renderRadar(_lastRadarAll, _lastRadarFiltered);
      canvasFs.id = '_radarCanvasFs';
      const bak = document.getElementById('_radarCanvas_bak');
      if(bak) bak.id = 'radarCanvas';
    });
  });
}

/* ── Serpent de charge ── */
function fsOpenBubble(){
  if(!LINE) return;
  const titleEl = document.getElementById('compBubbleTitle');
  openFullscreen(titleEl ? titleEl.textContent : T('compBubbleTitle'), body => {
    Object.assign(body.style, {
      overflow: 'hidden', padding: '0', display: 'flex', flexDirection: 'row', alignItems: 'stretch',
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
      if(oldL) oldL.id = '_chargeAxisCanvas_bak';
      axisL.id = 'chargeAxisCanvas';

      renderBubbleChartOnCanvas(c2, null, availH,
        window._lastBubbleAll || [], window._lastBubbleSc ?? 0);

      axisL.id = 'chargeAxisCanvas_fs';
      if(oldL) oldL.id = 'chargeAxisCanvas';
    }));
  });
}

/* ── Image terminus ── */
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

/* ── Matrice SP ── */
function fsOpenSP(){
  const card = document.querySelector('.comp-sp-card');
  if(!card) return;
  const titleEl = document.getElementById('compSPTitle');
  openFullscreen(titleEl ? titleEl.textContent : '', body => {
    Object.assign(body.style, {alignItems:'flex-start', padding:'1.5rem', overflow:'auto'});
    const container = document.getElementById('spMatrixContainer') || card;
    const clone = container.cloneNode(true);
    clone.style.cssText = 'width:auto;overflow:visible;';
    clone.querySelectorAll('*').forEach(el=>{
      if(el.style.maxHeight) el.style.maxHeight='none';
      if(el.style.overflow==='auto'||el.style.overflow==='scroll') el.style.overflow='visible';
    });
    body.appendChild(clone);
  });
}

/* ── Tableau comparatif ── */
function fsOpenCompTable(){
  const tbl = document.getElementById('compTable');
  if(!tbl) return;
  const titleEl = document.getElementById('compTableTitle');
  openFullscreen(titleEl ? titleEl.textContent : '', body => {
    Object.assign(body.style, {overflow:'auto', alignItems:'flex-start', padding:'1.5rem', flexDirection:'column'});
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

/* ── Histogramme terminus ── */
function fsOpenTermHisto(svgHtml, title){
  openFullscreen(title, body => {
    Object.assign(body.style, {alignItems:'center', justifyContent:'center'});
    const fsW = Math.min(window.innerWidth - 60, 1400);
    const wrap = document.createElement('div');
    wrap.style.cssText = `width:${fsW}px;`;
    wrap.innerHTML = svgHtml;
    const svg = wrap.querySelector('svg');
    if(svg){
      const vb = svg.getAttribute('viewBox') || '0 0 220 140';
      svg.setAttribute('viewBox', vb);
      svg.style.cssText = 'width:100%;height:auto;display:block;';
    }
    body.appendChild(wrap);
  });
}

/* ── Gantt fullscreen ── */
function fsOpenGantt(ganttId, nom){
  const el = document.getElementById(ganttId);
  if(!el) return;
  openFullscreen(T('trackOccupancy') + ' — ' + nom, body => {
    Object.assign(body.style, {overflow:'auto', alignItems:'flex-start', padding:'1rem'});
    const clone = el.cloneNode(true);
    clone.style.cssText = 'width:100%;';
    clone.querySelectorAll('.fs-btn').forEach(b=>b.remove());
    body.appendChild(clone);
  });
}

/* ═══════════════════════════════════════════════
   GANTT D'OCCUPATION DES VOIES
═══════════════════════════════════════════════ */
function buildTermGantt(ret, nom, groupData){
  if(!ret || !ret.params || !ret.params.length) return '';

  const sc       = LINE && LINE.scenarios[currentSc];
  const freqMin  = sc ? (sc.freqHP || sc.freqMin || 6) : 6;
  const freqSec  = freqMin * 60;
  const axisStepMin = (()=>{ const el=document.getElementById('settGanttStep'); return el?(parseInt(el.value)||5):5; })();
  // Palette cyclique par bus — chaque trainIdx a sa propre teinte
  // Palette monochrome générée depuis la couleur de marque — même teinte, luminosités variées
  const _h2hsl = hex => {
    const n=parseInt((hex||'#3b82f6').replace('#',''),16);
    let r=(n>>16&255)/255, g=(n>>8&255)/255, b=(n&255)/255;
    const mx=Math.max(r,g,b), mn=Math.min(r,g,b), l=(mx+mn)/2;
    if(mx===mn) return [0,0,l*100];
    const d=mx-mn, s=l>0.5?d/(2-mx-mn):d/(mx+mn);
    const h={[r]:(g-b)/d+(g<b?6:0),[g]:(b-r)/d+2,[b]:(r-g)/d+4}[mx]/6;
    return [Math.round(h*360), Math.round(s*100), Math.round(l*100)];
  };
  const _hsl2hex = (h,s,l) => {
    s/=100; l/=100;
    const k=n=>(n+h/30)%12, a=s*Math.min(l,1-l);
    const f=n=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));
    return '#'+[f(0),f(8),f(4)].map(x=>Math.round(x*255).toString(16).padStart(2,'0')).join('');
  };
  const [_bh, _bs] = _h2hsl(BRAND.primaire2 || '#3b82f6');
  // 6 variantes : même teinte, même saturation, luminosités de 30% à 70%
  const _BUS_COLORS = [45, 58, 35, 65, 40, 55].map(lv => _hsl2hex(_bh, _bs, lv));
  const busCol = (idx) => _BUS_COLORS[idx % _BUS_COLORS.length];

  const sorted = [...ret.params].sort((a,b)=>{
  if(a.ordre!=null&&b.ordre!=null) return a.ordre-b.ordre; return 0;
});

// Map occKey → nPos sélectionné dans les histos
  const occNPos = new Map((groupData||[]).map(g => [g.occKey, g.nPos]));

// ── Parse les alternatives d'une voie : "Voie 1&Voie 2&Voie 3" → ['Voie 1','Voie 2','Voie 3']
// Si une seule voie (pas de &), comportement identique à avant
const parseVoies = p => {
  const raw    = (p.voie||'').trim() || p.label;
  const alts   = raw.split('&').map(v => v.trim()).filter(Boolean);
  const occKey = (p.occ||'').trim() || 'Autre';
  const nPos   = occNPos.get(occKey) || 1;
  return alts.slice(0, nPos); // limiter aux N premières voies sélectionnées
};

const seqSec      = sorted.reduce((a,p) => a + p.sec, 0);
const durationSec = 3600;
// voiesSet : on explose toutes les alternatives pour avoir une ligne par voie physique
const voiesSet    = [...new Set(sorted.flatMap(p => parseVoies(p)))];

// ── Assignation dynamique : chaque bus prend la première position libre ──
// Pour un step "Voie 1&Voie 2" : essaie Voie 1, si occupée → Voie 2, etc.
// Si toutes occupées → fallback sur la 1ère (conflit visible)
const _voieFreeAt     = new Map(); // voie → seconde à partir de laquelle elle est libre
  const _busVoie        = new Map(); // trainIdx → dernière voie multi-position assignée
  const _allSlots       = [];

  for (let t = 0, idx = 0; t < durationSec; t += freqSec, idx++) {
    let cursor = t;
    _busVoie.delete(idx); // ce bus commence une nouvelle séquence

    sorted.forEach(p => {
      const alts      = parseVoies(p);
      const stuckVoie = _busVoie.get(idx); // voie mémorisée depuis une phase précédente

      let chosenVoie;
      if (stuckVoie && alts.includes(stuckVoie)) {
        // Le bus reste sur sa voie courante — même physique, pas besoin de libération
        chosenVoie = stuckVoie;
      } else {
        // Nouvelle assignation : première voie libre dans les alternatives
        chosenVoie = alts.find(v => cursor >= (_voieFreeAt.get(v) || 0)) || alts[0];
        // Mémoriser uniquement si c'est une voie "à choix" (plusieurs alternatives)
        if (alts.length > 1) _busVoie.set(idx, chosenVoie);
      }

      _allSlots.push({ voie: chosenVoie, start: cursor, end: cursor + p.sec,
                       label: p.label, sec: p.sec, trainIdx: idx });
      _voieFreeAt.set(chosenVoie, cursor + p.sec);
      cursor += p.sec;
    });
  }

// Reconstruction par train (compatibilité avec la détection de conflits ci-dessous)
const trains = [];
for (let i = 0; i * freqSec < durationSec; i++) trains.push([]);
_allSlots.forEach(s => { if (trains[s.trainIdx]) trains[s.trainIdx].push(s); });

  // Détection des conflits par voie
  const voieConflictZones = {};
  const voieHasConflict   = {};
  voiesSet.forEach(voie => {
    voieConflictZones[voie] = [];
    voieHasConflict[voie]   = false;
    for(let i=0; i<trains.length-1; i++){
      const curSlots  = trains[i].filter(s=>s.voie===voie);
      const nextSlots = trains[i+1].filter(s=>s.voie===voie);
      if(!curSlots.length || !nextSlots.length) continue;
      const curEnd    = Math.max(...curSlots.map(s=>s.end));
      const nextStart = Math.min(...nextSlots.map(s=>s.start));
      if(curEnd > nextStart && nextStart < durationSec){
        voieConflictZones[voie].push({start:nextStart, end:Math.min(curEnd, durationSec)});
        voieHasConflict[voie] = true;
      }
    }
  });

  const anyConflict = Object.values(voieHasConflict).some(Boolean);

  // Dimensions
const LABEL_W  = 80;
  const OCC_W    = 90;
  const PCT_W    = 46;
  const availPx  = Math.max(600, (window.innerWidth||1400)-320 - LABEL_W - OCC_W - PCT_W);
  const CELL     = availPx / durationSec;
  const toX      = sec => sec * CELL;
  const ROW_MAIN = 20;
  const ROW_SUB  = 15;
  const HEADER_H = 26;

  // Taux d'occupation par voie
  const voieOccup = {};
  voiesSet.forEach(v=>{ voieOccup[v]=0; });
  trains.forEach(slots => slots.forEach(s=>{
    const dur = Math.min(s.end,durationSec)-Math.max(s.start,0);
    if(dur>0) voieOccup[s.voie]=(voieOccup[s.voie]||0)+dur;
  }));

  // Map voie → occKey (première correspondance trouvée dans sorted)
  const voieOcc = new Map();
  sorted.forEach(p => {
    const occKey = (p.occ||'').trim() || 'Autre';
    parseVoies(p).forEach(v => { if(!voieOcc.has(v)) voieOcc.set(v, occKey); });
  });

  // Ticks axe
  const tickStepSec = axisStepMin*60;
  const ticks=[];
  for(let s=0; s<=durationSec; s+=tickStepSec) ticks.push(s);

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

 const rows = voiesSet.map((voie, vi) => {
    const pct    = Math.round((voieOccup[voie]||0)/durationSec*100);
    const pctCol = occColorHex(Math.min(pct,100));
    const hasC   = voieHasConflict[voie];
    const cZones = voieConflictZones[voie];
    const rowH   = hasC ? ROW_MAIN + ROW_SUB + 2 : ROW_MAIN;

    const vticks = ticks.map(s=>
      `<div style="position:absolute;left:${toX(s).toFixed(1)}px;top:0;width:1px;height:100%;background:var(--border);opacity:.2;"></div>`
    ).join('');

    const cZoneBg = cZones.map(z=>
      `<div style="position:absolute;left:${toX(z.start).toFixed(1)}px;top:0;width:${toX(z.end-z.start).toFixed(1)}px;height:100%;background:${COLOR_CONFLICT_BG};"></div>`
    ).join('');

    const voieSlots = trains.flatMap(t=>t).filter(s=>s.voie===voie&&s.start<durationSec);

    const segHtml = voieSlots.map(s=>{
      const subLine    = hasC ? (s.trainIdx % 2) : 0;
      const yTop       = subLine===0 ? 1 : ROW_MAIN + 2;
      const segH       = subLine===0 ? ROW_MAIN-2 : ROW_SUB-2;
      const inConflict = cZones.some(z=>s.start<z.end&&s.end>z.start);
      const segCol     = inConflict ? COLOR_CONFLICT : busCol(s.trainIdx);
      const opacity    = inConflict ? '.9' : '.85';
      const x = toX(s.start).toFixed(1);
      const w = Math.max(1, toX(Math.min(s.end,durationSec)-s.start)-0.5).toFixed(1);
      const numLabel = parseFloat(w) > 20
        ? `<span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
            font-size:7px;font-weight:900;color:rgba(255,255,255,.8);
            font-family:var(--fontb);pointer-events:none;line-height:1;">${s.trainIdx+1}</span>`
        : '';
      return `<div style="position:absolute;left:${x}px;top:${yTop}px;width:${w}px;height:${segH}px;
        background:${segCol};opacity:${opacity};border-radius:2px;cursor:pointer;overflow:hidden;"
        data-label="${s.label}" data-total="${secToStr(s.sec)}"
        data-start="${Math.floor(s.start/60)}min${String(s.start%60).padStart(2,'0')}s"
        data-end="${Math.floor(Math.min(s.end,durationSec)/60)}min${String(Math.min(s.end,durationSec)%60).padStart(2,'0')}s"
        data-col="${segCol}" data-bus="${s.trainIdx+1}" data-base-opacity="${opacity}"
        onmouseenter="ganttSegEnter(this,event)" onmouseleave="ganttSegLeave(this)">${numLabel}</div>`;
    }).join('');


    // Bordures : pas de bordure inférieure si la voie suivante partage le même occKey
    const thisOcc = voieOcc.get(voie) || '';
    const nextOcc = voieOcc.get(voiesSet[vi+1]) || null;
    const sameGroupAsNext = nextOcc !== null && nextOcc === thisOcc;
    const rowBorder  = sameGroupAsNext ? 'none' : '1px solid var(--border)';

    // Colonne occ : afficher le label uniquement sur la première voie du groupe
    const prevOcc = voieOcc.get(voiesSet[vi-1]) || null;
    const isFirstOfGroup = prevOcc !== thisOcc;
    const occLabel = isFirstOfGroup ? thisOcc : '';

    return `<div style="display:flex;align-items:stretch;border-bottom:${rowBorder};">
      <div style="width:${LABEL_W}px;flex-shrink:0;font-size:.52rem;font-family:var(--fontb);font-weight:800;
        color:var(--text);padding:0 .4rem;display:flex;align-items:center;
        border-right:1px solid var(--border);">${voie}</div>
      <div style="width:${OCC_W}px;flex-shrink:0;font-size:.46rem;font-family:var(--fontb);font-weight:700;
        color:var(--text3);padding:0 .4rem;display:flex;align-items:center;
        border-right:1px solid var(--border);letter-spacing:.04em;
        text-transform:uppercase;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;"
        title="${thisOcc}">${occLabel}</div>
      <div style="position:relative;width:${toX(durationSec).toFixed(1)}px;flex-shrink:0;height:${rowH}px;background:var(--bg4);">
        ${vticks}${cZoneBg}${segHtml}
      </div>
      <div style="width:${PCT_W}px;flex-shrink:0;font-size:.6rem;font-weight:800;color:${pctCol};
        font-family:var(--fontb);display:flex;align-items:center;justify-content:center;
        border-left:1px solid var(--border);">${pct}%</div>
    </div>`;
  }).join('');

  const totalW = LABEL_W + OCC_W + toX(durationSec) + PCT_W;
  const ganttId = 'gantt_'+nom.replace(/[^a-z0-9]/gi,'_');

  const conflictBanner = anyConflict
    ? `<div style="display:flex;align-items:center;gap:.4rem;background:${COLOR_CONFLICT_BG};border:1px solid ${COLOR_CONFLICT_BD};
        border-radius:4px;padding:.2rem .5rem;margin-bottom:.35rem;font-size:.52rem;font-family:var(--fontb);color:${COLOR_CONFLICT};">
        ⚠️ ${T('ganttConflict')} : séquence ${Math.round(seqSec/60*10)/10}min › fréquence ${freqMin}min
       </div>`
    : '';

  const header = `<div style="display:flex;border-bottom:2px solid var(--border);">
    <div style="width:${LABEL_W}px;flex-shrink:0;border-right:1px solid var(--border);"></div>
    <div style="width:${OCC_W}px;flex-shrink:0;border-right:1px solid var(--border);"></div>
    <div style="position:relative;width:${toX(durationSec).toFixed(1)}px;flex-shrink:0;height:${HEADER_H}px;">
      ${headerTicks}${conflictMarkers}
    </div>
    <div style="width:${PCT_W}px;flex-shrink:0;font-size:6px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
      color:var(--text3);font-family:var(--fontb);display:flex;align-items:flex-end;justify-content:center;
      padding-bottom:3px;border-left:1px solid var(--border);">${T('ganttOcc')}</div>
  </div>`;

  return `<div class="term-gantt-wrap" id="${ganttId}">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.3rem;">
      <div>
        <div class="term-gantt-title" style="margin:0;">${T('trackOccupancy')} — ${nom}</div>
        ${(groupData||[]).filter(g => g.maxPos > 1).map(g =>
          `<div style="font-size:.42rem;color:var(--text3);font-family:var(--fontb);line-height:1.6;margin-top:.1rem;">
            ${g.occKey} — ${g.nPos} ${isEN ? 'lane'+(g.nPos>1?'s':'') : 'voie'+(g.nPos>1?'s':'')}
          </div>`
        ).join('')}
      </div>
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
