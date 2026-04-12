/* ══════════════════════════════════════════════════════════════════════
   render.comp.terminus.js — Comparaison terminus — Canvas 3D stacked v3
   • Tabs par terminus
   • Graphique 3D stacked Canvas
   • Hover tooltip : nom terminus, temps total, catégorie survolée
   • Hachuré = compressible, Plein = incompressible
══════════════════════════════════════════════════════════════════════ */

/* ── État ── */
let _termCmpScFilter = null;
let TERM_CATEGORIES  = [];
let _activeTerminus  = null;

/* ── Palettes ── */
const _CAT_PALETTES = [
  ['#3b82f6','#60a5fa','#93c5fd','#bfdbfe'],
  ['#10b981','#34d399','#6ee7b7','#a7f3d0'],
  ['#f59e0b','#fbbf24','#fcd34d','#fde68a'],
  ['#8b5cf6','#a78bfa','#c4b5fd','#ddd6fe'],
  ['#ef4444','#f87171','#fca5a5','#fecaca'],
  ['#06b6d4','#22d3ee','#67e8f9','#a5f3fc'],
  ['#ec4899','#f472b6','#f9a8d4','#fbcfe8'],
  ['#84cc16','#a3e635','#bef264','#d9f99d'],
];
const _CAT_EMOJIS = ['🚶','🔧','⏸','🚌','🔄','🏁','⚡','🛤️'];

/* ── Constantes 3D ── */
const _3D = { DX: 18, DY: -9, BAR_W: 52, GAP: 28 };

/* ══════════════════════════════════════════════════════
   Utilitaires couleur
══════════════════════════════════════════════════════ */
function _darkenHex(hex, f) {
  const n = parseInt((hex||'#888').replace('#',''), 16);
  const r = Math.max(0, ((n>>16)&0xff) - Math.round(((n>>16)&0xff) * f));
  const g = Math.max(0, ((n>>8) &0xff) - Math.round(((n>>8) &0xff) * f));
  const b = Math.max(0, ( n     &0xff) - Math.round(( n     &0xff) * f));
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}
/* _lightenHex définie dans render_comp_utils.js */

/* ── Pattern hachuré ── */
function _hatchPattern(ctx, col) {
  const size = 7;
  const pc   = document.createElement('canvas');
  pc.width   = size; pc.height = size;
  const px   = pc.getContext('2d');
  px.fillStyle = col + '33';
  px.fillRect(0, 0, size, size);
  px.strokeStyle = col;
  px.lineWidth   = 1.4;
  px.beginPath();
  px.moveTo(0, size);        px.lineTo(size, 0);
  px.moveTo(-1, 1);          px.lineTo(1, -1);
  px.moveTo(size-1, size+1); px.lineTo(size+1, size-1);
  px.stroke();
  return ctx.createPattern(pc, 'repeat');
}

