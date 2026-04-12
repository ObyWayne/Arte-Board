/* ═══════════════════════════════════════════════════════
   render.synthese.js  —  Fiches opérationnelles
   Une fiche SVG 960×540 (16:9) par scénario NOMINAL.
   Scorecard : 3 valeurs depuis la feuille META xlsx
     col A  →  SCORECARD_GLOBAL | SCORECARD_FREQUENCE | SCORECARD_REGULARITE
     col B  →  valeur numérique /5
   MR type  →  META clé MR_TYPE (metro | tram | bus_articule | bus_biarticule | bus_std | bus)
               Défaut : metro
   SVGs     →  images/svg/{fichier}  (relatif depuis index.html)
═══════════════════════════════════════════════════════ */

/* ── Mapping matériel roulant ─────────────────────── */
const _MR_SVG = {
  metro         : 'metro_white.svg',
  tram          : 'tram_white.svg',
  bus_articule  : 'bus_art_white.svg',
  bus_biarticule: 'bus_art_white.svg',
  bus_std       : 'bus_std_white.svg',
  bus           : 'bus_std_white.svg',
};
const _MR_LBL = {
  metro         : 'nouvelles rames',
  tram          : 'nouvelles rames',
  bus_articule  : 'nouveaux bus',
  bus_biarticule: 'nouveaux bus',
  bus_std       : 'nouveaux bus',
  bus           : 'nouveaux bus',
};

/* ── Palette fiche (indépendante du dark/light mode) ── */
const _SC = {
  BD : '#0D3F6A',   // blue dark — header / sidebar / footer
  BB : '#0B2E50',   // blue bg  — zone contenu
  AC : '#35B87D',   // accent vert
  AM : '#F5A820',   // amber étoiles
};

/* ── État interne ──────────────────────────────────── */
let _sIdx   = 0;    // index fiche courante
let _sItems = [];   // [{sc, scIdx, k}]

/* ══════════════════════════════════════════════════════
   POINT D'ENTRÉE
   Appelé par switchTab('synthese') et applyLang()
══════════════════════════════════════════════════════ */
function renderSynthese() {
  const wrap = document.getElementById('view-synthese');
  if (!wrap) return;

  if (!LINE) {
    wrap.innerHTML = '<div class="synth-empty">Importez un fichier pour afficher la synthèse.</div>';
    return;
  }

  /* Calcul global de tous les KPIs (gestion correcte multi-scénario) */
  let allK;
  try { allK = computeKPIsAll(); }
  catch (e) { console.error('[renderSynthese]', e); return; }

  /* Filtre NOMINAL */
  _sItems = allK
    .filter(r => r.sc.type === 'NOMINAL')
    .map(r => ({ sc: r.sc, scIdx: r.scIdx, k: r }));

  if (!_sItems.length) {
    wrap.innerHTML = '<div class="synth-empty">Aucun scénario NOMINAL disponible.</div>';
    return;
  }

  _sIdx = Math.min(_sIdx, _sItems.length - 1);

  wrap.innerHTML = `
    <div class="synth-carousel-wrap">
      <div class="synth-card-area" id="sCardArea"></div>
      <div class="synth-nav-bar">
        <button class="synth-btn synth-arrow" id="sBtnP" onclick="synthPrev()">←</button>
        <div class="synth-dots" id="sDots"></div>
        <button class="synth-btn synth-arrow" id="sBtnN" onclick="synthNext()">→</button>
        <button class="synth-btn synth-pdf"   onclick="synthPrint()">⬇ PDF</button>
      </div>
    </div>`;

  _sDraw();
}

/* ── Navigation ────────────────────────────────────── */
function synthPrev()  { if (_sIdx > 0)                    { _sIdx--; _sDraw(); } }
function synthNext()  { if (_sIdx < _sItems.length - 1)   { _sIdx++; _sDraw(); } }
function synthGoto(i) { _sIdx = i; _sDraw(); }
function synthPrint() { window.print(); }

