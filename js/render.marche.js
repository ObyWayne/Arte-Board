/* ── render.marche.js — Graphique interactif marche type (CSV) ── */
/* ═══════════════════════════════════════════════
   Remplace l'image marche type par un graphique
   dual-axe interactif dessiné en Canvas 2D natif.
   Dépendances : core.js (BRAND, currentDir, currentSc, LINE)
═══════════════════════════════════════════════ */

/* ── Point d'entrée — appelé par updateMTImage() ── */
function renderMarcheType(){
  const canvas = document.getElementById('mtCanvas');
  const img    = document.getElementById('mtImg');
  const ph     = document.getElementById('mtPlaceholder');
  if(!canvas) return;

  if(!LINE){
    canvas.style.display = 'none';
    return;
  }

  const d       = LINE.scenariosData ? LINE.scenariosData[currentSc] : null;
  const csvData = d ? (currentDir === 'aller' ? d.csvA : d.csvR) : null;

  if(csvData && csvData.t && csvData.t.length > 5){
    if(img) img.style.display = 'none';
    if(ph)  ph.style.display  = 'none';
    canvas.style.display = 'block';
    // Léger délai pour laisser le layout calculer les dimensions
    requestAnimationFrame(() => _drawMTChart(canvas, csvData));
  } else {
    // Pas de CSV → fallback image/placeholder géré par updateMTImage standard
    canvas.style.display = 'none';
    _mtFallback(img, ph);
  }
}

function _mtFallback(img, ph){
  if(!LINE) return;
  const sc  = LINE.scenarios[currentSc];
  let src = '';
  if(sc && sc.type === 'SP'){
    const key = currentDir === 'aller' ? sc.mtA : sc.mtR;
    if(key) src = (typeof MT_IMAGES !== 'undefined') ? (MT_IMAGES['sc_'+key] || MT_IMAGES[key] || '') : '';
  }
  if(!src && typeof MT_IMAGES !== 'undefined') src = MT_IMAGES[currentDir] || '';
  if(img){
    if(src){ img.src = src; img.style.display = 'block'; if(ph) ph.style.display = 'none'; }
    else { img.style.display = 'none'; if(ph) ph.style.display = 'flex'; }
  }
}

