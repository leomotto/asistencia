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
  let anio = partes[2] ? partes[2].trim() : '2026';
  if (anio.length === 2) anio = '20' + anio;
  return `${anio}-${mes}-${dia}`;
}

export function formatISOToDisplay(isoStr) {
  if (!isoStr || !/^\d{4}-\d{2}-\d{2}$/.test(isoStr)) return isoStr || "-";
  const [anio, mes, dia] = isoStr.split('-');
  return `${dia}/${mes}/${anio}`;
}
