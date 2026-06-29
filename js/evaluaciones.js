// js/evaluaciones.js — Módulo de Calificaciones: Gestión de notas de bimestres y períodos de orientación (PO)

import { doc, setDoc, collection, getDocs, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db, getPath } from "./firebase-config.js?v=9.5";
import { showToast } from "./ui.js?v=9.5";
import { escaparHTML } from "./utils.js?v=9.5";

// Cambios pendientes locales antes de guardar en Firestore: { "alumnoId": { b1, b2, b3, b4, po_dic, po_feb } }
export let cambiosPendientesEvaluaciones = {};

// Limpia el estado de cambios locales
export function limpiarCambiosEvaluaciones() {
  cambiosPendientesEvaluaciones = {};
  const btn = document.getElementById('btnGuardarEvaluaciones');
  if (btn) btn.disabled = true;
}

// ==========================================
// CÁLCULO EN TIEMPO REAL
// ==========================================

export function calcularNotaFinalYCondicion(b1, b2, b3, b4, poDic, poFeb) {
  // Convertir a float o null
  const parseVal = (val) => {
    if (val === undefined || val === null || val === '') return null;
    const n = parseFloat(val);
    return isNaN(n) ? null : n;
  };

  const n1 = parseVal(b1);
  const n2 = parseVal(b2);
  const n3 = parseVal(b3);
  const n4 = parseVal(b4);
  const pDic = parseVal(poDic);
  const pFeb = parseVal(poFeb);

  // Verificar si hay bimestres cargados
  const notasCargadas = [n1, n2, n3, n4].filter(n => n !== null);
  
  if (notasCargadas.length === 0) {
    return { promedio: null, final: null, condicion: 'CURSANDO', colorClass: 'bg-slate-100 text-slate-700 dark:bg-slate-900/50 dark:text-slate-400' };
  }

  // Calcular promedio de bimestres cargados
  const promedio = notasCargadas.reduce((a, b) => a + b, 0) / notasCargadas.length;

  // Si no se han cargado los 4 bimestres, aún está cursando
  if (notasCargadas.length < 4) {
    return { 
      promedio: promedio.toFixed(2), 
      final: null, 
      condicion: 'CURSANDO', 
      colorClass: 'bg-slate-100 text-slate-700 dark:bg-slate-900/50 dark:text-slate-400' 
    };
  }

  // 4 bimestres completos: evaluar condición
  if (promedio >= 7.0) {
    return { 
      promedio: promedio.toFixed(2), 
      final: Math.round(promedio), 
      condicion: 'APROBADO', 
      colorClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold' 
    };
  }

  // Promedio < 7: requiere Período de Orientación Diciembre (PO DIC)
  if (pDic === null) {
    return { 
      promedio: promedio.toFixed(2), 
      final: null, 
      condicion: 'A PO DIC', 
      colorClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-bold' 
    };
  }

  if (pDic >= 7.0) {
    return { 
      promedio: promedio.toFixed(2), 
      final: pDic, 
      condicion: 'APROBADO (PO DIC)', 
      colorClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-medium' 
    };
  }

  // Falló PO DIC: requiere Período de Orientación Febrero (PO FEB)
  if (pFeb === null) {
    return { 
      promedio: promedio.toFixed(2), 
      final: null, 
      condicion: 'A PO FEB', 
      colorClass: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 font-bold animate-pulse' 
    };
  }

  if (pFeb >= 7.0) {
    return { 
      promedio: promedio.toFixed(2), 
      final: pFeb, 
      condicion: 'APROBADO (PO FEB)', 
      colorClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-medium' 
    };
  }

  // Falló PO FEB: Desaprobado (Previa)
  return { 
    promedio: promedio.toFixed(2), 
    final: pFeb, 
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
    // Leer valores originales cargados en el DOM para ese alumno
    const tr = document.querySelector(`tr[data-alumno-id="${alumnoId}"]`);
    if (tr) {
      cambiosPendientesEvaluaciones[alumnoId] = {
        b1: tr.querySelector('.input-b1').value,
        b2: tr.querySelector('.input-b2').value,
        b3: tr.querySelector('.input-b3').value,
        b4: tr.querySelector('.input-b4').value,
        po_dic: tr.querySelector('.input-po-dic').value,
        po_feb: tr.querySelector('.input-po-feb').value,
      };
    } else {
      cambiosPendientesEvaluaciones[alumnoId] = { b1:'', b2:'', b3:'', b4:'', po_dic:'', po_feb:'' };
    }
  }

  // Validar nota (rango 1 a 10, o vacía)
  const valTrim = valor.trim();
  if (valTrim !== '') {
    const num = parseFloat(valTrim);
    if (isNaN(num) || num < 1 || num > 10) {
      showToast('⚠️ Las calificaciones deben ser números entre 1 y 10.', 'error');
      // Reestablecer valor en el input
      const tr = document.querySelector(`tr[data-alumno-id="${alumnoId}"]`);
      if (tr) {
        tr.querySelector(`.input-${campo.replace('_', '-')}`).value = cambiosPendientesEvaluaciones[alumnoId][campo] || '';
      }
      return;
    }
  }

  // Guardar cambio
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

    // Actualizar celdas del DOM
    tr.querySelector('.cell-promedio').innerText = res.promedio !== null ? res.promedio : '—';
    tr.querySelector('.cell-final').innerText = res.final !== null ? res.final : '—';
    
    const condBadge = tr.querySelector('.badge-condicion');
    condBadge.innerText = res.condicion;
    condBadge.className = `badge-condicion text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${res.colorClass}`;

    // Marcar input editado visualmente
    const input = tr.querySelector(`.input-${campo.replace('_', '-')}`);
    if (input) input.classList.add('bg-orange-50', 'dark:bg-orange-950/20', 'border-orange-300');
  }
}

