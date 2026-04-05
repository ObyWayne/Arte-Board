/* ── render.comp.utils.js — Utilitaires de formatage + comportements UI partagés ── */

/* ══════════════════════════════════════════════════════
   SCROLL-CLOSE GLOBAL — tous les .col-picker-dropdown
   Ferme les menus au scroll, SAUF si le scroll est
   à l'intérieur du menu lui-même (pour pouvoir scroller
   la liste d'options sans la fermer).
══════════════════════════════════════════════════════ */
window.addEventListener('scroll', (e) => {
  // Si le scroll vient de l'intérieur d'un dropdown → on laisse ouvert
  if (e.target && typeof e.target.closest === 'function' &&
      e.target.closest('.col-picker-dropdown')) return;
  document.querySelectorAll('.col-picker-dropdown.open')
          .forEach(d => d.classList.remove('open'));
}, true /* capture : intercepte tous les containers scrollables */);


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

// Formate la valeur SMR :
// - nombre pur → affiché tel quel (capacité passagers)
// - contient ":" → format mm:ss
function fmtSmr(val) {
  if (val === null || val === undefined || val === '') return '—';
  const n = parseFloat(val);
  if (isNaN(n)) return String(val);
  if (typeof val === 'string' && val.includes(':')) return fmtMmSs(n);
  return String(n);
}
