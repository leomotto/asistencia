// js/utils.js — Utilidades de fecha compartidas entre módulos

export function normalizeDateToISO(dateStr) {
  if (!dateStr) return "";
  dateStr = dateStr.trim();
  if (dateStr === "") return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

  const sep = dateStr.includes('/') ? '/' : '-';
  const partes = dateStr.split(sep);
  if (partes[0].length === 4) return dateStr; // ya es ISO
  const dia = partes[0].padStart(2, '0');
  const mes = partes[1].padStart(2, '0');
  let anio = partes[2] ? partes[2].trim() : String(new Date().getFullYear());
  if (anio.length === 2) anio = '20' + anio;
  return `${anio}-${mes}-${dia}`;
}

// Escapa caracteres HTML especiales para prevenir XSS en innerHTML
export function escaparHTML(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// SIDEAC guarda los bimestres valorativos (b1/b3) en mayúsculas: SUFICIENTE, AVANZADO, EN PROCESO.
// MiEscuela los maneja con otra capitalización (Suficiente, Avanzado, En Proceso). Mismo valor,
// distinta forma — hay que normalizar antes de comparar o el sync los ve como "diferentes" siempre.
export function esPeriodoValorativo(periodo) {
  return periodo === 'b1' || periodo === 'b3';
}

export function normValorativo(v) {
  return (v || '').toString().trim().toUpperCase();
}

// Convierte el código SIDEAC (mayúsculas) a la capitalización que usa MiEscuela.
export function valorativoDisplayGCABA(sideacVal) {
  const mapa = { SUFICIENTE: 'Suficiente', AVANZADO: 'Avanzado', 'EN PROCESO': 'En Proceso' };
  return mapa[normValorativo(sideacVal)] || sideacVal;
}

export function formatISOToDisplay(isoStr) {
  if (!isoStr || !/^\d{4}-\d{2}-\d{2}$/.test(isoStr)) return isoStr || "-";
  const [anio, mes, dia] = isoStr.split('-');
  return `${dia}/${mes}/${anio}`;
}
