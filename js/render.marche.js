/* ── render.marche.js v2 — Graphique interactif marche type (CSV) ── */
/* ═══════════════════════════════════════════════
   Mode normal           : X = PK (km),     Y gauche = T (mm:ss)  ← marche type FR
   Mode international    : X = T (mm:ss),   Y gauche = PK (km)    ← globe actif
═══════════════════════════════════════════════ */

let _mtWorldView = false;   // false = normal, true = international

/* ── Point d'entrée ── */
function renderMarcheType(){
  const canvas = document.getElementById('mtCanvas');
  const img    = document.getElementById('mtImg');
  const ph     = document.getElementById('mtPlaceholder');
  const lbl    = document.getElementById('mtSensLabel');
  if(!canvas) return;
  if(!LINE){ canvas.style.display = 'none'; return; }

  const d       = LINE.scenariosData ? LINE.scenariosData[currentSc] : null;
  const csvData = d ? (currentDir === 'aller' ? d.csvA : d.csvR) : null;

  if(csvData && csvData.t && csvData.t.length > 5){
    if(img) img.style.display = 'none';
    if(ph)  ph.style.display  = 'none';
    if(lbl) lbl.style.display = 'none';   // direction affichée dans le canvas
    canvas.style.display = 'block';
    requestAnimationFrame(() => _drawMTChart(canvas, csvData));
  } else {
    canvas.style.display = 'none';
    if(lbl) lbl.style.display = '';
    _mtFallback(img, ph);
  }
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
   DESSIN PRINCIPAL
═══════════════════════════════════════════════ */
function _drawMTChart(canvas, data){
  const worldView = _mtWorldView;
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.offsetWidth  || (canvas.parentElement && canvas.parentElement.offsetWidth) || 400;
  const H = canvas.offsetHeight || 200;
  if(W <= 0 || H <= 0) return;

  // Reset canvas (réinitialise aussi la transform)
  canvas.width  = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);   // toutes les coords ci-dessous sont en CSS pixels
  ctx.clearRect(0, 0, W, H);

  // ── Couleurs ──
  const cs     = getComputedStyle(document.body);
  const colBg  = cs.getPropertyValue('--bg3').trim()   || '#161b2e';
  const colBdr = cs.getPropertyValue('--border').trim() || '#2d3449';
  const colTxt = cs.getPropertyValue('--text3').trim()  || '#8898b0';
  const colTxt2= cs.getPropertyValue('--text2').trim()  || '#c5cfe0';
  const colSeg = (typeof BRAND !== 'undefined')
    ? (currentDir === 'aller' ? BRAND.aller : BRAND.retour)
    : (currentDir === 'aller' ? '#4a9eff' : '#f5a623');
  const colPri = (typeof BRAND !== 'undefined') ? BRAND.primaire1 : '#a06bff';

  // ── Layout : bande header + zone plot ──
  const HDR = 22;                                          // hauteur bande titre/boutons
  const ML = 58, MR = 62, MT = HDR + 10, MB = 34;
  const PW = W - ML - MR, PH = H - MT - MB;
  if(PW <= 0 || PH <= 0) return;

  // ── Données ──
  const { t, pk, v2 } = data;
  const tMin = t[0], tMax = t[t.length - 1];
  const pkMin = Math.min(...pk), pkMax = Math.max(...pk);
  const v2Max = Math.ceil(Math.max(...v2) / 10) * 10 || 60;
  const v2Min = 0;
  const dT = tMax - tMin || 1, dPK = pkMax - pkMin || 1, dV2 = v2Max - v2Min || 1;

  // ── Projections selon le mode ──
  let scX, scYL, scYR, xTicks, yLTicks, xFmt, yLFmt, xArr, yLArr, mainLabel;

  if(!worldView){
    // NORMAL : X = PK, Y gauche = T
    scX   = pkv => ML + (pkv - pkMin) / dPK * PW;
    scYL  = tv  => MT + PH - (tv  - tMin)  / dT  * PH;
    scYR  = vv  => MT + PH - (vv  - v2Min) / dV2 * PH;
    xTicks  = _mtNiceTicks(pkMin, pkMax, Math.max(3, Math.round(PW / 70)));
    yLTicks = _mtTimeTicks(tMin, tMax, Math.max(3, Math.round(PH / 35)));
    xFmt    = v => v.toFixed(v >= 10 ? 1 : v >= 1 ? 2 : 3) + ' km';
    yLFmt   = v => _mtFmtSec(v);
    xArr = pk; yLArr = t; mainLabel = 'T (mm:ss)';
  } else {
    // INTERNATIONAL : X = T, Y gauche = PK
    scX   = tv  => ML + (tv  - tMin)  / dT  * PW;
    scYL  = pkv => MT + PH - (pkv - pkMin) / dPK * PH;
    scYR  = vv  => MT + PH - (vv  - v2Min) / dV2 * PH;
    xTicks  = _mtTimeTicks(tMin, tMax, Math.max(3, Math.round(PW / 70)));
    yLTicks = _mtNiceTicks(pkMin, pkMax, Math.max(3, Math.round(PH / 35)));
    xFmt    = v => _mtFmtSec(v);
    yLFmt   = v => v.toFixed(v >= 10 ? 1 : v >= 1 ? 2 : 3);
    xArr = t; yLArr = pk; mainLabel = 'PK (km)';
  }
  const v2Label = 'V (km/h)';

  // ── Fond ──
  ctx.fillStyle = colBg; ctx.fillRect(0, 0, W, H);

  // ── Grilles horizontales ──
  ctx.save();
  ctx.strokeStyle = colBdr; ctx.lineWidth = 0.5; ctx.globalAlpha = 0.7;
  yLTicks.forEach(v => { const y = scYL(v); ctx.beginPath(); ctx.moveTo(ML, y); ctx.lineTo(ML + PW, y); ctx.stroke(); });
  ctx.restore();

  // ── Grilles verticales ──
  ctx.save();
  ctx.strokeStyle = colBdr; ctx.lineWidth = 0.5; ctx.globalAlpha = 0.7;
  xTicks.forEach(v => { const x = scX(v); ctx.beginPath(); ctx.moveTo(x, MT); ctx.lineTo(x, MT + PH); ctx.stroke(); });
  ctx.restore();

  // ── Courbe V2 — axe droit, arrière-plan ──
  ctx.save();
  ctx.strokeStyle = colPri; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.60;
  ctx.beginPath();
  xArr.forEach((xv, i) => { const x = scX(xv), y = scYR(v2[i]); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
  ctx.stroke();
  ctx.restore();

  // ── Courbe principale — aller ou retour ──
  ctx.save();
  ctx.strokeStyle = colSeg; ctx.lineWidth = 2.5;
  ctx.beginPath();
  xArr.forEach((xv, i) => { const x = scX(xv), y = scYL(yLArr[i]); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
  ctx.stroke();
  ctx.restore();

  // ── Cadre du plot ──
  ctx.save();
  ctx.strokeStyle = colBdr; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(ML, MT); ctx.lineTo(ML, MT + PH); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ML + PW, MT); ctx.lineTo(ML + PW, MT + PH); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ML, MT + PH); ctx.lineTo(ML + PW, MT + PH); ctx.stroke();
  ctx.restore();

  // ── Labels Y gauche ──
  ctx.save();
  ctx.fillStyle = colSeg; ctx.font = '500 8.5px Barlow Condensed, sans-serif';
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  yLTicks.forEach(v => { ctx.fillText(yLFmt(v), ML - 5, scYL(v)); });
  ctx.translate(11, MT + PH / 2); ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center'; ctx.font = '600 8px Barlow Condensed, sans-serif'; ctx.globalAlpha = 0.7;
  ctx.fillText(mainLabel, 0, 0);
  ctx.restore();

  // ── Labels Y droit (V2) ──
  ctx.save();
  ctx.fillStyle = colPri; ctx.font = '500 8.5px Barlow Condensed, sans-serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  _mtNiceTicks(v2Min, v2Max, 4).forEach(v => { if(v >= 0) ctx.fillText(v + '', ML + PW + 5, scYR(v)); });
  ctx.translate(W - 10, MT + PH / 2); ctx.rotate(Math.PI / 2);
  ctx.textAlign = 'center'; ctx.font = '600 8px Barlow Condensed, sans-serif'; ctx.globalAlpha = 0.7;
  ctx.fillText(v2Label, 0, 0);
  ctx.restore();

  // ── Labels X ──
  ctx.save();
  ctx.fillStyle = colTxt; ctx.font = '400 8.5px Barlow Condensed, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  xTicks.forEach(v => { ctx.fillText(xFmt(v), scX(v), MT + PH + 5); });
  ctx.restore();

  // ── Légende ──
  let lx = ML + 4;
  const legY = MT + PH + 24;
  ctx.save();
  ctx.font = '500 8px Barlow Condensed, sans-serif'; ctx.textBaseline = 'middle';
  [{ col: colSeg, label: mainLabel, lw: 2.5 },
   { col: colPri, label: v2Label,   lw: 1.5, a: 0.60 }].forEach(({ col, label, lw, a }) => {
    ctx.globalAlpha = a || 1; ctx.strokeStyle = col; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(lx, legY); ctx.lineTo(lx + 16, legY); ctx.stroke();
    ctx.globalAlpha = 1; ctx.fillStyle = col; ctx.textAlign = 'left';
    ctx.fillText(label, lx + 20, legY);
    lx += 84;
  });
  ctx.restore();

  // ── HEADER : titre + direction ──
  ctx.save();
  ctx.font = '700 9px Barlow Condensed, sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.fillStyle = colTxt2; ctx.fillText('MARCHE TYPE', 8, HDR / 2);
  const tw = ctx.measureText('MARCHE TYPE').width;
  ctx.font = '600 8.5px Barlow Condensed, sans-serif'; ctx.fillStyle = colSeg;
  ctx.fillText(' — ' + (currentDir === 'aller' ? '↓ Aller' : '↑ Retour'), 8 + tw, HDR / 2);
  ctx.restore();

  // Séparateur header
  ctx.save();
  ctx.strokeStyle = colBdr; ctx.lineWidth = 0.5; ctx.globalAlpha = 0.5;
  ctx.beginPath(); ctx.moveTo(0, HDR); ctx.lineTo(W, HDR); ctx.stroke();
  ctx.restore();

  // ── Boutons header ──
  const BS = 18, BGAP = 4, BPAD = 3;   // taille bouton, espace entre, padding bord
  const bFsX  = W - BPAD - BS;
  const bWldX = bFsX - BGAP - BS;
  const bY    = Math.round((HDR - BS) / 2);

  // Plein écran
  ctx.save();
  ctx.strokeStyle = colTxt; ctx.lineWidth = 1.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  _mtDrawFsIcon(ctx, bFsX + BS / 2, bY + BS / 2, 5.5);
  ctx.restore();

  // Globe / Vue internationale (actif = couleur primaire)
  ctx.save();
  if(worldView){
    ctx.fillStyle = _mtRgba(colPri, 0.16);
    ctx.beginPath(); ctx.arc(bWldX + BS / 2, bY + BS / 2, BS / 2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = colPri;
  } else {
    ctx.strokeStyle = colTxt;
  }
  ctx.lineWidth = 1.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  _mtDrawGlobe(ctx, bWldX + BS / 2, bY + BS / 2, 7);
  ctx.restore();

  // ── Stocker pour events souris ──
  canvas._mtCtx = {
    data, scX, scYL, scYR, xArr, yLArr,
    tMin, tMax, pkMin, pkMax, v2Min, v2Max,
    ML, MR, MT, MB, PW, PH, W, H,
    colSeg, colPri, colBdr, colTxt, worldView,
    btns: {
      world: { x: bWldX, y: bY, w: BS, h: BS },
      fs:    { x: bFsX,  y: bY, w: BS, h: BS },
    }
  };

  if(!canvas._mtBound){
    canvas.addEventListener('mousemove',  _mtOnMouseMove);
    canvas.addEventListener('mouseleave', _mtOnMouseLeave);
    canvas.addEventListener('click',      _mtOnClick);
    canvas._mtBound = true;
  }
}

/* ═══════════════════════════════════════════════
   EVENTS
═══════════════════════════════════════════════ */
function _mtOnMouseMove(e){
  const canvas = e.currentTarget;
  const c = canvas._mtCtx;
  if(!c) return;

  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  // Curseur
  const overBtn = c.btns && (_mtInRect(mx, my, c.btns.world) || _mtInRect(mx, my, c.btns.fs));
  canvas.style.cursor = overBtn ? 'pointer'
    : (mx >= c.ML && mx <= c.ML + c.PW && my >= c.MT && my <= c.MT + c.PH) ? 'crosshair'
    : 'default';

  if(overBtn || mx < c.ML || mx > c.ML + c.PW || my < c.MT || my > c.MT + c.PH) return;

  const { data, scX, scYL, scYR, xArr, yLArr,
          tMin, tMax, pkMin, pkMax,
          ML, MT, PW, PH, colSeg, colPri, colBdr, worldView } = c;

  // Index le plus proche en X
  const xRaw = !worldView
    ? pkMin + (mx - ML) / PW * (pkMax - pkMin)
    : tMin  + (mx - ML) / PW * (tMax  - tMin);
  const xRef = !worldView ? data.pk : data.t;
  let idx = 0, minD = Infinity;
  xRef.forEach((v, i) => { const d = Math.abs(v - xRaw); if(d < minD){ minD = d; idx = i; } });

  // Redessiner (ctx revient à scale(dpr) après _drawMTChart)
  _drawMTChart(canvas, data);
  const ctx = canvas.getContext('2d');
  ctx.save();
  // ⚠️ Ne pas rappeler ctx.scale() — déjà appliqué par _drawMTChart

  const x  = scX(xArr[idx]);
  const yL = scYL(yLArr[idx]);
  const yR = scYR(data.v2[idx]);

  // Crosshair vertical
  ctx.strokeStyle = (typeof isDark !== 'undefined' && isDark) ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
  ctx.beginPath(); ctx.moveTo(x, MT); ctx.lineTo(x, MT + PH); ctx.stroke();
  ctx.setLineDash([]);

  // Points sur les courbes (coordonnées logiques = CSS pixels)
  [[yL, colSeg], [yR, colPri]].forEach(([y, col]) => {
    ctx.fillStyle   = col;
    ctx.strokeStyle = _mtRgba('#000000', 0.40); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  });

  // ── Tooltip fond couleur segment ──
  const tipLines = [
    { text: _mtFmtSec(data.t[idx]) },
    { text: data.pk[idx].toFixed(3) + ' km' },
    { text: data.v2[idx].toFixed(1) + ' km/h', col: _mtRgba(colPri, 0.90) },
  ];
  const TP = 8, LH = 14, TW = 116, TH = TP * 2 + LH * tipLines.length;
  let tx = x + 14, ty = MT + 6;
  if(tx + TW > ML + PW - 2) tx = x - TW - 14;
  if(ty + TH > MT + PH)     ty = MT + PH - TH - 4;

  ctx.fillStyle   = _mtRgba(colSeg, 0.90);
  ctx.strokeStyle = colSeg; ctx.lineWidth = 1;
  ctx.beginPath(); _mtRoundRect(ctx, tx, ty, TW, TH, 5); ctx.fill(); ctx.stroke();

  tipLines.forEach(({ text, col }, i) => {
    ctx.fillStyle = col || 'rgba(255,255,255,0.95)';
    ctx.font = `${i === 0 ? 400 : 600} 9px Barlow Condensed, sans-serif`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(text, tx + TP, ty + TP + LH * i + LH * 0.5);
  });

  ctx.restore();
}

function _mtOnMouseLeave(e){
  const canvas = e.currentTarget;
  canvas.style.cursor = 'default';
  const c = canvas._mtCtx;
  if(c) _drawMTChart(canvas, c.data);
}

function _mtOnClick(e){
  const canvas = e.currentTarget;
  const c = canvas._mtCtx;
  if(!c || !c.btns) return;
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
  if(_mtInRect(mx, my, c.btns.world)){
    _mtWorldView = !_mtWorldView;
    renderMarcheType();
  } else if(_mtInRect(mx, my, c.btns.fs)){
    fsOpenMarcheType();
  }
}

/* ── Plein écran ── */
function fsOpenMarcheTypeCanvas(canvas){
  if(!canvas || canvas.style.display === 'none') return;
  const c = canvas._mtCtx;
  if(!c) return;
  openFullscreen('Marche type — ' + (currentDir === 'aller' ? '↓ Aller' : '↑ Retour'), body => {
    Object.assign(body.style, {
      padding:'1rem 1.5rem', overflow:'hidden',
      alignItems:'stretch', justifyContent:'flex-start', flexDirection:'column'
    });
    const cvs = document.createElement('canvas');
    cvs.style.cssText = 'width:100%;flex:1;min-height:0;display:block;';
    body.appendChild(cvs);
    requestAnimationFrame(() => _drawMTChart(cvs, c.data));
  });
}

/* ═══════════════════════════════════════════════
   ICÔNES
═══════════════════════════════════════════════ */
function _mtDrawGlobe(ctx, cx, cy, r){
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();   // cercle ext.
  ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r); ctx.stroke(); // méridien central
  ctx.beginPath(); ctx.ellipse(cx, cy, r * 0.50, r, 0, 0, Math.PI * 2); ctx.stroke(); // méridiens latéraux
  ctx.beginPath(); ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy); ctx.stroke();  // équateur
  [-0.58, 0.58].forEach(fy => {   // parallèles
    const py = cy + fy * r, prx = r * Math.sqrt(1 - fy * fy);
    ctx.beginPath(); ctx.ellipse(cx, py, prx, prx * 0.22, 0, 0, Math.PI * 2); ctx.stroke();
  });
}

function _mtDrawFsIcon(ctx, cx, cy, r){
  const d = r * 0.40, s = r * 0.58;
  [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([sx, sy]) => {
    const ox = cx + sx * d, oy = cy + sy * d;
    ctx.beginPath(); ctx.moveTo(ox + sx * s, oy); ctx.lineTo(ox, oy); ctx.lineTo(ox, oy + sy * s); ctx.stroke();
  });
}

/* ═══════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════ */
function _mtInRect(mx, my, r){ return mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h; }

function _mtRgba(hex, alpha){
  if(!hex || hex.length < 7) return `rgba(100,150,255,${alpha})`;
  return `rgba(${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)},${alpha})`;
}

function _mtFmtSec(s){
  const m = Math.floor(s / 60), sec = Math.round(s % 60);
  return String(m).padStart(2,'0') + ':' + String(sec).padStart(2,'0');
}

function _mtNiceTicks(min, max, n){
  const range = max - min;
  if(range === 0) return [min];
  const step  = _mtNiceStep(range / n);
  const start = Math.ceil(min / step) * step;
  const ticks = [];
  for(let v = start; v <= max + step * 0.001; v += step) ticks.push(Math.round(v / step) * step);
  return ticks;
}

function _mtNiceStep(rough){
  const exp  = Math.floor(Math.log10(rough));
  const frac = rough / Math.pow(10, exp);
  return (frac < 1.5 ? 1 : frac < 3.5 ? 2 : frac < 7.5 ? 5 : 10) * Math.pow(10, exp);
}

function _mtTimeTicks(tMin, tMax, n){
  const cands = [10, 30, 60, 120, 300, 600, 900, 1800];
  const ideal = (tMax - tMin) / Math.max(n, 1);
  let step = cands[cands.length - 1];
  for(const c of cands){ if(c >= ideal * 0.5){ step = c; break; } }
  const start = Math.ceil(tMin / step) * step, ticks = [];
  for(let tv = start; tv <= tMax + 0.001; tv += step) ticks.push(tv);
  return ticks;
}

function _mtRoundRect(ctx, x, y, w, h, r){
  if(ctx.roundRect){ ctx.roundRect(x, y, w, h, r); return; }
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
}
