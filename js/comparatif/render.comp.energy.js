/* ══════════════════════════════════════════════════════════════════════
   render.comp.energy.js — Cycle Energy Flow — SC1 vs SC2 — v3
   • Séparateurs de groupe centrés  ──── Aller ────
   • Textes agrandis
   • Plein écran (⛶)
   • Bouton groupe terminus (🏁)
══════════════════════════════════════════════════════════════════════ */

let _efSc1            = null;
let _efSc2            = null;
let _efGroupTerminus  = false; // true → un seul bloc par terminus

/* ══════════════════════════════════════════════════════
   Extraction des composantes pour un scénario
══════════════════════════════════════════════════════ */
function _computeEnergyFlowData(scIdx) {
  const saved = {
    stations: LINE.stations, inter: LINE.inter, retournement: LINE.retournement,
    tendu: LINE.tendu, tenduR: LINE.tenduR, detenteA: LINE.detenteA, detenteR: LINE.detenteR
  };
  try {
    if (LINE.scenariosData?.[scIdx]) {
      const d = LINE.scenariosData[scIdx];
      LINE.stations=d.stations; LINE.inter=d.inter; LINE.retournement=d.retournement;
      LINE.tendu=d.tendu; LINE.tenduR=d.tenduR; LINE.detenteA=d.detenteA; LINE.detenteR=d.detenteR;
    }
    const sc    = LINE.scenarios[scIdx];
    const keys  = Object.keys(LINE.tendu || {});
    const tArr  = (LINE.tendu  && (LINE.tendu[sc.id]  || LINE.tendu[keys[0]]))  || [];
    const tRArr = (LINE.tenduR && (LINE.tenduR[sc.id] || LINE.tenduR[keys[0]])) || [...tArr].reverse();
    const coeff = sc.coeff || 1.05;
    const dA    = LINE.detenteA?.length ? LINE.detenteA : tArr.map(v=>v*(coeff-1));
    const dR    = LINE.detenteR?.length ? LINE.detenteR : tRArr.map(v=>v*(coeff-1));
    const mA    = tArr.reduce((a,b)=>a+b, 0);
    const mR    = tRArr.reduce((a,b)=>a+b, 0);
    const dSA   = dA.reduce((a,b)=>a+b, 0);
    const dSR   = dR.reduce((a,b)=>a+b, 0);
    const N     = LINE.stations.length;
    const aA    = N>0 ? LINE.stations.reduce((a,s)=>a+s.arretA,0)/60-(LINE.stations[N-1].arretA||0)/60 : 0;
    const aR    = N>0 ? LINE.stations.reduce((a,s)=>a+s.arretR,0)/60-(LINE.stations[0].arretR||0)/60 : 0;
    const termSc = getTerminusForSc(scIdx);
    return { mA, mR, dSA, dSR, aA, aR,
             retA: termSc.retA, retR: termSc.retR,
             termNameA: termSc.termA, termNameR: termSc.termR, sc };
  } catch(e) {
    console.error('[_computeEnergyFlowData]', e);
    return null;
  } finally {
    Object.assign(LINE, saved);
  }
}

