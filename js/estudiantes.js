// js/estudiantes.js — Matrícula, modal de alumnos, horarios y fusión de duplicados

import { doc, setDoc, collection, getDocs, query, where, orderBy, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db, getPath } from "./firebase-config.js?v=9.1";
import { showToast } from "./ui.js?v=9.1";
import { HORARIOS_DINAMICOS } from "./materias.js?v=9.1";
import { normalizeDateToISO, formatISOToDisplay, escaparHTML } from "./utils.js?v=9.1";

let fusionState = { primario: null, secundario: null, todosAlumnos: [] };

// ==========================================
// MATRÍCULA — LISTADO
// ==========================================

export async function cargarAlumnosMatricula() {
  const curso   = document.getElementById('mCurso').value;
  const tabla   = document.getElementById('tablaMatricula');
  const esTodos = curso === '__TODOS__';

  if (!curso) {
    tabla.innerHTML = '<tr><td colspan="5" class="px-4 py-8 text-center text-slate-400">Seleccione un curso del menú superior.</td></tr>';
    return;
  }
  tabla.innerHTML = '<tr><td colspan="5" class="px-4 py-8 text-center text-indigo-500 animate-pulse">Sincronizando matrícula...</td></tr>';

  try {
    const snap = await getDocs(collection(db, getPath("estudiantes")));
    let todos = [];
    snap.forEach(d => todos.push({ id: d.id, ...d.data() }));

    window.app.alumnosMatriculaCache = esTodos
      ? todos.sort((a, b) => a.apellido.localeCompare(b.apellido))
      : todos.filter(a => a.curso === curso || (a.materias && a.materias.includes(curso)))
             .sort((a, b) => a.apellido.localeCompare(b.apellido));

    if (window.app.alumnosMatriculaCache.length === 0) {
      tabla.innerHTML = '<tr><td colspan="5" class="px-4 py-8 text-center text-amber-600">No hay ningún alumno matriculado en este espacio.</td></tr>';
      return;
    }

    tabla.innerHTML = '';
    window.app.alumnosMatriculaCache.forEach(est => {
      const apodoStr = est.apodo ? ` (${escaparHTML(est.apodo)})` : "";
      const notasStr = est.notas ? `<p class="text-xs text-amber-600 italic">📌 ${escaparHTML(est.notas)}</p>` : "";
      const materiasAMostrar = esTodos
        ? (est.materias || [est.curso])
        : (est.materias || [est.curso]).filter(m => m === curso);

      const materiasHtml = materiasAMostrar.map(m => {
        let grupoEnMateria = 'GENERAL', estadoEnMateria = 'ACTIVO', desde = '', hasta = '';
        if (est.inscripciones && est.inscripciones[m] && est.inscripciones[m].length > 0) {
          const insc = est.inscripciones[m][est.inscripciones[m].length - 1];
          grupoEnMateria = insc.grupo || 'GENERAL';
          estadoEnMateria = insc.estado || 'ACTIVO';
          desde = insc.desde || ''; hasta = insc.hasta || '';
        } else {
          grupoEnMateria = (est.grupos && est.grupos[m]) || est.grupo || 'GENERAL';
          estadoEnMateria = est.estado || 'ACTIVO';
          desde = est.fechaIngreso || ''; hasta = est.fechaBaja || '';
        }
        const isActivo    = estadoEnMateria === 'ACTIVO';
        const estadoColor = isActivo ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300 font-bold';
        const bgClass     = isActivo ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-100 border-gray-300 opacity-80';
        return `
          <div class="flex flex-col border dark:border-slate-700 rounded-md px-2 py-1.5 ${bgClass} text-[10px] leading-tight min-w-[140px] mb-1">
            <div class="flex justify-between items-center mb-0.5">
              <span class="font-bold text-slate-800 dark:text-slate-100 tracking-wide text-xs">${m}</span>
              <span class="text-[9px] px-1 py-0.5 rounded bg-white dark:bg-slate-800 border dark:border-slate-700 ${estadoColor}">${estadoEnMateria}</span>
            </div>
            <div class="flex items-center gap-1 mt-0.5">
              ${grupoEnMateria !== 'GENERAL' ? `<span class="bg-amber-100 text-amber-800 px-1 rounded font-bold">${grupoEnMateria}</span>` : '<span class="text-slate-500 dark:text-slate-400">GENERAL</span>'}
            </div>
            <div class="mt-1 flex flex-col gap-0.5 text-[9px] text-slate-500 dark:text-slate-400">
              ${desde ? `<span>Ingreso: ${formatISOToDisplay(desde)}</span>` : ''}
              ${hasta ? `<span class="text-red-600 font-medium">Baja: ${formatISOToDisplay(hasta)}</span>` : ''}
            </div>
          </div>`;
      }).join('');

      const tr = document.createElement('tr');
      tr.className = "hover:bg-slate-100 dark:hover:bg-slate-700/50 border-b transition-colors text-slate-700 dark:text-slate-200";
      tr.innerHTML = `
        <td class="px-4 py-3 align-top">
          <p class="font-bold text-slate-800 dark:text-slate-100">${escaparHTML(est.apellido)}, ${escaparHTML(est.nombre)}<span class="text-blue-600">${apodoStr}</span>${est.dni ? `<span class="ml-2 text-[10px] font-mono text-slate-400">${escaparHTML(est.dni)}</span>` : ''}</p>
          ${notasStr}
        </td>
        <td class="px-4 py-3"><div class="flex flex-wrap gap-2">${materiasHtml}</div></td>
        <td class="px-4 py-3 text-right align-top">
          <button onclick='app.abrirModalAlumnoConId("${est.id}")' class="bg-slate-100 dark:bg-slate-900 border dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold py-1 px-3 rounded hover:bg-slate-800 hover:text-white transition text-xs mt-1">
            <i class="ph ph-note-pencil"></i> Editar
          </button>
        </td>
      `;
      tabla.appendChild(tr);
    });
  } catch (error) {
    console.error(error);
    showToast('❌ Error al consultar matrícula.', 'error');
  }
}

