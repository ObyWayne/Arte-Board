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

  /* ── Chronomètre Canvas : remplace le donut SVG ── */
  function drawChrono(canvasEl, segs, total){
    if(!canvasEl || !segs || total <= 0) return { mStart:-90, mEnd:-90 };

    const dpr  = window.devicePixelRatio || 1;
    const CSS  = canvasEl.offsetWidth || parseInt(canvasEl.style.width) || 120;
    canvasEl.width  = Math.round(CSS * dpr);
    canvasEl.height = Math.round(CSS * dpr);
    canvasEl.style.width  = CSS + 'px';
    canvasEl.style.height = CSS + 'px';

    const ctx = canvasEl.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, CSS, CSS);

    // ── Couleurs depuis body pour respecter dark/light ──
    const cs    = getComputedStyle(document.body);
    const cBg   = cs.getPropertyValue('--bg3').trim()   || '#252b3b';
    const cBg2  = cs.getPropertyValue('--bg2').trim()   || '#1f2435';
    const cBg4  = cs.getPropertyValue('--bg4').trim()   || '#2d3449';
    const cBdr  = cs.getPropertyValue('--border').trim()|| '#323854';
    const cTxt  = cs.getPropertyValue('--text').trim()  || '#e8eaf0';
    const cT2   = cs.getPropertyValue('--text2').trim() || '#a0a8c0';
    const cT3   = cs.getPropertyValue('--text3').trim() || '#6b748f';

    const cx = CSS/2, cy = CSS/2;
    const BEZEL = CSS/2 - 1;     // rayon extérieur du cadran
    const R_OUT = BEZEL - 7;     // bord extérieur de la piste colorée
    const R_IN  = R_OUT  - 18;   // bord intérieur (épaisseur piste = 18px)
    const R_MID = (R_OUT + R_IN) / 2;

    // ── Fond du cadran ──
    ctx.beginPath(); ctx.arc(cx, cy, BEZEL, 0, Math.PI*2);
    ctx.fillStyle = cBg; ctx.fill();
    ctx.strokeStyle = cBdr; ctx.lineWidth = 1.5; ctx.stroke();

    // ── Face centrale ──
    ctx.beginPath(); ctx.arc(cx, cy, R_IN - 3, 0, Math.PI*2);
    ctx.fillStyle = cBg2; ctx.fill();

    // ── Piste de fond (anneau gris) ──
    ctx.beginPath(); ctx.arc(cx, cy, R_MID, 0, Math.PI*2);
    ctx.lineWidth = R_OUT - R_IN; ctx.strokeStyle = cBg4;
    ctx.lineCap = 'butt'; ctx.stroke();

    // ── Arcs colorés par segment ──
    let angle = -Math.PI / 2;   // départ en haut (12h)
    const segAngles = [];
    segs.forEach(s => {
      if(s.v <= 0) return;
      const sweep = (s.v / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, R_MID, angle, angle + sweep);
      ctx.lineWidth = R_OUT - R_IN;
      ctx.strokeStyle = s.c;
      ctx.globalAlpha = 0.92;
      ctx.lineCap = 'butt';
      ctx.stroke();
      ctx.globalAlpha = 1;
      segAngles.push({ startA: angle, endA: angle + sweep, s });
      angle += sweep;
    });

    // ── Séparateurs entre segments ──
    segAngles.forEach(sa => {
      ctx.beginPath();
      ctx.moveTo(cx + (R_IN-1) * Math.cos(sa.startA), cy + (R_IN-1) * Math.sin(sa.startA));
      ctx.lineTo(cx + (R_OUT+1)* Math.cos(sa.startA), cy + (R_OUT+1)* Math.sin(sa.startA));
      ctx.strokeStyle = cBg2; ctx.lineWidth = 2.5; ctx.stroke();
    });

    // ── Graduations chronomètre ──
    const totalMins = Math.ceil(total);
    for(let m=0; m<=totalMins; m++){
      const a = -Math.PI/2 + (m / total) * Math.PI * 2;
      const isMaj = m % 5 === 0;
      const t0 = R_OUT + 1, t1 = R_OUT + (isMaj ? 5 : 3);
      ctx.beginPath();
      ctx.moveTo(cx + t0*Math.cos(a), cy + t0*Math.sin(a));
      ctx.lineTo(cx + t1*Math.cos(a), cy + t1*Math.sin(a));
      ctx.strokeStyle = isMaj ? cT2 : cT3;
      ctx.lineWidth   = isMaj ? 1.3 : 0.7;
      ctx.stroke();
      // Label toutes les 5 min (pas 0, pas extrémité)
      if(isMaj && m > 0 && m < totalMins){
        const lr = R_OUT + 7;
        ctx.fillStyle = cT3;
        ctx.font = `600 ${Math.max(5, CSS * 0.055)}px Barlow Condensed,sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(m + '\'', cx + lr*Math.cos(a), cy + lr*Math.sin(a));
      }
    }

    // ── Affichage central ──
    const mm = Math.floor(total);
    const ss = Math.round((total - mm) * 60);
    const szBig = Math.max(11, CSS * 0.145);
    const szSm  = Math.max(9,  CSS * 0.1);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if(ss > 0){
      ctx.fillStyle = cTxt;
      ctx.font = `800 ${szBig}px Barlow Condensed,sans-serif`;
      ctx.fillText(`${mm}m`, cx, cy - szBig * 0.42);
      ctx.fillStyle = cT2;
      ctx.font = `700 ${szSm}px Barlow Condensed,sans-serif`;
      ctx.fillText(`${ss}s`, cx, cy + szSm * 0.55);
    } else {
      ctx.fillStyle = cTxt;
      ctx.font = `800 ${szBig * 1.1}px Barlow Condensed,sans-serif`;
      ctx.fillText(`${mm}m`, cx, cy);
    }

    // ── Stockage hover ──
    canvasEl._chrono = { segs, total, segAngles, cx, cy, R_IN, R_OUT };

    if(!canvasEl._chronoBound){
      canvasEl.addEventListener('mousemove',  _chronoMouseMove);
      canvasEl.addEventListener('mouseleave', _chronoMouseLeave);
      canvasEl._chronoBound = true;
    }

    // Retourne mStart/mEnd en degrés (compatibilité drawConnector)
    const first = segAngles[0];
    return {
      mStart: first ? first.startA * 180/Math.PI : -90,
      mEnd:   first ? first.endA   * 180/Math.PI : -90,
    };
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

  /* Helper : génère HTML chrono (canvas) simplifié */
  function renderBopPies(outId, inId, legendId, d, pieSize){
    return `<div class="bop-wrap" style="justify-content:center;gap:1rem;">
      <div class="bop-pie-col">
        <div class="bop-sens-label" style="color:var(--blue)">↓ ${T('dirOutbound')}</div>
        <canvas id="${outId}" style="width:${pieSize}px;height:${pieSize}px;display:block;"></canvas>
      </div>
      <div class="bop-legend-center">
        <div class="bop-leg-header"><span style="color:var(--blue)">↓ ${isEN?'Out':'All.'}</span><span></span><span style="color:var(--orange)">↑ ${isEN?'In':'Ret.'}</span></div>
        <div id="${legendId}"></div>
      </div>
      <div class="bop-pie-col">
        <div class="bop-sens-label" style="color:var(--orange)">↑ ${T('dirInbound')}</div>
        <canvas id="${inId}" style="width:${pieSize}px;height:${pieSize}px;display:block;"></canvas>
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
        drawChrono(document.getElementById(id), segs, tot);
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
      drawChrono(document.getElementById('bopPieA'), d.segsA, d.totalA);
      drawChrono(document.getElementById('bopPieR'), d.segsR, d.totalR);
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


/* ── Handlers hover cadrans chronomètre (scope global) ── */
function _chronoMouseMove(e){
  const canvas=e.currentTarget, c=canvas._chrono;
  if(!c) return;
  const rect=canvas.getBoundingClientRect();
  const px=(e.clientX-rect.left)*(canvas.offsetWidth/rect.width);
  const py=(e.clientY-rect.top)*(canvas.offsetHeight/rect.height);
  const dx=px-c.cx, dy=py-c.cy;
  const dist=Math.sqrt(dx*dx+dy*dy);
  const tt=document.getElementById("pieTooltip");
  if(!tt) return;
  if(dist<c.R_IN||dist>c.R_OUT){tt.style.display="none";return;}
  const TWO_PI=Math.PI*2;
  const normA=a=>((a+Math.PI/2)%TWO_PI+TWO_PI)%TWO_PI;
  const mouseN=normA(Math.atan2(dy,dx));
  const hit=c.segAngles.find(sa=>{
    const s=normA(sa.startA),en=normA(sa.endA);
    return en>=s?(mouseN>=s&&mouseN<en):(mouseN>=s||mouseN<en);
  });
  if(!hit){tt.style.display="none";return;}
  const seg=hit.s;
  tt.style.background=seg.c;
  const icon=(typeof pieIcon==="function")?pieIcon(seg.l):"\u23F1";
  document.getElementById("ptIcon").textContent=icon;
  document.getElementById("ptLabel").textContent=seg.l;
  const val=(typeof fmtMin==="function")?fmtMin(seg.v):seg.v.toFixed(1)+"m";
  document.getElementById("ptVal").textContent=val;
  document.getElementById("ptPct").textContent=Math.round(seg.v/c.total*100)+"%";
  tt.style.display="block";
  const W=tt.offsetWidth||160,H=tt.offsetHeight||70;
  let x=e.clientX+14,y=e.clientY-H/2;
  if(x+W>window.innerWidth-8)x=e.clientX-W-14;
  if(y<8)y=8;
  if(y+H>window.innerHeight-8)y=window.innerHeight-H-8;
  tt.style.left=x+"px";tt.style.top=y+"px";
}
function _chronoMouseLeave(e){
  const tt=document.getElementById("pieTooltip");
  if(tt)tt.style.display="none";
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

