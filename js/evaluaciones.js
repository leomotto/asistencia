// js/evaluaciones.js — Módulo de Calificaciones: Gestión de notas de bimestres y períodos de orientación (PO)

import { doc, setDoc, getDoc, collection, getDocs, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db, getPath } from "./firebase-config.js?v=9.49";
import { showToast } from "./ui.js?v=9.49";
import { escaparHTML } from "./utils.js?v=9.49";

// Estado de cambios pendientes locales: { "alumnoId": { b1, b2, b3, b4, po_dic, po_feb } }
export let cambiosPendientesEvaluaciones = {};

// Configuración global de columnas habilitadas (Admin): { b1: true, b2: true, ... }
export let configHabilitacionEvaluaciones = { b1: true, b2: true, b3: true, b4: true, po_dic: true, po_feb: true };

// Estructura de columnas de evaluaciones por periodo (por defecto)
export let configEstructuraEvaluaciones = {
  b1: [{ key: 'nota', label: '1er Bim (Val)', type: 'principal' }],
  b2: [{ key: 'nota', label: '2do Bim (Num)', type: 'principal' }],
  b3: [{ key: 'nota', label: '3er Bim (Val)', type: 'principal' }],
  b4: [{ key: 'nota', label: '4to Bim (Num)', type: 'principal' }],
  po_dic: [{ key: 'nota', label: 'PO Dic', type: 'principal' }],
  po_feb: [{ key: 'nota', label: 'PO Feb', type: 'principal' }]
};

// Estado de bloqueo de la planilla para el curso actual: true / false
export let planillaBloqueadaCurso = false;

// Estado de las notas cargadas de la última planilla para cálculos reactivos
export let _ultimaPlanillaCargadaNotasMap = {};

// Limpia el estado de cambios locales
export function limpiarCambiosEvaluaciones() {
  cambiosPendientesEvaluaciones = {};
  const btn = document.getElementById('btnGuardarEvaluaciones');
  if (btn) btn.disabled = true;
}

// ==========================================
// CONFIGURACIÓN Y BLOQUEOS (FIRESTORE)
// ==========================================

// Carga la configuración de columnas habilitadas y la estructura desde Firestore
export async function cargarConfiguracionHabilitacion() {
  try {
    const docRef = doc(db, getPath('config'), 'evaluaciones');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.habilitados) {
        configHabilitacionEvaluaciones = { ...configHabilitacionEvaluaciones, ...data.habilitados };
      }
      if (data.estructura) {
        configEstructuraEvaluaciones = { ...configEstructuraEvaluaciones, ...data.estructura };
      }
    }
    _renderizarControlesAdmin();
  } catch (e) {
    console.error("Error al cargar configuración de evaluaciones:", e);
  }
}

// Guarda la configuración de columnas habilitadas (Solo Admin)
export async function guardarConfiguracionHabilitacion() {
  const btn = document.getElementById('btnGuardarConfigEval');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="ph ph-spinner animate-spin"></i> Guardando...';
  }

  const habilitados = {
    b1: document.getElementById('cfgB1')?.checked ?? true,
    b2: document.getElementById('cfgB2')?.checked ?? true,
    b3: document.getElementById('cfgB3')?.checked ?? true,
    b4: document.getElementById('cfgB4')?.checked ?? true,
    po_dic: document.getElementById('cfgPoDic')?.checked ?? true,
    po_feb: document.getElementById('cfgPoFeb')?.checked ?? true,
  };

  try {
    const docRef = doc(db, getPath('config'), 'evaluaciones');
    await setDoc(docRef, { habilitados }, { merge: true });
    configHabilitacionEvaluaciones = habilitados;
    showToast("✅ Configuración de periodos guardada correctamente.");
    await cargarPlanillaEvaluaciones();
  } catch (e) {
    console.error(e);
    showToast("❌ Error al guardar la configuración.", "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="ph ph-sliders"></i> Guardar Fechas';
    }
  }
}

// Carga el estado de bloqueo para el curso seleccionado
export async function cargarBloqueoCurso(curso) {
  if (!curso) {
    planillaBloqueadaCurso = false;
    _actualizarBotonBloqueo();
    return;
  }
  try {
    const docRef = doc(db, getPath('evaluaciones_locks'), curso);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      planillaBloqueadaCurso = !!docSnap.data().locked;
    } else {
      planillaBloqueadaCurso = false;
    }
    _actualizarBotonBloqueo();
  } catch (e) {
    console.error("Error al cargar estado de bloqueo:", e);
    planillaBloqueadaCurso = false;
    _actualizarBotonBloqueo();
  }
}

