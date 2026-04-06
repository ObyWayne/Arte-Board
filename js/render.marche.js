/* ── render.marche.js v3 — Graphique interactif marche type (CSV) ── */
/* ═══════════════════════════════════════════════
   Mode normal        : X = PK (km),   Y gauche = T (mm:ss)  ← marche type FR
   Mode international : X = T (mm:ss), Y gauche = PK (km)    ← globe actif

   Tooltip → réutilise #pieTooltip (style global défini dans base.css)
   Header  → éléments HTML (titre + boutons .fs-btn)
═══════════════════════════════════════════════ */

let _mtWorldView = false;

/* ═══════════════════════════════════════════════
   POINT D'ENTRÉE
═══════════════════════════════════════════════ */
function renderMarcheType(){
  const canvas = document.getElementById('mtCanvas');
  const img    = document.getElementById('mtImg');
  const ph     = document.getElementById('mtPlaceholder');
  const lbl    = document.getElementById('mtSensLabel');
  if(!canvas) return;
  if(!LINE){ canvas.style.display = 'none'; _mtHideOverlay(); return; }

  const d       = LINE.scenariosData ? LINE.scenariosData[currentSc] : null;
  const csvData = d ? (currentDir === 'aller' ? d.csvA : d.csvR) : null;

  if(csvData && csvData.t && csvData.t.length > 5){
    if(img) img.style.display = 'none';
    if(ph)  ph.style.display  = 'none';
    if(lbl) lbl.style.display = 'none';
    canvas.style.display = 'block';
    _mtEnsureOverlay();
    requestAnimationFrame(() => _drawMTChart(canvas, csvData));
  } else {
    canvas.style.display = 'none';
    _mtHideOverlay();
    if(lbl) lbl.style.display = '';
    _mtFallback(img, ph);
  }
}

/* ═══════════════════════════════════════════════
   OVERLAY HTML (titre + boutons)
   — même formalisme que .chart-card-header + .fs-btn
═══════════════════════════════════════════════ */
const _MT_HDR_H = 24;   // hauteur du header en px (commun canvas + overlay)

function _mtEnsureOverlay(){
  const card = document.getElementById('mtCard');
  if(!card) return;

  let ov = document.getElementById('mtOverlay');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'mtOverlay';
    // Même look que .chart-card-header mais en position absolue
    ov.style.cssText = [
      'position:absolute;top:0;left:0;right:0;z-index:6',
      `height:${_MT_HDR_H}px`,
      'display:flex;align-items:center;justify-content:space-between',
      'padding:0 .4rem',
      'background:var(--bg3)',
      'border-bottom:1px solid var(--border)',
      'pointer-events:auto',
    ].join(';');

    // Titre
    const title = document.createElement('span');
    title.id = 'mtOvTitle';
    title.style.cssText = [
      "font-family:var(--fontb,'Barlow',sans-serif)",
      'font-size:.58rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase',
      'color:var(--text2)',
    ].join(';');

    // Groupe boutons
    const grp = document.createElement('div');
    grp.style.cssText = 'display:flex;gap:.25rem;align-items:center;';

    // Bouton globe — même classe que .fs-btn
    const btnW = document.createElement('button');
    btnW.id        = 'mtBtnWorld';
    btnW.className = 'fs-btn';
    btnW.title     = 'Vue internationale';
    btnW.innerHTML = _mtGlobeSVG(11);
    btnW.style.cssText = 'display:flex;align-items:center;padding:.15rem .3rem;';
    btnW.onclick = () => { _mtWorldView = !_mtWorldView; _mtUpdateBtnWorld(); renderMarcheType(); };

    // Bouton plein écran — exactement .fs-btn avec ⛶
    const btnFs = document.createElement('button');
    btnFs.className = 'fs-btn';
    btnFs.title     = 'Plein écran';
    btnFs.textContent = '⛶';
    btnFs.onclick = () => fsOpenMarcheType();

    grp.appendChild(btnW);
    grp.appendChild(btnFs);
    ov.appendChild(title);
    ov.appendChild(grp);
    card.appendChild(ov);

    if(!card._mtRO){
      let _mtROTimer = null;
      card._mtRO = new ResizeObserver(() => {
        clearTimeout(_mtROTimer);
        _mtROTimer = setTimeout(() => renderMarcheType(), 80);
      });
      card._mtRO.observe(card);
    }
  }

  // Mise à jour titre + direction
  const colSeg = (typeof BRAND !== 'undefined')
    ? (currentDir === 'aller' ? BRAND.aller : BRAND.retour)
    : (currentDir === 'aller' ? '#4a9eff' : '#f5a623');
  const dir    = currentDir === 'aller' ? '↓ Aller' : '↑ Retour';
  const title  = document.getElementById('mtOvTitle');
  if(title) title.innerHTML =
    `<span style="color:var(--text2)">Marche type</span>`
    + `<span style="color:${colSeg};margin-left:.3em">${dir}</span>`;

  document.getElementById('mtOverlay').style.display = 'flex';
  _mtUpdateBtnWorld();
}

