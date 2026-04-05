/* ── render.comp.terminus.js — Comparaison terminus inter-scénarios ── */

let _termCmpTermFilter = null;
let _termCmpScFilter   = null;
let TERM_CATEGORIES    = []; // from master PARAMETRE sheet B2:BXX

/* ── Palettes couleur catégories terminus ── */
const _CAT_PALETTES = [
  ['#3b82f6','#60a5fa','#93c5fd','#bfdbfe'],  // blue family
  ['#10b981','#34d399','#6ee7b7','#a7f3d0'],  // green family
  ['#f59e0b','#fbbf24','#fcd34d','#fde68a'],  // amber family
  ['#8b5cf6','#a78bfa','#c4b5fd','#ddd6fe'],  // violet family
  ['#ef4444','#f87171','#fca5a5','#fecaca'],  // red family
  ['#06b6d4','#22d3ee','#67e8f9','#a5f3fc'],  // cyan family
  ['#ec4899','#f472b6','#f9a8d4','#fbcfe8'],  // pink family
  ['#84cc16','#a3e635','#bef264','#d9f99d'],  // lime family
];
const _CAT_EMOJIS = ['🚶','🔧','⏸','🚌','🔄','🏁','⚡','🛤️'];

/* ── Collecte toutes les données terminus pour tous les scénarios ── */
function _getScTermData(all){
  const saved = {stations:LINE.stations, inter:LINE.inter, retournement:LINE.retournement,
    tendu:LINE.tendu, tenduR:LINE.tenduR, detenteA:LINE.detenteA, detenteR:LINE.detenteR};
  const result = [];
  all.forEach(k => {
    try {
      if(LINE.scenariosData && LINE.scenariosData[k.scIdx]){
        const d = LINE.scenariosData[k.scIdx];
        LINE.stations=d.stations; LINE.inter=d.inter; LINE.retournement=d.retournement;
        LINE.tendu=d.tendu; LINE.tenduR=d.tenduR; LINE.detenteA=d.detenteA; LINE.detenteR=d.detenteR;
      }
      const tsc = getTerminusForSc(k.scIdx);
      result.push({sc:k.sc, scIdx:k.scIdx, termA:tsc.termA, retA:tsc.retA, termR:tsc.termR, retR:tsc.retR});
    } catch(e) {
      console.warn('[_getScTermData] skip scénario', k.scIdx, e.message);
    }
  });
  Object.assign(LINE, saved);
  return result;
}

/* ── Occ → style ── */
function _occStyle(occ, label){
  const k=(occ||label||'').toLowerCase();
  if(k.includes('arriv')||k.includes('descent')) return {emoji:'🚶',col:BRAND.aller||'#4a9eff'};
  if(k.includes('depart')||k.includes('départ')||k.includes('monter')||k.includes('montée')) return {emoji:'🚶',col:BRAND.primaire2||'#3ecf6a'};
  if(k.includes('manoe')||k.includes('manoeu')||k.includes('retour')) return {emoji:'🔧',col:BRAND.primaire1||'#a06bff'};
  if(k.includes('pause')||k.includes('attente')) return {emoji:'⏸',col:BRAND.retour||'#f5a623'};
  return {emoji:'🕐',col:BRAND.cycle||'#cf3e9e'};
}

