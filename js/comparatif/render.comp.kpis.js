/* ── render.comp.kpis.js — computeKPIsAll + renderComparatif (orchestrateur) ── */
/* Doit être chargé en DERNIER parmi les fichiers render.comp.*.js            */

function computeKPIsAll(){
  if(!LINE || !LINE.scenarios || LINE.scenarios.length === 0) return [];

  const savedStations     = LINE.stations;
  const savedInter        = LINE.inter;
  const savedRetournement = LINE.retournement;
  const savedTendu        = LINE.tendu;
  const savedTenduR       = LINE.tenduR;
  const savedDetenteA     = LINE.detenteA;
  const savedDetenteR     = LINE.detenteR;

  const results = [];
  LINE.scenarios.forEach((sc, i) => {
    try {
      // Injecter les données du scénario i
      if(LINE.scenariosData && LINE.scenariosData[i]){
        const d = LINE.scenariosData[i];
        LINE.stations     = d.stations;
        LINE.inter        = d.inter;
        LINE.retournement = d.retournement;
        LINE.tendu        = d.tendu;
        LINE.tenduR       = d.tenduR;
        LINE.detenteA     = d.detenteA;
        LINE.detenteR     = d.detenteR;
      }
      const k = computeKPIs(i);
      const tPrioA = LINE.inter.reduce((a,seg)=>a+(seg.tpsA||0),0)/60;
      const tPrioR = LINE.inter.reduce((a,seg)=>a+(seg.tpsR||0),0)/60;
      const nSt = LINE.stations.length || 1;
      const moyMontees   = LINE.stations.reduce((a,s)=>a+(s.monteesA||0),0) / nSt;
      const moyDescentes = LINE.stations.reduce((a,s)=>a+(s.descentesA||0),0) / nSt;
      const nStations    = nSt;
      const distInterMoy = LINE.inter.length > 0
        ? +(LINE.inter.reduce((a,b)=>a+b.dist,0) / LINE.inter.length).toFixed(0)
        : 0;

      results.push({
        ...k, sc, scIdx:i,
        tPrioA, tPrioR, tPrioTotal: tPrioA + tPrioR,
        moyMontees, moyDescentes, nStations, distInterMoy,
        smrCapacite: sc.smrCapacite ?? null
      });
    } catch(e){
      console.error(`[computeKPIsAll] erreur scénario ${i} (${sc?.id}):`, e);
    }
  });

  // Restaurer les données du scénario courant
  LINE.stations     = savedStations;
  LINE.inter        = savedInter;
  LINE.retournement = savedRetournement;
  LINE.tendu        = savedTendu;
  LINE.tenduR       = savedTenduR;
  LINE.detenteA     = savedDetenteA;
  LINE.detenteR     = savedDetenteR;

  return results;
}

function renderComparatif(){
  if(!LINE){ console.warn('[renderComparatif] LINE is null'); return; }
  let all;
  try { all = computeKPIsAll(); } catch(e){ console.error('[renderComparatif] computeKPIsAll threw:', e); return; }
  console.log('[renderComparatif] all.length =', all.length, '| scenarios =', LINE.scenarios.length);
  if(all.length === 0){
    document.getElementById('radarScSelector').innerHTML  = '';
    document.getElementById('chargeScSelector').innerHTML = '';
    const el = document.getElementById('radarCanvas');
    if(el){ const ctx=el.getContext('2d'); ctx.clearRect(0,0,el.width,el.height); }
    return;
  }

  const SC_COLORS = [BRAND.aller, BRAND.retour, BRAND.primaire2, BRAND.cycle, BRAND.primaire1,'#e8453c'];

  // ── Radar : nominaux uniquement ──
  if(!radarActiveScenarios || radarActiveScenarios.size === 0)
    radarActiveScenarios = new Set(all.map((_,i)=>i).filter(i=>all[i].sc.type==='NOMINAL'));
  for(const idx of radarActiveScenarios)
    if(idx>=all.length||all[idx].sc.type!=='NOMINAL') radarActiveScenarios.delete(idx);

  const radarSel = document.getElementById('radarScSelector');
  radarSel.innerHTML = all.map((k,i)=>{
    if(k.sc.type !== 'NOMINAL') return '';
    const col=SC_COLORS[i%SC_COLORS.length], on=radarActiveScenarios.has(i);
    return `<button class="radar-sc-btn${on?' on':''}" style="border-color:${col};color:${col};${on?`background:${col}22`:''}" onclick="toggleRadarSc(${i})">${k.sc.label}</button>`;
  }).join('');

  const SPFiltered = all.filter((_,i)=>radarActiveScenarios.has(i));
  const allNominal = all.filter(d => (d.sc.type||'NOMINAL').toUpperCase() === 'NOMINAL');

  // ── Montées/Descentes : sélection unique ──
  if (bubbleActiveSc === null || bubbleActiveSc >= allNominal.length) bubbleActiveSc = 0;
  _buildBubbleScPills(allNominal);

  try { renderRadar(all, SPFiltered); }          catch(e){ console.error('[renderComparatif] renderRadar:', e); }
  try { renderBubbleChart(allNominal, bubbleActiveSc); } catch(e){ console.error('[renderComparatif] renderBubbleChart:', e); }
  try { renderCompTable(all); }                  catch(e){ console.error('[renderComparatif] renderCompTable:', e); }
  try { renderSPMatrix(); }                      catch(e){ console.error('[renderComparatif] renderSPMatrix:', e); }
  try { renderCompTerminus(all); }               catch(e){ console.error('[renderComparatif] renderCompTerminus:', e); }
}

/* ── Handlers UI ── */
function toggleRadarSc(idx){
  if(!radarActiveScenarios) radarActiveScenarios = new Set();
  if(radarActiveScenarios.has(idx)){ if(radarActiveScenarios.size>1) radarActiveScenarios.delete(idx); }
  else radarActiveScenarios.add(idx);
  if(LINE) renderComparatif();
}

function selectBubbleSc(idx){
  bubbleActiveSc = idx;
  _buildBubbleScPills(window._lastBubbleAll || []);
  if(LINE) renderBubbleChart(window._lastBubbleAll || [], bubbleActiveSc);
}

function setBubbleDir(dir){
  bubbleDir = dir;
  const btnA = document.getElementById('bubbleDirBtnA');
  const btnR = document.getElementById('bubbleDirBtnR');
  if(btnA) btnA.classList.toggle('active', dir === 'aller');
  if(btnR) btnR.classList.toggle('active', dir === 'retour');
  if(LINE) renderBubbleChart(window._lastBubbleAll || [], bubbleActiveSc);
}

function _buildBubbleScPills(all){
  const sel = document.getElementById('chargeScSelector');
  if(!sel) return;
  window._lastBubbleAll = all;
  sel.innerHTML = all.map((k,i)=>`
    <div class="sc-pill${i===bubbleActiveSc?' on':''}"
         onclick="selectBubbleSc(${i})">${k.sc.label}</div>
  `).join('');
}
