/* ── settings.js — Contrôles UI: dark/light, lang, settings panel ── */
/* ═══════════════════════════════════════════════
   CONTRÔLES
═══════════════════════════════════════════════ */
function setDirection(dir){
  currentDir = dir;
  // Mise à jour visuelle des 2 boutons
  const btnA = document.getElementById('dirBtnA');
  const btnR = document.getElementById('dirBtnR');
  if(btnA) btnA.classList.toggle('active', dir==='aller');
  if(btnR) btnR.classList.toggle('active', dir==='retour');
  // sous-titre
  const ps = document.getElementById('pageSub');
  if(ps && LINE) ps.innerHTML=`${T('scenarioBar')} <span id="scLabel">${LINE.scenarios[currentSc].label}</span> — ${dir==='aller'?T('dirOutbound'):T('dirInbound')}`;
  requestAnimationFrame(render);
}
function toggleDirection(){ setDirection(currentDir==='aller'?'retour':'aller'); }

/* Met à jour les labels des boutons avec les vrais noms de terminus */
function updateDirBtnLabels(){
  if(!LINE || !LINE.stations || !LINE.stations.length) return;
  const N   = LINE.stations.length;
  const tA  = LINE.stations[N-1].nom;  // terminus aller = dernière station
  const tR  = LINE.stations[0].nom;    // terminus retour = première station
  const lblA = document.getElementById('dirLabelA');
  const lblR = document.getElementById('dirLabelR');
  if(lblA) lblA.textContent = `↓ ${tR} → ${tA}`;
  if(lblR) lblR.textContent = `↑ ${tA} → ${tR}`;
}

function setScenario(idx){
  currentSc = idx;
  document.querySelectorAll('.sc-btn').forEach((b,i)=>b.classList.toggle('active',i===idx));

  // Injecter les données du scénario sélectionné dans LINE
  if(LINE && LINE.scenariosData && LINE.scenariosData[idx]){
    const d = LINE.scenariosData[idx];
    LINE.stations     = d.stations;
    LINE.inter        = d.inter;
    LINE.retournement = d.retournement;
    LINE.tendu        = d.tendu;
    LINE.tenduR       = d.tenduR;
    LINE.detenteA     = d.detenteA;
    LINE.detenteR     = d.detenteR;
    LINE.infra        = d.infra || [];
  }

  requestAnimationFrame(()=>{
    render();
    if(currentTab==='comparatif' && LINE) renderComparatif();
    if(currentTab==='terminus'   && LINE) renderTerminus();
  });
}

function toggleDark(){
  isDark=!isDark;
  document.body.classList.toggle('light-mode',!isDark);
  drawClock();
  updateClockLegend();
  document.getElementById('darkBtn').textContent=isDark?'🌙 Dark':'☀️ Light';
  document.getElementById('darkBtn').classList.toggle('active',!isDark);
}