function _mtHideOverlay(){
  const ov = document.getElementById('mtOverlay');
  if(ov) ov.style.display = 'none';
}

function _mtUpdateBtnWorld(){
  const btn = document.getElementById('mtBtnWorld');
  if(!btn) return;
  if(_mtWorldView){
    const col = (typeof BRAND !== 'undefined') ? BRAND.primaire1 : 'var(--purple)';
    btn.style.background  = col;
    btn.style.borderColor = col;
    btn.style.color       = '#fff';
  } else {
    btn.style.removeProperty('background');
    btn.style.removeProperty('border-color');
    btn.style.removeProperty('color');
  }
}

/* ── SVG globe inline ── */
function _mtGlobeSVG(sz){
  const h = sz || 11;
  return `<svg width="${h}" height="${h}" viewBox="0 0 12 12" fill="none"
    stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="6" cy="6" r="5"/>
    <line x1="6" y1="1" x2="6" y2="11"/>
    <ellipse cx="6" cy="6" rx="2.6" ry="5"/>
    <line x1="1" y1="6" x2="11" y2="6"/>
    <ellipse cx="6" cy="3.5" rx="4.2" ry="1.1"/>
    <ellipse cx="6" cy="8.5" rx="4.2" ry="1.1"/>
  </svg>`;
}

/* ── Fallback image / placeholder ── */
function _mtFallback(img, ph){
  if(!LINE) return;
  const sc = LINE.scenarios[currentSc];
  let src = '';
  if(sc && sc.type === 'SP'){
    const key = currentDir === 'aller' ? sc.mtA : sc.mtR;
    if(key && typeof MT_IMAGES !== 'undefined') src = MT_IMAGES['sc_'+key] || MT_IMAGES[key] || '';
  }
  if(!src && typeof MT_IMAGES !== 'undefined') src = MT_IMAGES[currentDir] || '';
  if(img){
    if(src){ img.src = src; img.style.display = 'block'; if(ph) ph.style.display = 'none'; }
    else   { img.style.display = 'none'; if(ph) ph.style.display = 'flex'; }
  }
}

