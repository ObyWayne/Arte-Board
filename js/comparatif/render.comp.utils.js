/* ── render.comp.utils.js — Utilitaires + comportements UI partagés ── */

/* ══════════════════════════════════════════════════════
   COULEUR — UTILITAIRE PARTAGÉ
   Utilisé par render_comp_radar.js, render_comp_terminus.js,
   render_comp_energy.js.
   Éclaircit une couleur hex d'un facteur f ∈ [0,1] vers le blanc.
   Exemple : _lightenHex('#a06bff', 0.35)
══════════════════════════════════════════════════════ */
function _lightenHex(hex, f) {
  const n = parseInt((hex||'#888').replace('#',''), 16);
  const r = Math.min(255, ((n>>16)&0xff) + Math.round((255-((n>>16)&0xff)) * f));
  const g = Math.min(255, ((n>>8) &0xff) + Math.round((255-((n>>8) &0xff)) * f));
  const b = Math.min(255, ( n     &0xff) + Math.round((255-( n     &0xff)) * f));
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

/* ══════════════════════════════════════════════════════
   FERMETURE GLOBALE DES MENUS DÉROULANTS
   • Scroll en dehors du menu  → ferme
   • Clic en dehors du menu   → ferme
   • Scroll dans le menu      → reste ouvert (sélection possible)
══════════════════════════════════════════════════════ */

/* Fermeture au scroll — capture phase pour intercepter tous les containers */
window.addEventListener('scroll', (e) => {
  if (e.target && typeof e.target.closest === 'function' &&
      e.target.closest('.col-picker-dropdown')) return;
  document.querySelectorAll('.col-picker-dropdown.open')
          .forEach(d => d.classList.remove('open'));
}, true);

/* Fermeture au clic en dehors d'un .col-picker-wrap */
document.addEventListener('click', (e) => {
  if (e.target.closest && e.target.closest('.col-picker-wrap')) return;
  document.querySelectorAll('.col-picker-dropdown.open')
          .forEach(d => d.classList.remove('open'));
});


/* ══════════════════════════════════════════════════════
   FORMATAGE
══════════════════════════════════════════════════════ */

// Convertit des minutes en "mm:ss" — Ex : 45.5 min → "45:30"
function fmtMmSs(minutes) {
  if (!minutes && minutes !== 0) return '—';
  const totalSec = Math.round(minutes * 60);
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  return `${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
}

// Convertit des minutes en "hh:mm:ss" — Ex : 90.5 min → "01:30:30"
function fmtHhMmSs(minutes) {
  if (!minutes && minutes !== 0) return '—';
  const totalSec = Math.round(minutes * 60);
  const hh = Math.floor(totalSec / 3600);
  const mm = Math.floor((totalSec % 3600) / 60);
  const ss = totalSec % 60;
  return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
}

// Formate la valeur SMR
function fmtSmr(val) {
  if (val === null || val === undefined || val === '') return '—';
  const n = parseFloat(val);
  if (isNaN(n)) return String(val);
  if (typeof val === 'string' && val.includes(':')) return fmtMmSs(n);
  return String(n);
}