/* ═══ Treemap hiérarchique catégorie > sous-catégorie ═══ */
function _buildTreemap(ret){
  const W=220, H=110;
  if(!ret||!ret.params||!ret.totalSec)
    return `<div style="width:${W}px;height:${H}px;background:var(--bg4);border-radius:4px;display:flex;align-items:center;justify-content:center;color:var(--text3);font-size:.55rem;">—</div>`;

  const total  = ret.totalSec;
  const params = ret.params.filter(p=>p.sec>0);

  const catOrder = TERM_CATEGORIES.length ? TERM_CATEGORIES : [];
  const catMap   = new Map(); // catName → {sec, subs:[{label,sec}]}

  params.forEach(p=>{
    const cat = (p.categorie||p.occ||p.label||'Autre').trim() || 'Autre';
    if(!catMap.has(cat)) catMap.set(cat, {sec:0, subs:[]});
    const entry = catMap.get(cat);
    entry.sec  += p.sec;
    entry.subs.push({label:p.label, sec:p.sec});
  });

  // Order categories: first by TERM_CATEGORIES order, then remainder
  const orderedCats = [];
  catOrder.forEach(n=>{ if(catMap.has(n)) orderedCats.push(n); });
  catMap.forEach((_,n)=>{ if(!orderedCats.includes(n)) orderedCats.push(n); });

  // Assign palette per category
  const catStyles = {};
  orderedCats.forEach((n,i)=>{
    const pal = _CAT_PALETTES[i % _CAT_PALETTES.length];
    const emoji = _CAT_EMOJIS[i % _CAT_EMOJIS.length];
    catStyles[n] = {pal, emoji};
  });

  /* Splits horizontalement par catégorie, verticalement pour sous-catégories */
  let html = '';
  let xCursor = 0;

  orderedCats.forEach(catName => {
    const entry  = catMap.get(catName);
    const catW   = W * (entry.sec / total);
    const style  = catStyles[catName];
    const catPct = Math.round(entry.sec/total*100);

    const catLblH = 18;
    const innerH  = H - catLblH;
    const fs      = Math.min(11, Math.max(7, Math.floor(catW/catName.length*1.4)));

    html += `<div style="position:absolute;left:${xCursor.toFixed(1)}px;top:0;width:${catW.toFixed(1)}px;height:${catLblH}px;
      background:${style.pal[0]};display:flex;align-items:center;justify-content:center;
      border-right:1px solid var(--bg2);box-sizing:border-box;cursor:pointer;transition:opacity .12s,filter .12s;"
      data-label="${catName}"
      data-val="${fmtMin(entry.sec/60)}"
      data-pct="${catPct}"
      data-col="${style.pal[0]}"
      data-icon="${style.emoji}"
      onmouseenter="termTreeEnter(this,event)" onmouseleave="termTreeLeave(this)">
      <span style="font-size:${fs}px;font-weight:800;color:#fff;overflow:hidden;white-space:nowrap;
        text-overflow:ellipsis;padding:0 2px;pointer-events:none;">
        ${catW>30?style.emoji+' ':''}${catW>50?catName:''}
      </span>
    </div>`;

    let yCursor = catLblH;
    const subs  = entry.subs.filter(s=>s.sec>0);
    subs.forEach((sub, si) => {
      const subH   = si<subs.length-1 ? innerH*(sub.sec/entry.sec) : (H - yCursor);
      const subCol = style.pal[Math.min(si+1, style.pal.length-1)];
      const subPct = Math.round(sub.sec/total*100);

      html += `<div style="position:absolute;left:${xCursor.toFixed(1)}px;top:${yCursor.toFixed(1)}px;
        width:${catW.toFixed(1)}px;height:${subH.toFixed(1)}px;
        background:${subCol};opacity:.9;box-sizing:border-box;
        border-right:1px solid var(--bg2);border-bottom:1px solid var(--bg2);
        display:flex;align-items:center;justify-content:center;cursor:pointer;transition:opacity .12s,filter .12s;"
        data-label="${catName} › ${sub.label}"
        data-val="${fmtMin(sub.sec/60)}"
        data-pct="${subPct}"
        data-col="${subCol}"
        data-icon="${style.emoji}"
        onmouseenter="termTreeEnter(this,event)" onmouseleave="termTreeLeave(this)">
        ${subH>18&&catW>28?`<span style="font-size:8px;font-weight:700;pointer-events:none;color:rgba(0,0,0,.75);overflow:hidden;white-space:nowrap;text-overflow:ellipsis;padding:0 3px;">${catW>50?sub.label:''}</span>`:''}
      </div>`;
      yCursor += subH;
    });

    xCursor += catW;
  });

  return `<div style="position:relative;width:${W}px;height:${H}px;border-radius:4px;overflow:hidden;border:1px solid var(--border);">${html}</div>`;
}

function termTreeEnter(el, evt){
  el.style.opacity='1';
  el.style.filter='brightness(1.25)';
  const tt=document.getElementById('pieTooltip');
  tt.style.background=el.dataset.col;
  document.getElementById('ptIcon').textContent=el.dataset.icon;
  document.getElementById('ptLabel').textContent=el.dataset.label;
  document.getElementById('ptVal').textContent=el.dataset.val;
  document.getElementById('ptPct').textContent=el.dataset.pct+'%';
  tt.style.display='block';
  _movePieTooltip(evt);
  el.addEventListener('mousemove',_movePieTooltip);
}
function termTreeLeave(el){
  el.style.opacity='.82';
  el.style.filter='';
  document.getElementById('pieTooltip').style.display='none';
  el.removeEventListener('mousemove',_movePieTooltip);
}