// ==========================================
// CARGAR PLANILLA
// ==========================================

export async function cargarPlanillaEvaluaciones() {
  const curso     = document.getElementById('evalCurso').value;
  const tablaBody = document.getElementById('evalBody');
  const btnGuardar = document.getElementById('btnGuardarEvaluaciones');

  if (!curso) {
    tablaBody.innerHTML = '<tr><td colspan="10" class="px-4 py-8 text-center text-slate-400">Seleccione un curso del menú superior.</td></tr>';
    if (btnGuardar) btnGuardar.disabled = true;
    return;
  }

  tablaBody.innerHTML = '<tr><td colspan="10" class="px-4 py-8 text-center text-indigo-500 animate-pulse">Cargando planilla de calificaciones...</td></tr>';
  limpiarCambiosEvaluaciones();

  try {
    // 1. Obtener estudiantes del curso
    const snapEst = await getDocs(collection(db, getPath("estudiantes")));
    let alumnos = [];
    snapEst.forEach(d => {
      const data = { id: d.id, ...d.data() };
      const inscrip = data.inscripciones?.[curso] || [];
      const ultimoEstado = inscrip.length > 0 ? inscrip[inscrip.length - 1].estado : data.estado || 'ACTIVO';
      if ((data.curso === curso || data.materias?.includes(curso)) && ultimoEstado === 'ACTIVO') {
        alumnos.push(data);
      }
    });
    alumnos.sort((a, b) => a.apellido.localeCompare(b.apellido));

    if (alumnos.length === 0) {
      tablaBody.innerHTML = '<tr><td colspan="10" class="px-4 py-8 text-center text-amber-600 font-bold">No hay alumnos activos en esta materia.</td></tr>';
      return;
    }

    // 2. Obtener calificaciones registradas en Firestore
    const snapEval = await getDocs(collection(db, getPath("evaluaciones")));
    const notasMap = {}; // { "alumnoId": { b1, b2, b3, b4, po_dic, po_feb } }
    snapEval.forEach(d => {
      const data = d.data();
      if (data.materia === curso) {
        notasMap[data.alumnoId] = data;
      }
    });

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

      const tr = document.createElement('tr');
      tr.className = "hover:bg-slate-100 dark:hover:bg-slate-700/30 border-b dark:border-slate-700 transition-colors text-slate-700 dark:text-slate-200";
      tr.dataset.alumnoId = al.id;
      tr.innerHTML = `
        <td class="px-4 py-3 font-bold text-slate-800 dark:text-slate-100 sticky-student-col bg-white dark:bg-slate-800 border-r dark:border-slate-700 w-64 truncate">
          ${escaparHTML(al.apellido)}, ${escaparHTML(al.nombre)}
        </td>
        <td class="px-2 py-2 text-center">
          <input type="text" class="input-b1 w-12 text-center p-1 border dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-900 text-sm font-semibold outline-none focus:ring-1 focus:ring-indigo-500" 
            value="${b1}" onchange="app.registrarCambioEvaluacion('${al.id}', 'b1', this.value)">
        </td>
        <td class="px-2 py-2 text-center">
          <input type="text" class="input-b2 w-12 text-center p-1 border dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-900 text-sm font-semibold outline-none focus:ring-1 focus:ring-indigo-500" 
            value="${b2}" onchange="app.registrarCambioEvaluacion('${al.id}', 'b2', this.value)">
        </td>
        <td class="px-2 py-2 text-center">
          <input type="text" class="input-b3 w-12 text-center p-1 border dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-900 text-sm font-semibold outline-none focus:ring-1 focus:ring-indigo-500" 
            value="${b3}" onchange="app.registrarCambioEvaluacion('${al.id}', 'b3', this.value)">
        </td>
        <td class="px-2 py-2 text-center">
          <input type="text" class="input-b4 w-12 text-center p-1 border dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-900 text-sm font-semibold outline-none focus:ring-1 focus:ring-indigo-500" 
            value="${b4}" onchange="app.registrarCambioEvaluacion('${al.id}', 'b4', this.value)">
        </td>
        <td class="px-3 py-3 text-center font-bold text-slate-800 dark:text-slate-100 bg-slate-50/50 dark:bg-slate-900/30 cell-promedio">
          ${res.promedio !== null ? res.promedio : '—'}
        </td>
        <td class="px-2 py-2 text-center border-l dark:border-slate-700">
          <input type="text" class="input-po-dic w-12 text-center p-1 border dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-900 text-sm font-semibold outline-none focus:ring-1 focus:ring-indigo-500" 
            value="${poDic}" onchange="app.registrarCambioEvaluacion('${al.id}', 'po_dic', this.value)">
        </td>
        <td class="px-2 py-2 text-center">
          <input type="text" class="input-po-feb w-12 text-center p-1 border dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-900 text-sm font-semibold outline-none focus:ring-1 focus:ring-indigo-500" 
            value="${poFeb}" onchange="app.registrarCambioEvaluacion('${al.id}', 'po_feb', this.value)">
        </td>
        <td class="px-3 py-3 text-center font-black text-indigo-600 dark:text-indigo-400 bg-slate-50/50 dark:bg-slate-900/30 cell-final">
          ${res.final !== null ? res.final : '—'}
        </td>
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