// Modifica el estado de bloqueo del curso
export async function toggleBloqueoCurso() {
  const curso = document.getElementById('evalCurso').value;
  if (!curso) return;

  const esAdmin = window.app.currentUser?.rol === 'ADMIN';
  if (!esAdmin && planillaBloqueadaCurso) {
    showToast("⚠️ Solo un Administrador puede desbloquear la planilla.", "error");
    return;
  }

  const nuevoEstado = !planillaBloqueadaCurso;
  
  const btn = document.getElementById('btnLockEvaluaciones');
  if (btn) btn.disabled = true;

  try {
    const docRef = doc(db, getPath('evaluaciones_locks'), curso);
    await setDoc(docRef, {
      locked: nuevoEstado,
      lockedBy: window.app.currentUser?.email || 'unknown',
      lockedAt: new Date().toISOString()
    });
    planillaBloqueadaCurso = nuevoEstado;
    showToast(nuevoEstado ? "🔒 Planilla bloqueada contra cambios involuntarios." : "🔓 Planilla desbloqueada para edición.");
    await cargarPlanillaEvaluaciones();
  } catch (e) {
    console.error(e);
    showToast("❌ Error al cambiar el estado de bloqueo.", "error");
  } finally {
    if (btn) btn.disabled = false;
  }
}

function _actualizarBotonBloqueo() {
  const btn = document.getElementById('btnLockEvaluaciones');
  const badge = document.getElementById('badgeEvalBloqueada');
  if (!btn) return;

  const esAdmin = window.app.currentUser?.rol === 'ADMIN';

  if (planillaBloqueadaCurso) {
    btn.innerHTML = `<i class="ph ph-lock-key-open"></i> <span class="hidden sm:inline">Desbloquear</span>`;
    btn.className = "bg-orange-500 text-white px-3 py-2 rounded text-sm font-semibold hover:bg-orange-600 transition flex items-center gap-1.5";
    // Si no es admin, ocultar o inhabilitar el botón de desbloqueo
    if (!esAdmin) {
      btn.classList.add('opacity-50', 'cursor-not-allowed');
      btn.title = "Solo un Admin puede desbloquear";
    } else {
      btn.classList.remove('opacity-50', 'cursor-not-allowed');
      btn.title = "Desbloquear planilla";
    }
    if (badge) badge.classList.remove('hidden');
  } else {
    btn.innerHTML = `<i class="ph ph-lock-key"></i> <span class="hidden sm:inline">Bloquear Planilla</span>`;
    btn.className = "bg-slate-600 text-white px-3 py-2 rounded text-sm font-semibold hover:bg-slate-700 transition flex items-center gap-1.5";
    btn.classList.remove('opacity-50', 'cursor-not-allowed');
    btn.title = "Bloquear planilla para evitar cambios involuntarios";
    if (badge) badge.classList.add('hidden');
  }

  // Ocultar botón de bloqueo si no hay curso seleccionado
  const curso = document.getElementById('evalCurso').value;
  if (!curso) btn.classList.add('hidden');
  else btn.classList.remove('hidden');
}

function _obtenerNombrePeriodo(periodo) {
  switch (periodo) {
    case 'b1': return '1er Bimestre (Valorativo)';
    case 'b2': return '2do Bimestre (Numérico)';
    case 'b3': return '3er Bimestre (Valorativo)';
    case 'b4': return '4to Bimestre (Numérico)';
    case 'po_dic': return 'Periodo de Orientación Diciembre';
    case 'po_feb': return 'Periodo de Orientación Febrero';
    default: return periodo;
  }
}

