/* ── render.comp.table.js — Tableau comparatif scénarios ── */

/* ── Toutes les colonnes disponibles avec leur clé et visibilité par défaut ── */
const ALL_COMP_COLS = [
  // ── Colonnes cochées par défaut ──
  {key:'tAllerMin',    label:'Temps aller',             labelEN:'Running time out',     higher:false, fmt:v=>fmtMmSs(v),             visible:true},
  {key:'tRetourMin',   label:'Temps retour',            labelEN:'Running time in',      higher:false, fmt:v=>fmtMmSs(v),             visible:true},
  {key:'tCycleMin',    label:'Cycle',                   labelEN:'Cycle',                higher:false, fmt:v=>fmtHhMmSs(v),           visible:true},
  {key:'vitA',         label:'Vit. aller',              labelEN:'Speed out',            higher:true,  fmt:v=>v.toFixed(1),           visible:true},
  {key:'vitR',         label:'Vit. retour',             labelEN:'Speed in',             higher:true,  fmt:v=>v.toFixed(1),           visible:true},
  {key:'flotteNec',    label:'Flotte néc.',             labelEN:'Fleet',                higher:false, fmt:v=>String(v),              visible:true},
  {key:'flotteTot',    label:'Flotte tot.',             labelEN:'Total fleet',          higher:false, fmt:v=>String(v),              visible:true},
  {key:'freqHP',       label:'Fréq cible',              labelEN:'Target freq',          higher:false, fmt:v=>String(v),              visible:true},
  {key:'entrees',      label:'Entrées/Sorties dépôt',  labelEN:'Depot in/out',         higher:false, fmt:(v,k)=>`${v}/${k.sorties}`,visible:true},
  {key:'smrCapacite',  label:'Capacité SMR',            labelEN:'SMR capacity',         higher:false, fmt:(v,k)=>fmtSmr(v),          visible:true},
  // ── Colonnes décochées par défaut ──
  {key:'moyMontees',   label:'Moy. montées/st',         labelEN:'Avg boardings/st',     higher:true,  fmt:v=>v>0?v.toFixed(2):'—',   visible:false},
  {key:'moyDescentes', label:'Moy. descentes/st',       labelEN:'Avg alightings/st',    higher:true,  fmt:v=>v>0?v.toFixed(2):'—',   visible:false},
  {key:'tPrioTotal',   label:'Priorité',                labelEN:'Priority',             higher:false, fmt:v=>v.toFixed(1),           visible:true},
  {key:'coursesJour',  label:'Courses/jour',            labelEN:'Trips/day',            higher:true,  fmt:v=>String(v),              visible:true},
  // ── Colonnes masquées par défaut ──
  {key:'nStations',    label:'Nb stations',             labelEN:'Nb stations',          higher:false, fmt:v=>String(v),              visible:false},
  {key:'distInterMoy', label:'Dist. moy. interst. (m)',labelEN:'Avg inter-st (m)',      higher:false, fmt:v=>String(v),              visible:false},
  {key:'kmCom',        label:'km comm./jour',           labelEN:'Comm. km/day',         higher:true,  fmt:v=>String(v),              visible:false},
  {key:'tArretTotal',  label:'Arrêts tot.',             labelEN:'Total dwell',          higher:false, fmt:v=>v.toFixed(1),           visible:false},
  {key:'totalDistKm',  label:'Distance ligne (km)',     labelEN:'Line length (km)',     higher:false, fmt:v=>v.toFixed(2),           visible:false},
];

/* ── Sélecteur de colonnes ── */
let _colPickerBuilt = false;
function buildColPickerDropdown(){
  // Reconstruire à chaque appel pour refléter l'état visible actuel
  _colPickerBuilt = false; // ← forcer la reconstruction
  if(_colPickerBuilt) return;
  _colPickerBuilt = true;
  const dd = document.getElementById('colPickerDropdown');
  if(!dd) return;
  dd.innerHTML = ALL_COMP_COLS.map((c,i)=>
    `<label class="col-picker-item">
      <input type="checkbox" ${c.visible?'checked':''} onchange="toggleCompCol(${i},this.checked)">
      ${isEN ? c.labelEN : c.label}
    </label>`
  ).join('');
}