/* ═══════════════════════════════════════════════
   DESSIN DU GRAPHIQUE
   Le canvas couvre toute la mt-card.
   MT = _MT_HDR_H + padding pour ne pas dessiner sous le header HTML.
═══════════════════════════════════════════════ */
function _drawMTChart(canvas, data){
  const worldView = _mtWorldView;
  const dpr = window.devicePixelRatio || 1;
  const W   = canvas.offsetWidth  || (canvas.parentElement && canvas.parentElement.offsetWidth) || 400;
  const H   = canvas.offsetHeight || 200;
  if(W <= 0 || H <= 0) return;

  canvas.width  = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  // ── Couleurs (document.body pour lire body.light-mode) ──
  const cs     = getComputedStyle(document.body);
  const colBg  = cs.getPropertyValue('--bg3').trim()   || '#252b3b';
  const colBdr = cs.getPropertyValue('--border').trim() || '#323854';
  const colTxt = cs.getPropertyValue('--text3').trim()  || '#6b748f';
  const colSeg = (typeof BRAND !== 'undefined')
    ? (currentDir === 'aller' ? BRAND.aller : BRAND.retour)
    : (currentDir === 'aller' ? '#4a9eff' : '#f5a623');
  const colPri = (typeof BRAND !== 'undefined') ? BRAND.primaire1 : '#a06bff';

  // ── Marges ──
  const ML = 58, MR = 62, MT = _MT_HDR_H + 8, MB = 34;
  const PW = W - ML - MR, PH = H - MT - MB;
  if(PW <= 0 || PH <= 0) return;

  // ── Données ──
  const { t, pk, v2 } = data;
  const tMin = t[0], tMax = t[t.length - 1];
  const pkMin = Math.min(...pk), pkMax = Math.max(...pk);
  const v2Max = Math.ceil(Math.max(...v2) / 10) * 10 || 60;
  const v2Min = 0;
  const dT = tMax-tMin||1, dPK = pkMax-pkMin||1, dV2 = v2Max-v2Min||1;

  // ── Projections ──
  // Axe Y gauche = V (km/h), axe Y droit = T ou PK selon la vue
  let scX, scYL, scYR, xTicks, yLTicks, yRTicks, xFmt, yLFmt, yRFmt, xArr, yLArr, mainLabel;
  if(!worldView){
    scX   = pkv => ML + (pkv-pkMin)/dPK*PW;
    scYL  = vv  => MT + PH - (vv-v2Min)/dV2*PH;   // V gauche
    scYR  = tv  => MT + PH - (tv-tMin)/dT*PH;     // T droit
    xTicks  = _mtNiceTicks(pkMin, pkMax, Math.max(3,Math.round(PW/70)));
    yLTicks = _mtNiceTicks(v2Min, v2Max, Math.max(3,Math.round(PH/35)));
    yRTicks = _mtTimeTicks(tMin, tMax, Math.max(3,Math.round(PH/35)));
    xFmt    = v => v.toFixed(v>=10?1:v>=1?2:3)+' km';
    yLFmt   = v => v+'';
    yRFmt   = v => _mtFmtSec(v);
    xArr=pk; yLArr=t; mainLabel='T (mm:ss)';
  } else {
    scX   = tv  => ML + (tv-tMin)/dT*PW;
    scYL  = vv  => MT + PH - (vv-v2Min)/dV2*PH;    // V gauche
    scYR  = pkv => MT + PH - (pkv-pkMin)/dPK*PH;   // PK droit
    xTicks  = _mtTimeTicks(tMin, tMax, Math.max(3,Math.round(PW/70)));
    yLTicks = _mtNiceTicks(v2Min, v2Max, Math.max(3,Math.round(PH/35)));
    yRTicks = _mtNiceTicks(pkMin, pkMax, Math.max(3,Math.round(PH/35)));
    xFmt    = v => _mtFmtSec(v);
    yLFmt   = v => v+'';
    yRFmt   = v => v.toFixed(v>=10?1:v>=1?2:3);
    xArr=t; yLArr=pk; mainLabel='PK (km)';
  }
  const v2Label = 'V (km/h)';

  // ── Fond ──
  ctx.fillStyle = colBg; ctx.fillRect(0, 0, W, H);

  // ── Grilles ──
  ctx.save(); ctx.strokeStyle=colBdr; ctx.lineWidth=0.5; ctx.globalAlpha=0.7;
  yLTicks.forEach(v=>{ const y=scYL(v); ctx.beginPath(); ctx.moveTo(ML,y); ctx.lineTo(ML+PW,y); ctx.stroke(); });
  xTicks.forEach(v=>{ const x=scX(v);  ctx.beginPath(); ctx.moveTo(x,MT); ctx.lineTo(x,MT+PH); ctx.stroke(); });
  ctx.restore();

  // ── Courbe V2 — axe gauche ──
  ctx.save(); ctx.strokeStyle=colPri; ctx.lineWidth=1.5; ctx.globalAlpha=0.60;
  ctx.beginPath();
  xArr.forEach((xv,i)=>{ const x=scX(xv),y=scYL(v2[i]); i===0?ctx.moveTo(x,y):ctx.lineTo(x,y); });
  ctx.stroke(); ctx.restore();

  // ── Courbe principale — axe droit ──
  ctx.save(); ctx.strokeStyle=colSeg; ctx.lineWidth=2.5;
  ctx.beginPath();
  xArr.forEach((xv,i)=>{ const x=scX(xv),y=scYR(yLArr[i]); i===0?ctx.moveTo(x,y):ctx.lineTo(x,y); });
  ctx.stroke(); ctx.restore();

  // ── Cadre ──
  ctx.save(); ctx.strokeStyle=colBdr; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(ML,MT); ctx.lineTo(ML,MT+PH); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ML+PW,MT); ctx.lineTo(ML+PW,MT+PH); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ML,MT+PH); ctx.lineTo(ML+PW,MT+PH); ctx.stroke();
  ctx.restore();

  // ── Labels Y gauche = V (km/h) ──
  ctx.save(); ctx.fillStyle=colPri; ctx.font='500 8.5px Barlow Condensed,sans-serif';
  ctx.textAlign='right'; ctx.textBaseline='middle';
  yLTicks.forEach(v=>{ ctx.fillText(yLFmt(v), ML-5, scYL(v)); });
  ctx.translate(11, MT+PH/2); ctx.rotate(-Math.PI/2);
  ctx.textAlign='center'; ctx.font='600 8px Barlow Condensed,sans-serif'; ctx.globalAlpha=0.7;
  ctx.fillText(v2Label, 0, 0); ctx.restore();

  // ── Labels Y droit = T ou PK ──
  ctx.save(); ctx.fillStyle=colSeg; ctx.font='500 8.5px Barlow Condensed,sans-serif';
  ctx.textAlign='left'; ctx.textBaseline='middle';
  yRTicks.forEach(v=>{ ctx.fillText(yRFmt(v), ML+PW+5, scYR(v)); });
  ctx.translate(W-10, MT+PH/2); ctx.rotate(Math.PI/2);
  ctx.textAlign='center'; ctx.font='600 8px Barlow Condensed,sans-serif'; ctx.globalAlpha=0.7;
  ctx.fillText(mainLabel, 0, 0); ctx.restore();

  // ── Labels X ──
  ctx.save(); ctx.fillStyle=colTxt; ctx.font='400 8.5px Barlow Condensed,sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='top';
  xTicks.forEach(v=>{ ctx.fillText(xFmt(v), scX(v), MT+PH+5); });
  ctx.restore();

  // ── Légende ──
  let lx=ML+4; const legY=MT+PH+24;
  ctx.save(); ctx.font='500 8px Barlow Condensed,sans-serif'; ctx.textBaseline='middle';
  [{col:colSeg,label:mainLabel,lw:2.5},{col:colPri,label:v2Label,lw:1.5,a:0.6}].forEach(({col,label,lw,a})=>{
    ctx.globalAlpha=a||1; ctx.strokeStyle=col; ctx.lineWidth=lw;
    ctx.beginPath(); ctx.moveTo(lx,legY); ctx.lineTo(lx+16,legY); ctx.stroke();
    ctx.globalAlpha=1; ctx.fillStyle=col; ctx.textAlign='left';
    ctx.fillText(label, lx+20, legY); lx+=84;
  }); ctx.restore();

  // ── Stocker pour mouse events ──
  canvas._mtCtx = {
    data, scX, scYL, scYR, xArr, yLArr,
    tMin, tMax, pkMin, pkMax, v2Min, v2Max,
    ML, MR, MT, MB, PW, PH, W, H,
    colSeg, colPri, colBdr, worldView,
  };
  if(!canvas._mtBound){
    canvas.addEventListener('mousemove',  _mtOnMouseMove);
    canvas.addEventListener('mouseleave', _mtOnMouseLeave);
    canvas._mtBound = true;
  }
}