/* ══════════════════════════════════════════════════════
   Dessin d'un segment 3D
══════════════════════════════════════════════════════ */
function _draw3DSegment(ctx, x, yTop, barW, segH, col, compressible, showTop) {
  if (segH <= 0.5) return;
  const { DX, DY } = _3D;
  const darker  = _darkenHex(col, 0.28);
  const lighter = _lightenHex(col, 0.25);

  /* Face avant */
  if (compressible) {
    ctx.save();
    ctx.fillStyle = _hatchPattern(ctx, col);
    ctx.fillRect(x, yTop, barW, segH);
    ctx.restore();
    ctx.strokeStyle = col;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, yTop, barW, segH);
  } else {
    ctx.fillStyle = col;
    ctx.fillRect(x, yTop, barW, segH);
    ctx.strokeStyle = _darkenHex(col, 0.15);
    ctx.lineWidth = 0.5;
    ctx.strokeRect(x, yTop, barW, segH);
  }

  /* Face droite */
  ctx.beginPath();
  ctx.moveTo(x + barW,      yTop);
  ctx.lineTo(x + barW + DX, yTop + DY);
  ctx.lineTo(x + barW + DX, yTop + DY + segH);
  ctx.lineTo(x + barW,      yTop + segH);
  ctx.closePath();
  if (compressible) {
    ctx.save();
    ctx.clip();
    ctx.fillStyle = _hatchPattern(ctx, darker);
    ctx.fillRect(x + barW - 1, yTop + DY - 1, DX + 2, segH + 2);
    ctx.restore();
    ctx.strokeStyle = darker; ctx.lineWidth = 0.5; ctx.stroke();
  } else {
    ctx.fillStyle = darker; ctx.fill();
  }

  /* Face du dessus — toujours visible sur chaque segment */
  ctx.beginPath();
  ctx.moveTo(x,            yTop);
  ctx.lineTo(x + barW,     yTop);
  ctx.lineTo(x + barW + DX, yTop + DY);
  ctx.lineTo(x + DX,       yTop + DY);
  ctx.closePath();
  if (compressible) {
    ctx.save();
    ctx.clip();
    ctx.fillStyle = _hatchPattern(ctx, lighter);
    ctx.fillRect(x - 1, yTop + DY - 1, barW + DX + 2, Math.abs(DY) + 2);
    ctx.restore();
    ctx.strokeStyle = lighter; ctx.lineWidth = 0.5; ctx.stroke();
  } else {
    ctx.fillStyle = lighter; ctx.fill();
  }
}

/* ══════════════════════════════════════════════════════
   Collecte données terminus
══════════════════════════════════════════════════════ */
function _getScTermData(all) {
  const saved = {
    stations: LINE.stations, inter: LINE.inter, retournement: LINE.retournement,
    tendu: LINE.tendu, tenduR: LINE.tenduR, detenteA: LINE.detenteA, detenteR: LINE.detenteR
  };
  const result = [];
  all.forEach(k => {
    try {
      if (LINE.scenariosData?.[k.scIdx]) {
        const d = LINE.scenariosData[k.scIdx];
        LINE.stations=d.stations; LINE.inter=d.inter; LINE.retournement=d.retournement;
        LINE.tendu=d.tendu; LINE.tenduR=d.tenduR; LINE.detenteA=d.detenteA; LINE.detenteR=d.detenteR;
      }
      const tsc = getTerminusForSc(k.scIdx);
      result.push({ sc:k.sc, scIdx:k.scIdx, termA:tsc.termA, retA:tsc.retA, termR:tsc.termR, retR:tsc.retR });
    } catch(e) {
      console.warn('[_getScTermData] skip', k.scIdx, e.message);
    }
  });
  Object.assign(LINE, saved);
  return result;
}

/* ══════════════════════════════════════════════════════
   Catalogue catégories / sous-catégories unifié
══════════════════════════════════════════════════════ */
function _buildCatCatalog(scData, termName) {
  const catMap   = new Map();
  const catOrder = TERM_CATEGORIES.length ? [...TERM_CATEGORIES] : [];

  scData.forEach(d => {
    const ret = (d.termA === termName) ? d.retA : (d.termR === termName) ? d.retR : null;
    if (!ret?.params) return;
    ret.params.forEach(p => {
      const cat   = (p.categorie||p.occ||p.label||'Autre').trim() || 'Autre';
      const label = (p.label||'').trim() || 'Autre';
      if (!catMap.has(cat)) {
        let palIdx = catOrder.indexOf(cat);
        if (palIdx < 0) palIdx = catMap.size;
        catMap.set(cat, { palIdx: palIdx % _CAT_PALETTES.length, subs: new Map() });
      }
      const entry = catMap.get(cat);
      if (!entry.subs.has(label)) entry.subs.set(label, entry.subs.size);
    });
  });

  const ordered = [];
  catOrder.forEach(n => { if (catMap.has(n)) ordered.push([n, catMap.get(n)]); });
  catMap.forEach((v, n) => { if (!ordered.find(([k]) => k===n)) ordered.push([n, v]); });
  return ordered;
}