/* ── Dictionnaire bilingue ── */
const DICT = {
  // Topbar & import
  tabParcours:       {fr:'Temps de parcours',    en:'Journey Times'},
  tabTerminus:       {fr:'Terminus',              en:'Terminus'},
  tabComparatif:     {fr:'Comparatif',            en:'Comparison'},
  tabSynthese:       {fr:'Synthèse',              en:'Summary'},
  importBtn:        {fr:'📂 Import xlsx / zip',             en:'📂 Import xlsx / zip'},
  importTitle:      {fr:'📂 Importer un fichier de ligne', en:'📂 Import a line file'},
  importDesc:       {fr:'Sélectionnez un fichier <strong>.xlsx</strong> ou un <strong>.zip</strong> (xlsx + dossier <code>images/</code>) au format Tchoo.',
                     en:'Select a <strong>.xlsx</strong> file or a <strong>.zip</strong> (xlsx + <code>images/</code> folder) in Tchoo format.'},
  importDrop:       {fr:'⬆ Cliquer ou glisser-déposer le fichier <strong>.xlsx</strong> ou <strong>.zip</strong> ici',
                     en:'⬆ Click or drag &amp; drop the <strong>.xlsx</strong> or <strong>.zip</strong> file here'},
  importTip:        {fr:'💡 <strong>XLSX seul</strong> : charge toutes les données + textes du carousel (sans images).<br>📦 <strong>ZIP</strong> : xlsx + dossier <code>images/</code> → charge aussi les photos du carousel.',
                     en:'💡 <strong>XLSX only</strong>: loads all data + carousel texts (no images).<br>📦 <strong>ZIP</strong>: xlsx + <code>images/</code> folder → also loads carousel photos.'},
  importSlideTitle: {fr:'🖼 Points clés du réseau — Ajouter une slide', en:'🖼 Network highlights — Add a slide'},
  slidePlaceholder: {fr:'Titre et description de cette slide…', en:'Title and description of this slide…'},
  slideAddBtn:      {fr:'+ Ajouter cette slide',  en:'+ Add this slide'},
  closeBtn:         {fr:'Fermer',                 en:'Close'},
  topEtude:         {fr:'Étude de faisabilité',   en:'Feasibility Study'},
  // Page header
  pageTitle:        {fr:'Temps de parcours',       en:'Journey Times'},
  scenarioBar:      {fr:'Scénario',                en:'Scenario'},
  // KPI labels
  kpiLabelFlotte:   {fr:'Flotte<br>nécessaire',    en:'Required<br>Fleet'},
  kpiLabelFlotteTot:{fr:'Flotte<br>totale',        en:'Total<br>Fleet'},
  kpiLabelVitA:     {fr:'Vit. comm.<br>↓ Aller',   en:'Comm. Speed<br>↓ Outbound'},
  kpiLabelVitR:     {fr:'Vit. comm.<br>↑ Retour',  en:'Comm. Speed<br>↑ Inbound'},
  kpiLabelCycle:    {fr:'Cycle complet',            en:'Round trip time'},
  kpiLabelTaux:     {fr:'Taux utilisation',         en:'Utilisation Rate'},
  kpiLabelFreqHP:   {fr:'Fréq.<br>Heure de Pointe',en:'Freq.<br>Peak Hour'},
  kpiLabelFreqHC:   {fr:'Fréq.<br>Heure Creuse',   en:'Freq.<br>Off-Peak'},
  kpiLabelCourses:  {fr:'Courses / jour',           en:'Trips / day'},
  kpiLabelKmCom:    {fr:'Km commerciaux',           en:'Commercial km'},
  // Clock legend
  clockCardTitle:   {fr:'Plages horaires',          en:'Service hours'},
  clockFreqHP:      {fr:'Fréq. cible HP',           en:'Target freq. PH'},
  clockHP:          {fr:'Heure de Pointe',          en:'Peak Hour'},
  clockHC:          {fr:'Heure Creuse',             en:'Off-Peak'},
  clockHS:          {fr:'Hors service',             en:'Out of Service'},
  // MT placeholder
  mtLabel:          {fr:'Image de marche type',     en:'Typical operation diagram'},
  mtSub:            {fr:'Disponible via le fichier Excel', en:'Available via Excel file'},
  mtDir:            {fr:{aller:'↓ Aller', retour:'↑ Retour'}, en:{aller:'↓ Outbound', retour:'↑ Inbound'}},
  // Carousel
  carouselTitle:    {fr:'Points clés du réseau',    en:'Network highlights'},
  carouselEmpty:    {fr:'Aucun contenu — importez un fichier Excel<br>avec un onglet <strong>CAROUSEL</strong>',
                     en:'No content — import an Excel file<br>with a <strong>CAROUSEL</strong> sheet'},
  // Table headers
  thStop:           {fr:'Station',                  en:'Stop'},
  dirOutbound:      {fr:'Aller',                    en:'Outbound'},
  dirInbound:       {fr:'Retour',                   en:'Inbound'},
  thDistances:      {fr:'Distances',                en:'Distances'},
  thRuntime:        {fr:'Temps de parcours',        en:'Run time'},
  thDwell:          {fr:'Arrêt',                    en:'Dwell'},
  thArrival:        {fr:'Arrivée',                  en:'Arrival'},
  thDeparture:      {fr:'Départ',                   en:'Departure'},
  thSpacing:        {fr:'Interstation',             en:'Spacing'},
  thCumul:          {fr:'Cumulée',                  en:'Cumul.'},
  thRunTendu:       {fr:'Marche<br>tendue<br><span style="font-size:.5rem;color:var(--text3)">(mm:ss)</span>', en:'Run<br>time<br><span style="font-size:.5rem;color:var(--text3)">(mm:ss)</span>'},
  thRecovery:       {fr:'Détente<br><span style="font-size:.5rem;color:var(--text3)">(mm:ss)</span>', en:'Recovery<br><span style="font-size:.5rem;color:var(--text3)">(mm:ss)</span>'},
  // Footer
  footerLeft:       {fr:'', en:''},
  footerNoLine:     {fr:'Aucune ligne chargée',     en:'No line loaded'},
  // Table body dynamic
  terminalReversal: {fr:'↺ Retournement terminus',  en:'↺ Terminal reversal'},
  provisional:      {fr:' (provisoire)',            en:' (provisional)'},
  manoeuvre:        {fr:'Manœuvre',                 en:'Manoeuvre'},
  wait:             {fr:'Attente',                  en:'Wait'},
  total:            {fr:'Total :',                  en:'Total:'},
  partialReversal:  {fr:'⟳ Retournement terminus partiel', en:'⟳ Partial terminal reversal'},
  // KPI subs nominal
  cycleFreq:        {fr:'cycle',                    en:'cycle'},
  freq:             {fr:'fréq.',                    en:'freq.'},
  reserve:          {fr:'dont {n} réserve',         en:'incl. {n} reserve'},
  inSvc:            {fr:'{n} exploités / {t} dispo',en:'{n} in svc / {t} avail.'},
  vehTarget:        {fr:'{n} véh. · objectif',      en:'{n} veh · target'},
  offPeak:          {fr:'hors pointe',              en:'off-peak'},
  perDir:           {fr:'par sens',                 en:'per direction'},
  ofService:        {fr:'{n}h de service',          en:'{n}h of service'},
  outIn:            {fr:'A {a} · R {r} · 2×ret.',  en:'Out {a} · In {r} · 2×turn.'},
  expl:             {fr:'{n} expl. · +{r} rés.',   en:'{n} in svc · +{r} res.'},
  // Charts
  chartBopTitle:    {fr:'Répartition des temps de parcours', en:'Journey Time Breakdown'},
  chartCycleTitle:  {fr:'Décomposition du cycle complet',    en:'Round Trip Breakdown'},
  // Status messages
  fileLoaded:       {fr:'✓ Fichier chargé avec succès — ', en:'✓ File loaded successfully — '},
  zipLoaded:        {fr:'✓ ZIP chargé avec succès — ',     en:'✓ ZIP loaded successfully — '},
  lineImported:     {fr:'ligne importée',           en:'line imported'},
  zipExtracted:     {fr:'ZIP extrait — {n} image(s) trouvée(s). Lecture du xlsx…',
                     en:'ZIP extracted — {n} image(s) found. Reading xlsx…'},
  errorPrefix:      {fr:'✗ Erreur : ',              en:'✗ Error: '},
  noXlsx:           {fr:'Aucun fichier .xlsx trouvé dans le ZIP.', en:'No .xlsx file found in ZIP.'},
  noData:           {fr:'Aucune donnée — importez un fichier .xlsx ou .zip',
                     en:'No data — import a .xlsx or .zip file'},
  // Pie chart labels
  pieRunA:   {fr:'Marche A',    en:'Run A'},
  pieRecA:   {fr:'Détente A',   en:'Recov. A'},
  pieDwlA:   {fr:'Arrêt A',     en:'Dwell A'},
  pieTrnA:   {fr:'Retourn. A',  en:'Turn. A'},
  pieRunR:   {fr:'Marche R',    en:'Run R'},
  pieRecR:   {fr:'Détente R',   en:'Recov. R'},
  pieDwlR:   {fr:'Arrêt R',     en:'Dwell R'},
  pieTrnR:   {fr:'Retourn. R',  en:'Turn. R'},
  depotMouvements:  {fr:'Mouvements dépôt',          en:'Depot movements'},
  depotSorties:     {fr:'↑ Sorties',                  en:'↑ Departures'},
  depotRentrees:    {fr:'↓ Rentrées',                 en:'↓ Returns'},
  // Page Terminus
  termDirA:         {fr:'Terminus Aller',             en:'Outbound Terminus'},
  termDirR:         {fr:'Terminus Retour',            en:'Inbound Terminus'},
  termOccupCycle:   {fr:'Taux occup. cycle',          en:'Cycle occupancy'},
  termTotal:        {fr:'Total',                      en:'Total'},
  termNoLine:       {fr:'— Aucune ligne chargée —',   en:'— No line loaded —'},
  // Page Synthèse
  synthScorecardTitleKey: {fr:'Scorecard global',     en:'Global scorecard'},
  synthGlobal:      {fr:'GLOBAL',                     en:'GLOBAL'},
  // Comparatif
  compSPTitle:      {fr:'Couverture des incidents par scénario SP', en:'Incident coverage — SP scenarios'},
  compBubbleTitle:  {fr:'Montées / Descentes par station',          en:'Boardings / Alightings per stop'},
  noNominalSc:      {fr:'Aucun scénario nominal',                   en:'No nominal scenario'},
  noSPLoaded:       {fr:'Aucun scénario SP chargé',                 en:'No SP scenario loaded'},
  tronconUnique:    {fr:'Tronçon unique',                           en:'Single section'},
  depotAccessible:  {fr:'accessible',                               en:'accessible'},
  depotAccessA:     {fr:'accessible tronçon A uniquement',          en:'section A only'},
  depotAccessB:     {fr:'accessible tronçon B uniquement',          en:'section B only'},
  // Charge chart legend
  legendBoardings:  {fr:'↑ Montées',    en:'↑ Boardings'},
  legendAlightings: {fr:'↓ Descentes',  en:'↓ Alightings'},
  // KPI subs
  tripsKm:          {fr:'courses × {d} km', en:'trips × {d} km'},
  // Error messages
  noScenarioFile:   {fr:'Aucun fichier scénario trouvé (xlsx hors master.xlsx)', en:'No scenario file found (xlsx other than master.xlsx)'},
};

