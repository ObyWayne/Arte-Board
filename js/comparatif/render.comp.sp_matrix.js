/* ── render.comp.sp_matrix.js — Matrice couverture scénarios partiels ── */

function renderSPMatrix(){
  const el = document.getElementById('spMatrixContainer');
  if(!el || !LINE) return;

  const stations = LINE.stations;
  const N = stations.length;
  const infra = LINE.infra || [];

  // Collecter tous les scénarios SP avec leur bloc
  const spScenarios = LINE.scenarios.map((sc, i) => {
    if(sc.type !== 'SP' || !sc.debutBloc || !sc.finBloc) return null;
    const names = stations.map(s => s.nom.trim().toLowerCase());
    const iA = names.indexOf(sc.debutBloc.trim().toLowerCase());
    const iB = names.indexOf(sc.finBloc.trim().toLowerCase());
    if(iA < 0 || iB < 0) return null;
    return { sc, i, blocMin: Math.min(iA,iB), blocMax: Math.max(iA,iB) };
  }).filter(Boolean);

  if(spScenarios.length === 0){
    el.innerHTML = `<div style="color:var(--text3);font-size:.65rem;padding:.75rem;text-align:center">${T('noSPLoaded')}</div>`;
    return;
  }

  // Dépôts depuis LINE.infra — chaque dépôt est rattaché à une station (stDeb)
  // On détermine son index de station pour savoir s'il est dans le bloc ou non
  const names = stations.map(s => s.nom.trim().toLowerCase());
  const depots = infra
    .filter(e => e.type === 'DEPOT')
    .map(e => {
      const stIdx = names.indexOf((e.stDeb||'').trim().toLowerCase());
      return { label: e.label || e.desc || 'Dépôt', stIdx };
    })
    .filter(d => d.stIdx >= 0);

  // Pour chaque station-incident i, trouver le SP le plus serré qui la couvre
  function spForIncident(i){
    let best = null, bestSize = Infinity;
    for(const sp of spScenarios){
      if(i >= sp.blocMin && i <= sp.blocMax){
        const size = sp.blocMax - sp.blocMin;
        if(size < bestSize){ best = sp; bestSize = size; }
      }
    }
    return best;
  }

  // En-tête : stations + séparateur + dépôts
  let h = `<table class="sp-matrix"><thead><tr>`;
  h += `<th class="row-hdr col-hdr" style="min-width:80px;width:80px">${isEN?'Incident station':'Station (incident)'}</th>`;
  for(let j=0; j<N; j++){
    const nm = stations[j].nom;
    h += `<th class="col-hdr" title="${nm}">${nm}</th>`;
  }
  // Séparateur visuel + colonnes dépôts
  if(depots.length > 0){
    h += `<th class="col-hdr" style="min-width:6px;background:var(--bg2);border-left:2px solid var(--border2)"></th>`;
    depots.forEach(d => {
      h += `<th class="col-hdr sp-depot-hdr" title="${d.label}">${d.label}</th>`;
    });
  }
  h += `</tr></thead><tbody>`;

  for(let i=0; i<N; i++){
    const sp = spForIncident(i);
    h += `<tr>`;
    h += `<th class="row-hdr" title="${stations[i].nom}">${stations[i].nom}</th>`;
    // Colonnes stations
    for(let j=0; j<N; j++){
      if(!sp){
        h += `<td class="sp-none"></td>`;
      } else if(j === i){
        h += `<td class="sp-red" title="${stations[j].nom}">✕</td>`;
      } else if(j >= sp.blocMin && j <= sp.blocMax){
        h += `<td class="sp-orange" title="${stations[j].nom}"></td>`;
      } else {
        h += `<td class="sp-green" title="${stations[j].nom}"></td>`;
      }
    }
    // Colonnes dépôts
    if(depots.length > 0){
      h += `<td style="border-left:2px solid var(--border2);background:var(--bg2)"></td>`;
      depots.forEach(d => {
        if(!sp){
          h += `<td class="sp-none" title="${d.label}"></td>`;
          return;
        }
        const inBloc = d.stIdx >= sp.blocMin && d.stIdx <= sp.blocMax;
        const isFinDeLigne = sp.blocMin === 0 || sp.blocMax === N - 1;

        if(inBloc){
          // Dépôt dans le bloc → totalement coupé
          h += `<td class="sp-orange" title="${d.label} — coupé"></td>`;
        } else if(isFinDeLigne){
          // Bloc en bout de ligne → un seul tronçon actif, dépôt forcément accessible
          h += `<td class="sp-depot-ok" title="${d.label} — ${T('depotAccessible')}"></td>`;
        } else {
          // SP milieu : 2 tronçons (A = 0..blocMin-1, B = blocMax+1..N-1)
          const onA = d.stIdx < sp.blocMin;
          const onB = d.stIdx > sp.blocMax;
          if(onA && onB){
            h += `<td class="sp-depot-ok" title="${d.label} — accessible"></td>`;
          } else if(onA){
            // Accessible depuis tronçon A seulement
            h += `<td class="sp-depot-split sp-depot-split-a" title="${d.label} — ${T('depotAccessA')}"></td>`;
          } else {
            // Accessible depuis tronçon B seulement
            h += `<td class="sp-depot-split sp-depot-split-b" title="${d.label} — ${T('depotAccessB')}"></td>`;
          }
        }
      });
    }
    h += `</tr>`;
  }

  h += `</tbody></table>`;
  el.innerHTML = h;

  const title = document.getElementById('compSPTitle');
  if(title) title.textContent = T('compSPTitle');
}