export function abrirModalAlumnoConId(id) {
  const alumno = window.app.alumnosMatriculaCache.find(a => a.id === id);
  abrirModalAlumno(alumno);
}

// ==========================================
// MODAL DE ALUMNO
// ==========================================

export function toggleInscripcionDetails(checkbox) {
  const row = checkbox.closest('.group-materia-row');
  if (!row) return;
  const details = row.querySelector('.sel-inscripcion-details');
  if (!details) return;
  if (checkbox.checked) {
    details.classList.remove('hidden');
    const selDesde = row.querySelector('.sel-desde-materia');
    if (selDesde && !selDesde.value) selDesde.valueAsDate = new Date();
  } else {
    details.classList.add('hidden');
  }
  // Sincronizar el checkbox maestro de la división
  _sincronizarMaestra(checkbox.closest('.division-block'));
}

// Checkbox maestro: marca/desmarca todas las materias de su bloque
export function toggleDivisionMaestra(masterCb) {
  const block = masterCb.closest('.division-block');
  if (!block) return;
  block.querySelectorAll('.cb-materia').forEach(cb => {
    if (cb.checked !== masterCb.checked) {
      cb.checked = masterCb.checked;
      toggleInscripcionDetails(cb);
    }
  });
  // El maestro ya está en el estado correcto; asegurar que indeterminate = false
  masterCb.indeterminate = false;
}

// Extrae división y materia base de un nombre como "1ro A - Matemática"
function _descomponerMat(nombre) {
  const idx = nombre.indexOf(' - ');
  return idx !== -1
    ? { div: nombre.substring(0, idx), base: nombre.substring(idx + 3) }
    : { div: '', base: nombre };
}

