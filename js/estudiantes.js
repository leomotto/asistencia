// js/estudiantes.js — Matrícula, modal de alumnos, horarios y fusión de duplicados

import { doc, setDoc, collection, getDocs, deleteDoc, query, where, orderBy, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db, getPath } from "./firebase-config.js?v=9.95";
import { showToast } from "./ui.js?v=9.95";
import { HORARIOS_DINAMICOS } from "./materias.js?v=9.95";
import { normalizeDateToISO, formatISOToDisplay, escaparHTML } from "./utils.js?v=9.95";

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
      : todos.filter(a => {
          if (a.curso === curso) return true;
          if (a.materias && a.materias.some(m => m.startsWith(curso + ' -') || m === curso)) return true;
          return false;
        }).sort((a, b) => a.apellido.localeCompare(b.apellido));

    const terminoBusqueda = (document.getElementById('mBuscadorAlumno')?.value || '').toLowerCase().trim();
    let alumnosFiltrados = window.app.alumnosMatriculaCache;

    if (terminoBusqueda) {
      alumnosFiltrados = alumnosFiltrados.filter(est => 
        (est.apellido && est.apellido.toLowerCase().includes(terminoBusqueda)) || 
        (est.nombre && est.nombre.toLowerCase().includes(terminoBusqueda))
      );
    }

    if (alumnosFiltrados.length === 0) {
      tabla.innerHTML = '<tr><td colspan="5" class="px-4 py-8 text-center text-amber-600">No hay ningún alumno matriculado en este espacio que coincida con la búsqueda.</td></tr>';
      return;
    }

    tabla.innerHTML = '';
    alumnosFiltrados.forEach(est => {
      const apodoStr = est.apodo ? ` (${escaparHTML(est.apodo)})` : "";
      const notasStr = est.notas ? `<p class="text-xs text-amber-600 italic">📌 ${escaparHTML(est.notas)}</p>` : "";
      const esDivision = !curso.includes(" - "); const materiasAMostrar = (esTodos || esDivision)
        ? (est.materias || [est.curso])
        : (est.materias || [est.curso]).filter(m => m === curso);

      // Agrupar materias por división para no saturar la vista con 14 chips
      const materiasAgrupadas = {};
      materiasAMostrar.forEach(m => {
        const div = m.includes(' - ') ? m.split(' - ')[0] : m;
        if (!materiasAgrupadas[div]) {
          materiasAgrupadas[div] = { count: 0, grupos: new Set(), estados: new Set() };
        }
        materiasAgrupadas[div].count++;
        
        let grupo = 'GENERAL', estado = 'ACTIVO';
        if (est.inscripciones && est.inscripciones[m] && est.inscripciones[m].length > 0) {
          const insc = est.inscripciones[m][est.inscripciones[m].length - 1];
          grupo = insc.grupo || 'GENERAL';
          estado = insc.estado || 'ACTIVO';
        } else {
          grupo = (est.grupos && est.grupos[m]) || est.grupo || 'GENERAL';
          estado = est.estado || 'ACTIVO';
        }
        materiasAgrupadas[div].grupos.add(grupo);
        materiasAgrupadas[div].estados.add(estado);
      });

      const materiasHtml = Object.keys(materiasAgrupadas).map(div => {
        const data = materiasAgrupadas[div];
        const isBaja = !data.estados.has('ACTIVO'); // Si todas son baja, es baja
        const hasBaja = data.estados.has('BAJA'); // Si al menos una es baja
        const bgClass = isBaja ? 'bg-red-50 text-red-700 border-red-200' : (hasBaja ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200');
        
        const gruposArr = Array.from(data.grupos).filter(g => g !== 'GENERAL');
        const gruposStr = gruposArr.length > 0 ? ` [${gruposArr.join(', ')}]` : '';
        const estadoStr = isBaja ? ' (B)' : (hasBaja ? ' (M)' : '');
        
        return `<span class="inline-flex items-center px-1.5 py-0.5 text-[9px] rounded border ${bgClass} font-bold whitespace-nowrap mb-0.5 mr-0.5 max-w-[120px] truncate" title="${div}${gruposStr}${estadoStr === ' (B)' ? ' BAJA' : (estadoStr === ' (M)' ? ' MIXTO' : '')}">
          ${div}${gruposStr}${estadoStr}
        </span>`;
      }).join('');

      const tr = document.createElement('tr');
      tr.className = "hover:bg-slate-50 dark:hover:bg-slate-700/30 border-b dark:border-slate-700 transition-colors text-slate-700 dark:text-slate-200";
      tr.innerHTML = `
        <td class="px-2 py-1.5 align-middle">
          <p class="font-bold text-slate-800 dark:text-slate-100 text-sm leading-tight">${escaparHTML(est.apellido)}, ${escaparHTML(est.nombre)}<span class="text-blue-600">${apodoStr}</span>${est.dni ? `<span class="ml-1 text-[9px] font-mono text-slate-400">${escaparHTML(est.dni)}</span>` : ''}</p>
          ${notasStr}
        </td>
        <td class="px-2 py-1.5 align-middle"><div class="flex flex-wrap gap-0.5">${materiasHtml}</div></td>
        <td class="px-2 py-1.5 text-right align-middle">
          <button onclick='app.abrirModalAlumnoConId("${est.id}")' class="text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 p-1.5 rounded transition" title="Editar Estudiante">
            <i class="ph ph-pencil-simple text-lg"></i>
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
  if (!nombre) return { div: '', base: '' };
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

// Helpers for the new Spec-driven UI
export function _cambiarDivisionPrimaria() {
  const div = document.getElementById('formDivisionPrimaria').value;
  const container = document.getElementById('formMateriasContainer');
  const tarjeta = document.getElementById('tarjetaInscripcionDivision');
  const txtResumen = document.getElementById('txtResumenDivision');
  
  if (!div) {
    tarjeta.classList.add('hidden');
    container.classList.add('hidden');
    container.classList.remove('flex');
    return;
  }
  
  tarjeta.classList.remove('hidden');
  
  let countMats = 0;
  document.querySelectorAll('.division-block').forEach(block => {
    if (block.dataset.division === div) {
      block.classList.remove('hidden');
      const checkboxes = block.querySelectorAll('.cb-materia');
      countMats = checkboxes.length;
      checkboxes.forEach(cb => {
        if (!cb.checked) {
          cb.checked = true;
          window.app._toggleInscripcionDetails(cb);
        }
      });
    } else {
      block.classList.add('hidden');
    }
  });
  
  txtResumen.innerText = `Inscrito en ${div} (${countMats} asignaturas)`;
  _sincronizarGlobales();
}

export function _sincronizarGlobales() {
  const globalGrupo = document.getElementById('formGrupoGlobal').value;
  const globalEstado = document.getElementById('formEstadoGlobal').value;
  
  document.querySelectorAll('.division-block:not(.hidden) .group-materia-row').forEach(row => {
    if (row.querySelector('.cb-materia').checked) {
      row.querySelector('.sel-grupo-materia').value = globalGrupo;
      row.querySelector('.sel-estado-materia').value = globalEstado;
    }
  });
}

export function _toggleMateriasIndividuales() {
  const container = document.getElementById('formMateriasContainer');
  if (container.classList.contains('hidden')) {
    container.classList.remove('hidden');
    container.classList.add('flex');
  } else {
    container.classList.add('hidden');
    container.classList.remove('flex');
  }
}

export function abrirModalAlumno(alumno = null) {
  const modal = document.getElementById('modalAlumno');
  const title = document.getElementById('modalTitle');
  const selectDiv = document.getElementById('formDivisionPrimaria');

  // Reset form
  document.getElementById('formId').value = '';
  document.getElementById('formAlumnoAnio').value = '';
  document.getElementById('formApellido').value = '';
  document.getElementById('formNombre').value = '';
  document.getElementById('formApodo').value = '';
  document.getElementById('formDni').value = '';
  document.getElementById('formNotas').value = '';
  
  const container = document.getElementById('formMateriasContainer');
  container.innerHTML = '';
  
  const grupos = {}; 
  window.app.cursos.forEach(mat => {
    const { div } = _descomponerMat(mat);
    if (!grupos[div]) grupos[div] = [];
    grupos[div].push(mat);
  });

  const divisiones = Object.keys(grupos).sort((a,b) => a.localeCompare(b));
  
  divisiones.forEach(div => {
    const block = document.createElement('div');
    block.className = 'division-block hidden mb-2 rounded-lg overflow-hidden';
    block.dataset.division = div;
    
    grupos[div].forEach(mat => {
      const { base } = _descomponerMat(mat);
      const row = document.createElement('div');
      row.className = 'flex flex-col gap-1 p-2 border dark:border-slate-700 rounded bg-white dark:bg-slate-800 group-materia-row transition';
      row.innerHTML = `
        <div class="flex items-center gap-2">
          <input type="checkbox" value="${mat}" class="form-checkbox h-4 w-4 text-indigo-600 rounded cb-materia flex-shrink-0" onchange="app._toggleInscripcionDetails(this)">
          <span class="text-slate-700 dark:text-slate-200 text-sm font-semibold flex-1">${base || mat}</span>
        </div>
        ${_htmlDetallesInscripcion(mat)}
      `;
      block.appendChild(row);
    });
    container.appendChild(block);
  });

  selectDiv.innerHTML = '<option value="">-- Seleccione una División --</option>' + 
    divisiones.filter(d => d !== '').map(d => `<option value="${d}">${d}</option>`).join('');

  document.getElementById('tarjetaInscripcionDivision').classList.add('hidden');
  container.classList.add('hidden');
  container.classList.remove('flex');

  document.getElementById('formGrupoGlobal').value = 'GENERAL';
  document.getElementById('formEstadoGlobal').value = 'ACTIVO';

  if (alumno) {
    title.innerText = "Editar Ficha de Estudiante";
    document.getElementById('formId').value         = alumno.id;
    document.getElementById('formAlumnoAnio').value = alumno.planEstudio || "";
    document.getElementById('formApellido').value   = alumno.apellido || "";
    document.getElementById('formNombre').value     = alumno.nombre || "";
    document.getElementById('formApodo').value      = alumno.apodo || "";
    document.getElementById('formDni').value        = alumno.dni || "";
    document.getElementById('formNotas').value      = alumno.notas || "";

    const inscripciones = alumno.inscripciones || {};
    document.querySelectorAll('.cb-materia').forEach(cb => {
      const mat = cb.value;
      const nCursoMat = mat.replace(/\s+/g, ' ').toLowerCase().trim();
      const nDivAlum = (alumno.curso || '').replace(/\s+/g, ' ').toLowerCase().trim();
      const pertenecePorDivision = (nDivAlum && nDivAlum.length > 1 && nCursoMat.includes(nDivAlum));

      const estaAsignado = (alumno.materias && alumno.materias.includes(mat)) || 
                           (alumno.curso === mat) || 
                           pertenecePorDivision;
      cb.checked = !!estaAsignado;
      
      let insc = null;
      if (estaAsignado) {
        if (inscripciones[mat] && inscripciones[mat].length > 0) {
          insc = inscripciones[mat][inscripciones[mat].length - 1];
        } else {
          insc = {
            grupo:  (alumno.grupos && alumno.grupos[mat]) ? alumno.grupos[mat] : (alumno.grupo || "GENERAL"),
            estado: alumno.estado || "ACTIVO",
            desde:  alumno.fechaIngreso || "",
            hasta:  alumno.fechaBaja || ""
          };
        }
      } else {
        // Pre-fill fields to prevent overwriting with today's date if user checks the box
        insc = {
          grupo: "GENERAL",
          estado: alumno.estado || "ACTIVO",
          desde: alumno.fechaIngreso || "",
          hasta: alumno.fechaBaja || ""
        };
      }
      
      window.app._toggleInscripcionDetails(cb);
      
      const row = cb.closest('.group-materia-row');
      if (row && insc) {
        row.querySelector('.sel-grupo-materia').value  = insc.grupo  || "GENERAL";
        row.querySelector('.sel-estado-materia').value = insc.estado || "ACTIVO";
        row.querySelector('.sel-desde-materia').value  = normalizeDateToISO(insc.desde) || "";
        row.querySelector('.sel-hasta-materia').value  = normalizeDateToISO(insc.hasta) || "";
      }
    });

    let divPrincipal = '';
    if (alumno.curso && alumno.curso !== '__TODOS__') {
       divPrincipal = alumno.curso.indexOf(' - ') > -1 ? alumno.curso.split(' - ')[0] : alumno.curso;
    } else if (alumno.materias && alumno.materias.length > 0) {
       divPrincipal = alumno.materias[0].indexOf(' - ') > -1 ? alumno.materias[0].split(' - ')[0] : alumno.materias[0];
    }
    
    if (divPrincipal && divisiones.includes(divPrincipal)) {
      selectDiv.value = divPrincipal;
      document.getElementById('tarjetaInscripcionDivision').classList.remove('hidden');
      
      let countMats = 0;
      document.querySelectorAll('.division-block').forEach(block => {
        if (block.dataset.division === divPrincipal) {
          block.classList.remove('hidden');
          countMats = block.querySelectorAll('.cb-materia').length;
        } else {
          block.classList.add('hidden');
        }
      });
      document.getElementById('txtResumenDivision').innerText = `Inscrito en ${divPrincipal} (${countMats} asignaturas)`;
    }

  } else {
    title.innerText = `Agregar Nuevo Estudiante`;
    const filtroActual = document.getElementById('mCurso')?.value;
    if (filtroActual && filtroActual !== '__TODOS__') {
      const divFiltro = filtroActual.indexOf(' - ') > -1 ? filtroActual.split(' - ')[0] : filtroActual;
      if (divisiones.includes(divFiltro)) {
        selectDiv.value = divFiltro;
        _cambiarDivisionPrimaria();
      }
    }
  }
  
  const btnEliminar = document.getElementById('btnEliminarAlumno');
  if (btnEliminar) {
    if (alumno) {
      btnEliminar.classList.remove('hidden');
      btnEliminar.onclick = () => window.app.eliminarAlumno(alumno.id, `${alumno.apellido}, ${alumno.nombre}`);
    } else {
      btnEliminar.classList.add('hidden');
      btnEliminar.onclick = null;
    }
  }

  modal.classList.remove('hidden');
}

export function cerrarModalAlumno() {
  document.getElementById('modalAlumno').classList.add('hidden');
}

export async function guardarAlumnoMatricula() {
  const divisionPrimaria = document.getElementById('formDivisionPrimaria').value;
  const id       = document.getElementById('formId').value;
  const planEstudio = document.getElementById('formAlumnoAnio').value.trim();
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
      apellido, nombre, apodo, dni, notas, planEstudio,
      inscripciones: inscripcionesMap,
      materias: materiasSeleccionadas,
      grupos:   gruposMap,
      curso:    divisionPrimaria || ""
    }, { merge: true });

    window.app.invalidarCacheBI?.();
    showToast('✅ Ficha de matrícula actualizada correctamente.');
    cerrarModalAlumno();
    await cargarAlumnosMatricula();
    window.app.cargarAlumnos();
  } catch (error) {
    console.error(error);
    showToast('❌ Error de red al guardar en base de datos.', 'error');
  }
}

export async function eliminarAlumno(id, nombreFmt) {
  if (!await window.app.showConfirm("Confirmación", `¿Estás seguro de que deseas ELIMINAR por completo a ${nombreFmt}? Esta acción es irreversible.`)) return;

  try {
    await deleteDoc(doc(db, getPath("estudiantes"), id));
    showToast(`✅ Estudiante ${nombreFmt} eliminado correctamente.`);
    cerrarModalAlumno();
    await cargarAlumnosMatricula();
    window.app.cargarAlumnos();
  } catch (error) {
    console.error(error);
    showToast('❌ Error al eliminar estudiante.', 'error');
  }
}



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
        <div class="p-2 border-b dark:border-slate-700 text-xs hover:bg-orange-50 dark:hover:bg-slate-700 flex justify-between items-center gap-2">
          <span class="font-bold text-slate-800 dark:text-slate-200">${escaparHTML(a.apellido)}, ${escaparHTML(a.nombre)}</span>
          <span class="text-slate-400">${escaparHTML(a.dni || '')}</span>
          <span class="text-indigo-600 dark:text-indigo-400 text-[10px]">${(a.materias || [a.curso]).map(escaparHTML).join(', ')}</span>
          <div class="flex gap-1 ml-auto">
            <button onclick="app.seleccionarParaFusion('primario', '${a.id}')" class="px-2 py-0.5 bg-emerald-500 dark:bg-emerald-600 text-white rounded text-[10px] font-bold hover:bg-emerald-600 dark:hover:bg-emerald-500">Primario</button>
            <button onclick="app.seleccionarParaFusion('secundario', '${a.id}')" class="px-2 py-0.5 bg-red-500 dark:bg-red-600 text-white rounded text-[10px] font-bold hover:bg-red-600 dark:hover:bg-red-500">Secundario</button>
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
    showToast('🔄 Transfiriendo registros (Asistencias y Evaluaciones)...', 'info');

    let batches = [writeBatch(db)];
    let currentBatch = 0;
    let operationCount = 0;

    const commitBatches = async () => {
      for (const b of batches) await b.commit();
      batches = [writeBatch(db)];
      currentBatch = 0;
      operationCount = 0;
    };

    const addOperation = (type, ref, data) => {
      if (operationCount >= 450) {
        currentBatch++;
        batches[currentBatch] = writeBatch(db);
        operationCount = 0;
      }
      if (type === 'update') batches[currentBatch].update(ref, data);
      else if (type === 'set') batches[currentBatch].set(ref, data);
      else if (type === 'delete') batches[currentBatch].delete(ref);
      operationCount++;
    };

    const snapAsistencias = await getDocs(collection(db, getPath('asistencias')));
    let reescriturasAsistencias = 0;

    snapAsistencias.forEach(docSnap => {
      const data = docSnap.data();
      if (data.registros && data.registros[secundario.id] !== undefined) {
        const nuevosRegistros = { ...data.registros };
        if (!nuevosRegistros[primario.id]) nuevosRegistros[primario.id] = nuevosRegistros[secundario.id];
        delete nuevosRegistros[secundario.id];
        addOperation('update', docSnap.ref, { registros: nuevosRegistros });
        reescriturasAsistencias++;
      }
    });

    let reescriturasEvaluaciones = 0;
    const qEvals = query(collection(db, getPath('evaluaciones')), where('alumnoId', '==', secundario.id));
    const snapEvals = await getDocs(qEvals);
    
    snapEvals.forEach(docSnap => {
      const data = docSnap.data();
      const materia = data.materia || '';
      const newDocId = `${primario.id}_${materia.replace(/[\s/]+/g, '')}`;
      const newRef = doc(db, getPath('evaluaciones'), newDocId);
      
      const newData = { ...data, alumnoId: primario.id };
      addOperation('set', newRef, newData);
      addOperation('delete', docSnap.ref);
      reescriturasEvaluaciones++;
    });

    const materiasArr = [...(primario.materias || []), ...(primario.curso ? [primario.curso] : []), ...(secundario.materias || []), ...(secundario.curso ? [secundario.curso] : [])];
    const materiasUnidas = [...new Set(materiasArr)].filter(Boolean);
    
    const gruposUnidos = { ...(primario.grupos || {}), ...(secundario.grupos || {}) };
    const inscripcionesUnidas = { ...(primario.inscripciones || {}) };
    
    for (const mat of Object.keys(secundario.inscripciones || {})) {
      if (!inscripcionesUnidas[mat]) {
        inscripcionesUnidas[mat] = secundario.inscripciones[mat];
      } else {
        inscripcionesUnidas[mat] = [...inscripcionesUnidas[mat], ...secundario.inscripciones[mat]];
      }
    }

    addOperation('update', doc(db, getPath('estudiantes'), primario.id), {
      materias: materiasUnidas, 
      curso: materiasUnidas[0] || '', 
      dni: primario.dni || secundario.dni || '',
      grupos: gruposUnidos,
      inscripciones: inscripcionesUnidas
    });
    addOperation('delete', doc(db, getPath('estudiantes'), secundario.id));
    
    await commitBatches();

    window.app.invalidarCacheBI?.();
    showToast(`✅ Fusión completada. Asistencias: ${reescriturasAsistencias} | Evaluaciones: ${reescriturasEvaluaciones}`);
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

  const btnPase = document.getElementById('btnEmitirPase');
  if (btnPase) {
    if (window.app.currentUser?.rolActivo === 'ADMIN' || window.app.currentUser?.rolActivo === 'SUPERADMIN') {
      btnPase.style.display = 'flex';
      btnPase.classList.remove('hidden');
      btnPase.onclick = () => app.emitirPase(uid);
    } else {
      btnPase.style.display = 'none';
    }
  }

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

export async function emitirPase(uid) {
  const modal = document.getElementById('modalPase');
  if (!modal) return;
  
  document.getElementById('paseEstudianteId').value = uid;
  
  // Load schools
  const select = document.getElementById('paseEscuelaDestino');
  if (select) {
    try {
      const db = window.app.db || await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js").then(m => window.app.db);
      const { getDocs, collection } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
      const fbdb = (await import("./firebase-config.js?v=9.95")).db;
      const { getPath } = await import("./firebase-config.js?v=9.95");
      
      const qSnap = await getDocs(collection(fbdb, getPath("escuelas")));
      let html = '<option value="EXTERIOR">Otra / Fuera del sistema (EXTERIOR)</option>';
      qSnap.forEach(d => {
        if (d.id !== window.app.currentTenant) {
          html += `<option value="${d.id}">${d.data().nombre || d.id}</option>`;
        }
      });
      select.innerHTML = html;
    } catch(e) {
      console.error(e);
      select.innerHTML = '<option value="EXTERIOR">Otra / Fuera del sistema (EXTERIOR)</option>';
    }
  }

  modal.classList.remove('hidden');
  setTimeout(() => {
    modal.querySelector('div').classList.remove('scale-95', 'opacity-0');
  }, 10);
}

export function cerrarModalPase() {
  const modal = document.getElementById('modalPase');
  if (!modal) return;
  modal.querySelector('div').classList.add('scale-95', 'opacity-0');
  setTimeout(() => modal.classList.add('hidden'), 300);
}

export async function confirmarEmitirPase() {
  const uid = document.getElementById('paseEstudianteId').value;
  const destino = document.getElementById('paseEscuelaDestino').value;
  if (!uid || !destino) return;

  try {
    const db = window.app.db || await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js").then(m => window.app.db);
    const { doc, getDoc, setDoc, deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
    const fbdb = (await import("./firebase-config.js?v=9.95")).db;
    const { appId } = await import("./firebase-config.js?v=9.95");

    // Construir rutas absolutas
    const oldPath = typeof __app_id !== 'undefined' 
      ? `artifacts/${appId}/public/data/instituciones/${window.app.currentTenant}/estudiantes`
      : `instituciones/${window.app.currentTenant}/estudiantes`;
      
    const newPath = typeof __app_id !== 'undefined'
      ? `artifacts/${appId}/public/data/instituciones/${destino}/estudiantes`
      : `instituciones/${destino}/estudiantes`;

    const oldRef = doc(fbdb, oldPath, uid);
    const newRef = doc(fbdb, newPath, uid);

    const docSnap = await getDoc(oldRef);
    if (!docSnap.exists()) {
      window.app.showToast("No se encontró el legajo del estudiante.", "error");
      return;
    }

    const data = docSnap.data();
    data.fechaPase = new Date().toISOString();
    data.escuelaOrigen = window.app.currentTenant;
    // Si va a una escuela real, se limpia su estado global para que empiece de cero, o se deja 'PASE'?
    // Mejor lo dejamos como PASE en la de origen (aunque la borramos de ahí), pero en la destino debería entrar como ACTIVO o similar.
    data.estadoGlobal = 'ACTIVO';
    // Limpiamos las materias individuales (no van a coincidir con la nueva escuela)
    data.materiasActivas = {};
    data.materiasInactivas = {};
    // La asistencia NO viaja porque la asistencia está en la colección 'asistencias' (aislada), 
    // y no en el doc del alumno, por lo que el alumno llega con asistencia "limpia".

    await setDoc(newRef, data);
    await deleteDoc(oldRef);

    window.app.showToast("Pase emitido exitosamente. El legajo fue transferido a " + destino, "success");
    cerrarModalPase();
    if (typeof window.app.cerrarPerfilAlumno === 'function') window.app.cerrarPerfilAlumno();
    if (typeof window.app.cargarAlumnosMatricula === 'function') window.app.cargarAlumnosMatricula();

  } catch (error) {
    console.error("Error al emitir pase:", error);
    window.app.showToast("Error al emitir el pase. Revisá la consola.", "error");
  }
}

let normalizacionGrupos = [];
let normalizacionSeleccionados = new Set();

export async function abrirModalNormalizacion() {
  cerrarModalFusion();
  document.getElementById('modalNormalizacionMasiva').classList.remove('hidden');
  const lista = document.getElementById('listaNormalizacion');
  const btn = document.getElementById('btnConfirmarNormalizacion');
  const contador = document.getElementById('normContador');
  
  lista.innerHTML = '<div class="text-center py-10 text-slate-500"><i class="ph ph-spinner animate-spin text-3xl mb-2 block"></i> Analizando base de datos...</div>';
  btn.disabled = true;
  contador.textContent = '0';
  normalizacionGrupos = [];
  normalizacionSeleccionados.clear();

  try {
    const snap = await getDocs(collection(db, getPath('estudiantes')));
    const estudiantes = [];
    snap.forEach(d => estudiantes.push({ id: d.id, ...d.data() }));

    const grupos = {};
    estudiantes.forEach(est => {
      const key = `${(est.nombre || '').trim().toLowerCase()} ${(est.apellido || '').trim().toLowerCase()}`;
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(est);
    });

    const hasArtes = (s) => (s.materias||[]).some(m => m.toLowerCase().includes('arte')) || (s.curso||'').toLowerCase().includes('arte') || (s.inscripciones && Object.keys(s.inscripciones).some(m => m.toLowerCase().includes('arte')));

    const duplicados = Object.values(grupos).filter(g => g.length > 1);

    if (duplicados.length === 0) {
      lista.innerHTML = '<div class="text-center py-10 text-emerald-600 dark:text-emerald-500 font-bold"><i class="ph ph-check-circle text-4xl mb-2 block"></i> No se encontraron estudiantes duplicados.</div>';
      return;
    }

    let html = '';
    
    for (const [index, grupo] of duplicados.entries()) {
      let primario = grupo[0];
      let secundarios = [];
      
      for (const est of grupo) {
        if (hasArtes(est) && !hasArtes(primario)) {
          primario = est;
        }
      }
      secundarios = grupo.filter(e => e.id !== primario.id);
      
      const groupId = `norm_grupo_${index}`;
      normalizacionGrupos.push({ id: groupId, primario, secundarios });
      normalizacionSeleccionados.add(groupId); // checked by default

      html += `
        <label class="flex items-start gap-3 p-3 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-750 transition shadow-sm">
          <div class="pt-1">
            <input type="checkbox" id="${groupId}" class="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600" checked onchange="app.toggleNormalizacionItem('${groupId}')">
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              ${primario.nombre} ${primario.apellido}
              <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">Grupo de ${grupo.length}</span>
            </div>
            <div class="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div class="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-2 rounded">
                <div class="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1 mb-1"><i class="ph ph-star-fill"></i> Primario (Se mantiene)</div>
                <div class="text-slate-600 dark:text-slate-400 truncate">DNI: ${primario.dni || '-'}</div>
                <div class="text-slate-600 dark:text-slate-400 truncate">Materias: ${(primario.materias||[]).join(', ') || '-'}</div>
              </div>
              <div class="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 p-2 rounded">
                <div class="font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1 mb-1"><i class="ph ph-trash"></i> Secundario/s (Se elimina/n)</div>
                ${secundarios.map(sec => `
                  <div class="text-slate-600 dark:text-slate-400 truncate mb-1">DNI: ${sec.dni || '-'} | Materias: ${(sec.materias||[]).join(', ') || '-'}</div>
                `).join('')}
              </div>
            </div>
          </div>
        </label>
      `;
    }

    lista.innerHTML = html;
    actualizarBotonNormalizacion();

  } catch (error) {
    console.error(error);
    lista.innerHTML = `<div class="text-center py-10 text-rose-600 font-bold"><i class="ph ph-warning text-3xl mb-2 block"></i> Error al analizar: ${error.message}</div>`;
  }
}

export function cerrarModalNormalizacion() {
  document.getElementById('modalNormalizacionMasiva').classList.add('hidden');
}

export function toggleNormalizacionItem(id) {
  const cb = document.getElementById(id);
  if (cb.checked) {
    normalizacionSeleccionados.add(id);
  } else {
    normalizacionSeleccionados.delete(id);
  }
  actualizarBotonNormalizacion();
}

function actualizarBotonNormalizacion() {
  const contador = document.getElementById('normContador');
  const btn = document.getElementById('btnConfirmarNormalizacion');
  contador.textContent = normalizacionSeleccionados.size;
  btn.disabled = normalizacionSeleccionados.size === 0;
}

export async function ejecutarNormalizacionSeleccionada() {
  const gruposAEjecutar = normalizacionGrupos.filter(g => normalizacionSeleccionados.has(g.id));
  if (gruposAEjecutar.length === 0) return;

  if (!await window.app.showConfirm("Confirmación", `⚠️ ¿Estás seguro de fusionar los ${gruposAEjecutar.length} grupos seleccionados?\nEsta operación no se puede deshacer.`)) return;

  const btn = document.getElementById('btnConfirmarNormalizacion');
  btn.disabled = true;
  btn.innerHTML = '<i class="ph ph-spinner animate-spin"></i> Procesando...';

  try {
    showToast('💾 Realizando backup de seguridad...', 'info');
    await exportarBackup();
    showToast('🔄 Ejecutando fusiones...', 'info');

    let batches = [writeBatch(db)];
    let currentBatch = 0;
    let operationCount = 0;

    const addOperation = (type, ref, data) => {
      if (operationCount >= 450) {
        currentBatch++;
        batches[currentBatch] = writeBatch(db);
        operationCount = 0;
      }
      if (type === 'update') batches[currentBatch].update(ref, data);
      else if (type === 'set') batches[currentBatch].set(ref, data);
      else if (type === 'delete') batches[currentBatch].delete(ref);
      operationCount++;
    };

    const snapAsistencias = await getDocs(collection(db, getPath('asistencias')));
    const snapEvals = await getDocs(collection(db, getPath('evaluaciones')));
    const todasAsistencias = [];
    snapAsistencias.forEach(d => todasAsistencias.push({ id: d.id, ref: d.ref, ...d.data() }));
    const todasEvals = [];
    snapEvals.forEach(d => todasEvals.push({ id: d.id, ref: d.ref, ...d.data() }));

    let resAsist = 0;
    let resEvals = 0;
    let resFusionados = 0;

    for (const grupo of gruposAEjecutar) {
      let { primario, secundarios } = grupo;

      for (const secundario of secundarios) {
        for (const asis of todasAsistencias) {
          if (asis.registros && asis.registros[secundario.id] !== undefined) {
            const nuevosRegistros = { ...asis.registros };
            if (!nuevosRegistros[primario.id]) nuevosRegistros[primario.id] = nuevosRegistros[secundario.id];
            delete nuevosRegistros[secundario.id];
            addOperation('update', asis.ref, { registros: nuevosRegistros });
            asis.registros = nuevosRegistros;
            resAsist++;
          }
        }

        const evalsSecundario = todasEvals.filter(e => e.alumnoId === secundario.id);
        for (const docSnap of evalsSecundario) {
          const materia = docSnap.materia || '';
          const newDocId = `${primario.id}_${materia.replace(/[\s/]+/g, '')}`;
          const newRef = doc(db, getPath('evaluaciones'), newDocId);
          
          const newData = { ...docSnap, alumnoId: primario.id };
          delete newData.id;
          delete newData.ref;
          addOperation('set', newRef, newData);
          addOperation('delete', docSnap.ref);
          resEvals++;
        }

        const materiasArr = [...(primario.materias || []), ...(primario.curso ? [primario.curso] : []), ...(secundario.materias || []), ...(secundario.curso ? [secundario.curso] : [])];
        const materiasUnidas = [...new Set(materiasArr)].filter(Boolean);
        
        const gruposUnidos = { ...(primario.grupos || {}), ...(secundario.grupos || {}) };
        const inscripcionesUnidas = { ...(primario.inscripciones || {}) };
        for (const mat of Object.keys(secundario.inscripciones || {})) {
          if (!inscripcionesUnidas[mat]) inscripcionesUnidas[mat] = secundario.inscripciones[mat];
          else inscripcionesUnidas[mat] = [...inscripcionesUnidas[mat], ...secundario.inscripciones[mat]];
        }

        primario.materias = materiasUnidas;
        primario.curso = materiasUnidas[0] || '';
        primario.grupos = gruposUnidos;
        primario.inscripciones = inscripcionesUnidas;
        if (!primario.dni && secundario.dni) primario.dni = secundario.dni;

        addOperation('delete', doc(db, getPath('estudiantes'), secundario.id));
        resFusionados++;
      }
      
      addOperation('update', doc(db, getPath('estudiantes'), primario.id), {
        materias: primario.materias,
        curso: primario.curso,
        dni: primario.dni || '',
        grupos: primario.grupos || {},
        inscripciones: primario.inscripciones || {}
      });
    }

    for (const b of batches) await b.commit();

    window.app.invalidarCacheBI?.();
    showToast(`✅ Normalización completa: se unificaron ${resFusionados} estudiantes. (Asist: ${resAsist}, Evals: ${resEvals})`, 'success', 8000);
    cerrarModalNormalizacion();
    await cargarAlumnosMatricula();

  } catch (error) {
    console.error(error);
    showToast('❌ Error en auto-normalización: ' + error.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="ph ph-git-merge"></i> Ejecutar Selección';
  }
}
