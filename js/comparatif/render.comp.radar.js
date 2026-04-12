/* ══════════════════════════════════════════════════════════════════════
   render.comp.radar.js — Radar KPI — Canvas v4
   A : Canvas DPR/Retina
   B : Tooltips interactifs avec rang X/N
   C : Valeurs réelles lisibles sur les graduations
   D : Axes configurables (3 min), catalogue complet
   E : Hover highlight + points sur scénario survolé
══════════════════════════════════════════════════════════════════════ */

/* ── Palette brand-safe — sans aller/retour ──
   primaire1, primaire2, cycle + dérivées
   Fallback si BRAND non défini                      */
function _radarColors() {
  return [
    BRAND.primaire1 || '#a06bff',
    BRAND.primaire2 || '#3ecf6a',
    BRAND.cycle     || '#cf3e9e',
    _lighten(BRAND.primaire1 || '#a06bff', 0.35),
    _lighten(BRAND.primaire2 || '#3ecf6a', 0.30),
    _lighten(BRAND.cycle     || '#cf3e9e', 0.30),
  ];
}
/* Éclaircit une couleur hex d'un facteur 0-1 */
function _lighten(hex, f) {
  const n = parseInt(hex.replace('#',''), 16);
  const r = Math.min(255, ((n>>16)&0xff) + Math.round((255 - ((n>>16)&0xff)) * f));
  const g = Math.min(255, ((n>>8) &0xff) + Math.round((255 - ((n>>8) &0xff)) * f));
  const b = Math.min(255, ( n     &0xff) + Math.round((255 - ( n     &0xff)) * f));
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

/* ── D : Catalogue complet d'axes ── */
const RADAR_ALL_AXES = [
  // ── Temps & vitesse ──
  {key:'vitA',        label:'Vit. Aller',      labelEN:'Speed Out',       higher:true,  unit:'km/h', visible:true },
  {key:'vitR',        label:'Vit. Retour',     labelEN:'Speed In',        higher:true,  unit:'km/h', visible:true },
  {key:'tAllerMin',   label:'T. aller',        labelEN:'Run time out',    higher:false, unit:'min',  visible:false},
  {key:'tRetourMin',  label:'T. retour',       labelEN:'Run time in',     higher:false, unit:'min',  visible:false},
  {key:'tCycleMin',   label:'Cycle',           labelEN:'Cycle',           higher:false, unit:'min',  visible:true },
  {key:'tArretTotal', label:'Arrêts tot.',     labelEN:'Total dwell',     higher:false, unit:'min',  visible:true },
  {key:'tPrioTotal',  label:'Priorité',        labelEN:'Priority',        higher:false, unit:'min',  visible:true },
  // ── Exploitation ──
  {key:'freqHP',      label:'Fréq. cible',     labelEN:'Freq. target',    higher:false, unit:'min',  visible:false},
  {key:'flotteNec',   label:'Flotte néc.',     labelEN:'Fleet req.',      higher:false, unit:'',     visible:false},
  {key:'flotteTot',   label:'Flotte tot.',     labelEN:'Total fleet',     higher:false, unit:'',     visible:false},
  {key:'coursesJour', label:'Courses/jour',    labelEN:'Trips/day',       higher:true,  unit:'',     visible:false},
  {key:'kmCom',       label:'km comm./j',      labelEN:'Comm. km/d',      higher:true,  unit:'km',   visible:false},
  // ── Charge ──
  {key:'moyMontees',  label:'Moy. montées/st', labelEN:'Avg board./st',   higher:true,  unit:'',     visible:false},
  {key:'moyDescentes',label:'Moy. desc./st',   labelEN:'Avg alight./st',  higher:true,  unit:'',     visible:false},
  // ── Infrastructure ──
  {key:'totalDistKm', label:'Distance (km)',   labelEN:'Length (km)',     higher:false, unit:'km',   visible:false},
  {key:'distInterMoy',label:'Dist. interst.',  labelEN:'Avg inter-st',    higher:false, unit:'m',    visible:false},
];

let _radarHoverIdx = null;

/* ══════════════════════════════════════════════════════
   D — Picker d'axes + fermeture au scroll
══════════════════════════════════════════════════════ */
function buildRadarAxePicker() {
  const dd = document.getElementById('radarAxePickerDropdown');
  if (!dd) return;
  const activeCount = RADAR_ALL_AXES.filter(ax => ax.visible).length;
  dd.innerHTML = RADAR_ALL_AXES.map((ax, i) => {
    const isLast = ax.visible && activeCount <= 3;
    return `<label class="col-picker-item"${isLast ? ' title="3 axes minimum"' : ''}>
      <input type="checkbox" ${ax.visible ? 'checked' : ''} ${isLast ? 'disabled' : ''}
             onchange="toggleRadarAxe(${i}, this.checked)">
      ${isEN ? ax.labelEN : ax.label}
    </label>`;
  }).join('');
}

function toggleRadarAxePicker(e) {
  e.stopPropagation();
  document.querySelectorAll('.col-picker-dropdown').forEach(d => {
    if (d.id !== 'radarAxePickerDropdown') d.classList.remove('open');
  });
  const dd = document.getElementById('radarAxePickerDropdown');
  if (!dd) return;
  dd.classList.toggle('open');
  if (dd.classList.contains('open')) {
    const r = e.currentTarget.getBoundingClientRect();
    dd.style.top  = (r.bottom + 4) + 'px';
    dd.style.left = r.left + 'px';
  }
}

function toggleRadarAxe(idx, checked) {
  if (!checked && RADAR_ALL_AXES.filter(ax => ax.visible).length <= 3) return;
  RADAR_ALL_AXES[idx].visible = checked;
  buildRadarAxePicker();
  if (_lastRadarAll) renderRadar(_lastRadarAll, _lastRadarFiltered);
}

/* ── Utilitaires ── */
function _rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y);
  ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r);
  ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h);
  ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r);
  ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath();
}