// HTML reutilizable para los detalles de inscripción
function _htmlDetallesInscripcion(mat) {
  return `
    <div class="sel-inscripcion-details hidden flex flex-col sm:flex-row flex-wrap gap-2 items-end bg-indigo-50/50 p-2 rounded border dark:border-slate-700 border-indigo-100" data-mat="${mat}">
      <div class="flex-1 min-w-[110px]">
        <label class="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-0.5">GRUPO</label>
        <select class="sel-grupo-materia w-full text-xs border dark:border-slate-700 rounded px-1.5 py-1.5 bg-white dark:bg-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 font-semibold">
          <option value="GENERAL">GENERAL</option>
          <option value="ARTES VISUALES">ARTES VISUALES</option>
          <option value="TEATRO">TEATRO</option>
          <option value="MUSICA">MÚSICA</option>
          <option value="DANZA">DANZA</option>
        </select>
      </div>
      <div class="flex-1 min-w-[110px]">
        <label class="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-0.5">ESTADO EN DIVISIÓN</label>
        <select class="sel-estado-materia w-full text-xs border dark:border-slate-700 rounded px-1.5 py-1.5 bg-white dark:bg-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 font-semibold text-indigo-700">
          <option value="ACTIVO">ACTIVO</option>
          <option value="CAMBIO DE DIVISIÓN">CAMBIO DE DIVISIÓN</option>
          <option value="CAMBIO DE TURNO">CAMBIO DE TURNO</option>
          <option value="PASE">PASE</option>
          <option value="BAJA">BAJA</option>
        </select>
      </div>
      <div class="flex-1 min-w-[110px]">
        <label class="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-0.5">FECHA INGRESO</label>
        <input type="date" class="sel-desde-materia w-full text-xs border dark:border-slate-700 rounded px-1.5 py-1.5 bg-white dark:bg-slate-800 outline-none focus:ring-1 focus:ring-indigo-500">
      </div>
      <div class="flex-1 min-w-[110px]">
        <label class="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-0.5">FECHA EGRESO/BAJA</label>
        <input type="date" class="sel-hasta-materia w-full text-xs border dark:border-slate-700 rounded px-1.5 py-1.5 bg-white dark:bg-slate-800 outline-none focus:ring-1 focus:ring-indigo-500">
      </div>
    </div>`;
}

// Sincroniza el checkbox maestro de una división según el estado de sus hijos
function _sincronizarMaestra(divisionBlock) {
  if (!divisionBlock) return;
  const maestra   = divisionBlock.querySelector('.cb-division-maestro');
  if (!maestra) return;
  const hijos     = [...divisionBlock.querySelectorAll('.cb-materia')];
  const checkedN  = hijos.filter(cb => cb.checked).length;
  maestra.checked       = checkedN === hijos.length && hijos.length > 0;
  maestra.indeterminate = checkedN > 0 && checkedN < hijos.length;
}

