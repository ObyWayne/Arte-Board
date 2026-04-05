/* ── render.comp.utils.js — Utilitaires de formatage (tableau comparatif) ── */

// Convertit des minutes en "mm:ss"
// Ex : 45.5 min → "45:30"
function fmtMmSs(minutes) {
  if (!minutes && minutes !== 0) return '—';
  const totalSec = Math.round(minutes * 60);
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  return `${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
}

// Convertit des minutes en "hh:mm:ss"
// Ex : 90.5 min → "01:30:30"
function fmtHhMmSs(minutes) {
  if (!minutes && minutes !== 0) return '—';
  const totalSec = Math.round(minutes * 60);
  const hh = Math.floor(totalSec / 3600);
  const mm = Math.floor((totalSec % 3600) / 60);
  const ss = totalSec % 60;
  return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
}

// Formate la valeur SMR :
// - si c'est un nombre pur → affiché tel quel (capacité passagers)
// - si c'est une durée en minutes → format mm:ss
function fmtSmr(val) {
  if (val === null || val === undefined || val === '') return '—';
  const n = parseFloat(val);
  if (isNaN(n)) return String(val);
  // Heuristique : si < 300, probablement une capacité (passagers)
  // si >= 300 ou si val contient ":", c'est un temps en secondes/minutes
  if (typeof val === 'string' && val.includes(':')) return fmtMmSs(n);
  return String(n); // capacité numérique pure, pas d'unité
}