/* ═══════════════════════════════════════════════
   EVENTS — utilise #pieTooltip (style global)
═══════════════════════════════════════════════ */
function _mtOnMouseMove(e){
  const canvas = e.currentTarget;
  const c = canvas._mtCtx;
  if(!c) return;

  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  // Hors de la zone de plot → cacher le tooltip et sortir
  if(mx < c.ML || mx > c.ML+c.PW || my < c.MT || my > c.MT+c.PH){
    document.getElementById('pieTooltip').style.display = 'none';
    return;
  }

  // Index le plus proche en X
  const xRaw = !c.worldView
    ? c.pkMin + (mx-c.ML)/c.PW*(c.pkMax-c.pkMin)
    : c.tMin  + (mx-c.ML)/c.PW*(c.tMax-c.tMin);
  const xRef = !c.worldView ? c.data.pk : c.data.t;
  let idx=0, minD=Infinity;
  xRef.forEach((v,i)=>{ const d=Math.abs(v-xRaw); if(d<minD){minD=d;idx=i;} });

  // Redessiner + barre verticale (sans points)
  _drawMTChart(canvas, c.data);
  const ctx = canvas.getContext('2d');
  ctx.save();
  // ⚠️ pas de ctx.scale() — déjà appliqué par _drawMTChart

  const x = c.scX(c.xArr[idx]);
  // Barre verticale seule, légèrement épaissie
  ctx.strokeStyle = (typeof isDark!=='undefined'&&isDark) ? 'rgba(255,255,255,0.30)' : 'rgba(0,0,0,0.20)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x, c.MT); ctx.lineTo(x, c.MT+c.PH); ctx.stroke();
  ctx.restore();

  // ── #pieTooltip — style global ──
  const tt   = document.getElementById('pieTooltip');
  if(!tt) return;

  const pkVal = c.data.pk[idx];
  const tVal  = c.data.t[idx];
  const v2Val = c.data.v2[idx];

  tt.style.background = c.colSeg;
  document.getElementById('ptIcon').textContent  = currentDir==='aller' ? '↓' : '↑';
  document.getElementById('ptLabel').textContent =
    (c.worldView ? 'PK ' + pkVal.toFixed(3) + ' km' : 'T  ' + _mtFmtSec(tVal));
  document.getElementById('ptVal').textContent   =
    (c.worldView ? _mtFmtSec(tVal) : pkVal.toFixed(3) + ' km');
  document.getElementById('ptPct').textContent   = v2Val.toFixed(1) + ' km/h';

  tt.style.display = 'block';
  _mtPositionTooltip(e, tt);
}