/* Raccourci : retourne la chaîne dans la langue courante */
function T(key){ const e=DICT[key]; return e?(isEN?e.en:e.fr):'?'; }

function applyLang(){
  const L = isEN ? 'en' : 'fr';
  const set    = (id,v)=>{ const el=document.getElementById(id); if(el) el.innerHTML=v; };
  const setTxt = (id,v)=>{ const el=document.getElementById(id); if(el) el.textContent=v; };

  setTxt('tabLabelParcours',   T('tabParcours'));
  setTxt('tabLabelTerminus',   T('tabTerminus'));
  setTxt('tabLabelComparatif', T('tabComparatif'));
  setTxt('tabLabelSynthese',   T('tabSynthese'));
  setTxt('synthScorecardTitle', T('synthScorecardTitleKey'));
  setTxt('scGlobalLabel',       T('synthGlobal'));
  // Re-render langue-dépendant
  if(LINE && currentTab==='terminus') renderTerminus();
  renderScorecard();
  if(currentTab==='comparatif' && LINE) renderComparatif();
  // Topbar
  const _ib=document.querySelector('.import-btn'); if(_ib) _ib.textContent=T('importBtn')||'📂 Import xlsx / zip';
  setTxt('topEtude',     T('topEtude'));
  setTxt('langBtn',      isEN ? 'EN' : 'FR');
  set('importTitle',     T('importTitle'));
  set('importSlideTitle',T('importSlideTitle'));
  // Page header
  setTxt('scBarLabel',   T('scenarioBar'));
  // pageSub — ne re-render que si LINE chargée, sinon juste le label statique
  if(!LINE){
    document.getElementById('pageSub').innerHTML =
      `${T('scenarioBar')} <span id="scLabel">—</span> — ${T('dirOutbound')}`;
  }
  // KPI labels (via ids directs)
  set('kpiLabelFlotte',   T('kpiLabelFlotte'));
  set('kpiLabelFlotteTot',T('kpiLabelFlotteTot'));
  set('kpiLabelVitA',     T('kpiLabelVitA'));
  set('kpiLabelVitR',     T('kpiLabelVitR'));
  set('kpiCycleLabel',    T('kpiLabelCycle'));
  set('kpiTauxLabel',     T('kpiLabelTaux'));
  set('kpiLabelFreqHP',   T('kpiLabelFreqHP'));
  set('kpiLabelFreqHC',   T('kpiLabelFreqHC'));
  set('kpiLabelCourses',  T('kpiLabelCourses'));
  set('kpiLabelKmCom',    T('kpiLabelKmCom'));
  // Clock legend
  setTxt('clockCardLabel',  T('clockCardTitle'));
  setTxt('clockFreqHPLabel', T('clockFreqHP'));
  setTxt('clockLegHPLabel', T('clockHP'));
  setTxt('clockLegHCLabel', T('clockHC'));
  setTxt('clockLegHSLabel', T('clockHS'));
  // MT placeholder
  setTxt('mtLabel',  T('mtLabel'));
  setTxt('mtSub',    T('mtSub'));
  // MT direction label
  const mtDir = document.getElementById('mtSensLabel');
  if(mtDir) mtDir.textContent = DICT.mtDir[L][currentDir==='aller'?'aller':'retour'];
  // Carousel
  setTxt('carouselTitle', T('carouselTitle'));
  set('carouselEmpty',    T('carouselEmpty'));
  // Table stop header
  setTxt('thStop',      T('thStop'));
  const dirLbl = document.getElementById('dirLabel');
  if(dirLbl) dirLbl.textContent = currentDir==='aller' ? T('dirOutbound') : T('dirInbound');
  // Table th-top headers (via ids)
  set('thDistances', T('thDistances'));
  set('thRuntime',   T('thRuntime'));
  set('thDwell',     T('thDwell')+'<br><span style="font-size:.5rem;color:var(--text3)">(mm:ss)</span>');
  set('thArrival',   T('thArrival')+'<br><span style="font-size:.5rem;color:var(--text3)">(mm:ss)</span>');
  set('thDeparture', T('thDeparture')+'<br><span style="font-size:.5rem;color:var(--text3)">(mm:ss)</span>');
  // Table th-bot headers (via ids)
  set('thSpacing',  T('thSpacing')+'<br>(m)');
  set('thCumul',    T('thCumul')+'<br>(km)');
  set('thRunTendu', T('thRunTendu'));
  set('thRecovery', T('thRecovery'));
  setTxt('kpiLabelDepot',    T('depotMouvements'));
  setTxt('kpiLabelSorties',  T('depotSorties'));
  setTxt('kpiLabelRentrees', T('depotRentrees'));
  // Comparatif titles
  setTxt('compBubbleTitle', T('compBubbleTitle'));
  // Footer
  set('footerLeft', T('footerLeft'));
  // Re-render dynamic content
  if(LINE){
    renderKPIs(currentSc);
    render(currentSc, currentDir);
  } else {
    showEmptyState();
  }
}

function toggleLang(){
  isEN=!isEN;
  applyLang();
}

// Appel initial au chargement — FR par défaut
document.addEventListener('DOMContentLoaded', ()=>{ applyLang(); });

