/* ── render.comp.radar.js — Graphique radar KPI scénarios nominaux ── */

function renderRadar(all, filtered){
  _lastRadarAll = all; _lastRadarFiltered = filtered;
  const svg = document.getElementById('radarSvg');
  if(!svg) return;
  if(!filtered || filtered.length === 0) filtered = all;
  const SC_COLORS = [BRAND.aller, BRAND.retour, BRAND.primaire2, BRAND.cycle, BRAND.primaire1,'#e8453c'];
  const CX=160, CY=145, R=105;
  const AXES = [
    {key:'vitA',        label: isEN?'Speed Out':'Vit. Aller',    higher:true},
    {key:'vitR',        label: isEN?'Speed In':'Vit. Retour',    higher:true},
    {key:'tArretTotal', label: isEN?'Stops (min)':'Arrêts (min)',higher:false},
    {key:'tCycleMin',   label: isEN?'Cycle':'Cycle',             higher:false},
    {key:'tPrioTotal',  label: isEN?'Priority':'Priorité',       higher:false},
  ];

  // Exclure les scénarios SP de l'araignée
  const nominalAll      = all.filter(k => k.sc.type === 'NOMINAL');
  const nominalFiltered = filtered.filter(k => k.sc.type === 'NOMINAL');
  if(nominalAll.length === 0){
    svg.innerHTML = `<text x="160" y="140" text-anchor="middle" font-family="Barlow Condensed,sans-serif" font-size="11" fill="var(--text3)">${T('noNominalSc')}</text>`;
    return;
  }

  // Normalisation sur min/max globaux (tous scénarios nominaux, sélectionnés ou non)
  const allVals = AXES.map(ax => nominalAll.map(k => k[ax.key]||0));
  const gmins = allVals.map(v => Math.min(...v));
  const gmaxs = allVals.map(v => Math.max(...v));
  const norm = (v, i) => {
    const mn = gmins[i], mx = gmaxs[i];
    if(mx === mn) return 0.7;
    const n = (v - mn) / (mx - mn);
    return AXES[i].higher ? n : 1 - n;
  };

  const angle = i => (i/AXES.length)*2*Math.PI - Math.PI/2;
  const pt = (r,i) => [CX + r*Math.cos(angle(i)), CY + r*Math.sin(angle(i))];

  let h = '';
  // Grilles
  [0.25,0.5,0.75,1].forEach(f=>{
    const pts = AXES.map((_,i)=>pt(R*f,i).join(',')).join(' ');
    h += `<polygon points="${pts}" fill="none" stroke="var(--border)" stroke-width="${f===1?1.5:.7}" opacity=".6"/>`;
  });
  // Axes
  AXES.forEach((_,i)=>{
    const [x,y]=pt(R,i);
    h += `<line x1="${CX}" y1="${CY}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="var(--border)" stroke-width=".7" opacity=".7"/>`;
  });
  // Labels axes
  AXES.forEach((ax,i)=>{
    const [x,y]=pt(R+18,i);
    const anchor = x<CX-5?'end':x>CX+5?'start':'middle';
    h += `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}" dominant-baseline="middle"
      font-family="Barlow Condensed,sans-serif" font-size="9.5" font-weight="700" fill="var(--text3)">${ax.label}</text>`;
  });

  // Polygones — nominaux sélectionnés uniquement
  nominalFiltered.forEach(k=>{
    const si  = all.indexOf(k);
    const col = SC_COLORS[si%SC_COLORS.length];
    const isActive = si===currentSc;
    const norms = AXES.map((ax,i)=>norm(k[ax.key]||0,i));
    const pts = norms.map((n,i)=>pt(R*Math.max(0.02,n),i).map(v=>v.toFixed(1)).join(',')).join(' ');
    h += `<polygon points="${pts}" fill="${col}" fill-opacity="${isActive?.22:.08}" stroke="${col}" stroke-width="${isActive?2.5:1.2}" opacity="${isActive?1:.7}"/>`;
  });

  // Points + tooltips sur le scénario actif nominal visible
  const kA = nominalFiltered.find(k=>all.indexOf(k)===currentSc) || nominalFiltered[0];
  if(kA){
    const siA = all.indexOf(kA);
    const col = SC_COLORS[siA%SC_COLORS.length];
    AXES.forEach((ax,i)=>{
      const n = norm(kA[ax.key]||0,i);
      const [x,y] = pt(R*Math.max(0.02,n),i);
      const rawVal = kA[ax.key]||0;
      const disp = ax.key==='tArretTotal'||ax.key==='tCycleMin'||ax.key==='tPrioTotal' ? `${rawVal.toFixed(1)} min`
                 : `${rawVal.toFixed(1)} km/h`;
      h += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="${col}" stroke="#181c28" stroke-width="1.5"><title>${ax.label}: ${disp}</title></circle>`;
    });
  }

  // Légende — nominaux uniquement, SP absents
  nominalAll.forEach(k=>{
    const si  = all.indexOf(k);
    const col = SC_COLORS[si%SC_COLORS.length];
    const on  = radarActiveScenarios ? radarActiveScenarios.has(si) : true;
    const isActive = si===currentSc;
    const lx=8, ly=12+nominalAll.indexOf(k)*16;
    h += `<rect x="${lx}" y="${ly-5}" width="10" height="10" rx="2" fill="${col}" opacity="${on?1:.2}"/>`;
    h += `<text x="${lx+14}" y="${ly+0.5}" dominant-baseline="middle" font-family="Barlow Condensed,sans-serif" font-size="9" font-weight="${isActive?800:500}" fill="${on?(isActive?col:'var(--text2)'):'var(--border)'}">${k.sc.label}</text>`;
  });

  svg.innerHTML = h;
}