function _subColor(catalog, catName, subLabel) {
  const entry = catalog.find(([n]) => n===catName)?.[1];
  if (!entry) return '#888';
  const pal    = _CAT_PALETTES[entry.palIdx];
  const subIdx = entry.subs.get(subLabel) ?? 0;
  return pal[Math.min(subIdx, pal.length-1)];
}

/* ══════════════════════════════════════════════════════
   Tooltip hover
══════════════════════════════════════════════════════ */
function _getTermTooltip() {
  let t = document.getElementById('_termTooltip');
  if (!t) {
    t = document.createElement('div');
    t.id = '_termTooltip';
    t.style.cssText = [
      'position:fixed;z-index:9999;pointer-events:none;display:none',
      'background:var(--bg2);border:1px solid var(--border)',
      'border-radius:8px;padding:10px 13px;min-width:190px',
      'font-family:"Barlow Condensed",sans-serif',
      'box-shadow:0 4px 18px rgba(0,0,0,.30)',
    ].join(';');
    document.body.appendChild(t);
  }
  return t;
}

function _showTermTooltip(e, hit, termName) {
  const t = _getTermTooltip();
  const compressLabel = isEN ? '⏹ Adjustable (compressible)' : '⏹ Temps ajustable (compressible)';

  t.innerHTML = `
    <!-- En-tête : terminus + total centré -->
    <div style="text-align:center;padding-bottom:7px;margin-bottom:7px;border-bottom:1px solid var(--border);">
      <div style="font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;
        color:var(--text3);margin-bottom:3px;">${termName}</div>
      <div style="font-size:1rem;font-weight:800;color:var(--text);font-family:'Barlow Condensed',sans-serif;">
        ${fmtMmSs(hit.totalSec / 60)}
      </div>
      <div style="font-size:8.5px;color:var(--text3);">${isEN ? 'Total' : 'Temps total'}</div>
    </div>
    <!-- Détail segment survolé -->
    <div style="display:flex;align-items:flex-start;gap:7px;">
      <div style="width:10px;height:10px;border-radius:2px;background:${hit.col};flex-shrink:0;margin-top:2px;
        ${hit.compressible ? 'outline:1.5px dashed '+hit.col+';outline-offset:1px;' : ''}"></div>
      <div>
        <div style="font-size:8.5px;font-weight:700;color:var(--text3);text-transform:uppercase;
          letter-spacing:.07em;margin-bottom:2px;">${hit.catName}</div>
        <div style="font-size:.72rem;font-weight:700;color:var(--text);">${hit.label}</div>
        <div style="font-size:.9rem;font-weight:800;color:var(--text);margin-top:2px;">${fmtMmSs(hit.sec / 60)}</div>
        ${hit.compressible
          ? `<div style="font-size:8px;color:var(--text3);margin-top:3px;font-style:italic;">${compressLabel}</div>`
          : ''}
      </div>
    </div>`;

  t.style.display = 'block';
  t.style.left    = (e.clientX + 16) + 'px';
  t.style.top     = (e.clientY - 32) + 'px';
}

function _hideTermTooltip() {
  const t = document.getElementById('_termTooltip');
  if (t) t.style.display = 'none';
}

