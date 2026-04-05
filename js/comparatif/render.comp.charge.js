/* ══════════════════════════════════════════════════════════════════════════════
   render.comp.charge.js — Serpent de Charge v3
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

/* ── Axe Y1 sticky ── */
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

/* ── Tooltip ── */
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