export function abrirModalAlumno(alumno = null) {
  const curso = document.getElementById('mCurso').value;
  if (!curso && !alumno) { showToast('⚠️ Seleccione la división primero.', 'error'); return; }

  const modal = document.getElementById('modalAlumno');
  const title = document.getElementById('modalTitle');
  ['formId','formApellido','formNombre','formApodo','formDni','formNotas'].forEach(id => {
    document.getElementById(id).value = "";
  });

  // Feature 3: Agrupar materias por División con Checkbox Maestro
  const materiasContainer = document.getElementById('formMateriasContainer');
  materiasContainer.innerHTML = '';

  const grupos = {}; // { "1ro A": ["1ro A - Matemática", ...], "": ["ARTES"] }
  window.app.cursos.forEach(mat => {
    const { div } = _descomponerMat(mat);
    if (!grupos[div]) grupos[div] = [];
    grupos[div].push(mat);
  });

  // Ordenar: divisiones con nombre primero, luego las sin división
  const divsSorted = Object.keys(grupos).sort((a, b) => {
    if (a === '' && b !== '') return 1;
    if (a !== '' && b === '') return -1;
    return a.localeCompare(b);
  });

  divsSorted.forEach(div => {
    const mats = grupos[div];

    // Bloque contenedor por división
    const block = document.createElement('div');
    block.className = 'division-block mb-2 border dark:border-slate-700 rounded-lg overflow-hidden';

    if (div) {
      // Checkbox maestro para la división
      block.innerHTML = `
        <label class="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-700/50 cursor-pointer select-none hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
          <input type="checkbox" class="cb-division-maestro h-4 w-4 rounded accent-indigo-600"
                 data-division="${div}" onchange="app._toggleDivisionMaestra(this)">
          <span class="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">${div}</span>
          <span class="ml-auto text-[9px] text-slate-400 italic">marcar todo</span>
        </label>
        <div class="px-3 py-2 space-y-1.5"></div>`;
    } else {
      block.innerHTML = `<div class="px-0 py-0 space-y-1.5"></div>`;
    }

    const itemsContainer = block.querySelector('div:last-child');

    mats.forEach(mat => {
      const { base } = _descomponerMat(mat);
      const row = document.createElement('div');
      row.className = 'flex flex-col gap-1 p-2 border dark:border-slate-700 rounded bg-white dark:bg-slate-800 group-materia-row transition';
      row.innerHTML = `
        <div class="flex items-center gap-2">
          <input type="checkbox" value="${mat}" class="form-checkbox h-4 w-4 text-indigo-600 rounded cb-materia flex-shrink-0"
                 onchange="app._toggleInscripcionDetails(this)">
          <span class="text-slate-700 dark:text-slate-200 text-sm font-semibold flex-1">${base || mat}</span>
        </div>
        ${_htmlDetallesInscripcion(mat)}
      `;
      itemsContainer.appendChild(row);
    });

    materiasContainer.appendChild(block);
  });

  if (alumno) {
    title.innerText = "Editar Ficha de Estudiante";
    document.getElementById('formId').value       = alumno.id;
    document.getElementById('formApellido').value = alumno.apellido || "";
    document.getElementById('formNombre').value   = alumno.nombre || "";
    document.getElementById('formApodo').value    = alumno.apodo || "";
    document.getElementById('formDni').value      = alumno.dni || "";

    const inscripciones = alumno.inscripciones || {};
    document.querySelectorAll('.cb-materia').forEach(cb => {
      const mat = cb.value;
      let estaAsignado = false, insc = null;
      if (inscripciones[mat] && inscripciones[mat].length > 0) {
        estaAsignado = true;
        insc = inscripciones[mat][inscripciones[mat].length - 1];
      } else if ((alumno.materias && alumno.materias.includes(mat)) || (!alumno.materias && alumno.curso === mat)) {
        estaAsignado = true;
        insc = {
          grupo:  (alumno.grupos && alumno.grupos[mat]) ? alumno.grupos[mat] : (alumno.grupo || "GENERAL"),
          estado: alumno.estado || "ACTIVO",
          desde:  alumno.fechaIngreso || "",
          hasta:  alumno.fechaBaja || ""
        };
      }
      if (estaAsignado) {
        cb.checked = true;
        toggleInscripcionDetails(cb);
        const row = cb.closest('.group-materia-row');
        if (row && insc) {
          row.querySelector('.sel-grupo-materia').value  = insc.grupo  || "GENERAL";
          row.querySelector('.sel-estado-materia').value = insc.estado || "ACTIVO";
          row.querySelector('.sel-desde-materia').value  = normalizeDateToISO(insc.desde) || "";
          row.querySelector('.sel-hasta-materia').value  = normalizeDateToISO(insc.hasta) || "";
        }
      }
    });
    document.getElementById('formNotas').value = alumno.notas || "";

    // Sincronizar estado visual de todos los checkbox maestros
    document.querySelectorAll('.division-block').forEach(_sincronizarMaestra);
  } else {
    title.innerText = `Agregar Alumno a ${curso}`;
  }
  modal.classList.remove('hidden');
}

export function cerrarModalAlumno() {
  document.getElementById('modalAlumno').classList.add('hidden');
}

