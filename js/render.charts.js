/* ── render.charts.js — BOP, radar, charge, stack cycle ── */

/* ─ Couleur neutre des barres retournement (non paramétrable via COLOR) ─ */
const COLOR_REVERSAL = '#6b7280';

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
    const segsA = [{l: T('bopRunTime'),  v:mPureA, c:C_MA},
                   {l: T('bopPriority'), v:carrA,  c:C_CA},
                   {l: T('bopRecovery'), v:dSA,    c:C_DA},
                   {l: T('bopDwell'),    v:aA,     c:C_AA}];
    const segsR = [{l: T('bopRunTime'),  v:mPureR, c:C_MR},
                   {l: T('bopPriority'), v:carrR,  c:C_CR},
                   {l: T('bopRecovery'), v:dSR,    c:C_DR},
                   {l: T('bopDwell'),    v:aR,     c:C_AR}];
    // Filtrer les segments à 0 pour ne pas polluer le pie
    const filtA = segsA.filter(s=>s.v>0);
    const filtR = segsR.filter(s=>s.v>0);
    return{mA,mR,dSA,dSR,aA,aR,carrA,carrR,mPureA,mPureR,
      totalA: mA+dSA+aA, totalR: mR+dSR+aR,
      segsA: filtA, segsR: filtR,
      allSegsA: segsA, allSegsR: segsR,
    };
  }

  /* ── Chronomètre Canvas : remplace le donut SVG ── */
  function drawChrono(canvasEl, segs, total){
    if(!canvasEl || !segs || total <= 0) return { mStart:-90, mEnd:-90 };

    const dpr = window.devicePixelRatio || 1;
    const CSS = canvasEl.offsetWidth || parseInt(canvasEl.style.width) || 120;
    canvasEl.width  = Math.round(CSS * dpr);
    canvasEl.height = Math.round(CSS * dpr);
    canvasEl.style.width  = CSS + 'px';
    canvasEl.style.height = CSS + 'px';

    const ctx = canvasEl.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, CSS, CSS);

    // ── Couleurs ──
    const cs   = getComputedStyle(document.body);
    const cBg  = cs.getPropertyValue('--bg3').trim()   || '#252b3b';
    const cBg2 = cs.getPropertyValue('--bg2').trim()   || '#1f2435';
    const cBg4 = cs.getPropertyValue('--bg4').trim()   || '#2d3449';
    const cBdr = cs.getPropertyValue('--border').trim()|| '#323854';
    const cTxt = cs.getPropertyValue('--text').trim()  || '#e8eaf0';
    const cT2  = cs.getPropertyValue('--text2').trim() || '#a0a8c0';
    const cT3  = cs.getPropertyValue('--text3').trim() || '#6b748f';

    const cx = CSS/2, cy = CSS/2 + CSS*0.03; // légèrement vers le bas (place pour la couronne)
    const BEZEL = CSS/2 - 2;
    const FACE  = BEZEL - 9;          // bord interne du bezel (zone ticks)
    const R_OUT = FACE - 2;           // bord extérieur de la piste
    const TRACK = Math.max(10, CSS * 0.13); // épaisseur de la piste
    const R_IN  = R_OUT - TRACK;
    const R_MID = (R_OUT + R_IN) / 2;

    // Échelle : 60 min = 360°
    const SCALE   = 60;
    const START_A = -Math.PI / 2;          // 12h en haut
    const totalSweep = Math.min((total / SCALE) * Math.PI * 2, Math.PI * 2);

    // ── Couronne en haut (décorative) ──
    const crownW = CSS * 0.10, crownH = CSS * 0.07;
    ctx.fillStyle = cT3;
    ctx.strokeStyle = cBg;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.rect(cx - crownW/2, cy - BEZEL - crownH + 2, crownW, crownH);
    ctx.fill(); ctx.stroke();
    // Bouton poussoir rond sur la couronne
    ctx.beginPath();
    ctx.arc(cx, cy - BEZEL - crownH + 2 - CSS*0.025, CSS*0.028, 0, Math.PI*2);
    ctx.fillStyle = cBdr; ctx.fill(); ctx.stroke();

    // ── Bezel extérieur (dégradé métallique) ──
    const bzGrad = ctx.createRadialGradient(cx - CSS*0.1, cy - CSS*0.1, FACE*0.3, cx, cy, BEZEL);
    bzGrad.addColorStop(0, cBdr);
    bzGrad.addColorStop(0.6, cT3);
    bzGrad.addColorStop(1, cBg);
    ctx.beginPath(); ctx.arc(cx, cy, BEZEL, 0, Math.PI*2);
    ctx.fillStyle = bzGrad; ctx.fill();

    // ── Face du cadran ──
    ctx.beginPath(); ctx.arc(cx, cy, FACE, 0, Math.PI*2);
    ctx.fillStyle = cBg2; ctx.fill();
    ctx.strokeStyle = cBdr; ctx.lineWidth = 1; ctx.stroke();

    // ── Graduations sur le bezel (60 ticks = 60 min) ──
    for(let m=0; m<60; m++){
      const a = START_A + (m/60) * Math.PI * 2;
      const isMaj5  = m%5  === 0;
      const isMaj15 = m%15 === 0;
      const t0 = FACE + 1;
      const t1 = FACE + (isMaj5 ? (isMaj15 ? 7 : 5) : 3);
      ctx.beginPath();
      ctx.moveTo(cx + t0*Math.cos(a), cy + t0*Math.sin(a));
      ctx.lineTo(cx + t1*Math.cos(a), cy + t1*Math.sin(a));
      ctx.strokeStyle = isMaj5 ? cT2 : cT3;
      ctx.lineWidth   = isMaj5 ? 1.4 : 0.7;
      ctx.stroke();
      // Labels 15, 30, 45 seulement
      if(isMaj15 && m > 0){
        const lr = FACE + 9;
        ctx.fillStyle = cT2;
        ctx.font = `700 ${Math.max(5.5, CSS*0.055)}px Barlow Condensed,sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(m, cx + lr*Math.cos(a), cy + lr*Math.sin(a));
      }
    }

    // ── Piste de fond (arc complet gris) ──
    ctx.beginPath();
    ctx.arc(cx, cy, R_MID, 0, Math.PI*2);
    ctx.lineWidth = TRACK;
    ctx.strokeStyle = cBg4;
    ctx.lineCap = 'butt';
    ctx.stroke();

    // ── Arcs colorés (ARC PARTIEL : 0 → totalSweep) ──
    let angle = START_A;
    const segAngles = [];
    segs.forEach(s => {
      if(s.v <= 0) return;
      const sweep = (s.v / total) * totalSweep;
      ctx.beginPath();
      ctx.arc(cx, cy, R_MID, angle, angle + sweep);
      ctx.lineWidth = TRACK;
      ctx.strokeStyle = s.c;
      ctx.globalAlpha = 0.93;
      ctx.lineCap = 'butt';
      ctx.stroke();
      ctx.globalAlpha = 1;
      segAngles.push({ startA: angle, endA: angle + sweep, s });
      angle += sweep;
    });

    // ── Séparateurs entre segments ──
    segAngles.forEach(sa => {
      ctx.beginPath();
      ctx.moveTo(cx + R_IN * Math.cos(sa.startA), cy + R_IN * Math.sin(sa.startA));
      ctx.lineTo(cx + R_OUT * Math.cos(sa.startA), cy + R_OUT * Math.sin(sa.startA));
      ctx.strokeStyle = cBg2; ctx.lineWidth = 2; ctx.stroke();
    });

    // ── Point de départ (12h) ──
    ctx.beginPath();
    ctx.arc(cx, cy - R_MID, TRACK/2 - 1, 0, Math.PI*2);
    ctx.fillStyle = cBdr; ctx.fill();

    // ── Affichage central : 2 lignes "XX min / YY sec" ──
    const mm  = Math.floor(total);
    const ss  = Math.round((total - mm) * 60);
    const szL = Math.max(11, CSS * 0.175);
    const gap = szL * 0.65;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = cTxt;
    ctx.font = `800 ${szL}px Barlow Condensed,sans-serif`;
    ctx.fillText(`${mm} min`, cx, cy - gap);
    ctx.fillStyle = cT2;
    ctx.fillText(`${ss} s`, cx, cy + gap);

    // ── Stockage hover ──
    canvasEl._chrono = { segs, total, segAngles, cx, cy, R_IN, R_OUT };
    if(!canvasEl._chronoBound){
      canvasEl.addEventListener('mousemove',  _chronoMouseMove);
      canvasEl.addEventListener('mouseleave', _chronoMouseLeave);
      canvasEl._chronoBound = true;
    }

    const first = segAngles[0];
    return {
      mStart: first ? first.startA * 180/Math.PI : -90,
      mEnd:   angle  * 180/Math.PI,
    };
  }

  /* ── Mini-chronomètre : 1 segment, pas de ticks ── */
  function drawMiniChrono(canvas, seg, total){
    if(!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const CSS = canvas.offsetWidth || parseInt(canvas.style.width) || 58;
    canvas.width  = Math.round(CSS * dpr);
    canvas.height = Math.round(CSS * dpr);
    canvas.style.width  = CSS + 'px';
    canvas.style.height = CSS + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, CSS, CSS);

    const cs   = getComputedStyle(document.body);
    const cBg2 = cs.getPropertyValue('--bg2').trim() || '#1f2435';
    const cBg4 = cs.getPropertyValue('--bg4').trim() || '#2d3449';
    const cBdr = cs.getPropertyValue('--border').trim() || '#323854';
    const cTxt = cs.getPropertyValue('--text').trim() || '#e8eaf0';
    const cT3  = cs.getPropertyValue('--text3').trim() || '#6b748f';

    const cx = CSS / 2, cy = CSS / 2;
    const R_OUT = CSS * 0.44;
    const TRACK = Math.max(5, CSS * 0.13);
    const R_MID = R_OUT - TRACK / 2;

    // Face du cadran
    ctx.beginPath();
    ctx.arc(cx, cy, R_OUT + 1.5, 0, Math.PI * 2);
    ctx.fillStyle = cBg2; ctx.fill();
    ctx.strokeStyle = cBdr; ctx.lineWidth = 0.8; ctx.stroke();

    // Piste fond grise
    ctx.beginPath();
    ctx.arc(cx, cy, R_MID, 0, Math.PI * 2);
    ctx.lineWidth = TRACK;
    ctx.strokeStyle = cBg4;
    ctx.lineCap = 'butt';
    ctx.stroke();

    // Arc coloré proportionnel (seg.v / total)
    const isZero = !seg || seg.v <= 0 || !total;
    if(!isZero){
      const sweep = Math.min((seg.v / total) * Math.PI * 2, Math.PI * 2);
      ctx.beginPath();
      ctx.arc(cx, cy, R_MID, -Math.PI / 2, -Math.PI / 2 + sweep);
      ctx.lineWidth = TRACK;
      ctx.strokeStyle = seg.c;
      ctx.globalAlpha = 0.93;
      ctx.lineCap = 'butt';
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Valeur centrale en mm:ss
    const val = isZero ? '—' : fmtMmSs(seg.v);
    const szV = Math.max(8, CSS * 0.21);
    ctx.fillStyle = isZero ? cT3 : cTxt;
    ctx.font = `800 ${szV}px Barlow Condensed,sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(val, cx, cy);
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
      {l:T('cycleOutbound'), v:tA,  c:BRAND.aller},
      {l:T('cycleReversal'), v:cRA, c:COLOR_REVERSAL},
      {l:T('cycleInbound'),  v:tR,  c:BRAND.retour},
      {l:T('cycleReversal'), v:cRR, c:COLOR_REVERSAL},
    ];
    const CSEG_ICONS = ['⬆', '🔁', '⬇', '🔂'];
    if(containerEl) containerEl.innerHTML=CSEGS.map((s,i)=>{
      const p=(s.v/cyc*100).toFixed(1);
      const textColor = s.c===COLOR_REVERSAL ? 'rgba(255,255,255,.8)' : 'rgba(0,0,0,.75)';
      return `<div class="stack-seg" style="width:${p}%;background:${s.c};cursor:pointer;transition:filter .15s;"
        data-label="${s.l}" data-val="${fmtMin(s.v)}" data-pct="${p}" data-col="${s.c}" data-icon="${CSEG_ICONS[i]}"
        onmouseenter="stackSegEnter(this,event)" onmouseleave="stackSegLeave(this)"
        >${parseFloat(p)>=8?`<span style="font-size:.5rem;font-weight:800;color:${textColor};pointer-events:none">${_cycleShowPct?p+'%':fmtMin(s.v)}</span>`:''}</div>`;
    }).join('');
    if(labelEl) labelEl.innerHTML=CSEGS.map((s,i)=>{
      const p=(s.v/cyc*100).toFixed(1);
      const lbl = (i===1) ? `${s.l} (${T('cycleAllAbbr')})` :
                  (i===3) ? `${s.l} (${T('cycleRetAbbr')})` : s.l;
      const val = _cycleShowPct ? `${p}%` : fmtMin(s.v);
      return `<div class="stack-label"><div class="stack-label-dot" style="background:${s.c}"></div>${lbl}<span style="margin-left:.2rem;font-family:'Courier New',monospace;color:var(--text2);font-size:.5rem">${val}</span></div>`;
    }).join('');
    if(totalEl) totalEl.textContent=`Σ Cycle = ${_cycleShowPct ? '100%' : fmtMin(cyc)}`;
  }

  /* Helper : génère HTML chrono (canvas) simplifié */
  function renderBopPies(outId, inId, pieSize){
    const MINI = 58;
    const S = [T('bopRun'), T('bopPriorityShort'), T('bopRecoveryShort'), T('bopDwellShort')];
    function miniCell(id, lbl, color){
      return `<div style="display:flex;flex-direction:column;align-items:center;gap:.1rem;">`
        +`<div style="font-size:.44rem;font-weight:800;color:${color};text-align:center;`
        +`letter-spacing:.04em;text-transform:uppercase;line-height:1.2;margin-bottom:.05rem">${lbl}</div>`
        +`<canvas id="${id}" style="width:${MINI}px;height:${MINI}px;display:block;"></canvas>`
        +`</div>`;
    }
    function miniGroup(ids, lbls, color){
      return `<div style="display:flex;gap:.35rem;">`
        + ids.map((id,i) => miniCell(id, lbls[i], color)).join('')
        +`</div>`;
    }
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:.45rem;">
      <div style="display:flex;align-items:center;justify-content:space-evenly;width:100%;">
        <div class="bop-pie-col">
          <div style="font-size:.6rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--blue);text-align:center;margin-bottom:.25rem;">↓ ${T('dirOutbound')}</div>
          <canvas id="${outId}" style="width:${pieSize}px;height:${pieSize}px;display:block;"></canvas>
        </div>
        <div class="bop-pie-col">
          <div style="font-size:.6rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--orange);text-align:center;margin-bottom:.25rem;">↑ ${T('dirInbound')}</div>
          <canvas id="${inId}" style="width:${pieSize}px;height:${pieSize}px;display:block;"></canvas>
        </div>
      </div>
      <div style="display:flex;justify-content:space-evenly;width:100%;">
        ${miniGroup([outId+'_m0',outId+'_m1'], S.slice(0,2), 'var(--blue)')}
        ${miniGroup([inId+'_m0', inId+'_m1'],  S.slice(0,2), 'var(--orange)')}
      </div>
      <div style="display:flex;justify-content:space-evenly;width:100%;">
        ${miniGroup([outId+'_m2',outId+'_m3'], S.slice(2,4), 'var(--blue)')}
        ${miniGroup([inId+'_m2', inId+'_m3'],  S.slice(2,4), 'var(--orange)')}
      </div>
    </div>`;
  }

  /* ── Diagramme de cycle : bandes horizontales avec coudes ── */
  function drawCycleDiagram(canvas, tA, cRA, tR, cRR, termA, termR){
    if(!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const W   = Math.max(180, canvas.offsetWidth || parseInt(canvas.style.width) || 340);
    const H   = canvas.offsetHeight || parseInt(canvas.style.height) || 145;
    canvas.width  = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr); ctx.clearRect(0, 0, W, H);

    const cs = getComputedStyle(document.body);
    const g  = v => cs.getPropertyValue(v).trim();
    const cBg2=g('--bg2')||'#1f2435', cBg4=g('--bg4')||'#2d3449';
    const cBdr=g('--border')||'#323854', cTxt=g('--text')||'#e8eaf0';
    const cT2=g('--text2')||'#a0a8c0', cT3=g('--text3')||'#6b748f';
    const C_A=BRAND.aller, C_TA=shadeColor(BRAND.aller,-26);
    const C_R=BRAND.retour, C_TR=shadeColor(BRAND.retour,-26);

    const cyc = tA + cRA + tR + cRR;
    if(cyc <= 0) return;

    // ── Layout ──
    const sz    = Math.max(7.5, W * 0.024);
    const CONN  = Math.max(12, H * 0.095);
    const PAD_L = 10;
    const TIP_W = Math.max(22, H * 0.17);
    const PAD_R = TIP_W + sz * 3.8 + 8;
    const PTOP  = sz * 2.3 + CONN + 3;
    const PBOT  = sz * 2.3 + CONN + sz * 1.3 + 8;
    const drawW = W - PAD_L - PAD_R;
    const drawH = Math.max(24, H - PTOP - PBOT);

    // ── Band heights proportional, minimum 5px ──
    const MIN_B = 5;
    const raws  = [tA, cRA, tR, cRR].map(v => Math.max(MIN_B, (v/cyc)*drawH));
    const scH   = drawH / raws.reduce((a,b)=>a+b,0);
    const [hA, hTA, hR, hTR] = raws.map(h => h * scH);

    // ── Y coordinates (top-down: termA, aller, retour, termR)
    //    Le plus récent rejoint le bord le plus proche ──
    const yTA0 = PTOP;            // terminus aller  ← topmost (le plus récent du groupe)
    const yTA1 = yTA0 + hTA;     // aller
    const yA1  = yTA1 + hA;      // retour
    const yR1  = yA1  + hR;      // terminus retour
    const yTR1 = yR1  + hTR;
    const connTopY = yTA0 - CONN;
    const connBotY = yTR1 + CONN;

    // ── X coordinates ──
    const scX  = drawW / cyc;
    const x0   = PAD_L;
    const xEnd = PAD_L + drawW;
    const xA   = PAD_L + tA * scX;
    const xRA  = PAD_L + (tA + cRA) * scX;
    const xR   = PAD_L + (tA + cRA + tR) * scX;

    // ── Draw helpers ──
    function drawAllerBand(){
      const r = Math.min(hA * 0.42, 12);
      ctx.beginPath();
      ctx.moveTo(x0, yTA1 + r);
      ctx.quadraticCurveTo(x0, yTA1, x0 + r, yTA1);
      ctx.lineTo(xEnd, yTA1); ctx.lineTo(xEnd, yA1);
      ctx.lineTo(x0 + r, yA1);
      ctx.quadraticCurveTo(x0, yA1, x0, yA1 - r);
      ctx.closePath();
      ctx.fillStyle = C_A; ctx.globalAlpha = 0.9; ctx.fill(); ctx.globalAlpha = 1;
    }

    // Connector entering from above at xc, transitioning to band at yt..yb going right
    function connTop(xc, yt, yb, col){
      const bh = yb - yt, xl = xc - bh/2, xr2 = xc + bh/2;
      const r  = Math.min(bh * 0.4, 8);
      ctx.fillStyle = col; ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.moveTo(xl, connTopY);
      ctx.lineTo(xr2, connTopY);
      ctx.lineTo(xr2, yt + r);
      ctx.quadraticCurveTo(xr2, yt, xr2 + r, yt);
      ctx.lineTo(xEnd, yt); ctx.lineTo(xEnd, yb);
      ctx.lineTo(xl + r, yb);
      ctx.quadraticCurveTo(xl, yb, xl, yb - r);
      ctx.lineTo(xl, connTopY);
      ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
    }

    // Connector entering from below at xc, transitioning to band at yt..yb going right
    function connBot(xc, yt, yb, col){
      const bh = yb - yt, xl = xc - bh/2, xr2 = xc + bh/2;
      const r  = Math.min(bh * 0.4, 8);
      ctx.fillStyle = col; ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.moveTo(xl, connBotY);
      ctx.lineTo(xr2, connBotY);
      ctx.lineTo(xr2, yb - r);
      ctx.quadraticCurveTo(xr2, yb, xr2 + r, yb);
      ctx.lineTo(xEnd, yb); ctx.lineTo(xEnd, yt);
      ctx.lineTo(xl + r, yt);
      ctx.quadraticCurveTo(xl, yt, xl, yt + r);
      ctx.lineTo(xl, connBotY);
      ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
    }

    // ── Render bands ──
    drawAllerBand();                              // aller = 2e rang (sous terminus aller)
    connTop(xA,  yTA0, yTA1, C_TA);              // terminus aller = rang 1 (le plus en haut)
    connBot(xRA, yA1,  yR1,  C_R);              // retour = 3e rang
    connBot(xR,  yR1,  yTR1, C_TR);             // terminus retour = rang 4 (le plus en bas)

    // ── Arrow tip ──
    const tipX = xEnd + TIP_W, tipY = (yTA0 + yTR1) / 2;
    ctx.beginPath();
    ctx.moveTo(xEnd, yTA0 - 1); ctx.lineTo(tipX, tipY); ctx.lineTo(xEnd, yTR1 + 1);
    ctx.closePath(); ctx.fillStyle = cTxt; ctx.globalAlpha = 0.85; ctx.fill(); ctx.globalAlpha = 1;

    // ── Total time — centré sur tipY ──
    const mm2 = Math.floor(cyc), ss2 = Math.round((cyc - mm2) * 60);
    const szT = Math.max(8.5, sz * 1.0);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = cTxt; ctx.font = `800 ${szT}px Barlow Condensed,sans-serif`;
    ctx.fillText(`${mm2}min`, tipX + 5, tipY - szT * 0.52);
    ctx.fillStyle = cT2; ctx.font = `600 ${szT * 0.87}px Barlow Condensed,sans-serif`;
    ctx.fillText(`${ss2}s`, tipX + 5, tipY + szT * 0.52);

    // ── Axis ──
    const axisY = Math.round(connBotY + sz * 2.4 + 6);
    ctx.beginPath(); ctx.moveTo(x0, axisY); ctx.lineTo(xEnd + 8, axisY);
    ctx.strokeStyle = cT3; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(xEnd+8, axisY-3); ctx.lineTo(xEnd+14, axisY); ctx.lineTo(xEnd+8, axisY+3);
    ctx.strokeStyle = cT3; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.fillStyle = cT3; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.font = `500 ${sz * 0.82}px Barlow Condensed,sans-serif`;
    ctx.fillText(T('cycleTimeAxis'), xEnd + 18, axisY);
    // Ticks
    const step = cyc<=20?5:cyc<=60?10:cyc<=120?20:30;
    ctx.textAlign = 'center'; ctx.fillStyle = cT3;
    for(let t=0; t<=Math.ceil(cyc)+step/2; t+=step){
      const tx = PAD_L + t * scX;
      if(tx > xEnd + 4) break;
      ctx.beginPath(); ctx.moveTo(tx, axisY); ctx.lineTo(tx, axisY+3);
      ctx.strokeStyle = cT3; ctx.lineWidth = 0.7; ctx.stroke();
      ctx.fillText(String(t), tx, axisY + 3 + sz * 0.5);
    }

    // ── Labels above ──
    const szL = sz, szV = sz * 0.84;
    const trunc = (s,n) => s&&s.length>n ? s.slice(0,n)+'…' : (s||'—');
    function lblAbove(x, name, val, col, align){
      ctx.textAlign = align||'center'; ctx.textBaseline = 'bottom';
      ctx.fillStyle = col; ctx.font = `700 ${szL}px Barlow Condensed,sans-serif`;
      ctx.fillText(name, x, connTopY - 2);
      ctx.fillStyle = cT2; ctx.font = `600 ${szV}px Barlow Condensed,sans-serif`;
      ctx.fillText(val, x, connTopY - 2 - szL - 1);
    }
    function lblBelow(x, name, val, col){
      const top = connBotY + 2;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillStyle = col; ctx.font = `700 ${szL}px Barlow Condensed,sans-serif`;
      ctx.fillText(name, x, top);
      ctx.fillStyle = cT2; ctx.font = `600 ${szV}px Barlow Condensed,sans-serif`;
      ctx.fillText(val, x, top + szL + 1);
    }
    lblAbove(x0+4, T('cycleDirOut'),              fmtMmSs(0),               C_A,  'left');
    lblAbove(xA,   trunc(termR||T('cycleTermA'),14),                   fmtMmSs(tA),              C_TA);
    lblBelow(xRA,  T('cycleDirIn'),               fmtMmSs(tA + cRA),        C_R);
    lblBelow(xR,   trunc(termA||T('cycleTermR'),14),                      fmtMmSs(tA + cRA + tR),  C_TR);

    // ── Hover ──
    const SEGS = [
      {l:T('cycleOutShort'),                       v:tA,  c:C_A,  icon:'↓', x0:x0,  x1:xEnd, y0:yTA1, y1:yA1  },
      {l:trunc(termR||T('cycleTermA'),28),          v:cRA, c:C_TA, icon:'🔁', x0:xA,  x1:xEnd, y0:yTA0, y1:yTA1 },
      {l:T('cycleInShort'),                        v:tR,  c:C_R,  icon:'↑', x0:xRA, x1:xEnd, y0:yA1,  y1:yR1  },
      {l:trunc(termA||T('cycleTermR'),28),          v:cRR, c:C_TR, icon:'🔂', x0:xR,  x1:xEnd, y0:yR1,  y1:yTR1 },
    ];
    const TIP_BOX = { x0:xEnd, x1:tipX+6, y0:yTA0-2, y1:yTR1+2 };
    canvas._cycleDiag = { SEGS, cyc, TIP_BOX, cBg4, cTxt };
    if(!canvas._cdBound){
      canvas.addEventListener('mousemove',  _cycleDiagMouseMove);
      canvas.addEventListener('mouseleave', _cycleDiagMouseLeave);
      canvas._cdBound = true;
    }
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
          ${renderBopPies('bopA_PieA','bopA_PieR', 100)}
        </div>
        <div style="height:1px;background:var(--border);margin:0 .5rem"></div>
        <div>
          <div style="font-size:.58rem;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.08em;margin-bottom:.3rem">${trB.label}</div>
          ${renderBopPies('bopB_PieA','bopB_PieR', 100)}
        </div>
      </div>`;

    requestAnimationFrame(()=>{
      [['bopA_PieA',dA.segsA,dA.totalA],['bopA_PieR',dA.segsR,dA.totalR],
       ['bopB_PieA',dB.segsA,dB.totalA],['bopB_PieR',dB.segsR,dB.totalR]].forEach(([id,segs,tot])=>{
        drawChrono(document.getElementById(id), segs, tot);
      });
      [['bopA_PieA',dA.allSegsA,dA.totalA],['bopA_PieR',dA.allSegsR,dA.totalR],
       ['bopB_PieA',dB.allSegsA,dB.totalA],['bopB_PieR',dB.allSegsR,dB.totalR]].forEach(([pid,allSegs,tot])=>{
        allSegs.forEach((seg,i)=>drawMiniChrono(document.getElementById(pid+'_m'+i), seg, tot));
      });
    });

    cycleCardEl.innerHTML=`
      <div class="chart-card-title">${T('chartCycleTitle')}</div>
      <div style="display:flex;flex-direction:column;gap:.75rem;">
        <div>
          <div style="font-size:.58rem;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:.3rem">${trA.label}</div>
          <canvas id="cycleDiagA" style="width:100%;height:130px;display:block;"></canvas>
        </div>
        <div style="height:1px;background:var(--border);margin:0 .5rem"></div>
        <div>
          <div style="font-size:.58rem;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:.3rem">${trB.label}</div>
          <canvas id="cycleDiagB" style="width:100%;height:130px;display:block;"></canvas>
        </div>
      </div>`;
    requestAnimationFrame(()=>{
      const trs     = getTerminusForSc(currentSc).troncons||[];
      const trA_ret = trs[0]||{};
      const trB_ret = trs[1]||{};
      const def     = {totalSec:420};
      drawCycleDiagram(
        document.getElementById('cycleDiagA'),
        dA.mA+dA.dSA+dA.aA, ((trA_ret.retA)||def).totalSec/60,
        dA.mR+dA.dSR+dA.aR, ((trA_ret.retR)||def).totalSec/60,
        trA_ret.termA, trA_ret.termR
      );
      drawCycleDiagram(
        document.getElementById('cycleDiagB'),
        dB.mA+dB.dSA+dB.aA, ((trB_ret.retA)||def).totalSec/60,
        dB.mR+dB.dSR+dB.aR, ((trB_ret.retR)||def).totalSec/60,
        trB_ret.termA, trB_ret.termR
      );
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
      ${renderBopPies('bopPieA','bopPieR', 134)}`;

    requestAnimationFrame(()=>{
      drawChrono(document.getElementById('bopPieA'), d.segsA, d.totalA);
      drawChrono(document.getElementById('bopPieR'), d.segsR, d.totalR);
      d.allSegsA.forEach((seg,i)=>drawMiniChrono(document.getElementById('bopPieA_m'+i), seg, d.totalA));
      d.allSegsR.forEach((seg,i)=>drawMiniChrono(document.getElementById('bopPieR_m'+i), seg, d.totalR));
    });

    cycleCardEl.innerHTML=`
      <div class="chart-card-title">${T('chartCycleTitle')}</div>
      <canvas id="cycleDiag" style="width:100%;height:145px;display:block;margin-top:.3rem;"></canvas>`;
    requestAnimationFrame(()=>{
      const {termA, termR, retA, retR} = getTerminusForSc(currentSc);
      const def = {totalSec:420};
      drawCycleDiagram(
        document.getElementById('cycleDiag'),
        d.mA+d.dSA+d.aA, ((retA)||def).totalSec/60,
        d.mR+d.dSR+d.aR, ((retR)||def).totalSec/60,
        termA, termR
      );
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

/* ── Handlers hover diagramme de cycle ── */
function _cycleDiagMouseMove(e){
  const canvas=e.currentTarget, c=canvas._cycleDiag;
  if(!c) return;
  const rect=canvas.getBoundingClientRect();
  const px=(e.clientX-rect.left)*(canvas.offsetWidth/rect.width);
  const py=(e.clientY-rect.top)*(canvas.offsetHeight/rect.height);
  const tt=document.getElementById('pieTooltip');
  if(!tt) return;

  // ── Hover sur la pointe : affiche le cycle total ──
  if(c.TIP_BOX && px>=c.TIP_BOX.x0 && px<=c.TIP_BOX.x1 && py>=c.TIP_BOX.y0 && py<=c.TIP_BOX.y1){
    canvas.style.cursor='pointer';
    tt.style.background = c.cBg4||'#2d3449';
    document.getElementById('ptIcon').textContent='🔄';
    document.getElementById('ptLabel').textContent=T('cycleTotal');
    document.getElementById('ptVal').textContent=fmtHhMmSs(c.cyc);
    document.getElementById('ptPct').textContent='100%';
    tt.style.display='block';
    const W2=tt.offsetWidth||160,H2=tt.offsetHeight||70;
    let x=e.clientX+14,y=e.clientY-H2/2;
    if(x+W2>window.innerWidth-8)x=e.clientX-W2-14;
    if(y<8)y=8;
    if(y+H2>window.innerHeight-8)y=window.innerHeight-H2-8;
    tt.style.left=x+'px';tt.style.top=y+'px';
    return;
  }

  const hit=c.SEGS.find(s=>px>=s.x0&&px<=s.x1&&py>=s.y0&&py<=s.y1);
  if(!hit){tt.style.display='none';canvas.style.cursor='default';return;}
  canvas.style.cursor='pointer';
  tt.style.background=hit.c;
  document.getElementById('ptIcon').textContent=hit.icon;
  document.getElementById('ptLabel').textContent=hit.l;
  document.getElementById('ptVal').textContent=fmtMmSs(hit.v);
  document.getElementById('ptPct').textContent=Math.round(hit.v/c.cyc*100)+'%';
  tt.style.display='block';
  const W2=tt.offsetWidth||160,H2=tt.offsetHeight||70;
  let x=e.clientX+14,y=e.clientY-H2/2;
  if(x+W2>window.innerWidth-8)x=e.clientX-W2-14;
  if(y<8)y=8;
  if(y+H2>window.innerHeight-8)y=window.innerHeight-H2-8;
  tt.style.left=x+'px';tt.style.top=y+'px';
}
function _cycleDiagMouseLeave(e){
  const tt=document.getElementById('pieTooltip');
  if(tt)tt.style.display='none';
  e.currentTarget.style.cursor='default';
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
      <span style="font-size:.5rem;color:var(--text3)">→ ${m.veh} ${T('depotInSvc')}</span>
    </div>`;
  }).join('');
}