// js/estudiantes.js — Matrícula, modal de alumnos, horarios y fusión de duplicados

import { doc, setDoc, collection, getDocs, deleteDoc, query, where, orderBy, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db, getPath } from "./firebase-config.js?v=10.77";
import { showToast } from "./ui.js?v=10.77";
import { HORARIOS_DINAMICOS } from "./materias.js?v=10.77";
import { normalizeDateToISO, formatISOToDisplay, escaparHTML } from "./utils.js?v=10.77";

let fusionState = { primario: null, secundario: null, todosAlumnos: [] };

// Estado de orden de la tabla de matrícula
let _matSort = { key: 'apellido', dir: 1 };

// Resume el estado de un alumno: si tuvo baja, cambio de división, o está activo simple.
function _resumenCambios(est) {
  const insMap = est.inscripciones || {};
  const divs = new Set();
  let baja = false, cambio = false;
  Object.entries(insMap).forEach(([mat, arr]) => {
    const div = mat.includes(' - ') ? mat.split(' - ')[0] : mat;
    divs.add(div);
    const last = (arr && arr.length) ? arr[arr.length - 1] : {};
    if (last.estado === 'BAJA') baja = true;
    if (last.hasta) cambio = true;
    if (arr && arr.length > 1) cambio = true;   // más de un tramo en la misma materia
  });
  if (divs.size > 1) cambio = true;             // estuvo en más de una división
  const pase = !!est.pase;                       // pase a otra escuela
  if (pase) baja = true;
  // rank para ordenar: 0 activo simple, 1 con cambio, 2 con baja/pase
  return { baja, pase, cambio: cambio || baja, rank: baja ? 2 : (cambio ? 1 : 0) };
}

// Devuelve { anio, division } a partir del curso ("2do D", "A 1ro", etc.) y planEstudio.
// Busca el número de año EN CUALQUIER POSICIÓN del string (no solo al inicio), porque
// la división puede escribirse "1ro A" o "A 1ro" según cómo se haya cargado la materia.
function _anioDivision(est) {
  // est.curso a veces guarda solo la letra ("A") sin año; las materias suelen tener el
  // nombre completo ("1ro A - Matemática"). Se prioriza el candidato que SÍ tenga dígito.
  const candidatos = [
    est.curso,
    ...(est.materias || []).map(m => m.includes(' - ') ? m.split(' - ')[0] : m),
  ].filter(Boolean);
  const curso = candidatos.find(c => /\d/.test(c)) || candidatos[0] || '';
  const m = curso.match(/\d+\s*(?:ro|do|er|to|mo|vo|no|°|º)?/i);
  const anio = est.planEstudio || (m ? m[0].replace(/\s+/g, '') : '');
  const division = m ? (curso.slice(0, m.index) + curso.slice(m.index + m[0].length)).trim() : curso;
  return { anio, division: division || curso };
}

export function ordenarMatricula(key) {
  if (_matSort.key === key) _matSort.dir *= -1;
  else _matSort = { key, dir: 1 };
  cargarAlumnosMatricula();
}

// ==========================================
// MATRÍCULA — LISTADO
// ==========================================