/* ── Rendu principal ── */
function renderCompTerminus(all){
  const el=document.getElementById('compTermContent');
  if(!el) return;
  if(!all||!all.length||!LINE){el.innerHTML='<div style="color:var(--text3);font-size:.6rem;padding:.5rem;">—</div>';return;}

  const scTermData=_getScTermData(all);

  const allTermNames=[];
  const seenT=new Set();
  scTermData.forEach(d=>[d.termA,d.termR].forEach(n=>{if(!seenT.has(n)){seenT.add(n);allTermNames.push(n);}}));

  const termNames=_termCmpTermFilter?allTermNames.filter(n=>_termCmpTermFilter.has(n)):allTermNames;
  const scData=_termCmpScFilter?scTermData.filter(d=>_termCmpScFilter.has(d.scIdx)):scTermData;

  const SC_COLORS=[BRAND.aller,BRAND.retour,BRAND.primaire2,BRAND.cycle,BRAND.primaire1,'#e8453c'];

  // ── Légende globale par catégorie ──
  const catLegMap = new Map();
  scTermData.forEach(d=>[d.retA,d.retR].forEach(ret=>{
    if(!ret||!ret.params)return;
    ret.params.forEach(p=>{
      const catName=(p.categorie||p.occ||p.label||'Autre').trim()||'Autre';
      const catOrder2=TERM_CATEGORIES.length?TERM_CATEGORIES:[];
      const ordIdx=catOrder2.indexOf(catName)>=0?catOrder2.indexOf(catName):[...catLegMap.keys()].length;
      const pal=_CAT_PALETTES[ordIdx%_CAT_PALETTES.length];
      const emoji=_CAT_EMOJIS[ordIdx%_CAT_EMOJIS.length];
      if(!catLegMap.has(catName)) catLegMap.set(catName,{emoji,col:pal[0],subs:new Map()});
      const catEntry=catLegMap.get(catName);
      if(!catEntry.subs.has(p.label)){
        const subIdx=catEntry.subs.size;
        catEntry.subs.set(p.label,{col:pal[Math.min(subIdx+1,pal.length-1)]});
      }
    });
  }));
  const legend=[...catLegMap.entries()].map(([catName,catData])=>
    `<div style="display:flex;flex-direction:column;gap:.2rem;">
      <div style="display:flex;align-items:center;gap:.3rem;font-size:.55rem;font-weight:800;color:var(--text);font-family:var(--fontb);">
        <div style="width:12px;height:12px;border-radius:2px;background:${catData.col};flex-shrink:0;"></div>${catData.emoji} ${catName}
      </div>
      ${[...catData.subs.keys()].map(subLbl=>
        `<div style="font-size:.48rem;color:var(--text3);font-family:var(--fontb);padding-left:.9rem;line-height:1.5;">• ${subLbl}</div>`
      ).join('')}
    </div>`
  ).join('');

  // ── Filtres ──
  const termOpts=allTermNames.map(n=>{
    const chk=(!_termCmpTermFilter||_termCmpTermFilter.has(n))?'checked':'';
    return `<label class="col-picker-item"><input type="checkbox" ${chk} onchange="_termCmpTermCh(event,'${n.replace(/'/g,"\\'").replace(/"/g,"&quot;")}')"> ${n}</label>`;
  }).join('');
  const scOpts=all.map((d,i)=>{
    const chk=(!_termCmpScFilter||_termCmpScFilter.has(d.scIdx))?'checked':'';
    return `<label class="col-picker-item"><input type="checkbox" ${chk} onchange="_termCmpScCh(event,${d.scIdx})"> ${d.sc.label}</label>`;
  }).join('');

  const filters=`<div style="display:flex;gap:.75rem;flex-wrap:wrap;margin-bottom:.6rem;">
    <div class="col-picker-wrap">
      <button class="col-picker-btn" onclick="_toggleTermPicker(event,'_tcp1')">🚉 Terminus ▾</button>
      <div class="col-picker-dropdown" id="_tcp1">${termOpts}</div>
    </div>
    <div class="col-picker-wrap">
      <button class="col-picker-btn" onclick="_toggleTermPicker(event,'_tcp2')">📋 Scénarios ▾</button>
      <div class="col-picker-dropdown" id="_tcp2">${scOpts}</div>
    </div>
  </div>`;

  // ── Table ──
  const thead=`<tr>
    <th class="row-hdr" style="min-width:110px;position:sticky;left:0;z-index:3;background:var(--bg4);">Terminus</th>
    ${scData.map((d,i)=>`<th style="color:${SC_COLORS[all.indexOf(d)%SC_COLORS.length]};min-width:195px;padding:.4rem;">${d.sc.label}</th>`).join('')}
  </tr>`;

  const tbody=termNames.map(tNom=>
    `<tr>
      <td style="font-size:.6rem;font-weight:800;font-family:var(--fontb);color:var(--text);white-space:nowrap;padding:.4rem .5rem;position:sticky;left:0;z-index:1;background:var(--bg2);">${tNom}</td>
      ${scData.map(d=>{
        const ret=(d.termA===tNom)?d.retA:(d.termR===tNom)?d.retR:null;
        return `<td style="padding:.4rem .5rem;">
          <div style="display:inline-block;">
            ${ret?`<div style="width:220px;font-size:.85rem;font-weight:800;font-family:var(--fontb);color:var(--text);text-align:center;background:var(--bg4);border-radius:4px 4px 0 0;padding:.2rem .3rem;box-sizing:border-box;">${fmtMin(ret.totalSec/60)}</div>`:''}
            ${_buildTreemap(ret)}
          </div>
        </td>`;
      }).join('')}
    </tr>`
  ).join('');

  el.innerHTML=`${filters}
    <div class="comp-term-scroll">
      <table class="term-cmp-table"><thead>${thead}</thead><tbody>${tbody}</tbody></table>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:.5rem;margin-top:.6rem;padding-top:.4rem;border-top:1px solid var(--border);">${legend}</div>`;
}

