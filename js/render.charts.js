/* ── render.charts.js — BOP, radar, charge, stack cycle ── */
/* ═══════════════════════════════════════════════
   CHARTS
═══════════════════════════════════════════════ */
function renderCharts(scIdx){
  if(!LINE) return;
  const sc  = LINE.scenarios[scIdx];
  const sp  = computeSPTroncons(sc, LINE);
  // Aller : couleur primaire de la palette BRAND.aller + dérivées
  const C_MA = BRAND.aller;
  const C_DA = shadeColor(BRAND.aller, -15);
  const C_CA = shadeColor(BRAND.aller, -35);
  const C_AA = shadeColor(BRAND.aller, -25);
  // Retour : couleur primaire de la palette BRAND.retour + dérivées
  const C_MR = BRAND.retour;
  const C_DR = shadeColor(BRAND.retour, -10);
  const C_CR = shadeColor(BRAND.retour, -30);
  const C_AR = shadeColor(BRAND.retour, -40);
  // Barres verticales vbar : marche=aller, carrefour=aller foncé
  const C_RUN  = shadeColor(BRAND.aller, 15);
  const C_CARR = shadeColor(BRAND.aller, -30);

  /* ── helper : génère les données d'un tronçon ── */
  function tronconData(tenduA, tenduR, detA, detR, stations, interSlice){
    const inter_ = interSlice || [];
    const dA  = detA.length  ? detA  : tenduA.map(v=>v*(sc.coeff-1));
    const dR  = detR.length  ? detR  : tenduR.map(v=>v*(sc.coeff-1));
    const mA  = tenduA.reduce((a,b)=>a+b,0);
    const mR  = tenduR.reduce((a,b)=>a+b,0);
    const dSA = dA.reduce((a,b)=>a+b,0);
    const dSR = dR.reduce((a,b)=>a+b,0);
    // Carrefours : somme des TPS_A/TPS_R sur les interstations du tronçon (en minutes)
    const carrA = inter_.reduce((a,seg)=>a+(seg.tpsA||0),0)/60;
    const carrR = inter_.reduce((a,seg)=>a+(seg.tpsR||0),0)/60;
    // Marche pure = marche tendue - temps carrefours
    const mPureA = Math.max(0, mA - carrA);
    const mPureR = Math.max(0, mR - carrR);
    const aA  = stations.reduce((a,s)=>a+s.arretA,0)/60;
    const aR  = stations.reduce((a,s)=>a+s.arretR,0)/60;
    const segsA = [{l: isEN?'Run time':'Marche tendue',    v:mPureA, c:C_MA},
                   {l: isEN?'Priority':'Priorité',  v:carrA,  c:C_CA},
                   {l: isEN?'Recovery':'Détente',          v:dSA,    c:C_DA},
                   {l: isEN?'Station dwell':'Arrêts station', v:aA,  c:C_AA}];
    const segsR = [{l: isEN?'Run time':'Marche tendue',    v:mPureR, c:C_MR},
                   {l: isEN?'Priority':'Priorité',  v:carrR,  c:C_CR},
                   {l: isEN?'Recovery':'Détente',          v:dSR,    c:C_DR},
                   {l: isEN?'Station dwell':'Arrêts station', v:aR,  c:C_AR}];
    // Filtrer les segments à 0 pour ne pas polluer le pie
    const filtA = segsA.filter(s=>s.v>0);
    const filtR = segsR.filter(s=>s.v>0);
    return{mA,mR,dSA,dSR,aA,aR,carrA,carrR,mPureA,mPureR,
      totalA: mA+dSA+aA, totalR: mR+dSR+aR,
      segsA: filtA, segsR: filtR,
    };
  }

  function drawPie(svgEl, segs, total){
    if(!svgEl) return {};
    const cx=50,cy=50,r=47,inner=33;
    let angle=-90, mStart=-90, mEnd=-90, paths='';
    segs.forEach((s,i)=>{
      const pct=s.v/total, a=pct*360;
      if(i===0) mStart=angle;
      const midA = (angle + a/2) * Math.PI/180;
      const sr=angle*Math.PI/180, er=(angle+a)*Math.PI/180;
      const x1=cx+r*Math.cos(sr),y1=cy+r*Math.sin(sr);
      const x2=cx+r*Math.cos(er),y2=cy+r*Math.sin(er);
      const ix1=cx+inner*Math.cos(sr),iy1=cy+inner*Math.sin(sr);
      const ix2=cx+inner*Math.cos(er),iy2=cy+inner*Math.sin(er);
      const lg=a>180?1:0;
      const pctStr = Math.round(pct*100);
      const icon = pieIcon(s.l);
      // data attributes for JS hover
      paths+=`<path class="pie-slice" d="M${ix1} ${iy1} L${x1} ${y1} A${r} ${r} 0 ${lg} 1 ${x2} ${y2} L${ix2} ${iy2} A${inner} ${inner} 0 ${lg} 0 ${ix1} ${iy1}Z"
        fill="${s.c}" opacity=".9"
        data-label="${s.l}" data-val="${fmtMin(s.v)}" data-pct="${pctStr}" data-col="${s.c}" data-icon="${icon}"
        data-midx="${(cx + (r+inner)/2*Math.cos(midA)).toFixed(1)}" data-midy="${(cy + (r+inner)/2*Math.sin(midA)).toFixed(1)}"
        style="cursor:pointer;transition:transform .15s;transform-origin:${cx}px ${cy}px;transform-box:fill-box;"
        onmouseenter="pieSliceEnter(this,event)" onmouseleave="pieSliceLeave(this)"/>`;
      if(i===0) mEnd=angle+a;
      angle+=a;
    });
    const mm = Math.floor(total), ss = Math.round((total-mm)*60);
    const line1 = `${mm}m`;
    const line2 = ss>0 ? `${ss}s` : '';
    const yOff = line2 ? -4 : 2;
    paths+=`<text x="${cx}" y="${cy+yOff}" text-anchor="middle" font-family="Barlow Condensed,sans-serif" font-size="13" font-weight="800" fill="var(--text)">${line1}</text>`;
    if(line2) paths+=`<text x="${cx}" y="${cy+10}" text-anchor="middle" font-family="Barlow Condensed,sans-serif" font-size="10" font-weight="700" fill="var(--text3)">${line2}</text>`;
    svgEl.innerHTML=paths;
    return {mStart, mEnd};
  }

  function drawVbar(el, run, carref, total){
    if(!el) return;
    const pRun=(run/total*100).toFixed(1);
    const pCarr=(carref/total*100).toFixed(1);
    el.innerHTML=
      `<div class="bop-vbar-seg" style="height:${pCarr}%;background:${C_CARR}">`
      +(parseFloat(pCarr)>=14?`<span style="font-size:.46rem;font-weight:800;color:rgba(255,255,255,.95);line-height:1">${pCarr}%</span>`:'')
      +`</div>`
      +`<div class="bop-vbar-seg" style="height:${pRun}%;background:${C_RUN}">`
      +(parseFloat(pRun)>=14?`<span style="font-size:.46rem;font-weight:800;color:rgba(0,0,0,.8);line-height:1">${pRun}%</span>`:'')
      +`</div>`;
  }

  function drawConnector(conn, pie, ms, fromRight){
    requestAnimationFrame(()=>{
      if(!conn||!pie) return;
      const H=pie.getBoundingClientRect().height||100;
      const scale=H/100, r=44;
      const topY=(50+r*Math.sin(ms.mStart*Math.PI/180))*scale;
      const botY=(50+r*Math.sin(ms.mEnd  *Math.PI/180))*scale;
      conn.setAttribute('viewBox',`0 0 14 ${H}`);
      const CC = fromRight ? C_MR : C_MA;
      if(fromRight){
        conn.innerHTML=`<line x1="14" y1="${topY.toFixed(1)}" x2="0" y2="${(H*.2).toFixed(1)}" stroke="${CC}" stroke-width="1" opacity=".6"/>`
          +`<line x1="14" y1="${botY.toFixed(1)}" x2="0" y2="${(H*.8).toFixed(1)}" stroke="${CC}" stroke-width="1" opacity=".6"/>`;
      } else {
        conn.innerHTML=`<line x1="0" y1="${topY.toFixed(1)}" x2="14" y2="${(H*.2).toFixed(1)}" stroke="${CC}" stroke-width="1" opacity=".6"/>`
          +`<line x1="0" y1="${botY.toFixed(1)}" x2="14" y2="${(H*.8).toFixed(1)}" stroke="${CC}" stroke-width="1" opacity=".6"/>`;
      }
    });
  }

  function renderStackCycle(containerEl, labelEl, totalEl, mA, mR, dSA, dSR, aA, aR, retAObj, retRObj){
    const def = {totalSec:420};
    const cRA = (retAObj||def).totalSec/60;
    const cRR = (retRObj||def).totalSec/60;
    const cyc = mA+dSA+aA+cRA+mR+dSR+aR+cRR;
    const tA  = mA+dSA+aA;
    const tR  = mR+dSR+aR;
    const CSEGS=[
      {l:isEN?'Outbound time':'Temps aller',  v:tA,  c:BRAND.aller},
      {l:isEN?'Reversal':'Retournement',       v:cRA, c:'#6b7280'},
      {l:isEN?'Inbound time':'Temps retour',  v:tR,  c:BRAND.retour},
      {l:isEN?'Reversal':'Retournement',       v:cRR, c:'#6b7280'},
    ];
    const CSEG_ICONS = ['⬆', '🔁', '⬇', '🔂'];
    if(containerEl) containerEl.innerHTML=CSEGS.map((s,i)=>{
      const p=(s.v/cyc*100).toFixed(1);
      const textColor = s.c==='#6b7280' ? 'rgba(255,255,255,.8)' : 'rgba(0,0,0,.75)';
      return `<div class="stack-seg" style="width:${p}%;background:${s.c};cursor:pointer;transition:filter .15s;"
        data-label="${s.l}" data-val="${fmtMin(s.v)}" data-pct="${p}" data-col="${s.c}" data-icon="${CSEG_ICONS[i]}"
        onmouseenter="stackSegEnter(this,event)" onmouseleave="stackSegLeave(this)"
        >${parseFloat(p)>=8?`<span style="font-size:.5rem;font-weight:800;color:${textColor};pointer-events:none">${_cycleShowPct?p+'%':fmtMin(s.v)}</span>`:''}</div>`;
    }).join('');
    if(labelEl) labelEl.innerHTML=CSEGS.map((s,i)=>{
      const p=(s.v/cyc*100).toFixed(1);
      const lbl = (i===1) ? `${s.l} (${isEN?'Out.':'All.'})` :
                  (i===3) ? `${s.l} (${isEN?'In.':'Ret.'})` : s.l;
      const val = _cycleShowPct ? `${p}%` : fmtMin(s.v);
      return `<div class="stack-label"><div class="stack-label-dot" style="background:${s.c}"></div>${lbl}<span style="margin-left:.2rem;font-family:'Courier New',monospace;color:var(--text2);font-size:.5rem">${val}</span></div>`;
    }).join('');
    if(totalEl) totalEl.textContent=`Σ ${isEN?'Cycle':'Cycle'} = ${_cycleShowPct ? '100%' : fmtMin(cyc)}`;
  }

  /* Helper : génère HTML pie simplifié (sans zoom) */
  function renderBopPies(outId, inId, legendId, d, pieSize){
    return `<div class="bop-wrap" style="justify-content:center;gap:1rem;">
      <div class="bop-pie-col">
        <div class="bop-sens-label" style="color:var(--blue)">↓ ${T('dirOutbound')}</div>
        <svg id="${outId}" width="${pieSize}" height="${pieSize}" viewBox="0 0 100 100"></svg>
      </div>
      <div class="bop-legend-center">
        <div class="bop-leg-header"><span style="color:var(--blue)">↓ ${isEN?'Out':'All.'}</span><span></span><span style="color:var(--orange)">↑ ${isEN?'In':'Ret.'}</span></div>
        <div id="${legendId}"></div>
      </div>
      <div class="bop-pie-col">
        <div class="bop-sens-label" style="color:var(--orange)">↑ ${T('dirInbound')}</div>
        <svg id="${inId}" width="${pieSize}" height="${pieSize}" viewBox="0 0 100 100"></svg>
      </div>
    </div>`;
  }

  /* ── Reconstruit le HTML des blocs charts selon le mode SP ── */
  const bopCardEl   = document.getElementById('bopCard');
  const cycleCardEl = document.getElementById('cycleCard');

  if(sp.isSP && !sp.isFinDeLigne && sp.troncons.length >= 2){
    // SP MILIEU — 2 blocs côte à côte
    const [trA, trB] = sp.troncons;
    const interA = LINE.inter.slice(trA.idxStart, trA.idxEnd);
    const interB = LINE.inter.slice(trB.idxStart, trB.idxEnd);
    const dA = tronconData(trA.tenduA, trA.tenduR, trA.detenteA, trA.detenteR, trA.stations, interA);
    const dB = tronconData(trB.tenduA, trB.tenduR, trB.detenteA, trB.detenteR, trB.stations, interB);

    bopCardEl.innerHTML=`
      <div class="chart-card-title">${T('chartBopTitle')}</div>
      <div style="display:flex;flex-direction:column;gap:.75rem;">
        <div>
          <div style="font-size:.58rem;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.08em;margin-bottom:.3rem">${trA.label}</div>
          ${renderBopPies('bopA_PieA','bopA_PieR','bopA_Legend', dA, 100)}
        </div>
        <div style="height:1px;background:var(--border);margin:0 .5rem"></div>
        <div>
          <div style="font-size:.58rem;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.08em;margin-bottom:.3rem">${trB.label}</div>
          ${renderBopPies('bopB_PieA','bopB_PieR','bopB_Legend', dB, 100)}
        </div>
      </div>`;

    requestAnimationFrame(()=>{
      [['bopA_PieA',dA.segsA,dA.totalA],['bopA_PieR',dA.segsR,dA.totalR],
       ['bopB_PieA',dB.segsA,dB.totalA],['bopB_PieR',dB.segsR,dB.totalR]].forEach(([id,segs,tot])=>{
        drawPie(document.getElementById(id), segs, tot);
      });
      ['bopA','bopB'].forEach((pfx,i)=>{
        const dd=i===0?dA:dB;
        const leg=document.getElementById(pfx+'_Legend');
        if(!leg) return;
        // Fusion des noms des 2 sens pour la légende
        const names=[...new Set([...dd.segsA.map(s=>s.l),...dd.segsR.map(s=>s.l)])];
        leg.innerHTML=names.map(nm=>{
          const sA=dd.segsA.find(s=>s.l===nm)||{v:0,c:'#444'};
          const sR=dd.segsR.find(s=>s.l===nm)||{v:0,c:'#444'};
          return `<div class="bop-leg-row"><span class="bop-leg-val-a">${fmtMin(sA.v)}</span>`
            +`<div class="bop-leg-dot" style="background:${sA.c}"></div><span class="bop-leg-name">${nm}</span>`
            +`<div class="bop-leg-dot" style="background:${sR.c}"></div><span class="bop-leg-val-r">${fmtMin(sR.v)}</span></div>`;
        }).join('');
      });
    });

    cycleCardEl.innerHTML=`
      <div class="chart-card-header">
        <div class="chart-card-title">${T('chartCycleTitle')}</div>
        <button class="fs-btn" onclick="toggleCyclePct()" id="cyclePctBtn" title="Basculer %/mm:ss">%</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:.75rem;">
        <div>
          <div style="font-size:.58rem;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:.3rem">${trA.label}</div>
          <div class="stack-wrap"><div class="stack-bar-row" id="stackBarA"></div><div class="stack-labels" id="stackLabelsA"></div><div class="stack-total" id="stackTotalA"></div></div>
        </div>
        <div style="height:1px;background:var(--border);margin:0 .5rem"></div>
        <div>
          <div style="font-size:.58rem;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:.3rem">${trB.label}</div>
          <div class="stack-wrap"><div class="stack-bar-row" id="stackBarB"></div><div class="stack-labels" id="stackLabelsB"></div><div class="stack-total" id="stackTotalB"></div></div>
        </div>
      </div>`;
    requestAnimationFrame(()=>{
      const trs = getTerminusForSc(currentSc).troncons||[];
      const trA_ret = trs[0]||{retA:null,retR:null};
      const trB_ret = trs[1]||{retA:null,retR:null};
      renderStackCycle(document.getElementById('stackBarA'),document.getElementById('stackLabelsA'),document.getElementById('stackTotalA'),dA.mA,dA.mR,dA.dSA,dA.dSR,dA.aA,dA.aR, trA_ret.retA, trA_ret.retR);
      renderStackCycle(document.getElementById('stackBarB'),document.getElementById('stackLabelsB'),document.getElementById('stackTotalB'),dB.mA,dB.mR,dB.dSA,dB.dSR,dB.aA,dB.aR, trB_ret.retA, trB_ret.retR);
    });

  } else {
    // NOMINAL ou SP fin de ligne — 1 seul bloc
    let tenduA, tenduR, detenteA, detenteR, stationsSet, interSet;
    if(sp.isSP && sp.troncons.length > 0){
      const tr = sp.troncons[0];
      tenduA=tr.tenduA; tenduR=tr.tenduR; detenteA=tr.detenteA; detenteR=tr.detenteR;
      stationsSet=tr.stations; interSet=LINE.inter.slice(tr.idxStart, tr.idxEnd);
    } else {
      tenduA  = LINE.tendu[sc.id]||[];
      tenduR  = (LINE.tenduR&&LINE.tenduR[sc.id])||[...tenduA].reverse();
      detenteA= LINE.detenteA&&LINE.detenteA.length?LINE.detenteA:[];
      detenteR= LINE.detenteR&&LINE.detenteR.length?LINE.detenteR:[];
      stationsSet = LINE.stations;
      interSet = LINE.inter;
    }
    const d = tronconData(tenduA, tenduR, detenteA, detenteR, stationsSet, interSet);

    bopCardEl.innerHTML=`
      <div class="chart-card-title">${T('chartBopTitle')}</div>
      ${renderBopPies('bopPieA','bopPieR','bopLegendCenter', d, 124)}`;

    requestAnimationFrame(()=>{
      drawPie(document.getElementById('bopPieA'), d.segsA, d.totalA);
      drawPie(document.getElementById('bopPieR'), d.segsR, d.totalR);
      const bopLeg = document.getElementById('bopLegendCenter');
      if(bopLeg){
        const names=[...new Set([...d.segsA.map(s=>s.l),...d.segsR.map(s=>s.l)])];
        bopLeg.innerHTML=names.map(nm=>{
          const sA=d.segsA.find(s=>s.l===nm)||{v:0,c:'#444'};
          const sR=d.segsR.find(s=>s.l===nm)||{v:0,c:'#444'};
          return `<div class="bop-leg-row"><span class="bop-leg-val-a">${fmtMin(sA.v)}</span>`
            +`<div class="bop-leg-dot" style="background:${sA.c}"></div><span class="bop-leg-name">${nm}</span>`
            +`<div class="bop-leg-dot" style="background:${sR.c}"></div><span class="bop-leg-val-r">${fmtMin(sR.v)}</span></div>`;
        }).join('');
      }
    });

    cycleCardEl.innerHTML=`
      <div class="chart-card-header">
        <div class="chart-card-title">${T('chartCycleTitle')}</div>
        <button class="fs-btn" onclick="toggleCyclePct()" id="cyclePctBtn" title="Basculer %/mm:ss">%</button>
      </div>
      <div class="stack-wrap">
        <div class="stack-bar-row" id="stackBar"></div>
        <div class="stack-labels" id="stackLabels"></div>
        <div class="stack-total" id="stackTotal"></div>
      </div>`;
    requestAnimationFrame(()=>{
      const {retA, retR} = getTerminusForSc(currentSc);
      renderStackCycle(document.getElementById('stackBar'),document.getElementById('stackLabels'),document.getElementById('stackTotal'),d.mA,d.mR,d.dSA,d.dSR,d.aA,d.aR, retA, retR);
    });
  }
}


function renderDepotKPI(k){
  const elS = document.getElementById('kpiDepotSorties');
  const elE = document.getElementById('kpiDepotEntrees');
  const elD = document.getElementById('kpiDepotDetail');
  if(!elS||!elE||!elD) return;
  elS.textContent = k.sorties;
  elE.textContent = k.entrees;
  // Détail : ligne par changement (heure + delta + total veh)
  elD.innerHTML = (k.depotMouvements||[]).map(m=>{
    const isPos = m.delta > 0;
    const color = isPos ? 'var(--purple)' : 'var(--purple3)';
    const sign  = isPos ? `+${m.delta}` : `${m.delta}`;
    return `<div style="display:flex;justify-content:space-between;align-items:baseline;font-family:var(--fontb);">
      <span style="font-size:.5rem;color:var(--text3)">${minToHM(m.debut)}</span>
      <span style="font-size:.58rem;font-weight:800;color:${color}">${sign} veh</span>
      <span style="font-size:.5rem;color:var(--text3)">→ ${m.veh} ${isEN?'in svc':'en ligne'}</span>
    </div>`;
  }).join('');
}