export async function cargarAlumnosMatricula() {
  const curso   = document.getElementById('mCurso').value;
  const tabla   = document.getElementById('tablaMatricula');
  const esTodos = curso === '__TODOS__';

  if (!curso) {
    tabla.innerHTML = '<tr><td colspan="6" class="px-4 py-8 text-center text-slate-400">Seleccione un curso del menú superior.</td></tr>';
    return;
  }
  tabla.innerHTML = '<tr><td colspan="6" class="px-4 py-8 text-center text-indigo-500 animate-pulse">Sincronizando matrícula...</td></tr>';

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

    // Filtro por cambios/pases/bajas
    const filtroCambios = document.getElementById('mFiltroCambios')?.value || '';
    if (filtroCambios) {
      alumnosFiltrados = alumnosFiltrados.filter(est => {
        const r = _resumenCambios(est);
        if (filtroCambios === 'cambios') return r.cambio;
        if (filtroCambios === 'pase')    return r.pase;
        if (filtroCambios === 'baja')    return r.baja;
        if (filtroCambios === 'activo')  return !r.cambio;
        return true;
      });
    }

    // Orden por columna
    alumnosFiltrados = [...alumnosFiltrados].sort((a, b) => {
      let cmp;
      switch (_matSort.key) {
        case 'estado':
          cmp = _resumenCambios(a).rank - _resumenCambios(b).rank; break;
        case 'nombre':
          cmp = (a.nombre || '').localeCompare(b.nombre || ''); break;
        case 'anio':
        case 'division': {
          // Orden compuesto: primero por año, luego por división (1ro A, 1ro B, ... 2do A, ...)
          const da = _anioDivision(a), db = _anioDivision(b);
          cmp = da.anio.localeCompare(db.anio, undefined, { numeric: true });
          if (cmp === 0) cmp = da.division.localeCompare(db.division, undefined, { numeric: true });
          break;
        }
        default:
          cmp = (a.apellido || '').localeCompare(b.apellido || '');
      }
      if (cmp === 0) cmp = (a.apellido || '').localeCompare(b.apellido || '');
      return cmp * _matSort.dir;
    });

    // Indicadores de flecha en los headers
    ['apellido', 'nombre', 'anio', 'division', 'estado'].forEach(k => {
      const el = document.getElementById(`sortArrow-${k}`);
      if (el) el.textContent = _matSort.key === k ? (_matSort.dir === 1 ? '▲' : '▼') : '';
    });

    if (alumnosFiltrados.length === 0) {
      tabla.innerHTML = '<tr><td colspan="6" class="px-4 py-8 text-center text-amber-600">No hay ningún alumno matriculado en este espacio que coincida con la búsqueda.</td></tr>';
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

      const r = _resumenCambios(est);
      const { anio, division } = _anioDivision(est);
      let estadoBadge, estadoCls;
      if (r.pase)        { estadoBadge = `PASE → ${escaparHTML(est.pase?.destino || '')}`; estadoCls = 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'; }
      else if (r.baja)   { estadoBadge = 'BAJA';        estadoCls = 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'; }
      else if (r.cambio) { estadoBadge = 'CAMBIO DIV.'; estadoCls = 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'; }
      else               { estadoBadge = 'ACTIVO';      estadoCls = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'; }

      const tr = document.createElement('tr');
      tr.className = `hover:bg-slate-50 dark:hover:bg-slate-700/30 border-b dark:border-slate-700 transition-colors text-slate-700 dark:text-slate-200 ${r.baja ? 'opacity-70' : ''}`;
      tr.innerHTML = `
        <td class="px-3 py-1.5 align-middle font-bold text-slate-800 dark:text-slate-100">${escaparHTML(est.apellido)}<span class="text-blue-600 font-normal">${apodoStr}</span></td>
        <td class="px-3 py-1.5 align-middle">${escaparHTML(est.nombre)}${est.dni ? `<span class="ml-1 text-[9px] font-mono text-slate-400">${escaparHTML(est.dni)}</span>` : ''}${notasStr}</td>
        <td class="px-3 py-1.5 align-middle text-slate-600 dark:text-slate-300 font-semibold">${escaparHTML(anio) || '—'}</td>
        <td class="px-3 py-1.5 align-middle font-semibold text-slate-700 dark:text-slate-200">${escaparHTML(division) || '—'}${r.cambio ? `<div class="flex flex-wrap gap-0.5 mt-1">${materiasHtml}</div>` : ''}</td>
        <td class="px-3 py-1.5 align-middle"><span class="text-[9px] px-1.5 py-0.5 rounded font-black uppercase whitespace-nowrap ${estadoCls}">${estadoBadge}</span></td>
        <td class="px-3 py-1.5 text-right align-middle">
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
    } else if (!block.querySelector('.cb-materia:checked')) {
      // Solo ocultar bloques SIN inscripción. Los de divisiones previas quedan visibles
      // para poder registrar su baja tras un cambio de división.
      block.classList.add('hidden');
    }
  });

  txtResumen.innerText = `División actual: ${div} (${countMats} asignaturas)`;
  _sincronizarGlobales();
}

export function _sincronizarGlobales() {
  const globalGrupo  = document.getElementById('formGrupoGlobal').value;
  const globalEstado = document.getElementById('formEstadoGlobal').value;
  const divSel = document.getElementById('formDivisionPrimaria').value;

  // Aplicar los valores globales SOLO al bloque de la división seleccionada, para no pisar
  // el estado/fecha de baja de divisiones previas que estén visibles.
  const bloque = document.querySelector(`.division-block[data-division="${divSel}"]`);
  if (!bloque) return;
  bloque.querySelectorAll('.group-materia-row').forEach(row => {
    if (row.querySelector('.cb-materia').checked) {
      row.querySelector('.sel-grupo-materia').value  = globalGrupo;
      row.querySelector('.sel-estado-materia').value = globalEstado;
    }
  });
}

// Marca todas las materias de una división como BAJA con la fecha de hoy (para registrar
// que el alumno dejó esa división al cambiarse a otra).
export function _marcarBajaDivision(div) {
  const hoy = new Date().toISOString().split('T')[0];
  const bloque = document.querySelector(`.division-block[data-division="${div}"]`);
  if (!bloque) return;
  bloque.querySelectorAll('.group-materia-row').forEach(row => {
    const cb = row.querySelector('.cb-materia');
    if (!cb.checked) return;
    row.querySelector('.sel-estado-materia').value = 'BAJA';
    const selHasta = row.querySelector('.sel-hasta-materia');
    if (!selHasta.value) selHasta.value = hoy;
    row.querySelector('.sel-inscripcion-details')?.classList.remove('hidden');
  });
  window.app.showToast?.(`Materias de ${div} marcadas como BAJA (${hoy}). Revisá la fecha si corresponde otra.`, 'info');
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
  document.getElementById('formEmail').value = '';
  document.getElementById('formFechaNacimiento').value = '';
  document.getElementById('formIdMiescuela').value = '';
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
    block.className = 'division-block hidden mb-2 rounded-lg overflow-hidden border dark:border-slate-700';
    block.dataset.division = div;

    // Encabezado para distinguir bloques cuando hay varias divisiones visibles (cambios de división)
    const header = document.createElement('div');
    header.className = 'flex items-center justify-between bg-slate-100 dark:bg-slate-700/50 px-2 py-1.5';
    header.innerHTML = `
      <span class="text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-wide"><i class="ph ph-chalkboard-simple"></i> ${escaparHTML(div)}</span>
      <button type="button" onclick="app._marcarBajaDivision('${escaparHTML(div)}')" class="text-[10px] font-bold text-red-600 dark:text-red-400 hover:underline flex items-center gap-1" title="Marcar baja de esta división con la fecha de hoy"><i class="ph ph-sign-out"></i> Dar de baja</button>`;
    block.appendChild(header);

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
    document.getElementById('formEmail').value          = alumno.email || "";
    document.getElementById('formFechaNacimiento').value = alumno.fecha_nacimiento || "";
    document.getElementById('formIdMiescuela').value    = alumno.id_miescuela || "";
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

      // Mostrar TODOS los bloques donde el alumno tiene (o tuvo) materias, para poder editar
      // la baja de divisiones anteriores. Antes solo se veía la división primaria → no se podía
      // registrar la baja de una división intermedia tras un segundo cambio.
      let divisionesVisibles = 0;
      document.querySelectorAll('.division-block').forEach(block => {
        const tieneMarcadas = block.querySelector('.cb-materia:checked');
        if (block.dataset.division === divPrincipal || tieneMarcadas) {
          block.classList.remove('hidden');
          divisionesVisibles++;
        } else {
          block.classList.add('hidden');
        }
      });
      const extra = divisionesVisibles > 1 ? ` (+${divisionesVisibles - 1} división(es) previa(s) visibles para editar bajas)` : '';
      document.getElementById('txtResumenDivision').innerText = `División actual: ${divPrincipal}${extra}`;
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
  const email            = document.getElementById('formEmail').value.trim();
  const fecha_nacimiento = document.getElementById('formFechaNacimiento').value.trim();
  const id_miescuela     = document.getElementById('formIdMiescuela').value.trim();
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
      apellido, nombre, apodo, dni, email, fecha_nacimiento, id_miescuela, notas, planEstudio,
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
    const [snap, snapAsist, snapEval] = await Promise.all([
      getDocs(collection(db, getPath('estudiantes'))),
      getDocs(collection(db, getPath('asistencias'))),
      getDocs(collection(db, getPath('evaluaciones'))),
    ]);

    // Conteo de marcas de asistencia reales y planillas de notas por alumno
    const asistPorId = new Map(), evalPorId = new Map();
    snapAsist.forEach(d => {
      const regs = d.data().registros || {};
      Object.entries(regs).forEach(([aid, m]) => {
        if (m !== undefined && m !== null && m !== '' && m !== '-') asistPorId.set(aid, (asistPorId.get(aid) || 0) + 1);
      });
    });
    snapEval.forEach(d => { const aid = d.data().alumnoId; if (aid) evalPorId.set(aid, (evalPorId.get(aid) || 0) + 1); });

    snap.forEach(d => fusionState.todosAlumnos.push({
      id: d.id, ...d.data(),
      _nAsist: asistPorId.get(d.id) || 0,
      _nEval:  evalPorId.get(d.id) || 0,
    }));
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
        <div class="p-2 border-b dark:border-slate-700 text-xs hover:bg-orange-50 dark:hover:bg-slate-700 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span class="font-bold text-slate-800 dark:text-slate-200">${escaparHTML(a.apellido)}, ${escaparHTML(a.nombre)}</span>
          ${a.dni ? `<span class="text-slate-400 font-mono text-[10px]">${escaparHTML(a.dni)}</span>` : ''}
          <span class="text-[10px] font-bold text-blue-600 dark:text-blue-400" title="Asistencias"><i class="ph ph-calendar-check"></i> ${a._nAsist || 0}</span>
          <span class="text-[10px] font-bold text-purple-600 dark:text-purple-400" title="Notas"><i class="ph ph-exam"></i> ${a._nEval || 0}</span>
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
  const box = document.getElementById(`fusion${rol.charAt(0).toUpperCase() + rol.slice(1)}`);
  box.classList.remove('items-center', 'justify-center', 'italic');
  const materias = (alumno.materias || [alumno.curso]).filter(Boolean);
  box.innerHTML = `
    <div class="text-left not-italic w-full">
      <p class="font-bold text-slate-800 dark:text-slate-100 break-words">${escaparHTML(alumno.apellido)}, ${escaparHTML(alumno.nombre)}</p>
      ${alumno.dni ? `<p class="text-slate-500 dark:text-slate-400 font-mono text-[11px]">DNI: ${escaparHTML(alumno.dni)}</p>` : ''}
      <div class="flex gap-3 mt-1.5 mb-1">
        <span class="text-[11px] font-bold text-blue-600 dark:text-blue-400"><i class="ph ph-calendar-check"></i> ${alumno._nAsist || 0} asist.</span>
        <span class="text-[11px] font-bold text-purple-600 dark:text-purple-400"><i class="ph ph-exam"></i> ${alumno._nEval || 0} notas</span>
      </div>
      <p class="text-indigo-600 dark:text-indigo-400 text-[10px] break-words" title="${escaparHTML(materias.join(', '))}">${materias.slice(0, 4).map(escaparHTML).join(', ')}${materias.length > 4 ? ` +${materias.length - 4}` : ''}</p>
      <p class="text-slate-400 text-[9px] mt-1 font-mono truncate">ID: ${escaparHTML(alumno.id)}</p>
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
    <p class="text-amber-700 dark:text-amber-400 mt-2 text-xs">💡 El PRIMARIO conserva el nombre. Elegí como primario al del nombre correcto. Notas, asistencias y datos del secundario se traspasan sin pisar los del primario.</p>
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

    const _marcaReal = v => v !== undefined && v !== null && v !== '' && v !== '-';

    const snapAsistencias = await getDocs(collection(db, getPath('asistencias')));
    let reescriturasAsistencias = 0;
    const conflictosAsistencia = [];   // mismo día/clase con marca distinta en ambos nombres

    snapAsistencias.forEach(docSnap => {
      const data = docSnap.data();
      if (data.registros && data.registros[secundario.id] !== undefined) {
        const nuevosRegistros = { ...data.registros };
        const marcaP = nuevosRegistros[primario.id];
        const marcaS = nuevosRegistros[secundario.id];

        if (!_marcaReal(marcaP) && _marcaReal(marcaS)) {
          // Primario sin marca ese día → toma la del secundario
          nuevosRegistros[primario.id] = marcaS;
        } else if (_marcaReal(marcaP) && _marcaReal(marcaS) && marcaP !== marcaS) {
          // Conflicto: ambos con marca distinta el mismo día/clase → conserva primario, registra el choque
          conflictosAsistencia.push(`${data.curso || '?'} ${data.fecha || '?'}: primario "${marcaP}" vs secundario "${marcaS}"`);
        }
        // Si primario ya tiene marca (igual o ganadora), se conserva. En todos los casos se borra el secundario.
        delete nuevosRegistros[secundario.id];
        addOperation('update', docSnap.ref, { registros: nuevosRegistros });
        reescriturasAsistencias++;
      }
    });

    // Valor presente = no vacío ni marcador '-'. El primario (nombre válido) gana; el secundario rellena huecos.
    const _presente = v => v !== undefined && v !== null && String(v).trim() !== '' && String(v).trim() !== '-';

    // Notas ya existentes del primario, para no pisarlas al traer las del secundario.
    const primEvals = new Map();
    const snapPrimEvals = await getDocs(query(collection(db, getPath('evaluaciones')), where('alumnoId', '==', primario.id)));
    snapPrimEvals.forEach(d => primEvals.set(d.id, d.data()));

    let reescriturasEvaluaciones = 0;
    const qEvals = query(collection(db, getPath('evaluaciones')), where('alumnoId', '==', secundario.id));
    const snapEvals = await getDocs(qEvals);

    snapEvals.forEach(docSnap => {
      const data = docSnap.data();
      const materia = data.materia || '';
      const newDocId = `${primario.id}_${materia.replace(/[\s/]+/g, '')}`;
      const newRef = doc(db, getPath('evaluaciones'), newDocId);

      // Merge campo a campo: arranca del secundario, y todo campo con valor en el primario gana.
      const existing = primEvals.get(newDocId) || {};
      const merged = { ...data, ...Object.fromEntries(Object.entries(existing).filter(([, v]) => _presente(v))) };
      merged.alumnoId = primario.id;
      merged.materia = materia || existing.materia || '';

      addOperation('set', newRef, merged);
      if (docSnap.ref.id !== newDocId) addOperation('delete', docSnap.ref);
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

    // Identidad: el primario (nombre válido) manda; el secundario solo rellena lo que falte.
    const _fill = (a, b) => (_presente(a) ? a : (b || ''));
    addOperation('update', doc(db, getPath('estudiantes'), primario.id), {
      materias: materiasUnidas,
      curso: primario.curso || materiasUnidas[0] || '',
      dni:              _fill(primario.dni, secundario.dni),
      email:            _fill(primario.email, secundario.email),
      fecha_nacimiento: _fill(primario.fecha_nacimiento, secundario.fecha_nacimiento),
      id_miescuela:     _fill(primario.id_miescuela, secundario.id_miescuela),
      apodo:            _fill(primario.apodo, secundario.apodo),
      notas:            _fill(primario.notas, secundario.notas),
      planEstudio:      _fill(primario.planEstudio, secundario.planEstudio),
      grupos: gruposUnidos,
      inscripciones: inscripcionesUnidas
    });
    addOperation('delete', doc(db, getPath('estudiantes'), secundario.id));
    
    await commitBatches();

    window.app.invalidarCacheBI?.();
    showToast(`✅ Fusión completada. Asistencias: ${reescriturasAsistencias} | Evaluaciones: ${reescriturasEvaluaciones}`);
    if (conflictosAsistencia.length > 0) {
      console.warn('[Fusión] Conflictos de asistencia (se conservó la marca del primario):', conflictosAsistencia);
      showToast(`⚠️ ${conflictosAsistencia.length} día(s) con marca distinta en ambos nombres: se conservó la del primario. Detalle en consola (F12).`, 'error');
    }
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
          || window.app._grillaData?.alumnos?.find(a => a.id === uid)
          || window.app._evalAlumnos?.find(a => a.id === uid);

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
    const esAdmin = window.app.currentUser?.rolActivo === 'ADMIN' || window.app.currentUser?.rolActivo === 'SUPERADMIN';
    // El pase es una acción de administración de MATRÍCULA. No mostrarlo cuando el perfil
    // se abre desde Calificaciones o Asistencia.
    const enMatricula = !document.getElementById('gestionAlumnos')?.classList.contains('hidden');
    if (esAdmin && enMatricula) {
      btnPase.style.display = 'flex';
      btnPase.classList.remove('hidden');
      btnPase.onclick = () => app.emitirPase(uid);
    } else {
      btnPase.style.display = 'none';
      btnPase.classList.add('hidden');
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
    const fPresente = [], fAusente = [], fJustif = [];
    snap.forEach(d => {
      const data = d.data();
      if (!['CLASE','CLASES REGULARES','Migrada',undefined].includes(data.tipoClase)) return;
      const marca = data.registros?.[uid];
      const f = formatISOToDisplay(data.fecha) || data.fecha;
      if      (marca === 'P')   { p++;   fPresente.push(f); }
      else if (marca === 'A')   { a++;   fAusente.push(f); }
      else if (marca === 'ACP') { acp++; fJustif.push(f); }
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

    // Detalle de fechas
    const chips = (fechas, cls) => fechas.length
      ? fechas.map(f => `<span class="inline-block text-[10px] px-1.5 py-0.5 rounded ${cls} mr-1 mb-1 font-mono">${escaparHTML(f)}</span>`).join('')
      : '<span class="text-xs text-slate-400 italic">—</span>';
    const det = document.getElementById('perfilDetalleFechas');
    if (det) {
      det.innerHTML = `
        <div class="space-y-2">
          <details open><summary class="cursor-pointer text-xs font-bold text-red-600 dark:text-red-400 select-none">Ausentes (${a})</summary><div class="mt-1.5">${chips(fAusente, 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300')}</div></details>
          <details><summary class="cursor-pointer text-xs font-bold text-amber-600 dark:text-amber-400 select-none">Justificadas (${acp})</summary><div class="mt-1.5">${chips(fJustif, 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300')}</div></details>
          <details><summary class="cursor-pointer text-xs font-bold text-emerald-600 dark:text-emerald-400 select-none">Presentes (${p})</summary><div class="mt-1.5">${chips(fPresente, 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300')}</div></details>
        </div>`;
    }
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
      const fbdb = (await import("./firebase-config.js?v=10.77")).db;
      const { getPath } = await import("./firebase-config.js?v=10.77");
      
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
    const fbdb = (await import("./firebase-config.js?v=10.77")).db;
    const { appId } = await import("./firebase-config.js?v=10.77");

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
    const hoy = new Date().toISOString().split('T')[0];

    // 1) Copia al destino, arrancando activo y con asistencia limpia (asistencias viven aparte).
    const dataDestino = { ...data, fechaPase: new Date().toISOString(), escuelaOrigen: window.app.currentTenant, estado: 'ACTIVO' };
    delete dataDestino.pase;
    await setDoc(newRef, dataDestino);

    // 2) En ORIGEN no se borra: se marca BAJA por pase, cerrando todas las inscripciones con
    //    fecha de hoy. Así el alumno sale de listas/cálculos activos pero conserva su historial
    //    de divisiones (asistencias/notas previas siguen vinculadas por su id).
    const inscCerradas = {};
    Object.entries(data.inscripciones || {}).forEach(([mat, arr]) => {
      const historial = Array.isArray(arr) ? [...arr] : [];
      const ultimo = historial.length ? { ...historial[historial.length - 1] } : { grupo: 'GENERAL', desde: '' };
      ultimo.estado = 'BAJA';
      if (!ultimo.hasta) ultimo.hasta = hoy;
      inscCerradas[mat] = historial.length ? [...historial.slice(0, -1), ultimo] : [ultimo];
    });

    await setDoc(oldRef, {
      estado: 'BAJA',
      pase: { destino, fecha: hoy },
      inscripciones: inscCerradas,
    }, { merge: true });

    window.app.showToast(`Pase emitido a ${destino}. Queda registrado como BAJA por pase.`, "success");
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