/* ── Handlers filtres ── */
window._toggleTermPicker=function(e,id){
  e.stopPropagation();
  document.querySelectorAll('.col-picker-dropdown').forEach(d=>{if(d.id!==id)d.classList.remove('open');});
  const dd=document.getElementById(id);
  if(!dd)return;
  dd.classList.toggle('open');
  if(dd.classList.contains('open')){
    const r=e.currentTarget.getBoundingClientRect();
    dd.style.top=(r.bottom+4)+'px';
    dd.style.left=r.left+'px';
  }
};
window._termCmpTermCh=function(evt,nom){
  if(!_termCmpTermFilter){
    const all=window._lastCompAll||[];
    const data=_getScTermData(all);
    const names=[];const seen=new Set();
    data.forEach(d=>[d.termA,d.termR].forEach(n=>{if(!seen.has(n)){seen.add(n);names.push(n);}}));
    _termCmpTermFilter=new Set(names);
  }
  if(evt.target.checked)_termCmpTermFilter.add(nom);else _termCmpTermFilter.delete(nom);
  if(!_termCmpTermFilter.size)_termCmpTermFilter=null;
  renderCompTerminus(window._lastCompAll||[]);
};
window._termCmpScCh=function(evt,scIdx){
  if(!_termCmpScFilter){
    const all=window._lastCompAll||[];
    _termCmpScFilter=new Set(all.map(d=>d.scIdx));
  }
  if(evt.target.checked)_termCmpScFilter.add(scIdx);else _termCmpScFilter.delete(scIdx);
  if(!_termCmpScFilter.size)_termCmpScFilter=null;
  renderCompTerminus(window._lastCompAll||[]);
};

/* ── Plein écran ── */
function fsOpenCompTerminus(){
  const el=document.getElementById('compTermContent');
  if(!el)return;
  openFullscreen(document.getElementById('compTermTitle').textContent,body=>{
    Object.assign(body.style,{overflow:'auto',alignItems:'flex-start',padding:'1.5rem'});
    const clone=el.cloneNode(true);
    clone.style.cssText = 'width:calc(100vw - 3rem);overflow:visible;';
    body.appendChild(clone);
  });
}