function _pointInPolygon(px, py, pts) {
  let inside = false;
  for (let i=0, j=pts.length-1; i<pts.length; j=i++) {
    const [xi,yi]=pts[i],[xj,yj]=pts[j];
    if (((yi>py)!==(yj>py)) && px < (xj-xi)*(py-yi)/(yj-yi)+xi) inside=!inside;
  }
  return inside;
}

/* ══════════════════════════════════════════════════════
   RENDU PRINCIPAL
══════════════════════════════════════════════════════ */
function renderRadar(all, filtered) {
  _lastRadarAll      = all;
  _lastRadarFiltered = filtered;

  const canvas = document.getElementById('radarCanvas');
  if (!canvas) return;
  if (!filtered || filtered.length === 0) filtered = all;

  buildRadarAxePicker();

  const SC_COLORS = _radarColors();
  const AXES      = RADAR_ALL_AXES.filter(ax => ax.visible);
  if (AXES.length < 3) return;

  const nominalAll      = all.filter(k => k.sc.type === 'NOMINAL');
  const nominalFiltered = filtered.filter(k => k.sc.type === 'NOMINAL');

  /* ── A : DPR + sizing ── */
  const dpr       = window.devicePixelRatio || 1;
  const container = canvas.parentElement;
  const W         = container ? Math.min(container.clientWidth || 320, 380) : 320;
  const H         = Math.round(W * 0.92);

  canvas.width        = Math.round(W * dpr);
  canvas.height       = Math.round(H * dpr);
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  if (nominalAll.length === 0) {
    ctx.fillStyle = 'rgba(160,170,210,.45)';
    ctx.font = '600 11px "Barlow Condensed",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(typeof T==='function' ? T('noNominalSc') : 'Aucun scénario nominal', W/2, H/2);
    ctx.textBaseline = 'alphabetic';
    return;
  }

  /* ── Géométrie ── */
  const CX = W / 2;
  const CY = H / 2 + 4;
  const R  = Math.min(CX - 38, CY - 22) * 0.93;

  const axAngle = i => (i / AXES.length) * 2 * Math.PI - Math.PI / 2;
  const pt      = (r, i) => [CX + r * Math.cos(axAngle(i)), CY + r * Math.sin(axAngle(i))];

  /* ── Normalisation ── */
  const allVals = AXES.map(ax => nominalAll.map(k => k[ax.key] || 0));
  const gmins   = allVals.map(v => Math.min(...v));
  const gmaxs   = allVals.map(v => Math.max(...v));
  const norm    = (v, i) => {
    const mn=gmins[i], mx=gmaxs[i];
    if (mx===mn) return 0.7;
    return AXES[i].higher ? (v-mn)/(mx-mn) : 1-(v-mn)/(mx-mn);
  };
  const realAt  = (level, i) => {
    const mn=gmins[i], mx=gmaxs[i];
    return AXES[i].higher ? mn+level*(mx-mn) : mx-level*(mx-mn);
  };

  const isLight = document.body.classList.contains('light-mode');

  /* ── C : Anneaux avec valeurs réelles ── */
  [0.25, 0.5, 0.75, 1.0].forEach((f, ri) => {
    const last = ri === 3;
    ctx.beginPath();
    AXES.forEach((_, i) => {
      const [x,y] = pt(R*f, i);
      i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    });
    ctx.closePath();
    ctx.strokeStyle = last
      ? (isLight ? 'rgba(80,90,120,.30)' : 'rgba(160,170,210,.40)')
      : (isLight ? 'rgba(80,90,120,.11)' : 'rgba(160,170,210,.14)');
    ctx.lineWidth = last ? 1.3 : 0.65;
    ctx.stroke();

    AXES.forEach((ax, i) => {
      const rv    = realAt(f, i);
      const label = ax.unit==='km/h'||ax.unit==='km' ? rv.toFixed(1) : String(Math.round(rv));
      const [lx,ly] = pt(R*f, i);
      const perpA = axAngle(i) + Math.PI/2;
      ctx.fillStyle    = isLight ? 'rgba(60,70,100,.55)' : 'rgba(160,170,210,.58)';
      ctx.font         = '600 9px "Barlow Condensed",sans-serif';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, lx + Math.cos(perpA)*5, ly + Math.sin(perpA)*5);
    });
  });
  ctx.textBaseline = 'alphabetic';

  /* ── Axes + labels ── */
  AXES.forEach((ax, i) => {
    const [x,y] = pt(R, i);
    ctx.beginPath(); ctx.moveTo(CX,CY); ctx.lineTo(x,y);
    ctx.strokeStyle = isLight ? 'rgba(80,90,120,.18)' : 'rgba(160,170,210,.22)';
    ctx.lineWidth = 0.8; ctx.stroke();

    const [lx,ly] = pt(R+17, i);
    const lbl    = isEN ? ax.labelEN : ax.label;
    const anchor = lx<CX-6 ? 'right' : lx>CX+6 ? 'left' : 'center';
    ctx.fillStyle    = isLight ? 'rgba(50,60,90,.82)' : 'rgba(160,170,210,.85)';
    ctx.font         = '700 9.5px "Barlow Condensed",sans-serif';
    ctx.textAlign    = anchor;
    ctx.textBaseline = 'middle';
    ctx.fillText(lbl, lx, ly);
  });
  ctx.textBaseline = 'alphabetic';

  /* ── Pré-calcul polygones ── */
  const allNorms = nominalFiltered.map(k => AXES.map((ax,i) => norm(k[ax.key]||0, i)));
  const allPts   = allNorms.map(norms => norms.map((n,i) => pt(R*Math.max(0.02,n), i)));

  /* ── E : Polygones ── */
  nominalFiltered.forEach((k, fi) => {
    const si        = all.indexOf(k);
    const col       = SC_COLORS[si % SC_COLORS.length];
    const isActive  = si === currentSc;
    const isHovered = fi === _radarHoverIdx;

    ctx.beginPath();
    allPts[fi].forEach(([x,y],i) => i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y));
    ctx.closePath();

    ctx.globalAlpha = isHovered ? 0.30 : isActive ? 0.18 : 0.07;
    ctx.fillStyle   = col; ctx.fill();

    ctx.globalAlpha = isHovered ? 1 : isActive ? 0.95 : 0.55;
    ctx.strokeStyle = col;
    ctx.lineWidth   = isHovered ? 2.8 : isActive ? 2.2 : 1.0;
    ctx.stroke();
    ctx.globalAlpha = 1;
  });

  /* ── E : Points sur scénario survolé OU actif ── */
  const dotTarget = _radarHoverIdx !== null
    ? nominalFiltered[_radarHoverIdx]
    : (nominalFiltered.find(k => all.indexOf(k)===currentSc) || nominalFiltered[0]);

  if (dotTarget) {
    const si  = all.indexOf(dotTarget);
    const fi  = nominalFiltered.indexOf(dotTarget);
    const col = SC_COLORS[si % SC_COLORS.length];
    allPts[fi].forEach(([x,y]) => {
      ctx.beginPath(); ctx.arc(x,y,4.5,0,Math.PI*2);
      ctx.fillStyle   = col; ctx.fill();
      ctx.strokeStyle = isLight ? '#ffffff' : getComputedStyle(document.body).getPropertyValue('--bg').trim() || '#181c28';
      ctx.lineWidth   = 1.8; ctx.stroke();
    });
  }

  /* ── Interactions ── */
  canvas.onmousemove = (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx   = (e.clientX - rect.left) * (W / rect.width);
    const my   = (e.clientY - rect.top)  * (H / rect.height);
    let hit = null;
    for (let fi=nominalFiltered.length-1; fi>=0; fi--) {
      if (_pointInPolygon(mx, my, allPts[fi])) { hit=fi; break; }
    }
    if (hit !== _radarHoverIdx) {
      _radarHoverIdx = hit;
      renderRadar(_lastRadarAll, _lastRadarFiltered);
    }
    if (hit !== null)
      _showRadarTooltip(e, nominalFiltered[hit], AXES, allNorms[hit], SC_COLORS, all, nominalAll);
    else
      _hideRadarTooltip();
  };

  canvas.onmouseleave = () => {
    if (_radarHoverIdx !== null) { _radarHoverIdx=null; renderRadar(_lastRadarAll, _lastRadarFiltered); }
    _hideRadarTooltip();
  };
}