function _renderizarEstructuraEditor() {
  const periodo = document.getElementById('evalPeriodo').value;
  if (!periodo) return;
  const cols = configEstructuraEvaluaciones[periodo] || [];
  const container = document.getElementById('lstColumnasConfig');
  if (!container) return;

  container.innerHTML = '';
  cols.forEach((col, index) => {
    const item = document.createElement('div');
    item.className = "flex items-center justify-between p-1.5 border dark:border-slate-700 rounded text-xs bg-slate-50 dark:bg-slate-900";
    
    const isPrincipal = col.type === 'principal';
    
    const btnUp = index > 0 
      ? `<button onclick="app.moverColumnaAdicional(${index}, -1)" class="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500" title="Subir"><i class="ph ph-arrow-up"></i></button>`
      : `<span class="w-6"></span>`;
    const btnDown = index < cols.length - 1 
      ? `<button onclick="app.moverColumnaAdicional(${index}, 1)" class="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500" title="Bajar"><i class="ph ph-arrow-down"></i></button>`
      : `<span class="w-6"></span>`;
      
    const btnDelete = !isPrincipal 
      ? `<button onclick="app.eliminarColumnaAdicional(${index})" class="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded ml-1" title="Eliminar"><i class="ph ph-trash"></i></button>`
      : `<span class="w-6"></span>`;

    item.innerHTML = `
      <div class="flex items-center gap-1 flex-1 min-w-0">
        <span class="font-bold truncate text-slate-750 dark:text-slate-200">${escaparHTML(col.label)}</span>
        <span class="text-[9px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 rounded truncate">${escaparHTML(col.key)}</span>
        ${isPrincipal ? '<span class="text-[9px] font-black text-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 px-1 rounded ml-auto">NOTACIÓN</span>' : ''}
      </div>
      <div class="flex items-center gap-0.5 ml-2">
        ${btnUp}
        ${btnDown}
        ${btnDelete}
      </div>
    `;
    container.appendChild(item);
  });
}

export function agregarColumnaAdicional() {
  const periodo = document.getElementById('evalPeriodo').value;
  if (!periodo) return;

  const labelInput = document.getElementById('addColLabel');
  const keyInput = document.getElementById('addColKey');
  if (!labelInput || !keyInput) return;

  const label = labelInput.value.trim();
  const key = keyInput.value.trim().toLowerCase();

  if (!label || !key) {
    showToast("⚠️ Complete etiqueta y clave del campo.", "error");
    return;
  }

  if (!/^[a-z0-9_]+$/.test(key)) {
    showToast("⚠️ La clave de base de datos solo debe contener letras minúsculas, números y guión bajo.", "error");
    return;
  }

  if (key === 'nota') {
    showToast("⚠️ La clave 'nota' está reservada para la calificación principal.", "error");
    return;
  }

  const cols = configEstructuraEvaluaciones[periodo] || [];
  if (cols.some(c => c.key === key)) {
    showToast("⚠️ Ya existe una columna con esa misma clave.", "error");
    return;
  }

  cols.push({ key, label, type: 'additional' });
  configEstructuraEvaluaciones[periodo] = cols;

  _renderizarEstructuraEditor();
  cargarPlanillaEvaluaciones();

  labelInput.value = '';
  keyInput.value = '';
}

export function eliminarColumnaAdicional(index) {
  const periodo = document.getElementById('evalPeriodo').value;
  if (!periodo) return;

  const cols = configEstructuraEvaluaciones[periodo] || [];
  if (cols[index] && cols[index].type === 'principal') return;

  cols.splice(index, 1);
  configEstructuraEvaluaciones[periodo] = cols;

  _renderizarEstructuraEditor();
  cargarPlanillaEvaluaciones();
}

export function moverColumnaAdicional(index, direccion) {
  const periodo = document.getElementById('evalPeriodo').value;
  if (!periodo) return;

  const cols = configEstructuraEvaluaciones[periodo] || [];
  const targetIndex = index + direccion;

  if (targetIndex < 0 || targetIndex >= cols.length) return;

  const temp = cols[index];
  cols[index] = cols[targetIndex];
  cols[targetIndex] = temp;

  configEstructuraEvaluaciones[periodo] = cols;

  _renderizarEstructuraEditor();
  cargarPlanillaEvaluaciones();
}

export async function guardarEstructuraColumnas() {
  try {
    const docRef = doc(db, getPath('config'), 'evaluaciones');
    await setDoc(docRef, { estructura: configEstructuraEvaluaciones }, { merge: true });
    showToast("✅ Estructura de columnas guardada con éxito.");
  } catch (e) {
    console.error(e);
    showToast("❌ Error al guardar estructura de columnas.", "error");
  }
}