function toggleCompCol(idx, checked){
  ALL_COMP_COLS[idx].visible = checked;
  if(LINE) renderCompTable(window._lastCompAll || []);
}

function toggleColPicker(e){
  e.stopPropagation();
  const dd = document.getElementById('colPickerDropdown');
  const r = e.currentTarget.getBoundingClientRect();
  dd.style.top=(r.bottom+4)+'px'; dd.style.left=r.left+'px';
  if(dd) dd.classList.toggle('open');
}

document.addEventListener('click', e=>{
  const dd = document.getElementById('colPickerDropdown');
  if(dd && !dd.closest('.col-picker-wrap').contains(e.target)) dd.classList.remove('open');
});

/* ── Variable d'état : affichage ligne Programme MOE ── */
let _showProgrammeMOE = true; // cochée par défaut

function toggleProgrammeMOE(checked) {
  _showProgrammeMOE = checked;
  if (LINE) renderCompTable(window._lastCompAll || []);
}

/* ── Rendu du tableau ── */
function renderCompTable(all) {
  window._lastCompAll = all;

  const tbl = document.getElementById('compTable');
  if (!tbl) return;
  buildColPickerDropdown();

  const COLS = ALL_COMP_COLS.filter(c => c.visible).map(c => ({
    ...c, label: isEN ? c.labelEN : c.label
  }));

  const best = COLS.map(c => {
    const vs = all.filter(k => (k.sc.type||'NOMINAL').toUpperCase() === 'NOMINAL')
                  .map(k => parseFloat(k[c.key]) || 0);
    return c.higher ? Math.max(...vs) : Math.min(...vs);
  });
  const worst = COLS.map(c => {
    const vs = all.filter(k => (k.sc.type||'NOMINAL').toUpperCase() === 'NOMINAL')
                  .map(k => parseFloat(k[c.key]) || 0);
    return c.higher ? Math.min(...vs) : Math.max(...vs);
  });

  const STK_TH     = 'position:sticky;left:0;z-index:3;background:var(--bg4);';
  const STK_TD     = 'position:sticky;left:0;z-index:1;background:var(--bg2);font-weight:700;color:var(--text);';
  const STK_TD_MOE = 'position:sticky;left:0;z-index:1;background:var(--bg3);font-weight:700;color:var(--text);';

  let html = `<thead><tr>
    <th style="${STK_TH}">${isEN ? 'Scenario' : 'Scénario'}</th>
    ${COLS.map(c => `<th>${c.label}</th>`).join('')}
  </tr></thead><tbody>`;

  /* ── Ligne Programme MOE en PREMIER ── */
  if (_showProgrammeMOE) {
    html += `<tr style="background:var(--bg3);font-style:italic;opacity:.85;">`;
    html += `<td style="${STK_TD_MOE}background:var(--bg3);">Programme MOE</td>`;
    COLS.forEach(c => {
      const moeVal = (window.LINE_PROGRAMME_MOE || {})[c.key] ?? '—';
      html += `<td style="font-style:italic;color:var(--text2);">${moeVal}</td>`;
    });
    html += '</tr>';
  }

  /* ── Lignes scénarios nominaux + SP ── */
  const nominals = all.filter(k => (k.sc.type || 'NOMINAL').toUpperCase() === 'NOMINAL');
  nominals.forEach((k, si) => {
    const isActive = si === currentSc;

    // Ligne nominale
    html += `<tr class="${isActive ? 'active-sc' : ''}">`;
    html += `<td style="${STK_TD}">
      <div style="display:flex;align-items:center;gap:5px;">
        <span>${k.sc.label}</span>
        ${(window._SP_MAP?.[k.scIdx]?.length > 0)
          ? `<button onclick="toggleSPRows(${si})"
               id="spToggleBtn_${si}"
               style="font-size:.55rem;padding:1px 4px;border-radius:3px;cursor:pointer;
               background:rgba(245,166,35,.15);border:1px solid rgba(245,166,35,.5);
               color:#f5a623;font-weight:700;line-height:1.4;"
               title="Afficher scénarios partiels">SP</button>`
          : ''}
      </div>
    </td>`;
    COLS.forEach((c, ci) => {
      const v = k[c.key];
      const vNum = parseFloat(v) || 0;
      const cls = vNum === best[ci] ? 'best' : vNum === worst[ci] && all.length > 1 ? 'worst' : '';
      const arrow = vNum === best[ci] ? ' ▲' : vNum === worst[ci] && all.length > 1 ? ' ▼' : '';
      html += `<td class="${cls}">${c.fmt(v, k)}${arrow}</td>`;
    });
    html += '</tr>';

    // Lignes SP (masquées par défaut)
    const spIdxs = window._SP_MAP?.[k.scIdx] || [];
    spIdxs.forEach(spIdx => {
      const spSc = LINE.scenarios[spIdx];
      if (!spSc) return;
      html += `<tr class="sp-row sp-row-${si}" style="display:none;
        background:rgba(245,166,35,.08);
        border-left:3px solid rgba(245,166,35,.6);">`;
      html += `<td style="${STK_TD}background:rgba(245,166,35,.1);
        font-style:italic;font-size:.75em;color:#f5a623;font-weight:600;">
        ↳ ${spSc.label}
      </td>`;
      COLS.forEach(c => {
        const spData = all.find(d => d.scIdx === spIdx);
        const v = spData ? spData[c.key] : null;
        html += `<td style="font-style:italic;font-size:.75em;color:var(--text3);">${c.fmt(v, k)}</td>`;
      });
      html += '</tr>';
    });
  });

  html += '</tbody>';
  tbl.innerHTML = html;
}