function _mtOnMouseLeave(e){
  const tt = document.getElementById('pieTooltip');
  if(tt) tt.style.display = 'none';
  const c = e.currentTarget._mtCtx;
  if(c) _drawMTChart(e.currentTarget, c.data);
}

function _mtPositionTooltip(evt, tt){
  const W = tt.offsetWidth||160, H = tt.offsetHeight||70;
  let x = evt.clientX+14, y = evt.clientY - H/2;
  if(x+W > window.innerWidth-8)  x = evt.clientX - W - 14;
  if(y < 8)                      y = 8;
  if(y+H > window.innerHeight-8) y = window.innerHeight - H - 8;
  tt.style.left = x+'px'; tt.style.top = y+'px';
}

/* ── Plein écran ── */
function fsOpenMarcheTypeCanvas(canvas){
  if(!canvas || canvas.style.display==='none') return;
  const c = canvas._mtCtx;
  if(!c) return;
  openFullscreen('Marche type — '+(currentDir==='aller'?'↓ Aller':'↑ Retour'), body=>{
    Object.assign(body.style,{
      padding:'1rem 1.5rem', overflow:'hidden',
      alignItems:'stretch', justifyContent:'flex-start', flexDirection:'column'
    });
    const cvs = document.createElement('canvas');
    cvs.style.cssText = 'width:100%;flex:1;min-height:0;display:block;';
    body.appendChild(cvs);
    requestAnimationFrame(()=>_drawMTChart(cvs, c.data));
  });
}

/* ═══════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════ */
function _mtFmtSec(s){
  const m=Math.floor(s/60), sec=Math.round(s%60);
  return String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0');
}
function _mtNiceTicks(min,max,n){
  const range=max-min; if(range===0) return [min];
  const step=_mtNiceStep(range/n), start=Math.ceil(min/step)*step, ticks=[];
  for(let v=start;v<=max+step*0.001;v+=step) ticks.push(Math.round(v/step)*step);
  return ticks;
}
function _mtNiceStep(rough){
  const exp=Math.floor(Math.log10(rough)), frac=rough/Math.pow(10,exp);
  return (frac<1.5?1:frac<3.5?2:frac<7.5?5:10)*Math.pow(10,exp);
}
function _mtTimeTicks(tMin,tMax,n){
  const cands=[10,30,60,120,300,600,900,1800];
  const ideal=(tMax-tMin)/Math.max(n,1);
  let step=cands[cands.length-1];
  for(const c of cands){ if(c>=ideal*0.5){step=c;break;} }
  const start=Math.ceil(tMin/step)*step, ticks=[];
  for(let tv=start;tv<=tMax+0.001;tv+=step) ticks.push(tv);
  return ticks;
}