export async function guardarAlumnoMatricula() {
  const curso    = document.getElementById('mCurso').value;
  const id       = document.getElementById('formId').value;
  const apellido = document.getElementById('formApellido').value.trim();
  const nombre   = document.getElementById('formNombre').value.trim();
  const apodo    = document.getElementById('formApodo').value.trim();
  const dni      = document.getElementById('formDni').value.trim();
  const notas    = document.getElementById('formNotas').value.trim();

  if (!apellido || !nombre) { showToast('⚠️ Apellido y Nombre son requeridos.', 'error'); return; }

  // Recuperar el alumno original del caché para preservar el historial de inscripciones
  const alumnoActual = id ? (window.app.alumnosMatriculaCache?.find(a => a.id === id) || null) : null;

  const materiasSeleccionadas = [], gruposMap = {}, inscripcionesMap = {};
  document.querySelectorAll('.cb-materia:checked').forEach(cb => {
    const mat    = cb.value;
    const row    = cb.closest('.group-materia-row');
    const grupo  = row?.querySelector('.sel-grupo-materia')?.value  || "GENERAL";
    const estado = row?.querySelector('.sel-estado-materia')?.value || "ACTIVO";
    const desde  = row?.querySelector('.sel-desde-materia')?.value  || "";
    const hasta  = row?.querySelector('.sel-hasta-materia')?.value  || "";
    materiasSeleccionadas.push(mat);
    gruposMap[mat] = grupo;
    // Preservar todas las inscripciones históricas; reemplazar solo la última entrada
    const nuevoRegistro = { grupo, estado, desde: normalizeDateToISO(desde), hasta: normalizeDateToISO(hasta) };
    const historialPrevio = alumnoActual?.inscripciones?.[mat] || [];
    inscripcionesMap[mat] = historialPrevio.length > 0
      ? [...historialPrevio.slice(0, -1), nuevoRegistro]
      : [nuevoRegistro];
  });

  try {
    const docRef = id
      ? doc(db, getPath("estudiantes"), id)
      : doc(collection(db, getPath("estudiantes")));

    await setDoc(docRef, {
      apellido, nombre, apodo, dni, notas,
      inscripciones: inscripcionesMap,
      materias: materiasSeleccionadas,
      grupos:   gruposMap,
      curso:    materiasSeleccionadas.length > 0 ? materiasSeleccionadas[0] : (curso || "")
    });

    showToast('✅ Ficha de matrícula actualizada correctamente.');
    cerrarModalAlumno();
    await cargarAlumnosMatricula();
    window.app.cargarAlumnos();
  } catch (error) {
    console.error(error);
    showToast('❌ Error de red al guardar en base de datos.', 'error');
  }
}

// ==========================================
// HORARIOS (días de clase por división)
// ==========================================

export function cargarDiasDeClase() {
  const curso = document.getElementById('cfgCurso').value;
  if (!curso) { for (let d = 1; d <= 6; d++) document.getElementById(`chkDia${d}`).checked = false; return; }
  const horario = HORARIOS_DINAMICOS[curso] || { dias: [] };
  for (let d = 1; d <= 6; d++) {
    document.getElementById(`chkDia${d}`).checked = horario.dias.some(dd => (typeof dd === 'number' ? dd : dd.dia) === d);
  }
}

export async function guardarDiasDeClase() {
  const curso = document.getElementById('cfgCurso').value;
  if (!curso) { showToast('⚠️ Seleccione una división primero.', 'error'); return; }

  const diasSeleccionados = [], nombresDias = [];
  const diasLabel = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
  for (let d = 1; d <= 6; d++) {
    if (document.getElementById(`chkDia${d}`).checked) {
      diasSeleccionados.push(d); nombresDias.push(diasLabel[d - 1]);
    }
  }
  if (diasSeleccionados.length === 0) { showToast('⚠️ Seleccione al menos un día.', 'error'); return; }

  let stringNombre = nombresDias.join(', ');
  const ultComa = stringNombre.lastIndexOf(', ');
  if (ultComa !== -1) stringNombre = stringNombre.substring(0, ultComa) + ' y ' + stringNombre.substring(ultComa + 2);

  try {
    const datos = { dias: diasSeleccionados, nombre: stringNombre };
    await setDoc(doc(db, getPath("horarios"), curso), datos);
    HORARIOS_DINAMICOS[curso] = datos;
    showToast(`✅ Horario guardado para ${curso}: ${stringNombre}`);
    window.app.actualizarHorariosYFechasRapidas();
    window.app.verificarDiaSemana();
  } catch (e) {
    console.error(e);
    showToast('❌ Error al guardar horarios en Firestore.', 'error');
  }
}

// ==========================================
// BACKUP
// ==========================================