function _renderizarControlesAdmin() {
  const esAdmin = window.app.currentUser?.rol === 'ADMIN';
  const panel = document.getElementById('panelAdminConfigEval');
  if (!panel) return;

  if (esAdmin) {
    panel.classList.remove('hidden');
    const c1 = document.getElementById('cfgB1'); if (c1) c1.checked = !!configHabilitacionEvaluaciones.b1;
    const c2 = document.getElementById('cfgB2'); if (c2) c2.checked = !!configHabilitacionEvaluaciones.b2;
    const c3 = document.getElementById('cfgB3'); if (c3) c3.checked = !!configHabilitacionEvaluaciones.b3;
    const c4 = document.getElementById('cfgB4'); if (c4) c4.checked = !!configHabilitacionEvaluaciones.b4;
    const cD = document.getElementById('cfgPoDic'); if (cD) cD.checked = !!configHabilitacionEvaluaciones.po_dic;
    const cF = document.getElementById('cfgPoFeb'); if (cF) cF.checked = !!configHabilitacionEvaluaciones.po_feb;

    const periodo = document.getElementById('evalPeriodo')?.value;
    const panelCols = document.getElementById('panelAdminColumnasEval');
    if (panelCols) {
      if (periodo) {
        panelCols.classList.remove('hidden');
        const lblPeriodo = document.getElementById('lblPeriodoConfig');
        if (lblPeriodo) lblPeriodo.innerText = _obtenerNombrePeriodo(periodo);
        _renderizarEstructuraEditor();
      } else {
        panelCols.classList.add('hidden');
      }
    }
  } else {
    panel.classList.add('hidden');
    document.getElementById('panelAdminColumnasEval')?.classList.add('hidden');
  }
}

// ==========================================
// CÁLCULO DE CALIFICACIÓN PONDERADA
// ==========================================

export function calcularNotaFinalYCondicion(b1, b2, b3, b4, poDic, poFeb) {
  const parseVal = (val) => {
    if (val === undefined || val === null || val === '') return null;
    const n = parseFloat(val);
    return isNaN(n) ? null : n;
  };

  const n2 = parseVal(b2);
  const n4 = parseVal(b4);
  const pDic = parseVal(poDic);
  const pFeb = parseVal(poFeb);

  // Promedio numérico de B2 y B4
  const nums = [n2, n4].filter(n => n !== null);
  const promedioNum = nums.length > 0 ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) : null;

  // Calificación Final (B4)
  const finalRegular = n4;

  // Si el 4to bimestre no está cargado, aún está cursando
  if (n4 === null) {
    return { 
      promedio: promedioNum, 
      final: null, 
      definitiva: null,
      condicion: 'CURSANDO', 
      colorClass: 'bg-slate-100 text-slate-700 dark:bg-slate-900/50 dark:text-slate-400' 
    };
  }

  // 4to bimestre cargado: se aprueba con 6 o más
  if (n4 >= 6.0) {
    return { 
      promedio: promedioNum, 
      final: finalRegular, 
      definitiva: n4,
      condicion: 'APROBADO', 
      colorClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold' 
    };
  }

  // 4to bimestre < 6: requiere Período de Orientación Diciembre (PO DIC)
  if (pDic === null) {
    return { 
      promedio: promedioNum, 
      final: finalRegular, 
      definitiva: null,
      condicion: 'A PO DIC', 
      colorClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-bold' 
    };
  }

  if (pDic >= 6.0) {
    return { 
      promedio: promedioNum, 
      final: finalRegular, 
      definitiva: pDic, 
      condicion: 'APROBADO (PO DIC)', 
      colorClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-medium' 
    };
  }

  // Falló PO DIC: requiere Período de Orientación Febrero (PO FEB)
  if (pFeb === null) {
    return { 
      promedio: promedioNum, 
      final: finalRegular, 
      definitiva: null,
      condicion: 'A PO FEB', 
      colorClass: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 font-bold animate-pulse' 
    };
  }

  if (pFeb >= 6.0) {
    return { 
      promedio: promedioNum, 
      final: finalRegular, 
      definitiva: pFeb, 
      condicion: 'APROBADO (PO FEB)', 
      colorClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-medium' 
    };
  }

  // Falló PO FEB: Desaprobado
  return { 
    promedio: promedioNum, 
    final: finalRegular, 
    definitiva: pFeb, 
    condicion: 'DESAPROBADO', 
    colorClass: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 font-black' 
  };
}

export function registrarCambioEvaluacion(alumnoId, campo, valor) {
  if (!cambiosPendientesEvaluaciones[alumnoId]) {
    const notaData = _ultimaPlanillaCargadaNotasMap[alumnoId] || {};
    cambiosPendientesEvaluaciones[alumnoId] = {
      b1: notaData.b1 ?? '',
      b2: notaData.b2 ?? '',
      b3: notaData.b3 ?? '',
      b4: notaData.b4 ?? '',
      po_dic: notaData.po_dic ?? '',
      po_feb: notaData.po_feb ?? '',
    };
  }

  const valTrim = valor.trim();
  cambiosPendientesEvaluaciones[alumnoId][campo] = valTrim;

  const btn = document.getElementById('btnGuardarEvaluaciones');
  if (btn) btn.disabled = false;

  _recalcularFilaEvaluacion(alumnoId);
}

