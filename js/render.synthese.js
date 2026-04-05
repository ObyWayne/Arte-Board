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
  const dateStr    = new Date().toLocaleDateString('fr-FR');
  const clientName = meta.client     || 'CLIENT';
  const entreprise = meta.entreprise || 'SYSTRA';

  /* ── Terminus ──────────────────────────────────── */
  const stA = LINE.stations[0]?.nom                    || 'Terminus A';
  const stR = LINE.stations[LINE.stations.length-1]?.nom || 'Terminus B';

  /* ── KPIs ──────────────────────────────────────── */
  const tMin    = Math.min(k.tAllerMin, k.tRetourMin);
  const temps   = _fmtMin(tMin);
  const freq    = `${k.freqHP} min`;
  const flotte  = `${k.flotteTot}`;
  const vitMoy  = +((k.vitA + k.vitR) / 2).toFixed(1);
  const vit     = `${vitMoy} km/h`;

  /* ── Matériel roulant ──────────────────────────── */
  const mrRaw  = String(meta.mrType || 'metro').toLowerCase().replace(/[\s-]/g, '_');
  const mrKey  = _MR_SVG[mrRaw] ? mrRaw : 'metro';
  const mrSvg  = `images/svg/${_MR_SVG[mrKey]}`;
  const mrLbl  = _MR_LBL[mrKey];

  /* ── Scorecard (META xlsx) ─────────────────────── */
  /* Défaut SCORECARD_CRITERIA si clé META absente */
  let SCORECARD_CRITERIA = [
  {key:'capacite',    fr:'Capacité',    en:'Capacity',    score:5},
  {key:'regularite',  fr:'Régularité',  en:'Regularity',  score:4},
  {key:'faisabilite', fr:'Faisabilité', en:'Feasibility', score:5},
  {key:'efficacite',  fr:'Efficacité',  en:'Efficiency',  score:4},
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
  <radialGradient id="${U}pg" cx="50%" cy="55%" r="50%">
    <stop offset="0%"   stop-color="${AC}" stop-opacity="0.24"/>
    <stop offset="100%" stop-color="${AC}" stop-opacity="0"/>
  </radialGradient>
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

<!-- ── Temps de parcours ──────────────────────────── -->
<text x="399" y="148" fill="white"
  font-size="36" font-weight="700" letter-spacing="-0.5" font-family="system-ui,Arial">${temps}</text>
<image x="647" y="113" width="58" height="33"
  href="images/svg/travel_time_w.svg"
  preserveAspectRatio="xMidYMid meet" opacity="0.82"/>
<text x="399" y="166" fill="rgba(255,255,255,0.5)"
  font-size="12" font-family="system-ui,Arial">entre ${_xe(stA)} et ${_xe(stR)}</text>

<!-- Connecteur temps → orbite -->
<line x1="554" y1="170" x2="554" y2="182"
  stroke="rgba(255,255,255,0.2)" stroke-width="1" stroke-dasharray="4 3"/>
<circle cx="554" cy="182" r="3" fill="rgba(255,255,255,0.30)"/>

<!-- ── Orbite elliptique ───────────────────────────── -->
<ellipse cx="554" cy="272" rx="230" ry="90"
  fill="none" stroke="rgba(255,255,255,0.14)" stroke-width="1.2" stroke-dasharray="6 5"/>
<circle cx="324" cy="272" r="3" fill="rgba(255,255,255,0.25)"/>
<circle cx="784" cy="272" r="3" fill="rgba(255,255,255,0.25)"/>
<circle cx="554" cy="362" r="3" fill="rgba(255,255,255,0.25)"/>

<!-- Halo planète -->
<ellipse cx="554" cy="321" rx="220" ry="30" fill="url(#${U}pg)"/>

<!-- ── Matériel roulant (planète centrale) ────────── -->
<image x="330" y="213" width="448" height="118"
  href="${mrSvg}"
  preserveAspectRatio="xMidYMid meet" opacity="0.95"/>

<!-- Connecteurs KPI -->
<line x1="295" y1="272" x2="324" y2="272"
  stroke="rgba(255,255,255,0.2)" stroke-width="1" stroke-dasharray="4 3"/>
<line x1="784" y1="272" x2="796" y2="272"
  stroke="rgba(255,255,255,0.2)" stroke-width="1" stroke-dasharray="4 3"/>
<line x1="554" y1="362" x2="554" y2="370"
  stroke="rgba(255,255,255,0.2)" stroke-width="1" stroke-dasharray="4 3"/>

<!-- ── KPI GAUCHE : Fréquence ─────────────────────── -->
<image x="160" y="245" width="54" height="54"
  href="images/svg/Frequence_w.svg"
  preserveAspectRatio="xMidYMid meet" opacity="0.85"/>
<text x="222" y="281" fill="white"
  font-size="30" font-weight="700" font-family="system-ui,Arial">${freq}</text>
<text x="222" y="298" fill="rgba(255,255,255,0.5)"
  font-size="11" font-family="system-ui,Arial">de fréquence</text>

<!-- ── KPI DROITE : Flotte ───────────────────────── -->
<text x="798" y="262" fill="white"
  font-size="30" font-weight="700" font-family="system-ui,Arial">${flotte}</text>
<text x="798" y="282" fill="rgba(255,255,255,0.5)"
  font-size="11" font-family="system-ui,Arial">${mrLbl}</text>
<image x="890" y="245" width="54" height="54"
  href="images/svg/Designer_w.svg"
  preserveAspectRatio="xMidYMid meet" opacity="0.85"/>

<!-- ── KPI BAS : Vitesse commerciale ────────────── -->
<image x="404" y="370" width="54" height="54"
  href="images/svg/speedometer_w.svg"
  preserveAspectRatio="xMidYMid meet" opacity="0.85"/>
<text x="466" y="407" fill="white"
  font-size="28" font-weight="700" font-family="system-ui,Arial">${vit}</text>
<text x="466" y="423" fill="rgba(255,255,255,0.5)"
  font-size="11" font-family="system-ui,Arial">de vitesse commerciale</text>

<!-- ══════  BANDEAU SCORECARD  ══════════════════════ -->
${_starBanner(sR, sG, sF, AM, U)}

</g><!-- end clip -->
</svg>
</div>`;
}

/* ══════════════════════════════════════════════════════
   BANDEAU ÉTOILES  (3 blocs : Régularité | Global | Fréquence)
══════════════════════════════════════════════════════ */
function _starBanner(sReg, sGlob, sFreq, AM, U) {
  const BY = 434;  // y départ du bandeau

  /* Génère les 5 étoiles SVG centrées en (cx, cy) avec une taille `sz` */
  function stars(cx, cy, score, sz) {
    const step  = sz * 2 + 4;
    const total = 5 * step - 4;
    const x0    = cx - total / 2 + sz;
    let out = '';

    /* Chemin étoile 5 branches normalisé (rayon = sz) */
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
      const ex   = x0 + (n - 1) * step;
      const path = P(sz);
      const cid  = `${U}sc${cx}n${n}`;

      if (n <= full) {
        /* Étoile pleine */
        out += `<path transform="translate(${ex},${cy})" d="${path}" fill="${AM}"/>`;
      } else if (n === full + 1 && frac > 0.05) {
        /* Étoile partielle */
        const pw = frac * sz * 2;
        out += `<defs><clipPath id="${cid}">
          <rect x="${ex - sz}" y="${cy - sz - 2}" width="${pw.toFixed(1)}" height="${sz * 2 + 4}"/>
        </clipPath></defs>`;
        out += `<path transform="translate(${ex},${cy})" d="${path}"
          fill="rgba(245,165,32,0.12)" stroke="${AM}" stroke-width="0.7"/>`;
        out += `<path transform="translate(${ex},${cy})" clip-path="url(#${cid})"
          d="${path}" fill="${AM}"/>`;
      } else {
        /* Étoile vide */
        out += `<path transform="translate(${ex},${cy})" d="${path}"
          fill="rgba(245,165,32,0.10)" stroke="${AM}" stroke-width="0.7"/>`;
      }
    }
    return out;
  }

  const label = (txt, x, y, w, c='rgba(255,255,255,0.45)', fw='normal', ls='1') =>
    `<text x="${x}" y="${y}" text-anchor="middle" fill="${c}"
       font-size="${w}" font-weight="${fw}" letter-spacing="${ls}"
       font-family="system-ui,Arial">${txt}</text>`;

  return `
<rect x="148" y="${BY}" width="812" height="70" fill="rgba(0,0,0,0.28)"/>
<line x1="148" y1="${BY}"   x2="960" y2="${BY}"   stroke="rgba(255,255,255,0.07)" stroke-width="0.5"/>
<line x1="418" y1="${BY+6}" x2="418" y2="${BY+64}" stroke="rgba(255,255,255,0.08)" stroke-width="0.5"/>
<line x1="689" y1="${BY+6}" x2="689" y2="${BY+64}" stroke="rgba(255,255,255,0.08)" stroke-width="0.5"/>

<!-- GAUCHE : Régularité -->
${label('Régularité', 310, BY+14, '8.5')}
${stars(310, BY+35, sReg, 6)}
${label(`${sReg.toFixed(1)} / 5`, 310, BY+58, '9.5', AM, '600')}

<!-- CENTRE : Performance globale -->
${label('PERFORMANCE GLOBALE', 554, BY+14, '10', 'white', '600', '1.5')}
${stars(554, BY+35, sGlob, 9)}
${label(`${sGlob.toFixed(1)} / 5`, 554, BY+58, '13', AM, '700')}

<!-- DROITE : Fréquence -->
${label('Fréquence', 798, BY+14, '8.5')}
${stars(798, BY+35, sFreq, 6)}
${label(`${sFreq.toFixed(1)} / 5`, 798, BY+58, '9.5', AM, '600')}`;
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