export async function exportarBackup() {
  const btn  = document.getElementById('btnBackup');
  const icon = document.getElementById('iconBackup');
  const text = document.getElementById('textBackup');
  btn.disabled = true; icon.className = 'ph ph-spinner animate-spin text-lg'; text.innerText = 'Exportando...';

  try {
    const [snapEst, snapAsist, snapHor] = await Promise.all([
      getDocs(collection(db, getPath('estudiantes'))),
      getDocs(collection(db, getPath('asistencias'))),
      getDocs(collection(db, getPath('horarios')))
    ]);
    const backup = { exportado: new Date().toISOString(), version: '1.0', estudiantes: {}, asistencias: {}, horarios: {} };
    snapEst.forEach(d => { backup.estudiantes[d.id] = d.data(); });
    snapAsist.forEach(d => { backup.asistencias[d.id] = d.data(); });
    snapHor.forEach(d => { backup.horarios[d.id] = d.data(); });

    const fecha = new Date().toISOString().split('T')[0];
    const blob  = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url   = URL.createObjectURL(blob);
    const a     = Object.assign(document.createElement('a'), { href: url, download: `backup_asistencia_${fecha}.json` });
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);

    showToast(`✅ Backup descargado: ${Object.keys(backup.estudiantes).length} estudiantes, ${Object.keys(backup.asistencias).length} registros.`);
  } catch (e) {
    console.error(e);
    showToast('❌ Error al exportar backup.', 'error');
  } finally {
    btn.disabled = false; icon.className = 'ph ph-download-simple text-lg'; text.innerText = '💾 Exportar Backup Completo (.json)';
  }
}

// ==========================================
// FUSIÓN DE DUPLICADOS
// ==========================================

export async function abrirModalFusion() {
  document.getElementById('modalFusion').classList.remove('hidden');
  document.getElementById('fusionBusqueda').value = '';
  document.getElementById('fusionResultados').classList.add('hidden');
  document.getElementById('fusionResumen').classList.add('hidden');
  document.getElementById('btnFusionar').disabled = true;
  document.getElementById('fusionPrimario').innerHTML   = '<span class="text-slate-400 italic">Ninguno seleccionado</span>';
  document.getElementById('fusionSecundario').innerHTML = '<span class="text-slate-400 italic">Ninguno seleccionado</span>';
  fusionState = { primario: null, secundario: null, todosAlumnos: [] };

  showToast('Cargando lista de estudiantes...', 'info');
  try {
    const snap = await getDocs(collection(db, getPath('estudiantes')));
    snap.forEach(d => fusionState.todosAlumnos.push({ id: d.id, ...d.data() }));
    fusionState.todosAlumnos.sort((a, b) => a.apellido.localeCompare(b.apellido));
    showToast(`✅ ${fusionState.todosAlumnos.length} estudiantes cargados.`);
  } catch(e) { showToast('❌ Error al cargar estudiantes.', 'error'); }
}

export function cerrarModalFusion() {
  document.getElementById('modalFusion').classList.add('hidden');
}

export function buscarParaFusion() {
  const q = document.getElementById('fusionBusqueda').value.toLowerCase().trim();
  const resultadosDiv = document.getElementById('fusionResultados');
  if (q.length < 2) { resultadosDiv.classList.add('hidden'); return; }

  const encontrados = fusionState.todosAlumnos.filter(a =>
    `${a.apellido} ${a.nombre}`.toLowerCase().includes(q) || (a.dni && a.dni.includes(q))
  );
  resultadosDiv.innerHTML = encontrados.length === 0
    ? '<p class="text-xs text-slate-400 p-2 text-center">Sin resultados.</p>'
    : encontrados.map(a => `
        <div class="p-2 border-b dark:border-slate-700 text-xs hover:bg-orange-50 flex justify-between items-center gap-2">
          <span class="font-bold">${escaparHTML(a.apellido)}, ${escaparHTML(a.nombre)}</span>
          <span class="text-slate-400">${escaparHTML(a.dni || '')}</span>
          <span class="text-indigo-600 text-[10px]">${(a.materias || [a.curso]).map(escaparHTML).join(', ')}</span>
          <div class="flex gap-1 ml-auto">
            <button onclick="app.seleccionarParaFusion('primario',${JSON.stringify(a.id)})" class="px-2 py-0.5 bg-emerald-500 text-white rounded text-[10px] font-bold hover:bg-emerald-600">Primario</button>
            <button onclick="app.seleccionarParaFusion('secundario',${JSON.stringify(a.id)})" class="px-2 py-0.5 bg-red-500 text-white rounded text-[10px] font-bold hover:bg-red-600">Secundario</button>
          </div>
        </div>`).join('');
  resultadosDiv.classList.remove('hidden');
}