/* ══════════════════════════════════════════════════════
   Catalogue unifié des composantes
══════════════════════════════════════════════════════ */
function _buildEnergyUnifiedCatalog(data1, data2) {
  const colA    = BRAND.aller  || '#4a9eff';
  const colR    = BRAND.retour || '#f5a623';
  const termA1  = data1?.termNameA || 'Terminus A';
  const termR1  = data1?.termNameR || 'Terminus R';
  const catalog = [];

  /* ── Aller ── */
  catalog.push({ id:'mA',  label:isEN?'Running':'Marche',       group:'aller',  grpLabel:isEN?'Outbound':'Aller', color:colA,                    compressible:false });
  catalog.push({ id:'dSA', label:isEN?'Recovery':'Détente',     group:'aller',  grpLabel:null,                    color:_lightenHex(colA,0.30),  compressible:true  });
  catalog.push({ id:'aA',  label:isEN?'Dwell':'Arrêts station', group:'aller',  grpLabel:null,                    color:_lightenHex(colA,0.50),  compressible:false });

  /* ── Retour ── */
  catalog.push({ id:'mR',  label:isEN?'Running':'Marche',       group:'retour', grpLabel:isEN?'Inbound':'Retour', color:colR,                    compressible:false });
  catalog.push({ id:'dSR', label:isEN?'Recovery':'Détente',     group:'retour', grpLabel:null,                    color:_lightenHex(colR,0.30),  compressible:true  });
  catalog.push({ id:'aR',  label:isEN?'Dwell':'Arrêts station', group:'retour', grpLabel:null,                    color:_lightenHex(colR,0.50),  compressible:false });

  /* ── Terminus ── */
  if (_efGroupTerminus) {
    /* Mode condensé : un seul bloc par terminus */
    catalog.push({ id:'termA_total', label:termA1, group:'termA', grpLabel:termA1, color:_CAT_PALETTES[0][0], compressible:false });
    catalog.push({ id:'termR_total', label:termR1, group:'termR', grpLabel:termR1, color:_CAT_PALETTES[1][0], compressible:false });
  } else {
    /* Mode détaillé : params individuels */
    const seenA = new Set();
    [data1,data2].forEach(d => {
      d?.retA?.params?.filter(p=>p.sec>0).forEach(p => {
        const lbl = p.label||'Terminus A';
        if (!seenA.has(lbl)) {
          catalog.push({ id:`termA_${lbl}`, label:lbl, group:'termA',
            grpLabel: seenA.size===0 ? termA1 : null,
            color: _CAT_PALETTES[0][Math.min(seenA.size,3)],
            compressible: !!p.compressible });
          seenA.add(lbl);
        }
      });
    });
    const seenR = new Set();
    [data1,data2].forEach(d => {
      d?.retR?.params?.filter(p=>p.sec>0).forEach(p => {
        const lbl = p.label||'Terminus R';
        if (!seenR.has(lbl)) {
          catalog.push({ id:`termR_${lbl}`, label:lbl, group:'termR',
            grpLabel: seenR.size===0 ? termR1 : null,
            color: _CAT_PALETTES[1][Math.min(seenR.size,3)],
            compressible: !!p.compressible });
          seenR.add(lbl);
        }
      });
    });
  }
  return catalog;
}

function _secFor(id, data) {
  if (!data) return 0;
  const map = { mA:data.mA*60, mR:data.mR*60, dSA:data.dSA*60, dSR:data.dSR*60, aA:data.aA*60, aR:data.aR*60 };
  if (id in map) return map[id]||0;
  if (id==='termA_total') return data.retA?.totalSec||0;
  if (id==='termR_total') return data.retR?.totalSec||0;
  if (id.startsWith('termA_')) { const l=id.slice(6); return data.retA?.params?.find(p=>(p.label||'')===l)?.sec||0; }
  if (id.startsWith('termR_')) { const l=id.slice(6); return data.retR?.params?.find(p=>(p.label||'')===l)?.sec||0; }
  return 0;
}