/* ── Rendu ─────────────────────────────────────────── */
function _sDraw() {
  const area = document.getElementById('sCardArea');
  const dots = document.getElementById('sDots');
  const btnP = document.getElementById('sBtnP');
  const btnN = document.getElementById('sBtnN');
  if (!area) return;

  const n = _sItems.length;
  if (btnP) btnP.disabled = (_sIdx === 0);
  if (btnN) btnN.disabled = (_sIdx === n - 1);

  /* Dots */
  if (dots) dots.innerHTML = _sItems.map((it, di) => `
    <span class="synth-dot${di === _sIdx ? ' active' : ''}"
          onclick="synthGoto(${di})"
          title="${_xe(it.sc.label)}"></span>`).join('');

  const { sc, scIdx, k } = _sItems[_sIdx];
  area.innerHTML = _buildSVG(sc, scIdx, k);
}

/* ══════════════════════════════════════════════════════
   CONSTRUCTION DU SVG 960×540
══════════════════════════════════════════════════════ */
function _buildSVG(sc, scIdx, k) {
  const { BD, BB, AC, AM } = _SC;
  const meta = LINE.meta || {};

  /* ── Textes principaux ─────────────────────────── */
  const nomLigne   = meta.nomLigne  || 'LIGNE';
  const etude      = meta.etude     || '';
  const scLabel    = (sc.label || `Scénario ${scIdx + 1}`).toUpperCase();
  const dateStr    = new Date().toLocaleDateString(isEN ? 'en-GB' : 'fr-FR');
  const clientName = meta.client     || 'CLIENT';
  const entreprise = meta.entreprise || 'ARTELIA';

  /* ── Terminus ──────────────────────────────────── */
  const stA = LINE.stations[0]?.nom                     || 'Terminus A';
  const stR = LINE.stations[LINE.stations.length-1]?.nom || 'Terminus B';

  /* ── KPIs ──────────────────────────────────────── */
  const tMin   = Math.min(k.tAllerMin, k.tRetourMin);
  const temps  = _fmtMin(tMin);
  const freq   = `${k.freqHP} min`;
  const flotte = `${k.flotteTot}`;
  const vitMoy = +((k.vitA + k.vitR) / 2).toFixed(1);
  const vit    = `${vitMoy} km/h`;

  /* ── Matériel roulant ──────────────────────────── */
  const mrRaw = String(meta.mrType || 'metro').toLowerCase().replace(/[\s-]/g, '_');
  const mrKey = _MR_SVG[mrRaw] ? mrRaw : 'metro';
  const mrSvg = `img/svg/${_MR_SVG[mrKey]}`;
  const mrLbl = _MR_LBL[mrKey];

  /* ── Scorecard (META xlsx) ─────────────────────── */
  let SCORECARD_CRITERIA = [
    { key: 'capacite',    fr: 'Capacité',    en: 'Capacity',    score: 5 },
    { key: 'regularite',  fr: 'Régularité',  en: 'Regularity',  score: 4 },
    { key: 'faisabilite', fr: 'Faisabilité', en: 'Feasibility', score: 5 },
    { key: 'efficacite',  fr: 'Efficacité',  en: 'Efficiency',  score: 4 },
  ];
  const _scCrit = (key) => (SCORECARD_CRITERIA || []).find(c => c.key === key)?.score ?? 3.5;

  const sGlob = meta.scorecardGlobal     ?? _scCrit('all');
  const sFreq = meta.scorecardFrequence  ?? _scCrit('efficacite');
  const sReg  = meta.scorecardRegularite ?? _scCrit('regularite');
  const sG    = Math.min(5, Math.max(0, Number(sGlob) || 3.5));
  const sF    = Math.min(5, Math.max(0, Number(sFreq) || 3.5));
  const sR    = Math.min(5, Math.max(0, Number(sReg)  || 3.5));

  /* ── Logo client (base64 si disponible) ──────── */
  const logo = meta.logoClientB64
    ? `<image x="10" y="7" width="118" height="37" href="${meta.logoClientB64}"
         preserveAspectRatio="xMidYMid meet"/>`
    : `<text x="69" y="29" text-anchor="middle" fill="rgba(255,255,255,0.35)"
         font-size="8.5" font-family="system-ui,Arial">${_xe(clientName)}</text>`;

  /* ── ID préfixe unique pour les clipPaths ─────── */
  const U = `sf${scIdx}`;

  return `
<div class="synth-fiche-wrap">
<svg viewBox="0 0 960 540" xmlns="http://www.w3.org/2000/svg" class="synth-svg">
<defs>
  <pattern id="${U}dp" width="26" height="26" patternUnits="userSpaceOnUse">
    <circle cx="13" cy="13" r="0.7" fill="white" fill-opacity="0.05"/>
  </pattern>
  <clipPath id="${U}cc"><rect x="148" y="52" width="812" height="452"/></clipPath>
</defs>

<!-- ── FONDS ──────────────────────────────────────── -->
<rect x="0"   y="0"   width="148" height="540" fill="${BD}"/>
<rect x="0"   y="0"   width="4"   height="540" fill="${AC}" opacity="0.75"/>
<rect x="148" y="52"  width="812" height="452" fill="${BB}"/>
<rect x="148" y="52"  width="812" height="452" fill="url(#${U}dp)"/>
<rect x="0"   y="0"   width="960" height="52"  fill="${BD}"/>
<rect x="148" y="51"  width="812" height="1"   fill="rgba(255,255,255,0.12)"/>
<rect x="0"   y="504" width="960" height="36"  fill="${BD}"/>
<rect x="0"   y="504" width="960" height="1"   fill="rgba(255,255,255,0.10)"/>

<!-- ── HEADER ─────────────────────────────────────── -->
<rect x="10" y="7" width="118" height="37" rx="3"
  fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.15)" stroke-width="0.5"/>
${logo}
<text x="554" y="22" text-anchor="middle" fill="white"
  font-size="14" font-weight="700" letter-spacing="1.5" font-family="system-ui,Arial">${_xe(nomLigne)}</text>
<text x="554" y="40" text-anchor="middle" fill="rgba(255,255,255,0.5)"
  font-size="9.5" letter-spacing="2.5" font-family="system-ui,Arial">${_xe(scLabel)}</text>

<!-- ── SIDEBAR ────────────────────────────────────── -->
<text x="74" y="80" text-anchor="middle" fill="rgba(255,255,255,0.38)"
  font-size="7" letter-spacing="2" font-family="system-ui,Arial">À PROPOS</text>
<line x1="14" y1="86" x2="134" y2="86" stroke="rgba(255,255,255,0.1)" stroke-width="0.5"/>
<foreignObject x="12" y="94" width="126" height="340">
  <div xmlns="http://www.w3.org/1999/xhtml"
    style="color:rgba(255,255,255,0.44);font-size:8.5px;line-height:1.65;font-family:system-ui,Arial;">
    ${_xe(etude || `Étude d'exploitation — ${nomLigne}`)}
  </div>
</foreignObject>

<!-- ── FOOTER ─────────────────────────────────────── -->
<rect x="8"   y="509" width="96"  height="26" rx="3"
  fill="rgba(255,255,255,0.09)" stroke="rgba(255,255,255,0.12)" stroke-width="0.5"/>
<text x="56"  y="526" text-anchor="middle" fill="rgba(255,255,255,0.65)"
  font-size="8.5" font-weight="600" letter-spacing="0.5" font-family="system-ui,Arial">${_xe(clientName)}</text>
<text x="480" y="526" text-anchor="middle" fill="rgba(255,255,255,0.5)"
  font-size="8.5" font-family="system-ui,Arial">${dateStr}</text>
<rect x="846" y="509" width="106" height="26" rx="3"
  fill="rgba(255,255,255,0.09)" stroke="rgba(255,255,255,0.12)" stroke-width="0.5"/>
<text x="899" y="526" text-anchor="middle" fill="rgba(255,255,255,0.65)"
  font-size="8.5" font-weight="600" letter-spacing="1" font-family="system-ui,Arial">${_xe(entreprise)}</text>

<!-- ═════════════  ZONE CONTENU  ═════════════════════ -->
<g clip-path="url(#${U}cc)">

${_skyline(U)}

<!-- ── SÉPARATEUR scorecard / contenu principal ──── -->
<line x1="308" y1="62" x2="308" y2="456"
  stroke="rgba(255,255,255,0.07)" stroke-width="0.5"/>

<!-- ── SCORECARD VERTICAL (zone gauche 148→308) ───── -->
${_scorecardVertical(sR, sG, sF, AM, U)}

<!-- ── TEMPS DE PARCOURS ──────────────────────────── -->
<text x="630" y="92" text-anchor="middle" fill="rgba(255,255,255,0.32)"
  font-size="8.5" letter-spacing="2.5" font-family="system-ui,Arial">TEMPS DE PARCOURS</text>
<text x="630" y="132" text-anchor="middle" fill="white"
  font-size="50" font-weight="700" letter-spacing="-1.5" font-family="system-ui,Arial">${temps}</text>
<text x="630" y="152" text-anchor="middle" fill="rgba(255,255,255,0.38)"
  font-size="10.5" font-family="system-ui,Arial">${_xe(stA)}  ·  ${_xe(stR)}</text>

<!-- ── LIGNE DE TRAJET ────────────────────────────── -->
<!-- trait principal -->
<line x1="355" y1="270" x2="905" y2="270"
  stroke="rgba(255,255,255,0.18)" stroke-width="2.5"/>

<!-- terminus gauche -->
<circle cx="355" cy="270" r="13" fill="none" stroke="${AC}" stroke-width="2"/>
<circle cx="355" cy="270" r="5"  fill="${AC}"/>
<text x="355" y="298" text-anchor="middle" fill="rgba(255,255,255,0.45)"
  font-size="9" font-family="system-ui,Arial">${_xe(stA)}</text>

<!-- terminus droit -->
<circle cx="905" cy="270" r="13" fill="none" stroke="${AC}" stroke-width="2"/>
<circle cx="905" cy="270" r="5"  fill="${AC}"/>
<text x="905" y="298" text-anchor="middle" fill="rgba(255,255,255,0.45)"
  font-size="9" font-family="system-ui,Arial">${_xe(stR)}</text>

<!-- ── KPI 1 : FLOTTE — au-dessus, ancre x=490 ──────
     Bloc centré sur x=490, base du bloc à y=192 (haut du pointillé)
     Structure : label (y=168) / ligne chiffre+icône (y=200) / sous-label (y=216)
-->
<circle cx="490" cy="270" r="5" fill="${AC}"/>
<line x1="490" y1="265" x2="490" y2="192"
  stroke="rgba(255,255,255,0.18)" stroke-width="1" stroke-dasharray="4 3"/>
<text x="422" y="168" text-anchor="start" fill="rgba(255,255,255,0.35)"
  font-size="8" letter-spacing="2" font-family="system-ui,Arial">FLOTTE</text>
<text x="422" y="200" text-anchor="start" fill="white"
  font-size="38" font-weight="700" letter-spacing="-1" font-family="system-ui,Arial">${flotte}</text>
<image x="470" y="170" width="40" height="40"
  href="${mrSvg}"
  preserveAspectRatio="xMidYMid meet" opacity="0.72"/>
<text x="422" y="216" text-anchor="start" fill="rgba(255,255,255,0.45)"
  font-size="10" font-family="system-ui,Arial">${mrLbl}</text>

<!-- ── KPI 2 : VITESSE — en dessous, ancre x=628 ────
     Bloc centré sur x=628, sommet du bloc à y=352 (bas du pointillé)
     Structure : label (y=366) / ligne chiffre+icône (y=398) / sous-label (y=414)
-->
<circle cx="628" cy="270" r="5" fill="${AC}"/>
<line x1="628" y1="275" x2="628" y2="352"
  stroke="rgba(255,255,255,0.18)" stroke-width="1" stroke-dasharray="4 3"/>
<text x="560" y="370" text-anchor="start" fill="rgba(255,255,255,0.35)"
  font-size="8" letter-spacing="2" font-family="system-ui,Arial">VITESSE COM.</text>
<text x="560" y="402" text-anchor="start" fill="white"
  font-size="38" font-weight="700" letter-spacing="-1" font-family="system-ui,Arial">${vit}</text>
<image x="700" y="372" width="40" height="40"
  href="img/svg/speedometer_w.svg"
  preserveAspectRatio="xMidYMid meet" opacity="0.72"/>
<text x="560" y="418" text-anchor="start" fill="rgba(255,255,255,0.45)"
  font-size="10" font-family="system-ui,Arial">vitesse commerciale moyenne</text>

<!-- ── KPI 3 : FRÉQUENCE — au-dessus, ancre x=768 ───
     Bloc centré sur x=768, base du bloc à y=192 (haut du pointillé)
     Structure : label (y=168) / ligne chiffre+icône (y=200) / sous-label (y=216)
-->
<circle cx="768" cy="270" r="5" fill="${AC}"/>
<line x1="768" y1="265" x2="768" y2="192"
  stroke="rgba(255,255,255,0.18)" stroke-width="1" stroke-dasharray="4 3"/>
<text x="700" y="168" text-anchor="start" fill="rgba(255,255,255,0.35)"
  font-size="8" letter-spacing="2" font-family="system-ui,Arial">FRÉQUENCE</text>
<text x="700" y="200" text-anchor="start" fill="white"
  font-size="38" font-weight="700" letter-spacing="-1" font-family="system-ui,Arial">${freq}</text>
<image x="810" y="170" width="40" height="40"
  href="img/svg/Frequence_w.svg"
  preserveAspectRatio="xMidYMid meet" opacity="0.72"/>
<text x="700" y="216" text-anchor="start" fill="rgba(255,255,255,0.45)"
  font-size="10" font-family="system-ui,Arial">en heure de pointe</text>

</g><!-- end clip -->
</svg>
</div>`;
}

/* ══════════════════════════════════════════════════════
   SCORECARD VERTICAL  (zone gauche 148→308)
   3 blocs empilés : Régularité | Performance globale | Fréquence
══════════════════════════════════════════════════════ */
function _scorecardVertical(sReg, sGlob, sFreq, AM, U) {
  /* cx de la zone scorecard */
  const CX = 228;

  /* ── Générateur d'étoiles SVG ── */
  function stars(cx, cy, score, sz) {
    const step  = sz * 2 + 3;
    const total = 5 * step - 3;
    const x0    = cx - total / 2 + sz;
    let out = '';

    const P = (s) =>
      `M0,-${s} L${(.267*s).toFixed(1)},-${(.367*s).toFixed(1)} ` +
      `L${(.951*s).toFixed(1)},-${(.309*s).toFixed(1)} ` +
      `L${(.434*s).toFixed(1)},${(.149*s).toFixed(1)} ` +
      `L${(.588*s).toFixed(1)},${(.809*s).toFixed(1)} ` +
      `L0,${(.450*s).toFixed(1)} ` +
      `L-${(.588*s).toFixed(1)},${(.809*s).toFixed(1)} ` +
      `L-${(.434*s).toFixed(1)},${(.149*s).toFixed(1)} ` +
      `L-${(.951*s).toFixed(1)},-${(.309*s).toFixed(1)} ` +
      `L-${(.267*s).toFixed(1)},-${(.367*s).toFixed(1)}Z`;

    const scoreClean = Math.min(5, Math.max(0, score));
    const full  = Math.floor(scoreClean);
    const frac  = scoreClean - full;

    for (let n = 1; n <= 5; n++) {
      const ex  = x0 + (n - 1) * step;
      const path = P(sz);
      const cid  = `${U}sv${Math.round(cy)}n${n}`;

      if (n <= full) {
        out += `<path transform="translate(${ex},${cy})" d="${path}" fill="${AM}"/>`;
      } else if (n === full + 1 && frac > 0.05) {
        const pw = frac * sz * 2;
        out += `<defs><clipPath id="${cid}">
          <rect x="${ex - sz}" y="${cy - sz - 2}" width="${pw.toFixed(1)}" height="${sz * 2 + 4}"/>
        </clipPath></defs>`;
        out += `<path transform="translate(${ex},${cy})" d="${path}"
          fill="rgba(245,168,32,0.12)" stroke="${AM}" stroke-width="0.7"/>`;
        out += `<path transform="translate(${ex},${cy})" clip-path="url(#${cid})"
          d="${path}" fill="${AM}"/>`;
      } else {
        out += `<path transform="translate(${ex},${cy})" d="${path}"
          fill="rgba(245,168,32,0.10)" stroke="${AM}" stroke-width="0.7"/>`;
      }
    }
    return out;
  }

  const lbl = (txt, y, size, color, fw = 'normal', ls = '0') =>
    `<text x="${CX}" y="${y}" text-anchor="middle" fill="${color}"
       font-size="${size}" font-weight="${fw}" letter-spacing="${ls}"
       font-family="system-ui,Arial">${txt}</text>`;

  const sep = (y) =>
    `<line x1="168" y1="${y}" x2="288" y2="${y}"
       stroke="rgba(255,255,255,0.07)" stroke-width="0.5"/>`;

  return `
<!-- Régularité -->
${lbl('RÉGULARITÉ', 98, '7.5', 'rgba(255,255,255,0.38)', 'normal', '1.5')}
${stars(CX, 120, sReg, 6)}
${lbl(`${sReg.toFixed(1)} / 5`, 140, '9', AM, '600')}

${sep(158)}

<!-- Performance globale -->
${lbl('PERFORMANCE', 180, '9', 'white', '700', '1')}
${lbl('GLOBALE',     194, '9', 'white', '700', '1')}
${stars(CX, 222, sGlob, 9)}
${lbl(`${sGlob.toFixed(1)} / 5`, 246, '14', AM, '700')}

${sep(262)}

<!-- Fréquence -->
${lbl('FRÉQUENCE', 280, '7.5', 'rgba(255,255,255,0.38)', 'normal', '1.5')}
${stars(CX, 302, sFreq, 6)}
${lbl(`${sFreq.toFixed(1)} / 5`, 322, '9', AM, '600')}`;
}

/* ══════════════════════════════════════════════════════
   SKYLINE URBAINE  (bas de la zone contenu)
   Deux couches de bâtiments + sol, dessinées en SVG pur
══════════════════════════════════════════════════════ */
function _skyline(U) {
  /* Couche arrière : bâtiments plus hauts, teinte légèrement plus claire */
  const back = [
    [160,408,18,52],[180,393,14,67],[198,413,22,47],[224,398,16,62],
    [244,418,20,42],[268,403,12,57],[284,422,26,38],[314,406,14,54],
    [332,386,18,74],[354,414,24,46],[382,400,16,60],[402,380,20,80],
    [412,365, 2,18],/* antenne */
    [426,404,28,56],[458,416,18,44],[480,394,22,66],[506,408,16,52],
    [526,390,20,70],[550,380,14,80],[568,410,26,50],[598,397,18,63],
    [620,414,22,46],[646,390,16,70],[666,403,20,57],[690,413,14,47],
    [708,385,24,75],[736,406,18,54],[758,394,22,66],[784,418,16,42],
    [804,398,20,62],[828,410,14,50],[846,388,26,72],[876,404,18,56],
    [898,420,22,40],[924,396,16,64],
  ];

  /* Couche avant : bâtiments plus bas, plus sombres */
  const front = [
    [156,428,24,32],[186,435,30,25],[222,422,20,38],[250,430,28,30],
    [284,424,18,36],[310,414,34,46],[352,428,22,32],[382,418,26,42],
    [416,410,30,50],[450,396,36,64],[465,382, 4,18],/* antenne centrale */
    [492,424,24,36],[524,414,28,46],[560,426,20,34],[588,418,30,42],
    [626,428,22,32],[656,416,26,44],[690,430,18,30],[716,420,28,40],
    [752,414,32,46],[792,426,24,34],[824,418,20,42],[852,430,28,30],
    [888,424,22,36],[918,432,30,28],
  ];

  const r = (arr, fill) => arr
    .map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`)
    .join('\n');

  return `
<!-- ── Skyline arrière ── -->
${r(back, '#0d3254')}
<!-- ── Skyline avant ── -->
${r(front, '#082338')}
<!-- ── Sol ── -->
<rect x="148" y="458" width="812" height="46" fill="#071d2e"/>`;
}

/* ══════════════════════════════════════════════════════
   UTILITAIRES
══════════════════════════════════════════════════════ */

/** Formate des minutes décimales en "Xm Ys" */
function _fmtMin(decMin) {
  const m = Math.floor(decMin);
  const s = Math.round((decMin - m) * 60);
  return s > 0 ? `${m} min ${s} s` : `${m} min`;
}

/** Échappe les caractères HTML dangereux dans les chaînes SVG */
function _xe(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}