export function seleccionarParaFusion(rol, id) {
  const alumno = fusionState.todosAlumnos.find(a => a.id === id);
  if (!alumno) return;
  fusionState[rol] = alumno;
  document.getElementById(`fusion${rol.charAt(0).toUpperCase() + rol.slice(1)}`).innerHTML = `
    <div class="text-left not-italic">
      <p class="font-bold text-slate-800 dark:text-slate-100">${escaparHTML(alumno.apellido)}, ${escaparHTML(alumno.nombre)}</p>
      ${alumno.dni ? `<p class="text-slate-500 dark:text-slate-400 font-mono">DNI: ${escaparHTML(alumno.dni)}</p>` : ''}
      <p class="text-indigo-600 mt-1">${(alumno.materias || [alumno.curso]).map(escaparHTML).join(', ')}</p>
      <p class="text-slate-400 text-[10px] mt-1">ID: ${escaparHTML(alumno.id)}</p>
    </div>`;
  _actualizarResumenFusion();
}

function _actualizarResumenFusion() {
  const { primario, secundario } = fusionState;
  const resumenDiv = document.getElementById('fusionResumen');
  const btnFusion  = document.getElementById('btnFusionar');
  if (!primario || !secundario) { resumenDiv.classList.add('hidden'); btnFusion.disabled = true; return; }
  if (primario.id === secundario.id) {
    resumenDiv.innerHTML = '<p class="text-red-600 font-bold">⚠️ No podés seleccionar el mismo estudiante en ambos roles.</p>';
    resumenDiv.classList.remove('hidden'); btnFusion.disabled = true; return;
  }
  const materiasUnidas = [...new Set([...(primario.materias || [primario.curso]), ...(secundario.materias || [secundario.curso])])];
  resumenDiv.innerHTML = `
    <p class="font-bold text-slate-700 dark:text-slate-200 mb-1">📋 Resultado de la fusión:</p>
    <p>→ <strong>${escaparHTML(primario.apellido)}, ${escaparHTML(primario.nombre)}</strong> conservará el ID <code class="bg-gray-200 px-1 rounded">${escaparHTML(primario.id)}</code></p>
    <p>→ Se fusionarán sus materias: <strong class="text-indigo-600">${materiasUnidas.map(escaparHTML).join(', ')}</strong></p>
    <p>→ Todos los registros del secundario (<code class="bg-gray-200 px-1 rounded">${escaparHTML(secundario.id)}</code>) serán reescritos.</p>
    <p class="text-red-600 mt-1">→ El documento del secundario (<strong>${escaparHTML(secundario.apellido)}, ${escaparHTML(secundario.nombre)}</strong>) será eliminado.</p>
  `;
  resumenDiv.classList.remove('hidden');
  btnFusion.disabled = false;
}