export function registrarCambioAdicionalEvaluacion(alumnoId, periodo, campoKey, valor) {
  if (!cambiosPendientesEvaluaciones[alumnoId]) {
    const notaData = _ultimaPlanillaCargadaNotasMap[alumnoId] || {};
    cambiosPendientesEvaluaciones[alumnoId] = {
      b1: notaData.b1 ?? '',
      b2: notaData.b2 ?? '',
      b3: notaData.b3 ?? '',
      b4: notaData.b4 ?? '',
      po_dic: notaData.po_dic ?? '',
      po_feb: notaData.po_feb ?? '',
    };
  }

  if (!cambiosPendientesEvaluaciones[alumnoId].adicionales) {
    cambiosPendientesEvaluaciones[alumnoId].adicionales = {};
  }
  if (!cambiosPendientesEvaluaciones[alumnoId].adicionales[periodo]) {
    cambiosPendientesEvaluaciones[alumnoId].adicionales[periodo] = {};
  }

  cambiosPendientesEvaluaciones[alumnoId].adicionales[periodo][campoKey] = valor.trim();

  const btn = document.getElementById('btnGuardarEvaluaciones');
  if (btn) btn.disabled = false;
}

function _recalcularFilaEvaluacion(alumnoId) {
  const tr = document.querySelector(`tr[data-alumno-id="${alumnoId}"]`);
  if (!tr) return;

  const notaData = _ultimaPlanillaCargadaNotasMap[alumnoId] || {};
  const p = cambiosPendientesEvaluaciones[alumnoId] || {};

  const b1 = p.b1 !== undefined ? p.b1 : (notaData.b1 ?? '');
  const b2 = p.b2 !== undefined ? p.b2 : (notaData.b2 ?? '');
  const b3 = p.b3 !== undefined ? p.b3 : (notaData.b3 ?? '');
  const b4 = p.b4 !== undefined ? p.b4 : (notaData.b4 ?? '');
  const poDic = p.po_dic !== undefined ? p.po_dic : (notaData.po_dic ?? '');
  const poFeb = p.po_feb !== undefined ? p.po_feb : (notaData.po_feb ?? '');

  const res = calcularNotaFinalYCondicion(b1, b2, b3, b4, poDic, poFeb);

  const finalCell = tr.querySelector('.cell-final');
  if (finalCell) finalCell.innerText = res.final !== null ? res.final : '—';

  const definitivaCell = tr.querySelector('.cell-definitiva');
  if (definitivaCell) definitivaCell.innerText = res.definitiva !== null ? res.definitiva : '—';

  const condCell = tr.querySelector('.cell-condicion');
  if (condCell) {
    condCell.innerHTML = `
      <span class="badge-condicion text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${res.colorClass}">
        ${res.condicion}
      </span>
    `;
  }
}

function _getOptionsNumericas(selectedVal) {
  let html = `<option value="" ${selectedVal === '' ? 'selected' : ''}>-</option>`;
  for (let i = 10; i >= 1; i--) {
    html += `<option value="${i}" ${parseFloat(selectedVal) === i ? 'selected' : ''}>${i}</option>`;
  }
  return html;
}

// ==========================================
// CARGAR PLANILLA
// ==========================================