/* ══════════════════════════════════════════════════════
   Rendu du graphique 3D
══════════════════════════════════════════════════════ */
function _renderTerminus3DChart(container, scData, termName, catalog) {
  container.innerHTML = '';

  const { DX, DY, BAR_W, GAP } = _3D;
  const N       = scData.length;
  const PAD     = { l:65, r:30+DX, t:20-DY, b:72 };
  const CHART_H = 280;
  const W       = PAD.l + N * (BAR_W + DX + GAP) - GAP + PAD.r;
  const H       = PAD.t + CHART_H + PAD.b;

  const dpr    = window.devicePixelRatio || 1;
  const canvas = document.createElement('canvas');
  canvas.width        = Math.round(W * dpr);
  canvas.height       = Math.round(H * dpr);
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';
  canvas.style.display = 'block';

  const ctx     = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  const isLight = document.body.classList.contains('light-mode');
  const textCol = isLight ? 'rgba(50,60,90,.8)'   : 'rgba(180,190,220,.8)';
  const gridCol = isLight ? 'rgba(80,90,120,.10)'  : 'rgba(160,170,210,.10)';

  /* Données par scénario */
  const scReady = scData.map(d => {
    const ret = (d.termA === termName) ? d.retA : (d.termR === termName) ? d.retR : null;
    if (!ret?.params) return { sc:d.sc, totalSec:0, segments:[] };
    const segs = [];
    catalog.forEach(([catName]) => {
      ret.params
        .filter(p => ((p.categorie||p.occ||p.label||'Autre').trim()||'Autre') === catName && p.sec > 0)
        .forEach(p => segs.push({
          sec:          p.sec,
          col:          _subColor(catalog, catName, (p.label||'').trim()||'Autre'),
          compressible: !!p.compressible,
          catName,
          label:        p.label || catName,
        }));
    });
    return { sc:d.sc, totalSec:ret.totalSec||0, segments:segs };
  });

  const maxSec    = Math.max(...scReady.map(d => d.totalSec), 1);
  const rawStep   = maxSec / 5;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const yStep     = Math.ceil(rawStep / magnitude) * magnitude;
  const yMax      = yStep * Math.ceil(maxSec / yStep);
  const py        = sec => PAD.t + CHART_H - (sec / yMax) * CHART_H;

  /* Grille */
  for (let s = 0; s <= yMax; s += yStep) {
    const y = py(s);
    ctx.strokeStyle = gridCol; ctx.lineWidth = 0.8; ctx.setLineDash([4,3]);
    ctx.beginPath(); ctx.moveTo(PAD.l, y); ctx.lineTo(W - PAD.r + DX, y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = textCol; ctx.font = '600 9px "Barlow Condensed",sans-serif';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(fmtMmSs(s/60), PAD.l - 5, y);
  }
  ctx.textBaseline = 'alphabetic';

  /* Barres + hitMap pour le hover */
  const hitMap = [];

  scReady.forEach((d, si) => {
    const xBase = PAD.l + si * (BAR_W + DX + GAP);
    let cumSec  = 0;
    const nSegs = d.segments.length;

    d.segments.forEach((seg, segIdx) => {
      const yBot  = py(cumSec);
      const yTop  = py(cumSec + seg.sec);
      const segH  = yBot - yTop;
      const isTop = segIdx === nSegs - 1;
      _draw3DSegment(ctx, xBase, yTop, BAR_W, segH, seg.col, seg.compressible, isTop);

      /* Enregistrer pour hit-testing */
      hitMap.push({ si, x:xBase, yTop, barW:BAR_W, segH, ...seg, totalSec:d.totalSec });
      cumSec += seg.sec;
    });

    /* Valeur totale au sommet */
    if (d.totalSec > 0) {
      ctx.fillStyle = textCol; ctx.font = '700 9px "Barlow Condensed",sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(fmtMmSs(d.totalSec/60), xBase + BAR_W/2, py(d.totalSec) + DY - 2);
      ctx.textBaseline = 'alphabetic';
    }

    /* Label scénario incliné */
    ctx.save();
    ctx.translate(xBase + BAR_W/2, PAD.t + CHART_H + 10);
    ctx.rotate(-Math.PI / 5);
    ctx.fillStyle = textCol; ctx.font = '700 9.5px "Barlow Condensed",sans-serif';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(d.sc.label, 0, 0);
    ctx.restore();
  });

  /* Axe de base */
  ctx.strokeStyle = isLight ? 'rgba(80,90,120,.25)' : 'rgba(160,170,210,.30)';
  ctx.lineWidth = 1; ctx.beginPath();
  ctx.moveTo(PAD.l, py(0)); ctx.lineTo(W - PAD.r + DX, py(0)); ctx.stroke();

  /* Interactions hover */
  canvas.onmousemove = (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx   = (e.clientX - rect.left) * (W / rect.width);
    const my   = (e.clientY - rect.top)  * (H / rect.height);
    const hit  = hitMap.find(h => mx >= h.x && mx <= h.x + h.barW && my >= h.yTop && my <= h.yTop + h.segH);
    if (hit) _showTermTooltip(e, hit, termName);
    else     _hideTermTooltip();
  };
  canvas.onmouseleave = () => _hideTermTooltip();

  container.appendChild(canvas);

  /* Légende */
  const leg = document.createElement('div');
  leg.style.cssText = 'display:flex;flex-wrap:wrap;gap:.5rem .9rem;margin-top:.7rem;padding-top:.5rem;border-top:1px solid var(--border);align-items:flex-start;';

  catalog.forEach(([catName, entry]) => {
    const col   = _CAT_PALETTES[entry.palIdx][0];
    const emoji = _CAT_EMOJIS[entry.palIdx % _CAT_EMOJIS.length];
    const pal   = _CAT_PALETTES[entry.palIdx];
    const el    = document.createElement('div');
    el.style.cssText = 'display:flex;flex-direction:column;gap:.18rem;';
    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:.3rem;font-size:.55rem;font-weight:800;color:var(--text);font-family:var(--fontb);">
        <div style="width:12px;height:12px;border-radius:2px;background:${col};flex-shrink:0;"></div>
        ${emoji} ${catName}
      </div>
      ${[...entry.subs.keys()].map((subLbl, si) => {
        const subCol = pal[Math.min(si, pal.length-1)];
        return `<div style="display:flex;align-items:center;gap:.3rem;padding-left:.9rem;">
          <div style="width:9px;height:9px;border-radius:1px;background:${subCol};flex-shrink:0;"></div>
          <span style="font-size:.46rem;color:var(--text3);font-family:var(--fontb);line-height:1.4;">${subLbl}</span>
        </div>`;
      }).join('')}`;
    leg.appendChild(el);
  });

  /* Indicateur compressible */
  const compEl = document.createElement('div');
  compEl.style.cssText = 'display:flex;align-items:center;gap:.35rem;font-size:.52rem;color:var(--text3);font-family:var(--fontb);margin-left:auto;align-self:center;';
  compEl.innerHTML = `
    <div style="width:16px;height:16px;border-radius:2px;border:1px solid var(--border2);
      background:repeating-linear-gradient(-45deg,rgba(180,190,220,.35) 0px,rgba(180,190,220,.35) 2px,transparent 2px,transparent 6px);
      flex-shrink:0;"></div>
    ${isEN ? 'Adjustable (compressible)' : 'Temps compressible (ajustable)'}`;
  leg.appendChild(compEl);
  container.appendChild(leg);
}

/* ══════════════════════════════════════════════════════
   Switcher de tabs
══════════════════════════════════════════════════════ */
function _switchTerminusTab(termName) {
  _activeTerminus = termName;
  document.querySelectorAll('.term-tab-pill').forEach(el =>
    el.classList.toggle('on', el.dataset.term === termName)
  );
  const chartEl    = document.getElementById('_termChartArea');
  const scTermData = window._lastTermData || [];
  const scData     = _termCmpScFilter
    ? scTermData.filter(d => _termCmpScFilter.has(d.scIdx))
    : scTermData;
  const catalog    = _buildCatCatalog(scData, termName);
  if (chartEl) _renderTerminus3DChart(chartEl, scData, termName, catalog);
}

/* ══════════════════════════════════════════════════════
   RENDU PRINCIPAL
══════════════════════════════════════════════════════ */
function renderCompTerminus(all) {
  const el = document.getElementById('compTermContent');
  if (!el) return;
  if (!all?.length || !LINE) {
    el.innerHTML = '<div style="color:var(--text3);font-size:.6rem;padding:.5rem;">—</div>';
    return;
  }

  const scTermData = _getScTermData(all);
  window._lastTermData = scTermData;
  window._lastCompAll  = all;

  /* Terminus uniques */
  const allTermNames = [];
  const seenT = new Set();
  scTermData.forEach(d => [d.termA, d.termR].forEach(n => {
    if (n && !seenT.has(n)) { seenT.add(n); allTermNames.push(n); }
  }));

  const scData = _termCmpScFilter
    ? scTermData.filter(d => _termCmpScFilter.has(d.scIdx))
    : scTermData;

  if (!_activeTerminus || !allTermNames.includes(_activeTerminus))
    _activeTerminus = allTermNames[0];

  /* Filtre scénarios — bouton ⚙ */
  const scOpts = all.map(d => {
    const chk = (!_termCmpScFilter || _termCmpScFilter.has(d.scIdx)) ? 'checked' : '';
    return `<label class="col-picker-item"><input type="checkbox" ${chk} onchange="_termCmpScCh(event,${d.scIdx})"> ${d.sc.label}</label>`;
  }).join('');

  const filtersHtml = `
    <div style="display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;margin-bottom:.55rem;">
      <div class="col-picker-wrap">
        <button class="col-picker-btn" onclick="_toggleTermPicker(event,'_tcp2')">
          ⚙ ${isEN ? 'Scenarios' : 'Scénarios'} ▾
        </button>
        <div class="col-picker-dropdown" id="_tcp2">${scOpts}</div>
      </div>
    </div>`;

  /* Tabs terminus */
  const tabsHtml = `
    <div style="display:flex;flex-wrap:wrap;gap:.35rem;margin-bottom:.6rem;padding-bottom:.45rem;border-bottom:1px solid var(--border);">
      ${allTermNames.map(n =>
        `<div class="sc-pill term-tab-pill${n===_activeTerminus?' on':''}"
              data-term="${n}"
              onclick="_switchTerminusTab('${n.replace(/'/g,"\\'")}')"
              style="cursor:pointer;">${n}</div>`
      ).join('')}
    </div>`;

  const chartAreaHtml = `
    <div style="overflow-x:auto;overflow-y:hidden;
      scrollbar-width:thin;scrollbar-color:var(--border2) transparent;">
      <div id="_termChartArea"></div>
    </div>`;

  el.innerHTML = filtersHtml + tabsHtml + chartAreaHtml;

  const chartEl = document.getElementById('_termChartArea');
  const catalog = _buildCatCatalog(scData, _activeTerminus);
  _renderTerminus3DChart(chartEl, scData, _activeTerminus, catalog);
}

/* ── Handlers ── */
window._toggleTermPicker = function(e, id) {
  e.stopPropagation();
  document.querySelectorAll('.col-picker-dropdown').forEach(d => { if (d.id!==id) d.classList.remove('open'); });
  const dd = document.getElementById(id);
  if (!dd) return;
  dd.classList.toggle('open');
  if (dd.classList.contains('open')) {
    const r = e.currentTarget.getBoundingClientRect();
    dd.style.top  = (r.bottom + 4) + 'px';
    dd.style.left = r.left + 'px';
  }
};

window._termCmpScCh = function(evt, scIdx) {
  const all = window._lastCompAll || [];
  if (!_termCmpScFilter) _termCmpScFilter = new Set(all.map(d => d.scIdx));
  if (evt.target.checked) _termCmpScFilter.add(scIdx); else _termCmpScFilter.delete(scIdx);
  if (!_termCmpScFilter.size) _termCmpScFilter = null;
  renderCompTerminus(all);
};

/* ── Plein écran ── */
function fsOpenCompTerminus() {
  const el = document.getElementById('compTermContent');
  if (!el) return;
  openFullscreen(document.getElementById('compTermTitle').textContent, body => {
    Object.assign(body.style, { overflow:'auto', alignItems:'flex-start', padding:'1.5rem' });
    const clone = el.cloneNode(true);
    clone.style.cssText = 'width:calc(100vw - 3rem);overflow:visible;';
    body.appendChild(clone);
  });
}