export async function ejecutarFusion() {
  const { primario, secundario } = fusionState;
  if (!primario || !secundario || primario.id === secundario.id) return;

  const btn = document.getElementById('btnFusionar');
  btn.disabled = true; btn.innerHTML = '<i class="ph ph-spinner animate-spin"></i> Procesando...';

  try {
    showToast('💾 Realizando backup de seguridad...', 'info');
    await exportarBackup();
    showToast('🔄 Transfiriendo registros de asistencia...', 'info');

    const snapAsistencias = await getDocs(collection(db, getPath('asistencias')));
    const batch = writeBatch(db);
    let reescrituras = 0;

    snapAsistencias.forEach(docSnap => {
      const data = docSnap.data();
      if (data.registros && data.registros[secundario.id] !== undefined) {
        const nuevosRegistros = { ...data.registros };
        if (!nuevosRegistros[primario.id]) nuevosRegistros[primario.id] = nuevosRegistros[secundario.id];
        delete nuevosRegistros[secundario.id];
        batch.update(docSnap.ref, { registros: nuevosRegistros });
        reescrituras++;
      }
    });

    const materiasUnidas = [...new Set([...(primario.materias || [primario.curso]), ...(secundario.materias || [secundario.curso])])];
    batch.update(doc(db, getPath('estudiantes'), primario.id), {
      materias: materiasUnidas, curso: materiasUnidas[0], dni: primario.dni || secundario.dni || ''
    });
    batch.delete(doc(db, getPath('estudiantes'), secundario.id));
    await batch.commit();

    showToast(`✅ Fusión completada. ${reescrituras} registros de asistencia transferidos.`);
    cerrarModalFusion();
    await cargarAlumnosMatricula();
  } catch(e) {
    console.error(e);
    showToast('❌ Error durante la fusión. Revisá el backup descargado.', 'error');
    btn.disabled = false; btn.innerHTML = '<i class="ph ph-git-merge"></i> Confirmar Fusión';
  }
}

// ==========================================
// PERFIL INTERACTIVO DE ALUMNO (Dossier)
// ==========================================

export async function abrirPerfilAlumno(uid, curso) {
  const modal = document.getElementById('modalPerfilAlumno');
  if (!modal) return;

  // Buscar alumno en caché local (toma diaria, matrícula o grilla)
  const al = window.app.alumnosActivos?.find(a => a.id === uid)
          || window.app.alumnosMatriculaCache?.find(a => a.id === uid)
          || window.app._grillaData?.alumnos?.find(a => a.id === uid);

  if (!al) { showToast('❌ No se encontró el perfil.', 'error'); return; }

  // Iniciales para el avatar
  const inicial1 = (al.nombre?.[0] || '').toUpperCase();
  const inicial2 = (al.apellido?.[0] || '').toUpperCase();
  document.getElementById('perfilAvatar').innerText     = inicial1 + inicial2;
  document.getElementById('perfilNombre').innerText     = `${al.apellido}, ${al.nombre}`;
  document.getElementById('perfilSubtitulo').innerText  = `${al.dni ? 'DNI: ' + al.dni + '  ·  ' : ''}${curso}`;
  document.getElementById('perfilKpiP').innerText   = '…';
  document.getElementById('perfilKpiA').innerText   = '…';
  document.getElementById('perfilKpiACP').innerText = '…';
  document.getElementById('perfilKpiPct').innerText = '…';

  const barra = document.getElementById('perfilBarra');
  barra.style.width  = '0%';
  barra.className    = 'h-full rounded-full bg-slate-300 transition-all duration-500';

  modal.classList.remove('hidden');

  try {
    // Consultar asistencias del curso para este alumno
    const snap = await getDocs(query(
      collection(db, getPath('asistencias')),
      where('curso', '==', curso),
      orderBy('fecha', 'asc')
    ));

    let p = 0, a = 0, acp = 0;
    snap.forEach(d => {
      const data = d.data();
      if (!['CLASE','CLASES REGULARES','Migrada',undefined].includes(data.tipoClase)) return;
      const marca = data.registros?.[uid];
      if      (marca === 'P')   p++;
      else if (marca === 'A')   a++;
      else if (marca === 'ACP') acp++;
    });

    const conReg = p + a + acp;
    const pct    = conReg > 0 ? Math.round((p / conReg) * 100) : 0;

    document.getElementById('perfilKpiP').innerText   = p;
    document.getElementById('perfilKpiA').innerText   = a;
    document.getElementById('perfilKpiACP').innerText = acp;
    document.getElementById('perfilKpiPct').innerText = pct + '%';

    barra.style.width = pct + '%';
    barra.className   = `h-full rounded-full transition-all duration-500 ${
      pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500'
    }`;
  } catch(e) {
    console.error(e);
    showToast('❌ Error al cargar el perfil del alumno.', 'error');
  }
}

export function cerrarPerfilAlumno() {
  document.getElementById('modalPerfilAlumno')?.classList.add('hidden');
}