export async function cargarPlanillaEvaluaciones() {
  const curso     = document.getElementById('evalCurso').value;
  const periodo   = document.getElementById('evalPeriodo').value;
  const tablaBody = document.getElementById('evalBody');
  const btnGuardar = document.getElementById('btnGuardarEvaluaciones');

  await cargarBloqueoCurso(curso);
  _renderizarControlesAdmin();

  if (!curso) {
    tablaBody.innerHTML = '<tr><td colspan="10" class="px-4 py-8 text-center text-slate-400">Seleccione división del menú superior.</td></tr>';
    if (btnGuardar) btnGuardar.disabled = true;
    return;
  }

  if (!periodo) {
    tablaBody.innerHTML = '<tr><td colspan="10" class="px-4 py-8 text-center text-slate-400">Seleccione un periodo de evaluación para cargar la planilla.</td></tr>';
    if (btnGuardar) btnGuardar.disabled = true;
    return;
  }

  tablaBody.innerHTML = '<tr><td colspan="10" class="px-4 py-8 text-center text-indigo-500 animate-pulse">Cargando planilla de calificaciones...</td></tr>';
  limpiarCambiosEvaluaciones();

  try {
    const snapEval = await getDocs(collection(db, getPath("evaluaciones")));
    const notasMap = {};
    snapEval.forEach(d => {
      const data = d.data();
      if (data.materia === curso) {
        notasMap[data.alumnoId] = data;
      }
    });

    _ultimaPlanillaCargadaNotasMap = notasMap;

    const snapEst = await getDocs(collection(db, getPath("estudiantes")));
    let alumnos = [];
    snapEst.forEach(d => {
      const data = { id: d.id, ...d.data() };
      const inscrip = data.inscripciones?.[curso] || [];
      const ultimoEstado = inscrip.length > 0 ? inscrip[inscrip.length - 1].estado : data.estado || 'ACTIVO';
      
      const esActivo = (data.curso === curso || data.materias?.includes(curso)) && ultimoEstado === 'ACTIVO';
      const tieneNotas = !!notasMap[data.id];

      if (esActivo || tieneNotas) {
        data.esHistorico = !esActivo && tieneNotas;
        alumnos.push(data);
      }
    });
    alumnos.sort((a, b) => a.apellido.localeCompare(b.apellido));

    if (alumnos.length === 0) {
      tablaBody.innerHTML = '<tr><td colspan="10" class="px-4 py-8 text-center text-amber-600 font-bold">No hay alumnos registrados en esta materia.</td></tr>';
      return;
    }

    const cols = configEstructuraEvaluaciones[periodo] || [{ key: 'nota', label: 'Calificación', type: 'principal' }];

    const headerRow = document.getElementById('evalHeaders');
    // Periodos donde se muestran las columnas de resumen (Final / Definitiva / Condición)
    const PERIODOS_CON_RESUMEN = ['b4', 'po_dic', 'po_feb'];
    const mostrarResumen = PERIODOS_CON_RESUMEN.includes(periodo);

    let headersHtml = `
      <tr class="bg-slate-800 text-white text-[11px] uppercase font-semibold">
        <th class="px-4 py-3 text-left w-48 sm:w-64 max-w-[250px] sticky left-0 z-20 bg-slate-900 border-r border-slate-700 shadow-[2px_0_5px_rgba(0,0,0,0.2)]">Estudiante</th>
`;
      cols.forEach(col => {
        headersHtml += `<th class="px-2 py-3 text-center min-w-[70px]">${escaparHTML(col.label)}</th>`;
      });
      if (mostrarResumen) {
        headersHtml += `
          <th class="px-3 py-3 text-center min-w-[90px] bg-slate-700/80">Calif. Final</th>
          <th class="px-3 py-3 text-center min-w-[110px] bg-slate-700/80">Calif. Definitiva</th>
          <th class="px-3 py-3 text-center min-w-[70px]">Condición</th>
        `;
      }
      headerRow.innerHTML = headersHtml;


    const esAdmin = window.app.currentUser?.rol === 'ADMIN';
    const isPeriodoHabilitado = esAdmin || (!planillaBloqueadaCurso && !!configHabilitacionEvaluaciones[periodo]);
    const disabledAttr = isPeriodoHabilitado ? '' : 'disabled';

    tablaBody.innerHTML = '';
    alumnos.forEach(al => {
      const notaData = notasMap[al.id] || {};
      
      const b1 = notaData.b1 ?? '';
      const b2 = notaData.b2 ?? '';
      const b3 = notaData.b3 ?? '';
      const b4 = notaData.b4 ?? '';
      const poDic = notaData.po_dic ?? '';
      const poFeb = notaData.po_feb ?? '';

      const res = calcularNotaFinalYCondicion(b1, b2, b3, b4, poDic, poFeb);

      const labelHistorico = al.esHistorico 
        ? `<span class="ml-1.5 text-[8px] bg-slate-100 text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded font-black tracking-wider dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800" title="Estudiante ya no pertenece a esta división, pero posee calificaciones previas">TRASLADO / BAJA</span>` 
        : '';

      const tr = document.createElement('tr');
      tr.className = `hover:bg-slate-50 dark:hover:bg-slate-700/30 border-b dark:border-slate-700 transition-colors text-slate-700 dark:text-slate-200 text-sm ${al.esHistorico ? 'opacity-70 italic' : ''}`;
      tr.dataset.alumnoId = al.id;

      let colsHtml = `
        <td class="px-4 py-3 font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 sticky left-0 z-10 border-r dark:border-slate-700 shadow-[2px_0_5px_rgba(0,0,0,0.05)] w-48 sm:w-64 max-w-[250px]">
          <div class="truncate" title="${escaparHTML(al.apellido)}, ${escaparHTML(al.nombre)}">
            ${escaparHTML(al.apellido)}, ${escaparHTML(al.nombre)}${labelHistorico}
          </div>
        </td>
      `;

      cols.forEach(col => {
        if (col.type === 'principal') {
          const val = notaData[periodo] ?? '';
          if (periodo === 'b1' || periodo === 'b3') {
            const isEP = val === 'EN PROCESO';
            const isS = val === 'SUFICIENTE';
            const isA = val === 'AVANZADO';
            
            const colorCls = isEP ? 'bg-orange-100 text-orange-800 border-orange-300' :
                             isS ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                             isA ? 'bg-indigo-100 text-indigo-800 border-indigo-300' : 
                             'bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700';

            colsHtml += `
              <td class="px-1 py-1.5 text-center border-b dark:border-slate-700/50 min-w-[80px]">
                <select ${disabledAttr} class="sel-${periodo.replace('_','-')} w-full max-w-[74px] mx-auto py-2 md:py-0.5 px-1 md:px-0.5 border rounded text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-500 transition-colors ${colorCls} disabled:opacity-75 disabled:cursor-not-allowed text-center"
                  onchange="app.registrarCambioEvaluacion('${al.id}', '${periodo}', this.value); this.className = this.className.replace(/bg-\\w+-100 text-\\w+-800 border-\\w+-300 bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700/g, ''); const v = this.value; if(v==='EN PROCESO') this.classList.add('bg-orange-100','text-orange-800','border-orange-300'); else if(v==='SUFICIENTE') this.classList.add('bg-emerald-100','text-emerald-800','border-emerald-300'); else if(v==='AVANZADO') this.classList.add('bg-indigo-100','text-indigo-800','border-indigo-300'); else this.classList.add('bg-slate-50','dark:bg-slate-900','border-slate-300','dark:border-slate-700');">
                  <option value="" ${val === '' ? 'selected' : ''}>-</option>
                  <option value="EN PROCESO" ${val === 'EN PROCESO' ? 'selected' : ''}>EP</option>
                  <option value="SUFICIENTE" ${val === 'SUFICIENTE' ? 'selected' : ''}>S</option>
                  <option value="AVANZADO" ${val === 'AVANZADO' ? 'selected' : ''}>A</option>
                </select>
              </td>
            `;
          } else {
            const isNum = val !== '' && !isNaN(val);
            const numVal = isNum ? parseFloat(val) : 0;
            const colorClsNum = !isNum ? 'bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700' :
                                numVal < 7 ? 'bg-red-50 text-red-700 border-red-200' :
                                'bg-blue-50 text-blue-700 border-blue-200';
                                
            colsHtml += `
              <td class="px-1 py-1.5 text-center border-b dark:border-slate-700/50 min-w-[60px]">
                <select ${disabledAttr} class="sel-${periodo.replace('_','-')} w-full max-w-[54px] mx-auto py-2 md:py-0.5 px-1 md:px-0.5 border rounded text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-500 transition-colors ${colorClsNum} disabled:opacity-75 disabled:cursor-not-allowed text-center"
                  onchange="app.registrarCambioEvaluacion('${al.id}', '${periodo}', this.value); this.className = this.className.replace(/bg-\\w+-50 text-\\w+-700 border-\\w+-200 bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700/g, ''); const v = this.value; if(v!==''){ const n = parseFloat(v); if(n<7) this.classList.add('bg-red-50','text-red-700','border-red-200'); else this.classList.add('bg-blue-50','text-blue-700','border-blue-200'); } else this.classList.add('bg-slate-50','dark:bg-slate-900','border-slate-300','dark:border-slate-700');">
                  ${_getOptionsNumericas(val)}
                </select>
              </td>
            `;
          }
        } else {
          const val = notaData[`adicionales_${periodo}_${col.key}`] ?? '';
          colsHtml += `
            <td class="px-1 py-1.5 text-center border-b dark:border-slate-700/50 min-w-[70px]">
              <input type="text" ${disabledAttr} class="w-full max-w-[80px] mx-auto p-0.5 border dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-900 text-xs text-center font-medium focus:ring-1 focus:ring-indigo-500"
                value="${escaparHTML(val)}" 
                onchange="app.registrarCambioAdicionalEvaluacion('${al.id}', '${periodo}', '${col.key}', this.value)" placeholder="Opcional">
            </td>
          `;
        }
      });

      // Columnas de resumen: Calif. Final, Definitiva y Condición
      // b4: siempre se muestran las tres (el alumno está cerrando el año)
      // po_dic / po_feb: solo si el alumno está pendiente (aún no aprobó)
      if (mostrarResumen) {
        const esPendientePO = periodo !== 'b4' &&
          (res.condicion === 'A PO DIC' || res.condicion === 'A PO FEB' ||
           res.condicion === 'DESAPROBADO' || res.condicion === 'APROBADO (PO DIC)' ||
           res.condicion === 'APROBADO (PO FEB)');
        const verColumnas = periodo === 'b4' || esPendientePO;

        if (verColumnas) {
          colsHtml += `
            <td class="px-3 py-3 text-center border-b dark:border-slate-700/50 bg-slate-100 dark:bg-slate-800/80 min-w-[70px]">
              <span class="font-bold text-slate-800 dark:text-slate-100">${res.final !== null ? res.final : '—'}</span>
            </td>
            <td class="px-3 py-3 text-center border-b dark:border-slate-700/50 bg-slate-100 dark:bg-slate-800/80 min-w-[70px]">
              <span class="font-black text-indigo-600 dark:text-indigo-400">${res.definitiva !== null ? res.definitiva : '—'}</span>
            </td>
            <td class="px-3 py-3 text-center border-b dark:border-slate-700/50 min-w-[70px]">
              <span class="text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${res.colorClass}">
                ${res.condicion}
              </span>
            </td>
          `;
        } else {
          // Alumno ya aprobado en periodo regular (b4 >=6) → no necesita PO
          colsHtml += `<td colspan="3" class="px-3 py-3 text-center border-b dark:border-slate-700/50 min-w-[70px]">
            <span class="text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${res.colorClass}">${res.condicion}</span>
          </td>`;
        }
      }

      tr.innerHTML = colsHtml;
      tablaBody.appendChild(tr);
    });

  } catch(e) {
    console.error(e);
    tablaBody.innerHTML = '<tr><td colspan="10" class="px-4 py-8 text-center text-red-500 font-bold">Error al procesar la planilla de calificaciones.</td></tr>';
  }
}