/* ── Dessin principal ── */
function _drawMTChart(canvas, data){
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

  // ── Couleurs (CSS variables + BRAND) ──
  const cs     = getComputedStyle(document.documentElement);
  const colBg  = cs.getPropertyValue('--bg3').trim()  || '#161b2e';
  const colBdr = cs.getPropertyValue('--border').trim()|| '#2d3449';
  const colTxt = cs.getPropertyValue('--text3').trim() || '#8898b0';
  const colPK  = (typeof BRAND !== 'undefined')
    ? (currentDir === 'aller' ? BRAND.aller : BRAND.retour)
    : (currentDir === 'aller' ? '#4a9eff' : '#f5a623');
  const colV2  = (typeof BRAND !== 'undefined') ? BRAND.primaire1 : '#a06bff';

  // ── Marges ──
  const ML = 56, MR = 58, MT = 14, MB = 34;
  const PW = W - ML - MR;
  const PH = H - MT - MB;
  if(PW <= 0 || PH <= 0) return;

  // ── Domaines ──
  const tArr  = data.t,  pkArr = data.pk, v2Arr = data.v2;
  const tMin  = tArr[0],          tMax  = tArr[tArr.length - 1];
  const pkMin = Math.min(...pkArr), pkMax = Math.max(...pkArr);
  const v2Max = Math.ceil(Math.max(...v2Arr) / 10) * 10 || 60;
  const v2Min = 0;

  // Éviter division par zéro
  const dtPK = pkMax - pkMin || 1;
  const dtV2 = v2Max - v2Min || 1;
  const dtT  = tMax  - tMin  || 1;

  // ── Fonctions de projection ──
  const scX  = t  => ML + (t  - tMin)  / dtT  * PW;
  const scPK = pk => MT + PH - (pk - pkMin) / dtPK * PH;
  const scV2 = v  => MT + PH - (v  - v2Min) / dtV2 * PH;

  // ── Fond ──
  ctx.fillStyle = colBg;
  ctx.fillRect(0, 0, W, H);

  // ── Grilles horizontales (axe PK gauche) ──
  const pkTicks = _mtNiceTicks(pkMin, pkMax, 4);
  ctx.save();
  ctx.strokeStyle = colBdr; ctx.lineWidth = 0.5; ctx.globalAlpha = 0.8;
  pkTicks.forEach(v => {
    const y = scPK(v);
    ctx.beginPath(); ctx.moveTo(ML, y); ctx.lineTo(ML + PW, y); ctx.stroke();
  });
  ctx.restore();

  // ── Grilles verticales (axe T) ──
  const tTicks = _mtTimeTicks(tMin, tMax, Math.max(3, Math.round(PW / 60)));
  ctx.save();
  ctx.strokeStyle = colBdr; ctx.lineWidth = 0.5; ctx.globalAlpha = 0.8;
  tTicks.forEach(t => {
    const x = scX(t);
    ctx.beginPath(); ctx.moveTo(x, MT); ctx.lineTo(x, MT + PH); ctx.stroke();
  });
  ctx.restore();

  // ── Courbe V2 (vitesse) — en premier / arrière-plan ──
  ctx.save();
  ctx.strokeStyle = colV2; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.65;
  ctx.beginPath();
  tArr.forEach((t, i) => {
    const x = scX(t), y = scV2(v2Arr[i]);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.restore();

  // ── Courbe PK (trajectoire) — au-dessus ──
  ctx.save();
  ctx.strokeStyle = colPK; ctx.lineWidth = 2.5;
  ctx.beginPath();
  tArr.forEach((t, i) => {
    const x = scX(t), y = scPK(pkArr[i]);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.restore();

  // ── Axes (cadre de plot) ──
  ctx.save();
  ctx.strokeStyle = colBdr; ctx.lineWidth = 1;
  // Y gauche
  ctx.beginPath(); ctx.moveTo(ML, MT); ctx.lineTo(ML, MT + PH); ctx.stroke();
  // Y droit
  ctx.beginPath(); ctx.moveTo(ML + PW, MT); ctx.lineTo(ML + PW, MT + PH); ctx.stroke();
  // X bas
  ctx.beginPath(); ctx.moveTo(ML, MT + PH); ctx.lineTo(ML + PW, MT + PH); ctx.stroke();
  ctx.restore();

  // ── Labels Y gauche (PK en km) ──
  ctx.save();
  ctx.fillStyle = colPK;
  ctx.font = '500 8.5px Barlow Condensed, sans-serif';
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  pkTicks.forEach(v => {
    ctx.fillText(v.toFixed(v >= 1 ? 2 : 3) + ' km', ML - 5, scPK(v));
  });
  // Label axe
  ctx.save();
  ctx.translate(11, MT + PH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '600 8px Barlow Condensed, sans-serif';
  ctx.globalAlpha = 0.7;
  ctx.fillText('PK (km)', 0, 0);
  ctx.restore();
  ctx.restore();

  // ── Labels Y droit (V2 en km/h) ──
  ctx.save();
  ctx.fillStyle = colV2;
  ctx.font = '500 8.5px Barlow Condensed, sans-serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const v2Ticks = _mtNiceTicks(v2Min, v2Max, 4);
  v2Ticks.forEach(v => {
    if(v < 0) return;
    ctx.fillText(v + '', ML + PW + 5, scV2(v));
  });
  // Label axe
  ctx.save();
  ctx.translate(W - 10, MT + PH / 2);
  ctx.rotate(Math.PI / 2);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '600 8px Barlow Condensed, sans-serif';
  ctx.globalAlpha = 0.7;
  ctx.fillText('V (km/h)', 0, 0);
  ctx.restore();
  ctx.restore();

  // ── Labels X (T en mm:ss) ──
  ctx.save();
  ctx.fillStyle = colTxt;
  ctx.font = '400 8.5px Barlow Condensed, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  tTicks.forEach(t => {
    ctx.fillText(_mtFmtSec(t), scX(t), MT + PH + 5);
  });
  ctx.restore();

  // ── Légende compacte ──
  const legItems = [
    { col: colPK, label: 'PK (km)',   lw: 2.5 },
    { col: colV2, label: 'V (km/h)',  lw: 1.5, alpha: 0.65 },
  ];
  let lx = ML + 4;
  const legY = MT + PH + 24;
  ctx.save();
  ctx.font = '500 8px Barlow Condensed, sans-serif';
  ctx.textBaseline = 'middle';
  legItems.forEach(({ col, label, lw, alpha }) => {
    ctx.globalAlpha = alpha || 1;
    ctx.strokeStyle = col; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(lx, legY); ctx.lineTo(lx + 16, legY); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = col;
    ctx.textAlign = 'left';
    ctx.fillText(label, lx + 19, legY);
    lx += 72;
  });
  ctx.restore();

  // ── Stocker contexte pour l'interaction souris ──
  canvas._mtCtx = { data, scX, scPK, scV2, tMin, tMax, pkMin, pkMax, v2Min, v2Max,
                    ML, MR, MT, MB, PW, PH, W, H, colPK, colV2, colBdr, colTxt };

  if(!canvas._mtMouseBound){
    canvas.addEventListener('mousemove', _mtOnMouseMove);
    canvas.addEventListener('mouseleave', _mtOnMouseLeave);
    canvas._mtMouseBound = true;
  }
}

/* ── Interaction souris ── */
function _mtOnMouseMove(e){
  const canvas = e.currentTarget;
  const c = canvas._mtCtx;
  if(!c) return;

  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;

  if(mx < c.ML || mx > c.ML + c.PW) return;

  const { data, scX, scPK, scV2, tMin, tMax, ML, MT, PW, PH,
          colPK, colV2, colBdr, colTxt } = c;

  // Index le plus proche
  const tRaw = tMin + (mx - ML) / PW * (tMax - tMin);
  let idx = 0, minDist = Infinity;
  data.t.forEach((t, i) => { const d = Math.abs(t - tRaw); if(d < minDist){ minDist = d; idx = i; } });

  // Redessiner le graphique propre
  _drawMTChart(canvas, data);

  // Superposer le crosshair
  const dpr = window.devicePixelRatio || 1;
  const ctx = canvas.getContext('2d');
  ctx.save(); ctx.scale(dpr, dpr);

  const x   = scX(data.t[idx]);
  const yPK = scPK(data.pk[idx]);
  const yV2 = scV2(data.v2[idx]);

  // Ligne verticale pointillée
  ctx.strokeStyle = 'rgba(255,255,255,0.20)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath(); ctx.moveTo(x, MT); ctx.lineTo(x, MT + PH); ctx.stroke();
  ctx.setLineDash([]);

  // Points
  [{ y: yPK, col: colPK }, { y: yV2, col: colV2 }].forEach(({ y, col }) => {
    ctx.fillStyle = col;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
  });

  // Tooltip
  const lines = [
    { text: _mtFmtSec(data.t[idx]),          col: colTxt,  bold: false },
    { text: data.pk[idx].toFixed(3) + ' km', col: colPK,   bold: true  },
    { text: data.v2[idx].toFixed(1) + ' km/h', col: colV2, bold: true  },
  ];
  const tpad = 7, tlh = 14, tw = 108;
  const th   = tpad * 2 + tlh * lines.length;
  let   tx   = x + 12, ty = MT + 6;
  if(tx + tw > ML + PW - 4) tx = x - tw - 12;
  if(ty + th > MT + PH)     ty = MT + PH - th - 4;

  ctx.fillStyle   = 'rgba(8,12,26,0.92)';
  ctx.strokeStyle = colBdr; ctx.lineWidth = 1;
  ctx.beginPath();
  _mtRoundRect(ctx, tx, ty, tw, th, 4);
  ctx.fill(); ctx.stroke();

  lines.forEach(({ text, col, bold }, i) => {
    ctx.fillStyle = col;
    ctx.font = `${bold ? 600 : 400} 9px Barlow Condensed, sans-serif`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(text, tx + tpad, ty + tpad + tlh * i + tlh * 0.5);
  });

  ctx.restore();
}

function _mtOnMouseLeave(e){
  const canvas = e.currentTarget;
  const c = canvas._mtCtx;
  if(c) _drawMTChart(canvas, c.data);
}

/* ── Plein écran (appelé par fsOpenMarcheType dans parser.js) ── */
function fsOpenMarcheTypeCanvas(canvas){
  if(!canvas || canvas.style.display === 'none') return;
  const c = canvas._mtCtx;
  if(!c) return;
  const dir = currentDir === 'aller' ? '↓ Aller' : '↑ Retour';
  openFullscreen('Marche type — ' + dir, body => {
    Object.assign(body.style, { padding:'1.5rem', overflow:'hidden', alignItems:'stretch', justifyContent:'flex-start' });
    const wrap = document.createElement('div');
    wrap.style.cssText = 'width:100%;flex:1;min-height:0;';
    const cvs = document.createElement('canvas');
    cvs.style.cssText = 'width:100%;height:100%;display:block;';
    wrap.appendChild(cvs);
    body.appendChild(wrap);
    requestAnimationFrame(() => _drawMTChart(cvs, c.data));
  });
}

/* ── Helpers ── */
function _mtFmtSec(s){
  const m   = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return String(m).padStart(2,'0') + ':' + String(sec).padStart(2,'0');
}

function _mtNiceTicks(min, max, n){
  const range = max - min;
  if(range === 0) return [min];
  const step  = _mtNiceStep(range / n);
  const start = Math.ceil(min / step) * step;
  const ticks = [];
  for(let v = start; v <= max + step * 0.001; v += step)
    ticks.push(Math.round(v / step) * step);
  return ticks;
}

function _mtNiceStep(rough){
  const exp  = Math.floor(Math.log10(rough));
  const frac = rough / Math.pow(10, exp);
  const nice = frac < 1.5 ? 1 : frac < 3.5 ? 2 : frac < 7.5 ? 5 : 10;
  return nice * Math.pow(10, exp);
}

function _mtTimeTicks(tMin, tMax, n){
  const candidates = [10, 30, 60, 120, 300, 600, 900, 1800];
  const ideal = (tMax - tMin) / Math.max(n, 1);
  let step = candidates[candidates.length - 1];
  for(const c of candidates){ if(c >= ideal * 0.5){ step = c; break; } }
  const start = Math.ceil(tMin / step) * step;
  const ticks = [];
  for(let t = start; t <= tMax + 0.001; t += step) ticks.push(t);
  return ticks;
}

function _mtRoundRect(ctx, x, y, w, h, r){
  if(ctx.roundRect){ ctx.roundRect(x, y, w, h, r); return; }
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
