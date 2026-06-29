// js/evaluaciones.js — Módulo de Calificaciones: Gestión de notas de bimestres y períodos de orientación (PO)

import { doc, setDoc, getDoc, collection, getDocs, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db, getPath } from "./firebase-config.js?v=9.11";
import { showToast } from "./ui.js?v=9.11";
import { escaparHTML } from "./utils.js?v=9.11";

// Estado de cambios pendientes locales: { "alumnoId": { b1, b2, b3, b4, po_dic, po_feb } }
export let cambiosPendientesEvaluaciones = {};

// Configuración global de columnas habilitadas (Admin): { b1: true, b2: true, ... }
export let configHabilitacionEvaluaciones = { b1: true, b2: true, b3: true, b4: true, po_dic: true, po_feb: true };

// Estado de bloqueo de la planilla para el curso actual: true / false
export let planillaBloqueadaCurso = false;

// Limpia el estado de cambios locales
export function limpiarCambiosEvaluaciones() {
  cambiosPendientesEvaluaciones = {};
  const btn = document.getElementById('btnGuardarEvaluaciones');
  if (btn) btn.disabled = true;
}

// ==========================================
// CONFIGURACIÓN Y BLOQUEOS (FIRESTORE)
// ==========================================

// Carga la configuración de columnas habilitadas desde Firestore
export async function cargarConfiguracionHabilitacion() {
  try {
    const docRef = doc(db, getPath('config'), 'evaluaciones');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      configHabilitacionEvaluaciones = { ...configHabilitacionEvaluaciones, ...docSnap.data().habilitados };
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

function _renderizarControlesAdmin() {
  const esAdmin = window.app.currentUser?.rol === 'ADMIN';
  const panel = document.getElementById('panelAdminConfigEval');
  if (!panel) return;

  if (esAdmin) {
    panel.classList.remove('hidden');
    // Sincronizar checkboxes
    const c1 = document.getElementById('cfgB1'); if (c1) c1.checked = !!configHabilitacionEvaluaciones.b1;
    const c2 = document.getElementById('cfgB2'); if (c2) c2.checked = !!configHabilitacionEvaluaciones.b2;
    const c3 = document.getElementById('cfgB3'); if (c3) c3.checked = !!configHabilitacionEvaluaciones.b3;
    const c4 = document.getElementById('cfgB4'); if (c4) c4.checked = !!configHabilitacionEvaluaciones.b4;
    const cD = document.getElementById('cfgPoDic'); if (cD) cD.checked = !!configHabilitacionEvaluaciones.po_dic;
    const cF = document.getElementById('cfgPoFeb'); if (cF) cF.checked = !!configHabilitacionEvaluaciones.po_feb;
  } else {
    panel.classList.add('hidden');
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

// ==========================================
// REGISTRO DE CAMBIOS Y RENDERIZADO
// ==========================================

export function registrarCambioEvaluacion(alumnoId, campo, valor) {
  // Asegurar registro local del alumno
  if (!cambiosPendientesEvaluaciones[alumnoId]) {
    const tr = document.querySelector(`tr[data-alumno-id="${alumnoId}"]`);
    if (tr) {
      cambiosPendientesEvaluaciones[alumnoId] = {
        b1: tr.querySelector('.sel-b1')?.value || '',
        b2: tr.querySelector('.sel-b2')?.value || '',
        b3: tr.querySelector('.sel-b3')?.value || '',
        b4: tr.querySelector('.sel-b4')?.value || '',
        po_dic: tr.querySelector('.sel-po-dic')?.value || '',
        po_feb: tr.querySelector('.sel-po-feb')?.value || '',
      };
    } else {
      cambiosPendientesEvaluaciones[alumnoId] = { b1:'', b2:'', b3:'', b4:'', po_dic:'', po_feb:'' };
    }
  }

  const valTrim = valor.trim();

  // Guardar el cambio localmente
  cambiosPendientesEvaluaciones[alumnoId][campo] = valTrim;

  // Habilitar botón de guardado
  const btn = document.getElementById('btnGuardarEvaluaciones');
  if (btn) btn.disabled = false;

  // Recalcular en tiempo real en la fila del DOM
  const tr = document.querySelector(`tr[data-alumno-id="${alumnoId}"]`);
  if (tr) {
    const b1Val = cambiosPendientesEvaluaciones[alumnoId].b1;
    const b2Val = cambiosPendientesEvaluaciones[alumnoId].b2;
    const b3Val = cambiosPendientesEvaluaciones[alumnoId].b3;
    const b4Val = cambiosPendientesEvaluaciones[alumnoId].b4;
    const poDicVal = cambiosPendientesEvaluaciones[alumnoId].po_dic;
    const poFebVal = cambiosPendientesEvaluaciones[alumnoId].po_feb;

    const res = calcularNotaFinalYCondicion(b1Val, b2Val, b3Val, b4Val, poDicVal, poFebVal);

    // Actualizar celdas del promedio, calificación final y calificación definitiva
    tr.querySelector('.cell-promedio').innerText = res.promedio !== null ? res.promedio : '—';
    tr.querySelector('.cell-final').innerText = res.final !== null ? res.final : '—';
    tr.querySelector('.cell-definitiva').innerText = res.definitiva !== null ? res.definitiva : '—';
    
    const condBadge = tr.querySelector('.badge-condicion');
    condBadge.innerText = res.condicion;
    condBadge.className = `badge-condicion text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${res.colorClass}`;

    // Marcar el elemento modificado visualmente
    const select = tr.querySelector(`.sel-${campo.replace('_', '-')}`);
    if (select) select.classList.add('bg-orange-50', 'dark:bg-orange-950/20', 'border-orange-300');
  }
}

// Helper para generar opciones del 10 al 1 en el select (orden descendente)
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
  const tablaBody = document.getElementById('evalBody');
  const btnGuardar = document.getElementById('btnGuardarEvaluaciones');

  // Sincronizar botones de bloqueo y config de Admin
  await cargarBloqueoCurso(curso);
  _renderizarControlesAdmin();

  if (!curso) {
    tablaBody.innerHTML = '<tr><td colspan="10" class="px-4 py-8 text-center text-slate-400">Seleccione un curso del menú superior.</td></tr>';
    if (btnGuardar) btnGuardar.disabled = true;
    return;
  }

  tablaBody.innerHTML = '<tr><td colspan="10" class="px-4 py-8 text-center text-indigo-500 animate-pulse">Cargando planilla de calificaciones...</td></tr>';
  limpiarCambiosEvaluaciones();

  try {
    // 1. Obtener calificaciones registradas en Firestore
    const snapEval = await getDocs(collection(db, getPath("evaluaciones")));
    const notasMap = {}; // { "alumnoId": { b1, b2, b3, b4, po_dic, po_feb } }
    snapEval.forEach(d => {
      const data = d.data();
      if (data.materia === curso) {
        notasMap[data.alumnoId] = data;
      }
    });

    // 2. Obtener estudiantes del curso (activos o históricos con notas registradas)
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

    const esAdmin = window.app.currentUser?.rol === 'ADMIN';

    // 3. Renderizar filas
    tablaBody.innerHTML = '';
    alumnos.forEach(al => {
      const notaData = notasMap[al.id] || { b1:'', b2:'', b3:'', b4:'', po_dic:'', po_feb:'' };
      const b1 = notaData.b1 ?? '';
      const b2 = notaData.b2 ?? '';
      const b3 = notaData.b3 ?? '';
      const b4 = notaData.b4 ?? '';
      const poDic = notaData.po_dic ?? '';
      const poFeb = notaData.po_feb ?? '';

      const res = calcularNotaFinalYCondicion(b1, b2, b3, b4, poDic, poFeb);

      // Determinar atributos disabled según configuración de habilitación y estado de bloqueo
      const isPeriodoHabilitado = (periodoKey) => {
        if (esAdmin) return true; // Admin puede editar siempre
        if (planillaBloqueadaCurso) return false; // Bloqueo general del curso
        return !!configHabilitacionEvaluaciones[periodoKey]; // Habilitación global de fechas
      };

      const disB1 = isPeriodoHabilitado('b1') ? '' : 'disabled';
      const disB2 = isPeriodoHabilitado('b2') ? '' : 'disabled';
      const disB3 = isPeriodoHabilitado('b3') ? '' : 'disabled';
      const disB4 = isPeriodoHabilitado('b4') ? '' : 'disabled';
      const disPoDic = isPeriodoHabilitado('po_dic') ? '' : 'disabled';
      const disPoFeb = isPeriodoHabilitado('po_feb') ? '' : 'disabled';

      const labelHistorico = al.esHistorico 
        ? `<span class="ml-1.5 text-[8px] bg-slate-100 text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded font-black tracking-wider dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800" title="Estudiante ya no pertenece a esta división, pero posee calificaciones previas">TRASLADO / BAJA</span>` 
        : '';

      const tr = document.createElement('tr');
      tr.className = `hover:bg-slate-100 dark:hover:bg-slate-700/30 border-b dark:border-slate-700 transition-colors text-slate-700 dark:text-slate-200 ${al.esHistorico ? 'opacity-70 italic' : ''}`;
      tr.dataset.alumnoId = al.id;
      tr.innerHTML = `
        <td class="px-4 py-3 font-bold text-slate-800 dark:text-slate-100 sticky-student-col bg-white dark:bg-slate-800 border-r dark:border-slate-700 w-64 truncate">
          ${escaparHTML(al.apellido)}, ${escaparHTML(al.nombre)}${labelHistorico}
        </td>
        <!-- 1er Bim (Valorativo) -->
        <td class="px-2 py-2 text-center">
          <select ${disB1} class="sel-b1 w-20 p-1 border dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-900 text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-75 disabled:cursor-not-allowed" 
            onchange="app.registrarCambioEvaluacion('${al.id}', 'b1', this.value)">
            <option value="" ${b1 === '' ? 'selected' : ''}>-</option>
            <option value="EN PROCESO" ${b1 === 'EN PROCESO' ? 'selected' : ''}>EP</option>
            <option value="SUFICIENTE" ${b1 === 'SUFICIENTE' ? 'selected' : ''}>S</option>
            <option value="AVANZADO" ${b1 === 'AVANZADO' ? 'selected' : ''}>A</option>
          </select>
        </td>
        <!-- 2do Bim (Numérico) -->
        <td class="px-2 py-2 text-center">
          <select ${disB2} class="sel-b2 w-14 p-1 border dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-900 text-xs font-semibold outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-75 disabled:cursor-not-allowed" 
            onchange="app.registrarCambioEvaluacion('${al.id}', 'b2', this.value)">
            ${_getOptionsNumericas(b2)}
          </select>
        </td>
        <!-- 3er Bim (Valorativo) -->
        <td class="px-2 py-2 text-center">
          <select ${disB3} class="sel-b3 w-20 p-1 border dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-900 text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-75 disabled:cursor-not-allowed" 
            onchange="app.registrarCambioEvaluacion('${al.id}', 'b3', this.value)">
            <option value="" ${b3 === '' ? 'selected' : ''}>-</option>
            <option value="EN PROCESO" ${b3 === 'EN PROCESO' ? 'selected' : ''}>EP</option>
            <option value="SUFICIENTE" ${b3 === 'SUFICIENTE' ? 'selected' : ''}>S</option>
            <option value="AVANZADO" ${b3 === 'AVANZADO' ? 'selected' : ''}>A</option>
          </select>
        </td>
        <!-- 4to Bim (Numérico) -->
        <td class="px-2 py-2 text-center">
          <select ${disB4} class="sel-b4 w-14 p-1 border dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-900 text-xs font-semibold outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-75 disabled:cursor-not-allowed" 
            onchange="app.registrarCambioEvaluacion('${al.id}', 'b4', this.value)">
            ${_getOptionsNumericas(b4)}
          </select>
        </td>
        <!-- Calificación Final (B4) -->
        <td class="px-3 py-3 text-center font-bold text-slate-800 dark:text-slate-100 bg-slate-50/50 dark:bg-slate-900/30 cell-final">
          ${res.final !== null ? res.final : '—'}
        </td>
        <!-- PO Diciembre (Numérico) -->
        <td class="px-2 py-2 text-center border-l dark:border-slate-700">
          <select ${disPoDic} class="sel-po-dic w-14 p-1 border dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-900 text-xs font-semibold outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-75 disabled:cursor-not-allowed" 
            onchange="app.registrarCambioEvaluacion('${al.id}', 'po_dic', this.value)">
            ${_getOptionsNumericas(poDic)}
          </select>
        </td>
        <!-- PO Febrero (Numérico) -->
        <td class="px-2 py-2 text-center">
          <select ${disPoFeb} class="sel-po-feb w-14 p-1 border dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-900 text-xs font-semibold outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-75 disabled:cursor-not-allowed" 
            onchange="app.registrarCambioEvaluacion('${al.id}', 'po_feb', this.value)">
            ${_getOptionsNumericas(poFeb)}
          </select>
        </td>
        <!-- Calificación Definitiva -->
        <td class="px-3 py-3 text-center font-black text-indigo-600 dark:text-indigo-400 bg-slate-50/50 dark:bg-slate-900/30 cell-definitiva">
          ${res.definitiva !== null ? res.definitiva : '—'}
        </td>
        <!-- Condición -->
        <td class="px-3 py-3 text-center">
          <span class="badge-condicion text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${res.colorClass}">
            ${res.condicion}
          </span>
        </td>
      `;
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
      batch.set(docRef, {
        alumnoId: uid,
        materia: curso,
        b1: p.b1,
        b2: p.b2,
        b3: p.b3,
        b4: p.b4,
        po_dic: p.po_dic,
        po_feb: p.po_feb,
        timestamp: new Date().toISOString()
      }, { merge: true });
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