/* ══════════════════════════════════════════════════════
   B — Tooltip avec rang X/N
══════════════════════════════════════════════════════ */
function _getRadarTooltip() {
  let t = document.getElementById('_radarTooltip');
  if (!t) {
    t = document.createElement('div');
    t.id = '_radarTooltip';
    t.style.cssText = [
      'position:fixed;z-index:9999;pointer-events:none;display:none',
      'background:var(--bg2);border:1px solid var(--border)',
      'border-radius:7px;padding:9px 12px',
      'font-family:"Barlow Condensed",sans-serif;font-size:11px;min-width:185px',
      'box-shadow:0 4px 18px rgba(0,0,0,.28)',
    ].join(';');
    document.body.appendChild(t);
  }
  return t;
}

function _showRadarTooltip(e, k, AXES, norms, SC_COLORS, all, nominalAll) {
  const t   = _getRadarTooltip();
  const si  = (all||[]).indexOf(k);
  const col = SC_COLORS[si % SC_COLORS.length];
  const N   = nominalAll.length;

  const rows = AXES.map((ax, i) => {
    const rawVal = k[ax.key] || 0;
    const disp   = ax.unit===''
      ? String(Math.round(rawVal))
      : `${rawVal.toFixed(1)} ${ax.unit}`;

    const sorted = [...nominalAll]
      .sort((a,b) => ax.higher
        ? (b[ax.key]||0)-(a[ax.key]||0)
        : (a[ax.key]||0)-(b[ax.key]||0));
    const rank = sorted.indexOf(k) + 1;
    const rankCol = rank===1 ? 'var(--green)' : rank===N ? 'var(--orange)' : 'var(--text3)';
    const barW = Math.round(norms[i] * 60);

    return `<div style="margin:2px 0 5px;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-bottom:2px;">
        <span style="color:var(--text3);font-size:9px;white-space:nowrap;">${isEN ? ax.labelEN : ax.label}</span>
        <div style="display:flex;align-items:baseline;gap:5px;white-space:nowrap;">
          <span style="color:var(--text);font-weight:700;">${disp}</span>
          <span style="color:${rankCol};font-size:8.5px;font-weight:700;">${rank}/${N}</span>
        </div>
      </div>
      <div style="height:3px;background:var(--bg4);border-radius:2px;overflow:hidden;">
        <div style="height:3px;width:${barW}px;max-width:60px;background:${col};border-radius:2px;"></div>
      </div>
    </div>`;
  }).join('');

  t.innerHTML = `
    <div style="font-size:10px;font-weight:800;color:${col};margin-bottom:7px;
      letter-spacing:.06em;text-transform:uppercase;
      border-bottom:1px solid var(--border);padding-bottom:5px;">${k.sc.label}</div>
    ${rows}`;

  t.style.display = 'block';
  t.style.left    = (e.clientX + 16) + 'px';
  t.style.top     = (e.clientY - 32) + 'px';
}

function _hideRadarTooltip() {
  const t = document.getElementById('_radarTooltip');
  if (t) t.style.display = 'none';
}