// ==========================================
// GUARDAR CAMBIOS MASIVOS
// ==========================================

export async function guardarCambiosEvaluaciones() {
  const curso = document.getElementById('evalCurso').value;
  const btn   = document.getElementById('btnGuardarEvaluaciones');
  const uids  = Object.keys(cambiosPendientesEvaluaciones);

  if (!curso || uids.length === 0) return;

  btn.disabled = true;
  const origHtml = btn.innerHTML;
  btn.innerHTML = '<i class="ph ph-spinner animate-spin text-lg"></i> Guardando Calificaciones...';

  try {
    const batch = writeBatch(db);

    uids.forEach(uid => {
      const docId = `${uid}_${curso.replace(/\s+/g, '')}`;
      const docRef = doc(db, getPath('evaluaciones'), docId);
      
      const p = cambiosPendientesEvaluaciones[uid];
      const payload = {
        alumnoId: uid,
        materia: curso,
        timestamp: new Date().toISOString()
      };

      if (p.b1 !== undefined) payload.b1 = p.b1;
      if (p.b2 !== undefined) payload.b2 = p.b2;
      if (p.b3 !== undefined) payload.b3 = p.b3;
      if (p.b4 !== undefined) payload.b4 = p.b4;
      if (p.po_dic !== undefined) payload.po_dic = p.po_dic;
      if (p.po_feb !== undefined) payload.po_feb = p.po_feb;

      if (p.adicionales) {
        Object.keys(p.adicionales).forEach(periodoKey => {
          Object.keys(p.adicionales[periodoKey]).forEach(fieldKey => {
            payload[`adicionales_${periodoKey}_${fieldKey}`] = p.adicionales[periodoKey][fieldKey];
          });
        });
      }

      batch.set(docRef, payload, { merge: true });
    });

    await batch.commit();
    showToast(`✅ Se guardaron las calificaciones de ${uids.length} estudiantes.`);
    limpiarCambiosEvaluaciones();
    await cargarPlanillaEvaluaciones();

  } catch(e) {
    console.error(e);
    showToast('❌ Error al guardar calificaciones en Firebase.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = origHtml;
  }
}