/* ══════════════════════════════════════════════════════
   Rendu Canvas Sankey
══════════════════════════════════════════════════════ */
function _renderEnergySankey(canvas, catalog, data1, data2, scLabel1, scLabel2) {
  if (!canvas || !catalog.length) return { hitMap:[] };

  const isLight  = document.body.classList.contains('light-mode');
  const dpr      = window.devicePixelRatio || 1;
  const NODE_GAP = 8;
  const GRP_GAP  = 22;
  const groups   = [...new Set(catalog.map(n=>n.group))];
  const nGapSpace = (catalog.length-1)*NODE_GAP + (groups.length-1)*GRP_GAP;
  const PAD      = { t:52, b:20, l:165, r:155 };
  const CHART_H  = Math.max(400, catalog.length*34 + nGapSpace + 40);
  const H        = CHART_H + PAD.t + PAD.b;
  const W        = Math.max(560, canvas.parentElement?.clientWidth || 560);
  const NODE_W   = 18;
  const xLeft    = PAD.l;
  const xRight   = W - PAD.r;

  canvas.width        = Math.round(W * dpr);
  canvas.height       = Math.round(H * dpr);
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  const textCol = isLight ? 'rgba(50,60,90,.85)'  : 'rgba(185,195,225,.85)';
  const dimCol  = isLight ? 'rgba(80,90,120,.55)' : 'rgba(160,170,210,.55)';
  const goodHex = '#1a9e4a';  // vert foncé
  const badHex  = '#e8453c';  // rouge

  const totSec1 = catalog.reduce((a,n)=>a+_secFor(n.id,data1),0)||1;
  const totSec2 = catalog.reduce((a,n)=>a+_secFor(n.id,data2),0)||1;
  const drawH   = CHART_H - nGapSpace;

  /* ── Layout : calcul des Y ── */
  let cumL=0, cumR=0;
  let prevGroup=null;
  /* Séparateur du premier groupe — toujours affiché en haut */
  const firstLabel = catalog[0]?.grpLabel || catalog[0]?.group || '';
  const separators = firstLabel ? [{ y: PAD.t - 12, label: firstLabel }] : [];

  const nodes = catalog.map((n, i) => {
    if (prevGroup && n.group !== prevGroup) {
      /* Séparateur aligné sur le bas du scénario le plus long (max des deux côtés) */
      const maxCum = Math.max(cumL, cumR);
      separators.push({ y: PAD.t + maxCum + NODE_GAP/2, label: n.grpLabel || n.group });
      /* Réaligner les deux colonnes sur le même Y avant le prochain groupe */
      cumL = maxCum + GRP_GAP;
      cumR = maxCum + GRP_GAP;
    }
    prevGroup = n.group;

    const sec1 = _secFor(n.id, data1);
    const sec2 = _secFor(n.id, data2);
    const hL   = Math.max(3, sec1/totSec1 * drawH);
    const hR   = Math.max(3, sec2/totSec2 * drawH);
    const yL   = PAD.t + cumL;
    const yR   = PAD.t + cumR;

    cumL += hL + NODE_GAP;
    cumR += hR + NODE_GAP;

    return { ...n, sec1, sec2, hL, hR, yL, yR };
  });

  /* ── En-têtes scénarios (labels centrés au-dessus de chaque colonne) ── */
  ctx.font = '800 12px "Barlow Condensed",sans-serif';
  ctx.textBaseline = 'bottom';
  const sc1TotalStr = fmtHhMmSs(totSec1/60);
  const sc2TotalStr = fmtHhMmSs(totSec2/60);

  ctx.fillStyle = textCol; ctx.textAlign = 'center';
  ctx.fillText(scLabel1, xLeft + NODE_W/2, PAD.t - 20);
  ctx.fillText(scLabel2, xRight + NODE_W/2, PAD.t - 20);
  ctx.font = '700 11px "Barlow Condensed",sans-serif';
  ctx.fillStyle = dimCol;
  ctx.fillText(sc1TotalStr, xLeft + NODE_W/2, PAD.t - 6);
  ctx.fillText(sc2TotalStr, xRight + NODE_W/2, PAD.t - 6);
  ctx.textBaseline = 'alphabetic';

  /* ── Bandes bezier ── */
  const cpX = (xLeft + NODE_W + xRight) / 2;
  nodes.forEach(n => {
    if (n.sec1<=0 && n.sec2<=0) return;
    ctx.beginPath();
    ctx.moveTo(xLeft+NODE_W, n.yL);
    ctx.bezierCurveTo(cpX, n.yL, cpX, n.yR, xRight, n.yR);
    ctx.lineTo(xRight, n.yR+n.hR);
    ctx.bezierCurveTo(cpX, n.yR+n.hR, cpX, n.yL+n.hL, xLeft+NODE_W, n.yL+n.hL);
    ctx.closePath();
    ctx.fillStyle   = n.color;
    ctx.globalAlpha = 0.16;
    ctx.fill();
    ctx.globalAlpha = 1;
  });

  /* ── Noeuds gauche + droite ── */
  const _drawNode = (x, y, w, h, color) => {
    if (h < 1) return;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  nodes.forEach(n => {
    _drawNode(xLeft,  n.yL, NODE_W, n.hL, n.color);
    _drawNode(xRight, n.yR, NODE_W, n.hR, n.color);
  });

  /* ── Séparateurs de groupe CENTRÉS  ──── Aller ────  ── */
  separators.forEach(sep => {
    const label   = sep.label;
    const y       = sep.y;
    ctx.font = '700 10px "Barlow Condensed",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tw = ctx.measureText(label).width;
    const cx = W / 2;
    const lw = (W - PAD.l - PAD.r - NODE_W*2 - tw - 24) / 2;

    ctx.strokeStyle = dimCol; ctx.lineWidth = 0.8; ctx.setLineDash([4,3]);
    ctx.beginPath(); ctx.moveTo(xLeft+NODE_W+8, y); ctx.lineTo(cx-tw/2-8, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx+tw/2+8, y); ctx.lineTo(xRight-8, y); ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = dimCol;
    ctx.fillText(label, cx, y);
    ctx.textBaseline = 'alphabetic';
  });

  /* ── Labels gauche — une seule ligne : nom (gauche) | temps (proche du nœud) ── */
  nodes.forEach(n => {
    const midY  = n.yL + n.hL/2;
    const t1Str = n.sec1>0 ? fmtMmSs(n.sec1/60) : '—';

    /* Temps sc1 — collé au nœud, aligné à droite */
    ctx.fillStyle    = n.color;
    ctx.font         = '700 11px "Barlow Condensed",sans-serif';
    ctx.textAlign    = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(t1Str, xLeft - 6, midY);

    /* Nom — décalé à gauche du temps pour éviter le chevauchement */
    const timeW = ctx.measureText(t1Str).width;
    ctx.fillStyle = textCol;
    ctx.font      = '600 11px "Barlow Condensed",sans-serif';
    ctx.fillText(n.label, xLeft - 14 - timeW, midY);
    ctx.textBaseline = 'alphabetic';
  });

  /* ── Labels droite — temps sc2 (proche du nœud) + delta décalé ── */
  nodes.forEach(n => {
    const midY  = n.yR + n.hR/2;
    const t2Str = n.sec2>0 ? fmtMmSs(n.sec2/60) : '—';
    const delta = n.sec2 - n.sec1;
    const dAbs  = Math.abs(delta);
    const dStr  = dAbs>1 ? (delta>0 ? `▲ +${fmtMmSs(dAbs/60)}` : `▼ −${fmtMmSs(dAbs/60)}`) : null;
    const dCol  = delta>0 ? badHex : delta<0 ? goodHex : dimCol;

    /* Temps sc2 — collé au nœud */
    ctx.fillStyle    = n.color;
    ctx.font         = '700 11px "Barlow Condensed",sans-serif';
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(t2Str, xRight+NODE_W+6, midY);

    /* Delta — décalé après le temps */
    if (dStr) {
      const timeW = ctx.measureText(t2Str).width;
      ctx.fillStyle = dCol;
      ctx.font      = '700 10px "Barlow Condensed",sans-serif';
      ctx.fillText(dStr, xRight+NODE_W+14+timeW, midY);
    }
    ctx.textBaseline = 'alphabetic';
  });

  /* ── Hit map ── */
  const hitMap = nodes.map(n => ({
    ...n, totSec1, totSec2,
    x: xLeft, y: Math.min(n.yL, n.yR) - 2,
    w: xRight + NODE_W - xLeft,
    h: Math.max(n.hL, n.hR) + Math.abs(n.yL-n.yR) + 4,
  }));

  return { hitMap };
}

/* ══════════════════════════════════════════════════════
   Tooltip
══════════════════════════════════════════════════════ */
function _getEnergyTooltip() {
  let t = document.getElementById('_energyTooltip');
  if (!t) {
    t = document.createElement('div');
    t.id = '_energyTooltip';
    t.style.cssText = [
      'position:fixed;z-index:9999;pointer-events:none;display:none',
      'background:var(--bg2);border:1px solid var(--border)',
      'border-radius:8px;padding:10px 14px;min-width:210px',
      'font-family:"Barlow Condensed",sans-serif',
      'box-shadow:0 4px 18px rgba(0,0,0,.30)',
    ].join(';');
    document.body.appendChild(t);
  }
  return t;
}

function _showEnergyTooltip(e, n, scLabel1, scLabel2) {
  const t    = _getEnergyTooltip();
  const pct1 = Math.round(n.sec1/n.totSec1*100);
  const pct2 = Math.round(n.sec2/n.totSec2*100);
  const delta = n.sec2 - n.sec1;
  const dAbs  = Math.abs(delta);
  const dStr  = dAbs>1 ? (delta>0 ? `+${fmtMmSs(dAbs/60)} ▲` : `−${fmtMmSs(dAbs/60)} ▼`) : '=';
  const dCol  = delta>0 ? '#e8453c' : delta<0 ? '#1a9e4a' : 'var(--text3)';
  const t1Str = n.sec1>0 ? fmtMmSs(n.sec1/60) : '—';
  const t2Str = n.sec2>0 ? fmtMmSs(n.sec2/60) : '—';

  t.innerHTML = `
    <div style="text-align:center;font-size:.8rem;font-weight:800;color:var(--text);
      border-bottom:1px solid var(--border);padding-bottom:7px;margin-bottom:8px;">
      ${n.label}
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:3px;">
      <span style="font-size:1.05rem;font-weight:800;color:var(--text);">${t1Str}</span>
      <span style="color:${dCol};font-weight:800;font-size:.85rem;">${dStr}</span>
      <span style="font-size:1.05rem;font-weight:800;color:var(--text);">${t2Str}</span>
    </div>
    <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
      <span style="font-size:9px;color:var(--text3);">${scLabel1}</span>
      <span style="font-size:9px;color:var(--text3);">${scLabel2}</span>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;
      border-top:1px solid var(--border);padding-top:7px;">
      <div>
        <div style="height:3px;width:${Math.min(pct1,100)}px;max-width:70px;background:${n.color};border-radius:2px;margin-bottom:2px;"></div>
        <span style="font-size:9px;color:var(--text3);">${pct1}% ${isEN?'of cycle':'du cycle'}</span>
      </div>
      <div style="text-align:right;">
        <div style="height:3px;width:${Math.min(pct2,100)}px;max-width:70px;background:${n.color};border-radius:2px;margin-bottom:2px;margin-left:auto;"></div>
        <span style="font-size:9px;color:var(--text3);">${pct2}% ${isEN?'of cycle':'du cycle'}</span>
      </div>
    </div>
    ${n.compressible?`<div style="font-size:9px;color:var(--text3);margin-top:5px;font-style:italic;text-align:center;">⏹ ${isEN?'Adjustable':'Temps ajustable'}</div>`:''}`;

  t.style.display = 'block';
  t.style.left    = (e.clientX+16)+'px';
  t.style.top     = (e.clientY-56)+'px';
}

function _hideEnergyTooltip() {
  const t = document.getElementById('_energyTooltip');
  if (t) t.style.display = 'none';
}

/* ══════════════════════════════════════════════════════
   Sélecteurs scénarios
══════════════════════════════════════════════════════ */
function _buildEfScPicker(radioName, nominals, activeSc, onchangeFn) {
  return nominals.map(k =>
    `<label class="col-picker-item" style="${k.scIdx===activeSc?'font-weight:800;color:var(--text);':''}">
      <input type="radio" name="${radioName}" value="${k.scIdx}"
             ${k.scIdx===activeSc?'checked':''}
             onchange="${onchangeFn}(${k.scIdx})">
      ${k.sc.label}
    </label>`
  ).join('');
}

function _efPickSc1(scIdx) { _efSc1=scIdx; renderEnergyFlow(window._lastEnergyAll||[]); }
function _efPickSc2(scIdx) { _efSc2=scIdx; renderEnergyFlow(window._lastEnergyAll||[]); }

function toggleEfGroupTerminus() {
  _efGroupTerminus = !_efGroupTerminus;
  const btn = document.getElementById('efGroupTermBtn');
  if (btn) {
    btn.style.background   = _efGroupTerminus ? 'rgba(var(--purple-rgb),.18)' : '';
    btn.style.borderColor  = _efGroupTerminus ? 'rgba(var(--purple-rgb),.6)'  : '';
    btn.style.color        = _efGroupTerminus ? 'var(--purple)' : '';
  }
  renderEnergyFlow(window._lastEnergyAll||[]);
}

function _refreshEnergyFlow() {
  const canvas = document.getElementById('energyCanvas');
  if (!canvas) return;
  _renderEnergyCanvas(canvas, window._lastEnergyAll || []);
}

/* ── Rendu canvas (factorisé pour plein écran) ── */
function _renderEnergyCanvas(canvas, all) {
  const nominals = all.filter(k => (k.sc.type||'NOMINAL').toUpperCase()==='NOMINAL');

  if (nominals.length < 2) {
    canvas.style.width  = '400px'; canvas.style.height = '80px';
    const dpr = window.devicePixelRatio||1;
    canvas.width  = 400*dpr; canvas.height = 80*dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr); ctx.clearRect(0,0,400,80);
    ctx.fillStyle = 'rgba(160,170,210,.4)'; ctx.font='600 11px "Barlow Condensed",sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(isEN?'Need at least 2 scenarios':'Il faut au moins 2 scénarios nominaux', 200, 40);
    return;
  }

  if (_efSc1===null||!nominals.find(k=>k.scIdx===_efSc1)) _efSc1=nominals[0].scIdx;
  if (_efSc2===null||!nominals.find(k=>k.scIdx===_efSc2)) _efSc2=nominals[Math.min(1,nominals.length-1)].scIdx;

  const d1 = _computeEnergyFlowData(_efSc1);
  const d2 = _computeEnergyFlowData(_efSc2);
  if (!d1||!d2) return;

  const catalog = _buildEnergyUnifiedCatalog(d1, d2);
  const { hitMap } = _renderEnergySankey(canvas, catalog, d1, d2, d1.sc.label, d2.sc.label);

  canvas.onmousemove = (e) => {
    const rect = canvas.getBoundingClientRect();
    const W  = parseFloat(canvas.style.width);
    const H  = parseFloat(canvas.style.height);
    const mx = (e.clientX-rect.left)*(W/rect.width);
    const my = (e.clientY-rect.top) *(H/rect.height);
    const hit = hitMap
      .filter(h => mx>=h.x&&mx<=h.x+h.w&&my>=h.y&&my<=h.y+h.h)
      .sort((a,b) => Math.abs((a.yL+a.hL/2)-my)-Math.abs((b.yL+b.hL/2)-my))[0];
    if (hit) _showEnergyTooltip(e, hit, d1.sc.label, d2.sc.label);
    else     _hideEnergyTooltip();
  };
  canvas.onmouseleave = () => _hideEnergyTooltip();
}