/* ── Toggle affichage des lignes SP d'un nominal ── */
function toggleSPRows(si) {
  const rows = document.querySelectorAll(`.sp-row-${si}`);
  const btn  = document.getElementById(`spToggleBtn_${si}`);
  const isVisible = rows.length > 0 && rows[0].style.display !== 'none';
  rows.forEach(r => r.style.display = isVisible ? 'none' : '');
  if (btn) {
    btn.style.background  = isVisible ? 'rgba(245,166,35,.15)' : 'rgba(245,166,35,.35)';
    btn.style.borderColor = isVisible ? 'rgba(245,166,35,.5)'  : '#f5a623';
  }
}

/* ── Export CSV du tableau comparatif ── */
function exportCompTableCSV() {
  const all = window._lastCompAll || [];
  if (!all.length) return;

  const COLS = ALL_COMP_COLS.filter(c => c.visible).map(c => ({
    ...c, label: isEN ? c.labelEN : c.label
  }));

  const headers = [isEN ? 'Scenario' : 'Scénario', ...COLS.map(c => c.label)];
  const rows = [headers];

  all.forEach(k => {
    rows.push([
      k.sc.label,
      ...COLS.map(c => {
        const v = k[c.key];
        return c.fmt(v, k).replace(' ▲','').replace(' ▼','');
      })
    ]);
  });

  if (_showProgrammeMOE) {
    rows.push([
      'Programme MOE',
      ...COLS.map(c => LINE.programmeMOE ? (LINE.programmeMOE[c.key] ?? '') : '')
    ]);
  }

  const csv = rows.map(r =>
    r.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(';')
  ).join('\n');

  const blob = new Blob(['\uFEFF' + csv], {type:'text/csv;charset=utf-8;'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'comparaison_scenarios.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