/* ── Plein écran ── */
function fsOpenEnergyFlow() {
  if (!LINE) return;
  openFullscreen(document.getElementById('energyFlowTitle')?.textContent || 'Flow', body => {
    Object.assign(body.style, { overflow:'auto', alignItems:'flex-start', padding:'1rem' });
    const wrap   = document.createElement('div');
    wrap.style.cssText = 'width:calc(100vw - 2rem);';
    const canvas = document.createElement('canvas');
    canvas.style.display = 'block';
    wrap.appendChild(canvas);
    body.appendChild(wrap);
    requestAnimationFrame(() => {
      const orig = document.getElementById('energyCanvas');
      if (orig) orig.id = '_efCanvasBak';
      canvas.id = 'energyCanvas';
      _renderEnergyCanvas(canvas, window._lastEnergyAll || []);
      canvas.id = '_efCanvasFs';
      const bak = document.getElementById('_efCanvasBak');
      if (bak) bak.id = 'energyCanvas';
    });
  });
}

/* ══════════════════════════════════════════════════════
   RENDU PRINCIPAL
══════════════════════════════════════════════════════ */
function renderEnergyFlow(all) {
  const el = document.getElementById('energyFlowContent');
  if (!el) return;
  window._lastEnergyAll = all;

  const nominals = all.filter(k=>(k.sc.type||'NOMINAL').toUpperCase()==='NOMINAL');
  if (!nominals.length||!LINE) {
    el.innerHTML='<div style="color:var(--text3);font-size:.6rem;padding:.5rem;text-align:center;">—</div>';
    return;
  }

  if (_efSc1===null||!nominals.find(k=>k.scIdx===_efSc1)) _efSc1=nominals[0].scIdx;
  if (_efSc2===null||!nominals.find(k=>k.scIdx===_efSc2)) _efSc2=nominals[Math.min(1,nominals.length-1)].scIdx;

  const sc1Label = nominals.find(k=>k.scIdx===_efSc1)?.sc.label || '?';
  const sc2Label = nominals.find(k=>k.scIdx===_efSc2)?.sc.label || '?';
  const sc1Items = _buildEfScPicker('_ef_sc1', nominals, _efSc1, '_efPickSc1');
  const sc2Items = _buildEfScPicker('_ef_sc2', nominals, _efSc2, '_efPickSc2');

  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap;
      padding:.3rem .4rem;border-bottom:1px solid var(--border);margin-bottom:.45rem;">
      <span style="font-size:.6rem;font-weight:700;color:var(--text3);white-space:nowrap;">
        ${isEN?'Compare':'Comparer'} :
      </span>
      <div class="col-picker-wrap">
        <button class="col-picker-btn" onclick="_toggleTermPicker(event,'_efPick1')">
          ← ${sc1Label} ▾
        </button>
        <div class="col-picker-dropdown" id="_efPick1">${sc1Items}</div>
      </div>
      <span style="font-size:.65rem;color:var(--text3);">vs</span>
      <div class="col-picker-wrap">
        <button class="col-picker-btn" onclick="_toggleTermPicker(event,'_efPick2')">
          ${sc2Label} → ▾
        </button>
        <div class="col-picker-dropdown" id="_efPick2">${sc2Items}</div>
      </div>
    </div>
    <div style="overflow-x:auto;overflow-y:hidden;
      scrollbar-width:thin;scrollbar-color:var(--border2) transparent;">
      <canvas id="energyCanvas" style="display:block;"></canvas>
    </div>`;

  const canvas = document.getElementById('energyCanvas');
  requestAnimationFrame(() => _renderEnergyCanvas(canvas, all));
}
