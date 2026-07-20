import { db, getPath, appId } from "./firebase-config.js?v=10.80";
import { collection, getDocs, writeBatch, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { showToast } from "./ui.js?v=10.80";
import { escaparHTML } from "./utils.js?v=10.80";

let datosAuditoria = {
  materiasOficiales: [],
  estudiantesConProblemas: []
};

// Escuela sobre la que operan Comparador y Detector de duplicados. Vacío = contexto actual (getPath).
// Necesario porque estas herramientas viven en auditoríaTab (contexto root, sin datos operativos).
let _auditTenant = '';
export function setAuditTenant(sel) {
  _auditTenant = (sel && sel.value) || '';
  showToast(_auditTenant ? `Herramientas operando sobre "${_auditTenant}"` : 'Herramientas usando contexto actual', 'info');
}
function _auditPath(col) {
  return _auditTenant ? _tenantColPath(_auditTenant, col) : getPath(col);
}
// Pobla un <select> de escuelas para las herramientas (llamado desde el HTML al abrir Auditoría).
export async function poblarSelectorAuditoria() {
  if (window.app.currentUser?.rolActivo !== 'SUPERADMIN') return;
  const sel = document.getElementById('auditEscuelaSelector');
  if (!sel) return;
  try {
    const snap = await getDocs(collection(db, getPath('escuelas')));
    const opts = snap.docs.map(d => `<option value="${escaparHTML(d.id)}"${d.id === _auditTenant ? ' selected' : ''}>${escaparHTML(d.data().nombre || d.id)}</option>`).join('');
    sel.innerHTML = `<option value="">— Contexto actual —</option>${opts}`;
  } catch(e) { console.error(e); }
}

export async function iniciarAuditoriaDatos() {
  const progresoMsg = document.getElementById('auditoriaProgresoMsg');
  const progreso = document.getElementById('auditoriaProgreso');
  const resultados = document.getElementById('auditoriaResultados');
  
  progreso.classList.remove('hidden');
  resultados.classList.add('hidden');
  resultados.innerHTML = '';
  
  try {
    progresoMsg.textContent = "Leyendo materias oficiales...";
    const snapMaterias = await getDocs(collection(db, getPath("materias")));
    const materias = [];
    snapMaterias.forEach(d => {
      const m = d.data();
      const nombreCompleto = m.nombre; 
      materias.push({ id: d.id, nombreCompleto, ...m });
    });
    datosAuditoria.materiasOficiales = materias.sort((a,b) => a.nombreCompleto.localeCompare(b.nombreCompleto));
    
    progresoMsg.textContent = "Analizando estudiantes y sus materias inscritas...";
    const snapEstudiantes = await getDocs(collection(db, getPath("estudiantes")));
    const estudiantes = [];
    snapEstudiantes.forEach(d => estudiantes.push({ id: d.id, ...d.data() }));
    
    const materiasOficialesNombres = new Set(materias.map(m => m.nombreCompleto));
    
    const huerfanos = {}; // Materia String -> Array de alumnos
    
    estudiantes.forEach(est => {
      if (est.materias && Array.isArray(est.materias)) {
        est.materias.forEach(mat => {
          if (!materiasOficialesNombres.has(mat)) {
            if (!huerfanos[mat]) huerfanos[mat] = { estudiantes: [], asistencias: 0, evaluaciones: 0 };
            huerfanos[mat].estudiantes.push(est);
          }
        });
      }
    });

    progresoMsg.textContent = "Analizando asistencias y evaluaciones...";
    const [snapAsist, snapEval] = await Promise.all([
      getDocs(collection(db, getPath("asistencias"))),
      getDocs(collection(db, getPath("evaluaciones")))
    ]);

    snapAsist.forEach(d => {
      const data = d.data();
      if (data.curso && !materiasOficialesNombres.has(data.curso)) {
        if (!huerfanos[data.curso]) huerfanos[data.curso] = { estudiantes: [], asistencias: 0, evaluaciones: 0 };
        huerfanos[data.curso].asistencias++;
      }
    });

    snapEval.forEach(d => {
      const data = d.data();
      if (data.curso && !materiasOficialesNombres.has(data.curso)) {
        if (!huerfanos[data.curso]) huerfanos[data.curso] = { estudiantes: [], asistencias: 0, evaluaciones: 0 };
        huerfanos[data.curso].evaluaciones++;
      }
    });

    progreso.classList.add('hidden');
    resultados.classList.remove('hidden');
    
    const cantHuerfanas = Object.keys(huerfanos).length;
    
    if (cantHuerfanas === 0) {
      resultados.innerHTML = `<div class="bg-emerald-50 text-emerald-700 p-4 rounded-lg font-bold flex items-center gap-2 border border-emerald-200">
        <i class="ph ph-check-circle text-2xl"></i> ¡Base de datos limpia! Todos los estudiantes están inscritos a materias oficiales.
      </div>`;
      return;
    }
    
    let html = `
      <div class="bg-amber-50 text-amber-800 p-4 rounded-lg font-semibold flex items-center gap-2 border border-amber-200">
        <i class="ph ph-warning text-2xl"></i> Se encontraron ${cantHuerfanas} materias/divisiones inscritas que NO existen en la base oficial.
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm text-left border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
          <thead class="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
            <tr>
              <th class="p-3 font-bold">Materia Huérfana (String viejo)</th>
              <th class="p-3 font-bold text-center">Registros Afectados</th>
              <th class="p-3 font-bold">Mapear a Materia Oficial...</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200 dark:divide-slate-700">
    `;
    
    const grupos = {};
    datosAuditoria.materiasOficiales.forEach(m => {
      const c = m.planEstudio || 'Sin Año';
      if (!grupos[c]) grupos[c] = [];
      grupos[c].push(m);
    });

    let opcionesOficiales = '';
    Object.keys(grupos).sort().forEach(anio => {
      opcionesOficiales += `<optgroup label="Año / Nivel: ${anio}">`;
      grupos[anio].forEach(m => {
        const divStr = m.division ? ` | Div: ${m.division}` : '';
        const matBase = m.materiaBase || m.nombre;
        opcionesOficiales += `<option value="${m.nombreCompleto}">${matBase}${divStr}</option>`;
      });
      opcionesOficiales += `</optgroup>`;
    });
    
    Object.keys(huerfanos).sort().forEach(matVieja => {
      html += `
        <tr class="bg-white dark:bg-slate-900">
          <td class="p-3 font-bold text-rose-600 dark:text-rose-400">
            "${matVieja}"
            <div class="mt-2 text-xs font-normal text-slate-500 dark:text-slate-400">
              <b>Alumnos (${huerfanos[matVieja].estudiantes.length}):</b> 
              ${huerfanos[matVieja].estudiantes.slice(0, 5).map(e => `${e.apellido}, ${e.nombre}`).join(' &bull; ')}${huerfanos[matVieja].estudiantes.length > 5 ? '... y más' : ''}
              <br>
              <b>Asistencias:</b> ${huerfanos[matVieja].asistencias} planillas | <b>Evaluaciones:</b> ${huerfanos[matVieja].evaluaciones} registros
            </div>
          </td>
          <td class="p-3 text-center font-mono bg-slate-50 dark:bg-slate-800/50">
            Est: ${huerfanos[matVieja].estudiantes.length}<br>
            Asi: ${huerfanos[matVieja].asistencias}<br>
            Eva: ${huerfanos[matVieja].evaluaciones}
          </td>
          <td class="p-3">
            <select data-vieja="${matVieja}" class="sel-mapeo-materia w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 dark:text-slate-200">
              <option value="">-- Ignorar (No cambiar) --</option>
              ${opcionesOficiales}
            </select>
          </td>
        </tr>
      `;
    });
    
    html += `
          </tbody>
        </table>
      </div>
      
      <div class="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 p-4 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
        <div>
          <h4 class="font-bold text-indigo-800 dark:text-indigo-400">Paso 2: Migrar Base de Datos</h4>
          <p class="text-xs text-indigo-600 dark:text-indigo-500 mt-1">Se generará un archivo de backup automáticamente antes de aplicar los cambios en la nube.</p>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="app.simularMigracionAuditoria()" class="bg-white text-indigo-600 border border-indigo-200 px-4 py-2.5 rounded-lg font-bold hover:bg-indigo-50 transition flex items-center gap-2 whitespace-nowrap shadow-sm">
            <i class="ph ph-magic-wand"></i> Test (Log)
          </button>
          <button onclick="app.ejecutarMigracionAuditoria()" class="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-indigo-700 transition flex items-center gap-2 whitespace-nowrap shadow-sm">
            <i class="ph ph-database"></i> Ejecutar Migración
          </button>
        </div>
      </div>
    `;
    
    resultados.innerHTML = html;
    
  } catch (err) {
    console.error(err);
    resultados.innerHTML = `<div class="bg-red-50 text-red-700 p-4 rounded-lg font-bold">Error: ${err.message}</div>`;
    resultados.classList.remove('hidden');
    progreso.classList.add('hidden');
  }
}

export function simularMigracionAuditoria() {
  const selects = document.querySelectorAll('.sel-mapeo-materia');
  const mapa = {};
  let cambios = 0;
  
  selects.forEach(sel => {
    if (sel.value) {
      mapa[sel.dataset.vieja] = sel.value;
      cambios++;
    }
  });
  
  if (cambios === 0) {
    showToast('No seleccionaste ningún reemplazo.', 'error');
    return;
  }

  showToast(`${cambios} reemplazo(s) definidos. Revisá la consola y luego ejecutá la migración.`, 'info');
  console.log("Mapa de migración (simulación):", mapa);
}

export async function ejecutarMigracionAuditoria() {
  const selects = document.querySelectorAll('.sel-mapeo-materia');
  const mapa = {};
  let cambios = 0;
  
  selects.forEach(sel => {
    if (sel.value) {
      mapa[sel.dataset.vieja] = sel.value;
      cambios++;
    }
  });
  
  if (cambios === 0) {
    showToast('No seleccionaste ningún reemplazo.', 'error');
    return;
  }
  
  const confirmar = await window.app.showConfirm("Confirmación", `Vas a migrar ${cambios} strings huérfanos.\n\nFase 3: Se descargará un Backup en formato JSON automáticamente.\nFase 4: Se actualizarán los estudiantes, asistencias y evaluaciones afectados.\n\n¿Deseas continuar?`);
  if (!confirmar) return;
  
  const progresoMsg = document.getElementById('auditoriaProgresoMsg');
  const progreso = document.getElementById('auditoriaProgreso');
  const resultados = document.getElementById('auditoriaResultados');
  
  progreso.classList.remove('hidden');
  resultados.classList.add('hidden');
  
  try {
    // FASE 3: BACKUP
    progresoMsg.textContent = "⏳ Fase 3: Generando Backup de las colecciones...";
    const [snapEst, snapAsist, snapEval] = await Promise.all([
      getDocs(collection(db, getPath('estudiantes'))),
      getDocs(collection(db, getPath('asistencias'))),
      getDocs(collection(db, getPath('evaluaciones')))
    ]);
    
    const backup = { 
      fecha: new Date().toISOString(), 
      mapaAplicado: mapa,
      estudiantes: {}, asistencias: {}, evaluaciones: {} 
    };
    snapEst.forEach(d => backup.estudiantes[d.id] = d.data());
    snapAsist.forEach(d => backup.asistencias[d.id] = d.data());
    snapEval.forEach(d => backup.evaluaciones[d.id] = d.data());
    
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_asistencia_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // FASE 4: MIGRACION ATOMICA (En bloques de 400 para evitar límite de Firebase)
    progresoMsg.textContent = "🚀 Fase 4: Ejecutando actualizaciones en la nube...";
    let operaciones = [];
    
    const chunkPromises = async (ops) => {
      const CHUNK_SIZE = 400;
      for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
        const batch = writeBatch(db);
        const chunk = ops.slice(i, i + CHUNK_SIZE);
        chunk.forEach(op => {
          if (op.type === 'update') batch.update(op.ref, op.data);
          else if (op.type === 'set') batch.set(op.ref, op.data, op.options);
          else if (op.type === 'delete') batch.delete(op.ref);
        });
        await batch.commit();
      }
    };
    
    // 1. Estudiantes
    snapEst.forEach(d => {
      const data = d.data();
      let modificado = false;
      const updates = {};
      
      if (data.materias && Array.isArray(data.materias)) {
        const nuevasMateriasSet = new Set();
        data.materias.forEach(m => {
          if (mapa[m]) {
            modificado = true;
            nuevasMateriasSet.add(mapa[m]);
          } else {
            nuevasMateriasSet.add(m);
          }
        });
        if (modificado) updates.materias = Array.from(nuevasMateriasSet);
      }
      
      // Se elimina la reasignación de data.curso para evitar sobreescribir la División del alumno con una Materia.
      if (data.inscripciones) {
        let inscripModificadas = false;
        const nuevasInscripciones = {};
        for (const [key, val] of Object.entries(data.inscripciones)) {
          if (mapa[key]) {
            inscripModificadas = true;
            nuevasInscripciones[mapa[key]] = val;
          } else {
            nuevasInscripciones[key] = val;
          }
        }
        if (inscripModificadas) {
          modificado = true;
          updates.inscripciones = nuevasInscripciones;
        }
      }
      
      if (data.grupos) {
        let gruposModificados = false;
        const nuevosGrupos = {};
        for (const [key, val] of Object.entries(data.grupos)) {
          if (mapa[key]) {
            gruposModificados = true;
            nuevosGrupos[mapa[key]] = val;
          } else {
            nuevosGrupos[key] = val;
          }
        }
        if (gruposModificados) {
          modificado = true;
          updates.grupos = nuevosGrupos;
        }
      }
      
      if (modificado) {
        operaciones.push({ type: 'update', ref: d.ref, data: updates });
      }
    });
    
    // 2. Asistencias
    snapAsist.forEach(d => {
      const data = d.data();
      if (mapa[data.curso]) {
        const matNueva = mapa[data.curso];
        const nuevoDocId = `${matNueva.replace(/[\s/]+/g, '')}_${data.fecha}`;
        const nuevaRef = doc(db, getPath('asistencias'), nuevoDocId);
        
        // merge: true por si ya habia un documento ese mismo dia para la materia oficial
        operaciones.push({ type: 'set', ref: nuevaRef, data: { ...data, curso: matNueva }, options: { merge: true } });
        // Borramos el documento viejo con el string huérfano
        operaciones.push({ type: 'delete', ref: d.ref });
      }
    });
    
    // 3. Evaluaciones
    snapEval.forEach(d => {
      const data = d.data();
      if (mapa[data.curso]) {
        const matNueva = mapa[data.curso];
        const nuevoDocId = `${data.alumnoId}_${matNueva.replace(/[\s/]+/g, '')}`;
        const nuevaRef = doc(db, getPath('evaluaciones'), nuevoDocId);
        
        operaciones.push({ type: 'set', ref: nuevaRef, data: { ...data, curso: matNueva }, options: { merge: true } });
        operaciones.push({ type: 'delete', ref: d.ref });
      }
    });
    
    await chunkPromises(operaciones);
    showToast('🎉 ¡Migración completada con éxito!', 'success');
    
    // Refrescar para ver resultados vacíos
    iniciarAuditoriaDatos();
    
  } catch(e) {
    console.error(e);
    showToast('Error en la migración: ' + e.message, 'error');
    resultados.classList.remove('hidden');
    progreso.classList.add('hidden');
  }
}

// ==========================================
// INTEGRIDAD DE ESTUDIANTES
// ==========================================

let _planIntegridad = null;

export async function analizarIntegridadEstudiantes() {
  const progreso = document.getElementById('integridadProgreso');
  const resultados = document.getElementById('integridadResultados');
  const msg = document.getElementById('integridadProgresoMsg');
  const btn = document.getElementById('btnAnalizarIntegridad');

  if (progreso) progreso.classList.remove('hidden');
  if (resultados) resultados.classList.add('hidden');
  if (btn) btn.disabled = true;

  try {
    msg.textContent = 'Obteniendo materias oficiales...';
    const snapMat = await getDocs(collection(db, getPath('materias')));
    const materiasOficiales = {};
    const divisionesEstructura = {};

    snapMat.forEach(d => {
      const mat = d.data();
      materiasOficiales[mat.nombre] = mat;
      if (mat.division) {
        if (!divisionesEstructura[mat.division]) divisionesEstructura[mat.division] = [];
        divisionesEstructura[mat.division].push(mat.nombre);
      }
    });

    msg.textContent = 'Analizando legajos de estudiantes...';
    const snapEst = await getDocs(collection(db, getPath('estudiantes')));
    
    const anomalias = [];
    const planMigracion = {};

    const hoyFmt = new Date().toISOString().split('T')[0];

    snapEst.forEach(d => {
      const data = d.data();
      const id = d.id;
      let tieneAnomalias = false;
      const reporte = [];
      const estudianteUpdates = {
        materias: [...(data.materias || [])],
        inscripciones: JSON.parse(JSON.stringify(data.inscripciones || {}))
      };

      const cursoPrimario = data.curso;
      if (!cursoPrimario || !divisionesEstructura[cursoPrimario]) {
        if (data.estado === 'ACTIVO') {
          tieneAnomalias = true;
          reporte.push(`El curso primario '${cursoPrimario}' no existe en la estructura de la escuela.`);
        }
      } else {
        // Regla: Si está activo, debe tener TODAS las materias del curso primario en su array de materias, 
        // y con estado ACTIVO en inscripciones.
        const materiasEsperadas = divisionesEstructura[cursoPrimario];
        if (data.estado === 'ACTIVO') {
          materiasEsperadas.forEach(matEsperada => {
            if (!estudianteUpdates.materias.includes(matEsperada)) {
              estudianteUpdates.materias.push(matEsperada);
              tieneAnomalias = true;
              reporte.push(`Falta agregar la materia '${matEsperada}' correspondiente a su división '${cursoPrimario}'.`);
            }
            
            const inscrip = estudianteUpdates.inscripciones[matEsperada] || [];
            const isActivo = inscrip.length > 0 && inscrip[inscrip.length - 1].estado === 'ACTIVO';
            if (!isActivo) {
              estudianteUpdates.inscripciones[matEsperada] = inscrip;
              estudianteUpdates.inscripciones[matEsperada].push({
                estado: 'ACTIVO',
                desde: data.fechaIngreso || hoyFmt,
                hasta: ''
              });
              tieneAnomalias = true;
              reporte.push(`Se debe activar la inscripción en '${matEsperada}'.`);
            }
          });
        }
      }

      // Regla: Materias que NO pertenecen al curso primario (divisiones viejas),
      // deben estar dadas de baja.
      if (data.estado === 'ACTIVO' && cursoPrimario) {
        const materiasEsperadas = divisionesEstructura[cursoPrimario] || [];
        // Chequeamos el array actual
        const materiasParaRemover = [];
        estudianteUpdates.materias.forEach(matMapeada => {
          if (!materiasEsperadas.includes(matMapeada)) {
            materiasParaRemover.push(matMapeada);
            tieneAnomalias = true;
            reporte.push(`La materia '${matMapeada}' no pertenece a '${cursoPrimario}' y será removida de sus activas.`);
            
            // Cerrar historial
            if (estudianteUpdates.inscripciones[matMapeada]) {
              const hist = estudianteUpdates.inscripciones[matMapeada];
              if (hist.length > 0 && hist[hist.length-1].estado === 'ACTIVO') {
                hist[hist.length-1].estado = 'CAMBIO DE DIVISIÓN';
                if (!hist[hist.length-1].hasta) hist[hist.length-1].hasta = hoyFmt;
                reporte.push(`Se cerró el historial de '${matMapeada}' con motivo CAMBIO DE DIVISIÓN.`);
              }
            }
          }
        });
        
        // Removemos las no correspondientes
        estudianteUpdates.materias = estudianteUpdates.materias.filter(m => !materiasParaRemover.includes(m));
      }

      if (tieneAnomalias) {
        anomalias.push({
          id,
          nombre: `${data.apellido}, ${data.nombre}`,
          cursoPrimario,
          reporte,
          updates: estudianteUpdates,
          ref: d.ref
        });
        planMigracion[id] = { ref: d.ref, updates: estudianteUpdates };
      }
    });

    _planIntegridad = planMigracion;
    _renderizarResultadosIntegridad(anomalias);

  } catch(e) {
    console.error(e);
    resultados.innerHTML = `<div class="p-4 bg-red-50 text-red-600 rounded">Error: ${e.message}</div>`;
    resultados.classList.remove('hidden');
  } finally {
    if (progreso) progreso.classList.add('hidden');
    if (btn) btn.disabled = false;
  }
}

function _renderizarResultadosIntegridad(anomalias) {
  const container = document.getElementById('integridadResultados');
  container.classList.remove('hidden');

  if (anomalias.length === 0) {
    container.innerHTML = `<div class="p-6 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
      <i class="ph ph-check-circle text-4xl text-emerald-500 mb-2"></i>
      <h3 class="text-lg font-bold text-emerald-800">¡Todo está perfecto!</h3>
      <p class="text-emerald-600">No se encontraron inconsistencias de integridad (divisiones mezcladas o inscripciones abiertas incorrectamente).</p>
    </div>`;
    return;
  }

  let html = `
    <div class="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
      <h4 class="font-bold text-amber-800 flex items-center gap-2"><i class="ph ph-warning-circle text-lg"></i> Se encontraron ${anomalias.length} estudiantes con inconsistencias</h4>
      <p class="text-sm text-amber-700 mt-1">El sistema ha calculado los ajustes necesarios para normalizarlos sin perder el historial.</p>
    </div>
    
    <div class="overflow-x-auto border dark:border-slate-700 rounded-lg">
      <table class="w-full text-left border-collapse">
        <thead>
          <tr class="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs">
            <th class="p-3 border-b dark:border-slate-700">ESTUDIANTE</th>
            <th class="p-3 border-b dark:border-slate-700">DIVISIÓN OFICIAL</th>
            <th class="p-3 border-b dark:border-slate-700">ACCIONES PROPUESTAS</th>
          </tr>
        </thead>
        <tbody class="text-sm">
  `;

  anomalias.forEach(a => {
    html += `
      <tr class="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
        <td class="p-3 font-bold text-slate-800 dark:text-slate-100">${a.nombre}</td>
        <td class="p-3 text-indigo-600 font-semibold">${a.cursoPrimario || 'SIN ASIGNAR'}</td>
        <td class="p-3">
          <ul class="list-disc list-inside text-xs text-slate-600 dark:text-slate-400 space-y-1">
            ${a.reporte.map(r => `<li>${r}</li>`).join('')}
          </ul>
        </td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
    </div>
    
    <div class="flex justify-end mt-4">
      <button onclick="app.ejecutarMigracionIntegridad()" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-6 rounded-lg shadow-md transition flex items-center gap-2">
        <i class="ph ph-magic-wand text-xl"></i> Normalizar Todos Ahora
      </button>
    </div>
  `;
  container.innerHTML = html;
}

export async function ejecutarMigracionIntegridad() {
  if (!_planIntegridad || Object.keys(_planIntegridad).length === 0) return;

  const count = Object.keys(_planIntegridad).length;
  if (!await window.app.showConfirm("Confirmación", `ATENCIÓN: Se actualizarán los legajos de ${count} estudiantes. Se registrará todo en la base de datos de forma atómica para no perder historiales.\n\n¿Estás seguro de continuar?`)) return;

  const container = document.getElementById('integridadResultados');
  container.innerHTML = `<div class="text-center py-8">
    <i class="ph ph-spinner animate-spin text-4xl text-indigo-500 mb-2 block mx-auto"></i>
    <p class="text-sm text-slate-500 font-bold">Aplicando WriteBatch atómico...</p>
  </div>`;

  try {
    const batch = writeBatch(db);
    
    for (const [id, payload] of Object.entries(_planIntegridad)) {
      batch.update(payload.ref, payload.updates);
    }
    
    await batch.commit();
    showToast(`✅ ${count} estudiantes normalizados exitosamente.`, 'success');
    _planIntegridad = null;
    
    // Refrescar
    await analizarIntegridadEstudiantes();
  } catch(e) {
    console.error(e);
    showToast('❌ Error aplicando la migración: ' + e.message, 'error');
    container.innerHTML = `<div class="p-4 bg-red-50 text-red-600 rounded">Error: ${e.message}</div>`;
  }
}

// ==========================================
// ESTRUCTURADOR RELACIONAL (AÑO -> DIVISIÓN)
// ==========================================

let _planEstructura = null;

function inferirAnioDeDivision(division) {
  if (!division) return "";
  const match = division.match(/^(\d[a-zA-Z]{0,2})/); // ej. "1", "1ro", "2do", "3er", "4to"
  if (match) return match[1];
  return "";
}

export async function analizarEstructuraRelacional() {
  const progreso = document.getElementById('estructuraProgreso');
  const resultados = document.getElementById('estructuraResultados');
  const msg = document.getElementById('estructuraProgresoMsg');
  const btn = document.getElementById('btnAnalizarEstructura');

  if (progreso) progreso.classList.remove('hidden');
  if (resultados) resultados.classList.add('hidden');
  if (btn) btn.disabled = true;

  try {
    const planMigracion = { materias: {}, estudiantes: {} };
    const anomalias = [];

    msg.textContent = 'Analizando materias...';
    const snapMat = await getDocs(collection(db, getPath('materias')));
    snapMat.forEach(d => {
      const mat = d.data();
      const division = mat.division || "";
      const anioInferido = inferirAnioDeDivision(division);
      
      let modificar = false;
      const updates = {};
      
      if (anioInferido && mat.planEstudio !== anioInferido) {
        modificar = true;
        updates.planEstudio = anioInferido;
      }
      
      if (!mat.materiaBase && mat.nombre) {
        const idx = mat.nombre.indexOf(' - ');
        if (idx !== -1) {
          modificar = true;
          updates.materiaBase = mat.nombre.substring(idx + 3);
          if (!mat.division) updates.division = mat.nombre.substring(0, idx);
        }
      }
      
      if (modificar) {
        planMigracion.materias[d.id] = { ref: d.ref, updates };
        anomalias.push(`Materia "${mat.nombre}": Se asignará Año = "${updates.planEstudio || mat.planEstudio || '-'}" y Materia Base = "${updates.materiaBase || mat.materiaBase || '-'}"`);
      }
    });

    msg.textContent = 'Analizando estudiantes...';
    const snapEst = await getDocs(collection(db, getPath('estudiantes')));
    snapEst.forEach(d => {
      const est = d.data();
      const rawCurso = est.curso || "";
      const division = rawCurso.indexOf(' - ') > -1 ? rawCurso.split(' - ')[0] : rawCurso;
      const anioInferido = inferirAnioDeDivision(division);
      
      let modificar = false;
      const updates = {};

      if (anioInferido && est.planEstudio !== anioInferido) {
        modificar = true;
        updates.planEstudio = anioInferido;
      }
      if (division && est.curso !== division) {
        modificar = true;
        updates.curso = division;
      }
      
      if (modificar) {
        planMigracion.estudiantes[d.id] = { ref: d.ref, updates };
        anomalias.push(`Estudiante "${est.apellido}, ${est.nombre}": Se asignará Año = "${updates.planEstudio || est.planEstudio || '-'}" y División = "${updates.curso || est.curso || '-'}"`);
      }
    });

    _planEstructura = planMigracion;
    _renderizarResultadosEstructura(anomalias, Object.keys(planMigracion.materias).length, Object.keys(planMigracion.estudiantes).length);

  } catch(e) {
    console.error(e);
    resultados.innerHTML = `<div class="p-4 bg-red-50 text-red-600 rounded">Error: ${e.message}</div>`;
    resultados.classList.remove('hidden');
  } finally {
    if (progreso) progreso.classList.add('hidden');
    if (btn) btn.disabled = false;
  }
}

function _renderizarResultadosEstructura(anomalias, countMat, countEst) {
  const container = document.getElementById('estructuraResultados');
  container.classList.remove('hidden');

  if (countMat === 0 && countEst === 0) {
    container.innerHTML = `<div class="p-6 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
      <i class="ph ph-check-circle text-4xl text-emerald-500 mb-2"></i>
      <h3 class="text-lg font-bold text-emerald-800">¡Estructura Normalizada!</h3>
      <p class="text-emerald-600">Todos los estudiantes y materias ya tienen asignado su Año (planEstudio) correspondiente.</p>
    </div>`;
    return;
  }

  let html = `
    <div class="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-4">
      <h4 class="font-bold text-indigo-800 flex items-center gap-2"><i class="ph ph-tree-structure text-lg"></i> Se actualizarán ${countMat} materias y ${countEst} estudiantes</h4>
      <p class="text-sm text-indigo-700 mt-1">El sistema ha deducido las jerarquías relacionales y está listo para guardarlas.</p>
    </div>
    
    <div class="max-h-60 overflow-y-auto border dark:border-slate-700 rounded-lg p-3 bg-white dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-400 font-mono space-y-1">
      ${anomalias.map(a => `<div>&bull; ${a}</div>`).join('')}
    </div>
    
    <div class="flex justify-end mt-4">
      <button onclick="app.ejecutarMigracionEstructura()" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-6 rounded-lg shadow-md transition flex items-center gap-2">
        <i class="ph ph-magic-wand text-xl"></i> Normalizar Estructura Ahora
      </button>
    </div>
  `;
  container.innerHTML = html;
}

export async function ejecutarMigracionEstructura() {
  if (!_planEstructura) return;

  const count = Object.keys(_planEstructura.materias).length + Object.keys(_planEstructura.estudiantes).length;
  if (!await window.app.showConfirm("Confirmación", `¿Estás seguro de estructurar ${count} registros?`)) return;

  const container = document.getElementById('estructuraResultados');
  container.innerHTML = `<div class="text-center py-8">
    <i class="ph ph-spinner animate-spin text-4xl text-indigo-500 mb-2 block mx-auto"></i>
    <p class="text-sm text-slate-500 font-bold">Aplicando WriteBatch atómico...</p>
  </div>`;

  try {
    const batch = writeBatch(db);
    
    for (const [id, payload] of Object.entries(_planEstructura.materias)) {
      batch.update(payload.ref, payload.updates);
    }
    for (const [id, payload] of Object.entries(_planEstructura.estudiantes)) {
      batch.update(payload.ref, payload.updates);
    }
    
    await batch.commit();
    showToast(`✅ ${count} registros estructurados exitosamente.`, 'success');
    _planEstructura = null;
    
    // Refrescar
    await analizarEstructuraRelacional();
  } catch(e) {
    console.error(e);
    showToast('❌ Error estructurando: ' + e.message, 'error');
    container.innerHTML = `<div class="p-4 bg-red-50 text-red-600 rounded">Error: ${e.message}</div>`;
  }
}

let backupSeleccionado = null;

export async function restaurarBackup(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const backup = JSON.parse(text);

    if (!backup.estudiantes || !backup.asistencias || !backup.evaluaciones) {
      throw new Error("El archivo no tiene el formato de backup válido.");
    }

    backupSeleccionado = backup;
    const resultados = document.getElementById('auditoriaResultados');
    const progreso = document.getElementById('auditoriaProgreso');
    
    progreso.classList.add('hidden');
    resultados.classList.remove('hidden');
    
    // Obtener divisiones únicas del backup
    const divisiones = new Set();
    Object.values(backup.estudiantes).forEach(e => {
      if (e.curso) divisiones.add(e.curso);
    });

    let opcionesHtml = Array.from(divisiones).sort().map(div => `
      <label class="flex items-center gap-2 p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 cursor-pointer">
        <input type="checkbox" class="chk-restore-div w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" value="${div}">
        <span class="text-sm font-bold text-slate-700 dark:text-slate-300">${div}</span>
      </label>
    `).join('');

    resultados.innerHTML = `
      <div class="bg-amber-50 text-amber-800 p-4 rounded-lg font-semibold flex items-center gap-2 border border-amber-200 mb-4">
        <i class="ph ph-warning text-2xl"></i> Backup cargado: ${new Date(backup.fecha).toLocaleString()}. Seleccioná las divisiones que querés restaurar.
      </div>
      
      <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-2">1. Seleccionar Divisiones afectadas:</h3>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6 max-h-60 overflow-y-auto p-2 bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg">
        ${opcionesHtml}
      </div>

      <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-2">2. ¿Qué datos querés restaurar de esas divisiones?</h3>
      <div class="flex flex-col gap-2 mb-6">
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" id="chkRestaurarEstudiantes" checked class="w-4 h-4 text-indigo-600 rounded">
          <span class="text-sm font-medium text-slate-700 dark:text-slate-300"><b>Perfiles de Alumnos</b> (Restaura su división correcta y sus materias, ideal si se arruinó su división).</span>
        </label>
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" id="chkRestaurarAsistencias" class="w-4 h-4 text-indigo-600 rounded">
          <span class="text-sm font-medium text-slate-700 dark:text-slate-300"><b>Planillas de Asistencia</b> (Dejalo destildado si querés conservar las migraciones que hiciste recién).</span>
        </label>
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" id="chkRestaurarEvaluaciones" class="w-4 h-4 text-indigo-600 rounded">
          <span class="text-sm font-medium text-slate-700 dark:text-slate-300"><b>Planillas de Evaluaciones</b> (Dejalo destildado si querés conservar las migraciones).</span>
        </label>
      </div>

      <div class="flex gap-2">
        <button onclick="app.ejecutarRestauracionParcial()" class="bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 px-4 rounded-lg shadow-sm transition flex items-center gap-2">
          <i class="ph ph-check text-lg"></i> Ejecutar Restauración
        </button>
        <button onclick="document.getElementById('auditoriaResultados').classList.add('hidden')" class="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2 px-4 rounded-lg transition">
          Cancelar
        </button>
      </div>
    `;
    event.target.value = '';

  } catch (e) {
    console.error(e);
    showToast('❌ Error leyendo archivo: ' + e.message, 'error');
  }
}

export async function ejecutarRestauracionParcial() {
  const checkboxes = document.querySelectorAll('.chk-restore-div:checked');
  const divsSeleccionadas = Array.from(checkboxes).map(c => c.value);
  
  if (divsSeleccionadas.length === 0) {
    showToast('Seleccioná al menos una división para restaurar.', 'warning');
    return;
  }

  const restEstudiantes = document.getElementById('chkRestaurarEstudiantes').checked;
  const restAsistencias = document.getElementById('chkRestaurarAsistencias').checked;
  const restEvaluaciones = document.getElementById('chkRestaurarEvaluaciones').checked;

  if (!restEstudiantes && !restAsistencias && !restEvaluaciones) {
    showToast('Debés seleccionar al menos un tipo de dato a restaurar.', 'warning');
    return;
  }

  const conf = await window.app.showConfirm("Confirmación", `Estás por restaurar:\n- Estudiantes: ${restEstudiantes ? 'SÍ' : 'NO'}\n- Asistencias: ${restAsistencias ? 'SÍ' : 'NO'}\n- Evaluaciones: ${restEvaluaciones ? 'SÍ' : 'NO'}\n\nDe las divisiones:\n${divsSeleccionadas.join(', ')}\n\n¿Continuar?`);
  if (!conf) return;

  const progresoMsg = document.getElementById('auditoriaProgresoMsg');
  const progreso = document.getElementById('auditoriaProgreso');
  const resultados = document.getElementById('auditoriaResultados');
  
  resultados.classList.add('hidden');
  progreso.classList.remove('hidden');
  
  try {
    progresoMsg.textContent = "Analizando estado actual de la BD...";
    const [snapEst, snapAsist, snapEval] = await Promise.all([
      getDocs(collection(db, getPath('estudiantes'))),
      getDocs(collection(db, getPath('asistencias'))),
      getDocs(collection(db, getPath('evaluaciones')))
    ]);

    let ops = [];

    const isMatchDiv = (data, divisiones) => {
      if (!data.curso) return false;
      // estudiante: data.curso === "4to A"
      if (divisiones.includes(data.curso)) return true;
      // asistencia/evaluacion: data.curso === "4to A - MATEMATICA"
      return divisiones.some(div => data.curso.startsWith(div + ' - ') || data.curso === div);
    };

    const prepararRestauracion = (coleccionNombre, snapActual, backupObj) => {
      // 1. Añadir al batch los registros del backup que pertenecen a las divisiones seleccionadas
      for (const [id, data] of Object.entries(backupObj)) {
        // En el caso de que el estudiante actualmente tenga una división arruinada (ej: "4to A - Artes"),
        // isMatchDiv podría no agarrarlo desde el estado actual, PERO el ID es el mismo, y la data del backup
        // SÍ tiene data.curso === "4to A". Así que acá el backupObj data tiene el curso correcto.
        if (isMatchDiv(data, divsSeleccionadas)) {
          ops.push((b) => b.set(doc(db, getPath(coleccionNombre), id), data));
        }
      }
      
      // 2. Eliminar de la base de datos actual los registros de estas divisiones que NO están en el backup
      snapActual.forEach(d => {
        const data = d.data();
        if (isMatchDiv(data, divsSeleccionadas)) {
          if (!backupObj[d.id]) {
            ops.push((b) => b.delete(d.ref));
          }
        }
      });
    };

    if (restEstudiantes) prepararRestauracion('estudiantes', snapEst, backupSeleccionado.estudiantes);
    if (restAsistencias) prepararRestauracion('asistencias', snapAsist, backupSeleccionado.asistencias);
    if (restEvaluaciones) prepararRestauracion('evaluaciones', snapEval, backupSeleccionado.evaluaciones);

    progresoMsg.textContent = `Aplicando ${ops.length} operaciones de restauración...`;
    
    const chunkSize = 400;
    for (let i = 0; i < ops.length; i += chunkSize) {
      const chunk = ops.slice(i, i + chunkSize);
      const b = writeBatch(db);
      chunk.forEach(op => op(b));
      await b.commit();
      progresoMsg.textContent = `Guardando... ${Math.min(i + chunkSize, ops.length)} / ${ops.length}`;
    }

    progreso.classList.add('hidden');
    backupSeleccionado = null;
    showToast('✅ Divisiones restauradas con éxito.', 'success');
  } catch (e) {
    console.error(e);
    showToast('❌ Error restaurando: ' + e.message, 'error');
    progreso.classList.add('hidden');
  }
}
export async function auditarAsistencias() {
  const progreso = document.getElementById('auditoriaProgreso');
  const msg = document.getElementById('auditoriaProgresoMsg');
  const resultados = document.getElementById('auditoriaResultados');
  
  progreso.classList.remove('hidden');
  resultados.classList.add('hidden');
  msg.textContent = 'Analizando planillas de asistencia...';

  try {
    const snap = await getDocs(collection(db, getPath("asistencias")));
    let sinDivision = [];
    let vacias = [];
    
    snap.forEach(d => {
      const data = d.data();
      const curso = data.curso || 'Sin Curso';
      const regs = Object.keys(data.registros || {}).length;
      
      if (!curso.includes(' - ')) {
        sinDivision.push({ id: d.id, curso, fecha: data.fecha, regs });
      } else if (regs === 0) {
        vacias.push({ id: d.id, curso, fecha: data.fecha, regs });
      }
    });

    sinDivision.sort((a,b) => b.fecha.localeCompare(a.fecha));
    vacias.sort((a,b) => b.fecha.localeCompare(a.fecha));

    let html = '';
    
    if (sinDivision.length === 0 && vacias.length === 0) {
       html = '<div class="p-4 bg-emerald-50 text-emerald-700 font-bold rounded">No se encontraron planillas sin división ni planillas vacías.</div>';
    } else {
       html += '<h3 class="font-bold text-lg text-rose-600 mb-2">Planillas sin división detectadas (Posible error de toma antigua)</h3>';
       html += '<table class="w-full text-sm mb-6 border"><thead><tr class="bg-slate-100"><th>ID/Curso</th><th>Fecha</th><th>Registros</th></tr></thead><tbody>';
       sinDivision.forEach(p => {
         html += `<tr class="border-b"><td>${p.curso}</td><td class="text-center">${p.fecha}</td><td class="text-center">${p.regs}</td></tr>`;
       });
       html += '</tbody></table>';

       html += '<h3 class="font-bold text-lg text-amber-600 mb-2">Planillas vacías detectadas (0 registros)</h3>';
       html += '<table class="w-full text-sm border"><thead><tr class="bg-slate-100"><th>ID/Curso</th><th>Fecha</th><th>Registros</th></tr></thead><tbody>';
       vacias.forEach(p => {
         html += `<tr class="border-b"><td>${p.curso}</td><td class="text-center">${p.fecha}</td><td class="text-center">${p.regs}</td></tr>`;
       });
       html += '</tbody></table>';
    }

    resultados.innerHTML = html;
    resultados.classList.remove('hidden');
  } catch (e) {
    console.error(e);
    resultados.innerHTML = '<p class="text-red-600 font-bold">Error al leer asistencias.</p>';
    resultados.classList.remove('hidden');
  } finally {
    progreso.classList.add('hidden');
  }
}

// ==========================================
// COMPARADOR DE MATRÍCULA (vs. fuente externa)
// ==========================================

// Quita tildes y pasa a mayúsculas — solo para generar la clave de matching, nunca para guardar.
function _normKey(a, b) {
  const txt = ((a || '') + ' ' + (b || '')).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  return txt.split(/\s+/).filter(Boolean).sort().join(' ');
}
function _normStr(s) {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();
}
function _titleCase(s) {
  // Preserva ñ, acentos, etc. Solo capitaliza primer letra de cada palabra.
  return (s || '').toLowerCase().replace(/(?:^|\s)\S/g, c => c.toUpperCase());
}

// De una sección larga del JSON ("1er año Vespertino Extendida A") extrae número de año
// y letra de división, y busca la división SIDEAC equivalente ("1ro A") en la lista real.
function _derivarDivisionSideac(seccion, sideacDivisiones) {
  const s = _normStr(seccion);
  const year = (s.match(/\d/) || [''])[0];              // primer dígito = año
  const tokens = s.split(/\s+/).filter(Boolean);
  let letter = '';
  for (let i = tokens.length - 1; i >= 0; i--) {         // última letra suelta = división
    if (/^[A-Z]$/.test(tokens[i])) { letter = tokens[i]; break; }
  }
  if (!year && !letter) return '';
  return sideacDivisiones.find(d => {
    const ds = _normStr(d);
    const dYear = (ds.match(/\d/) || [''])[0];
    const dTok = ds.split(/\s+/).filter(Boolean);
    let dLetter = '';
    for (let i = dTok.length - 1; i >= 0; i--) { if (/^[A-Z]$/.test(dTok[i])) { dLetter = dTok[i]; break; } }
    return dYear === year && dLetter === letter;
  }) || '';
}

let _lastFaltantes    = [];
let _lastCoincidentes = [];
let _lastParciales    = [];
let _lastSobran       = [];

// Devuelve número de palabras en común entre dos claves word-sorted.
function _intersectCount(keyA, keyB) {
  const wa = new Set(keyA.split(' '));
  return keyB.split(' ').filter(w => wa.has(w)).length;
}

export async function compararMatricula() {
  if (window.app.currentUser?.rolActivo !== 'SUPERADMIN') return;

  const texto = document.getElementById('matriculaRefJson').value.trim();
  if (!texto) { showToast('Pegá el JSON de referencia primero.', 'error'); return; }

  let refList;
  try {
    refList = JSON.parse(texto);
    if (!Array.isArray(refList)) throw new Error('debe ser un array');
  } catch(e) {
    showToast('JSON inválido: ' + e.message, 'error');
    return;
  }

  // apOrig/noOrig: string ORIGINAL del JSON (preserva ñ, acentos) — nunca normalizado.
  const refMap = new Map();
  refList.forEach(item => {
    const apOrig = (item.apellidos || item.apellido || item.alumno?.persona?.apellido || '').trim();
    const noOrig = (item.nombres   || item.nombre  || item.alumno?.persona?.nombre   || '').trim();
    if (!apOrig || !noOrig) return;
    const key = _normKey(_normStr(apOrig), _normStr(noOrig));
    if (!refMap.has(key)) refMap.set(key, {
      apOrig, noOrig,
      seccion:          item.seccion_completa || item.seccion?.nombreSeccion || '',
      dni:              item.dni || item.alumno?.persona?.documento || '',
      email:            item.email || item.alumno?.persona?.email || '',
      id_miescuela:     item.id_miescuela || item.alumno?.idAlumno || '',
      fecha_nacimiento: item.fecha_nacimiento || item.alumno?.persona?.fechaNacimiento || '',
    });
  });

  const container = document.getElementById('matriculaResultados');
  container.innerHTML = `<div class="text-center py-6"><i class="ph ph-spinner animate-spin text-2xl text-indigo-500"></i><p class="text-sm text-slate-500 mt-2">Consultando Firebase...</p></div>`;

  try {
    const [snap, snapMat] = await Promise.all([
      getDocs(collection(db, _auditPath('estudiantes'))),
      getDocs(collection(db, _auditPath('materias'))),
    ]);

    const sideacDivisiones = [...new Set(
      snapMat.docs.map(d => d.data().division).filter(Boolean)
    )].sort();

    const dbMap = new Map();
    snap.forEach(d => {
      const data = d.data();
      const apOrig = data.apellido || '';
      const noOrig = data.nombre   || '';
      if (!apOrig || !noOrig) return;
      dbMap.set(_normKey(_normStr(apOrig), _normStr(noOrig)), {
        apOrig, noOrig,
        id:               d.id,
        curso:            data.curso            || '',
        dni:              data.dni              || '',
        email:            data.email            || '',
        id_miescuela:     data.id_miescuela     || '',
        fecha_nacimiento: data.fecha_nacimiento || '',
        estado:           data.estado           || '',
      });
    });

    console.log('[Comparador] Firebase keys (5):', [...dbMap.keys()].slice(0, 5));
    console.log('[Comparador] Referencia keys (5):', [...refMap.keys()].slice(0, 5));

    // ── Coincidencias exactas ──
    const faltanEnDB    = [...refMap.entries()].filter(([k]) => !dbMap.has(k)).map(([k, v]) => ({ ...v, _key: k }));
    const sobranEnDB    = [...dbMap.entries()].filter(([k]) => !refMap.has(k)).map(([k, v]) => ({ ...v, _key: k }));
    const coincidenList = [...dbMap.entries()]
      .filter(([k]) => refMap.has(k))
      .map(([k, dbV]) => ({ ...dbV, ref: refMap.get(k) }));

    // ── Coincidencias parciales (nombre incompleto en BD o en JSON) ──
    // Para cada faltante del JSON, busca el mejor candidato en sobranEnDB por intersección de palabras.
    // Threshold: ≥2 palabras en común Y ≥60% del nombre más corto.
    const usedRefIdx = new Set();
    const usedDbId   = new Set();
    const candidates = [];
    faltanEnDB.forEach((ref, ri) => {
      sobranEnDB.forEach(dbe => {
        const intersect = _intersectCount(ref._key, dbe._key);
        const minLen    = Math.min(ref._key.split(' ').length, dbe._key.split(' ').length);
        if (intersect >= 2 && intersect / minLen >= 0.6) {
          candidates.push({ ref, dbe, ri, intersect, score: intersect / minLen });
        }
      });
    });
    candidates.sort((a, b) => b.score - a.score || b.intersect - a.intersect);
    const parciales = [];
    for (const c of candidates) {
      if (usedRefIdx.has(c.ri) || usedDbId.has(c.dbe.id)) continue;
      parciales.push(c);
      usedRefIdx.add(c.ri);
      usedDbId.add(c.dbe.id);
    }

    const parcialDbIds = new Set(parciales.map(p => p.dbe.id));
    const faltantesDisplay = faltanEnDB.filter((_, i) => !usedRefIdx.has(i));
    const sobranDisplay    = sobranEnDB.filter(e => !parcialDbIds.has(e.id));

    _lastFaltantes    = [...faltantesDisplay].sort((a, b) => a.apOrig.localeCompare(b.apOrig));
    _lastCoincidentes = coincidenList;
    _lastParciales    = parciales;
    _lastSobran       = [...sobranDisplay].sort((a, b) => a.apOrig.localeCompare(b.apOrig));

    // ── HTML ──
    let html = `
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div class="bg-emerald-50 dark:bg-emerald-900/30 rounded-xl p-3 text-center">
          <p class="text-2xl font-black text-emerald-600 dark:text-emerald-400">${coincidenList.length}</p>
          <p class="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 uppercase">Exactos</p>
        </div>
        <div class="bg-orange-50 dark:bg-orange-900/30 rounded-xl p-3 text-center">
          <p class="text-2xl font-black text-orange-600 dark:text-orange-400">${parciales.length}</p>
          <p class="text-[11px] font-bold text-orange-700 dark:text-orange-300 uppercase">Parciales</p>
        </div>
        <div class="bg-red-50 dark:bg-red-900/30 rounded-xl p-3 text-center">
          <p class="text-2xl font-black text-red-600 dark:text-red-400">${faltantesDisplay.length}</p>
          <p class="text-[11px] font-bold text-red-700 dark:text-red-300 uppercase">Faltan en BD</p>
        </div>
        <div class="bg-amber-50 dark:bg-amber-900/30 rounded-xl p-3 text-center">
          <p class="text-2xl font-black text-amber-600 dark:text-amber-400">${sobranDisplay.length}</p>
          <p class="text-[11px] font-bold text-amber-700 dark:text-amber-300 uppercase">Solo en BD</p>
        </div>
      </div>
      <p class="text-xs text-slate-400 mb-5">Firebase: ${dbMap.size} · Referencia JSON: ${refMap.size}</p>`;

    // ── PARCIALES ──
    if (parciales.length > 0) {
      const rowsParciales = parciales.map((p, i) => {
        const commonWords = p.ref._key.split(' ').filter(w => new Set(p.dbe._key.split(' ')).has(w));
        return `
        <tr class="bg-white dark:bg-slate-900 hover:bg-orange-50 dark:hover:bg-orange-900/20">
          <td class="p-2 text-center"><input type="checkbox" class="chk-parcial w-4 h-4 accent-orange-600" data-idx="${i}" checked></td>
          <td class="p-2">
            <div class="font-semibold text-slate-800 dark:text-slate-100">${escaparHTML(_titleCase(p.ref.apOrig))}, ${escaparHTML(_titleCase(p.ref.noOrig))}</div>
            <div class="text-xs text-slate-400">${escaparHTML(p.ref.seccion)} · DNI: ${escaparHTML(p.ref.dni||'—')}</div>
          </td>
          <td class="p-2">
            <div class="font-semibold text-slate-700 dark:text-slate-200">${escaparHTML(p.dbe.apOrig)}, ${escaparHTML(p.dbe.noOrig)}</div>
            <div class="text-xs text-slate-400">${escaparHTML(p.dbe.curso)} · DNI BD: ${escaparHTML(p.dbe.dni||'—')}</div>
          </td>
          <td class="p-2 text-xs text-orange-600 font-mono">${commonWords.join(', ')}</td>
        </tr>`;
      }).join('');
      html += `
        <div class="mb-6 border border-orange-200 dark:border-orange-800 rounded-xl overflow-hidden">
          <div class="bg-orange-50 dark:bg-orange-900/30 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
            <h4 class="font-bold text-orange-700 dark:text-orange-300 flex items-center gap-2 text-sm">
              <i class="ph ph-link text-lg"></i> Coincidencias parciales — ${parciales.length} probable(s) par(es)
              <span class="text-xs font-normal text-slate-400">nombre incompleto o diferente en uno de los sistemas</span>
            </h4>
            <div class="flex items-center gap-2">
              <label class="text-xs text-slate-500 flex items-center gap-1 cursor-pointer">
                <input type="checkbox" id="chkTodosParciales" checked onchange="document.querySelectorAll('.chk-parcial').forEach(c=>c.checked=this.checked)">
                Todos
              </label>
              <button onclick="app.confirmarParciales()" class="bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition">
                <i class="ph ph-check-fat"></i> Confirmar y completar datos
              </button>
            </div>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-orange-50/50 dark:bg-orange-900/20 border-b border-orange-100 dark:border-orange-900"><tr>
                <th class="p-2 w-8"></th>
                <th class="p-2 text-left font-bold text-orange-800 dark:text-orange-300">En JSON (referencia)</th>
                <th class="p-2 text-left font-bold text-orange-800 dark:text-orange-300">En Firebase (BD)</th>
                <th class="p-2 text-left font-bold text-orange-800 dark:text-orange-300">Palabras comunes</th>
              </tr></thead>
              <tbody class="divide-y divide-orange-100 dark:divide-orange-900">${rowsParciales}</tbody>
            </table>
          </div>
          <p class="text-xs text-slate-400 px-4 py-2">Al confirmar: se actualiza el nombre en BD con el del JSON + se completan DNI, email, fecha de nac., ID MiEscuela.</p>
        </div>`;
    }

    // ── FALTAN EN FIREBASE (estrictos, sin parciales) ──
    if (_lastFaltantes.length > 0) {
      const rows = _lastFaltantes.map((e, i) => {
        // Deriva "1ro A" desde "1er año Vespertino Extendida A" y busca la división real SIDEAC
        const presel  = _derivarDivisionSideac(e.seccion, sideacDivisiones);
        const opts = sideacDivisiones.map(d =>
          `<option value="${escaparHTML(d)}"${d === presel ? ' selected' : ''}>${escaparHTML(d)}</option>`
        ).join('');
        return `
        <tr class="bg-white dark:bg-slate-900 hover:bg-red-50 dark:hover:bg-red-900/20">
          <td class="p-2 text-center"><input type="checkbox" class="chk-faltante w-4 h-4 accent-indigo-600" data-idx="${i}" checked></td>
          <td class="p-2 font-semibold text-slate-800 dark:text-slate-200">${escaparHTML(_titleCase(e.apOrig))}</td>
          <td class="p-2 text-slate-700 dark:text-slate-300">${escaparHTML(_titleCase(e.noOrig))}</td>
          <td class="p-2 text-xs text-slate-400">${escaparHTML(e.seccion)}</td>
          <td class="p-2 text-xs font-mono text-slate-500">${escaparHTML(e.dni)}</td>
          <td class="p-2">
            <select class="sel-division-faltante text-xs border border-slate-300 dark:border-slate-600 rounded px-1 py-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 min-w-[90px]" data-idx="${i}">
              <option value="">— elegir —</option>${opts}
            </select>
          </td>
        </tr>`;
      }).join('');
      html += `
        <div class="mb-6">
          <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h4 class="font-bold text-red-700 dark:text-red-400 flex items-center gap-2 text-sm">
              <i class="ph ph-user-minus text-lg"></i> Faltan en Firebase — ${_lastFaltantes.length} estudiante(s)
            </h4>
            <div class="flex items-center gap-2">
              <label class="text-xs text-slate-500 flex items-center gap-1 cursor-pointer">
                <input type="checkbox" id="chkTodosFaltantes" checked onchange="document.querySelectorAll('.chk-faltante').forEach(c=>c.checked=this.checked)">
                Todos
              </label>
              <button onclick="app.importarFaltantes()" class="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition">
                <i class="ph ph-upload-simple"></i> Importar seleccionados
              </button>
            </div>
          </div>
          <div class="overflow-x-auto rounded-lg border border-red-100 dark:border-red-900">
            <table class="w-full text-sm">
              <thead class="bg-red-50 dark:bg-red-900/30"><tr>
                <th class="p-2 w-8"></th>
                <th class="p-2 text-left font-bold text-red-800 dark:text-red-300">Apellido</th>
                <th class="p-2 text-left font-bold text-red-800 dark:text-red-300">Nombre</th>
                <th class="p-2 text-left font-bold text-red-800 dark:text-red-300">Sección JSON</th>
                <th class="p-2 text-left font-bold text-red-800 dark:text-red-300">DNI</th>
                <th class="p-2 text-left font-bold text-red-800 dark:text-red-300">División SIDEAC</th>
              </tr></thead>
              <tbody class="divide-y divide-red-100 dark:divide-red-900">${rows}</tbody>
            </table>
          </div>
        </div>`;
    }

    // ── COINCIDENTES EXACTOS (con opción de actualizar campos) ──
    if (coincidenList.length > 0) {
      // Comparación EXACTA contra _titleCase(JSON): detecta también diferencias de
      // mayúsculas/minúsculas — el JSON de MiEscuela es la fuente de verdad de los nombres.
      const _hasDif = e => {
        return (e.ref.dni && e.ref.dni !== e.dni) ||
               (e.ref.apOrig && _titleCase(e.ref.apOrig) !== e.apOrig) ||
               (e.ref.noOrig && _titleCase(e.ref.noOrig) !== e.noOrig) ||
               (e.ref.email && !e.email) ||
               (e.ref.id_miescuela && !e.id_miescuela) ||
               (e.ref.fecha_nacimiento && !e.fecha_nacimiento);
      };
      const conDif = coincidenList.filter(_hasDif).sort((a, b) => a.apOrig.localeCompare(b.apOrig));

      const rowsAll = coincidenList
        .sort((a, b) => a.apOrig.localeCompare(b.apOrig))
        .map(e => `<tr class="bg-white dark:bg-slate-900">
          <td class="p-2 font-semibold text-slate-800 dark:text-slate-200">${escaparHTML(e.apOrig)}</td>
          <td class="p-2 text-slate-700 dark:text-slate-300">${escaparHTML(e.noOrig)}</td>
          <td class="p-2 text-xs text-slate-400">${escaparHTML(e.curso)}</td>
          <td class="p-2 text-xs font-mono text-slate-400">${escaparHTML(e.dni)}</td>
          <td class="p-2 text-xs font-mono text-slate-400">${escaparHTML(e.id_miescuela)}</td>
        </tr>`).join('');

      let updateBlock = '';
      if (conDif.length > 0) {
        const rowsDif = conDif.map((e, i) => {
          const tag = (valJSON, valDB, isName) => {
            if (!valJSON) return '<span class="text-slate-300">—</span>';
            const nuevoValor = isName ? _titleCase(valJSON) : valJSON;
            if (!valDB)   return `<span class="text-red-600 font-bold">${escaparHTML(nuevoValor)}</span>`;
            const distinto = isName ? nuevoValor !== valDB : _normStr(valJSON) !== _normStr(valDB);
            if (distinto) return `<span class="text-amber-600 font-bold">${escaparHTML(nuevoValor)}</span>`;
            return '<span class="text-slate-300">igual</span>';
          };
          return `
            <tr class="bg-white dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-blue-900/20">
              <td class="p-2 text-center"><input type="checkbox" class="chk-actualizar w-4 h-4 accent-blue-600" data-idx="${i}" checked></td>
              <td class="p-2 text-xs font-semibold text-slate-700 dark:text-slate-200">${escaparHTML(e.apOrig)}, ${escaparHTML(e.noOrig)}</td>
              <td class="p-2 text-xs">${tag(e.ref.dni, e.dni, false)}</td>
              <td class="p-2 text-xs">${tag(e.ref.apOrig, e.apOrig, true)}</td>
              <td class="p-2 text-xs">${tag(e.ref.noOrig, e.noOrig, true)}</td>
              <td class="p-2 text-xs">${tag(e.ref.email, e.email, false)}</td>
              <td class="p-2 text-xs">${tag(e.ref.id_miescuela, e.id_miescuela, false)}</td>
              <td class="p-2 text-xs">${tag(e.ref.fecha_nacimiento, e.fecha_nacimiento, false)}</td>
            </tr>`;
        }).join('');
        updateBlock = `
          <div class="mt-4 border-t border-emerald-200 dark:border-emerald-800 pt-4">
            <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
              <p class="text-sm font-bold text-blue-700 dark:text-blue-400 flex items-center gap-2">
                <i class="ph ph-arrows-clockwise text-base"></i> ${conDif.length} con datos a completar/actualizar desde JSON
              </p>
              <div class="flex items-center gap-2">
                <label class="text-xs text-slate-500 flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" id="chkTodosActualizar" checked onchange="document.querySelectorAll('.chk-actualizar').forEach(c=>c.checked=this.checked)">
                  Todos
                </label>
                <button onclick="app.actualizarCoincidentes()" class="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition">
                  <i class="ph ph-pencil-simple"></i> Actualizar seleccionados
                </button>
              </div>
            </div>
            <div class="overflow-x-auto rounded-lg border border-blue-100 dark:border-blue-900">
              <table class="w-full text-sm">
                <thead class="bg-blue-50 dark:bg-blue-900/30"><tr>
                  <th class="p-2 w-8"></th>
                  <th class="p-2 text-left font-bold text-blue-800 dark:text-blue-300 text-xs">Alumno en BD</th>
                  <th class="p-2 text-left font-bold text-blue-800 dark:text-blue-300 text-xs">DNI</th>
                  <th class="p-2 text-left font-bold text-blue-800 dark:text-blue-300 text-xs">Apellido</th>
                  <th class="p-2 text-left font-bold text-blue-800 dark:text-blue-300 text-xs">Nombre</th>
                  <th class="p-2 text-left font-bold text-blue-800 dark:text-blue-300 text-xs">Email</th>
                  <th class="p-2 text-left font-bold text-blue-800 dark:text-blue-300 text-xs">ID MiEsc.</th>
                  <th class="p-2 text-left font-bold text-blue-800 dark:text-blue-300 text-xs">Fec. Nac.</th>
                </tr></thead>
                <tbody class="divide-y divide-blue-100 dark:divide-blue-900">${rowsDif}</tbody>
              </table>
            </div>
            <p class="text-xs text-slate-400 mt-2">Rojo = vacío en BD, naranja = distinto. Solo se escriben campos con valor en JSON.</p>
          </div>`;
      }

      html += `
        <details class="mb-6 group">
          <summary class="cursor-pointer list-none flex items-center gap-2 font-bold text-emerald-700 dark:text-emerald-400 text-sm select-none">
            <i class="ph ph-caret-right text-base group-open:rotate-90 transition-transform"></i>
            <i class="ph ph-check-circle text-lg"></i> Coincidencias exactas — ${coincidenList.length}${conDif.length ? ` · <span class="text-blue-600">${conDif.length} con datos a completar</span>` : ''} — clic para ver
          </summary>
          <div class="overflow-x-auto rounded-lg border border-emerald-100 dark:border-emerald-900 mt-3">
            <table class="w-full text-sm">
              <thead class="bg-emerald-50 dark:bg-emerald-900/30"><tr>
                <th class="p-2 text-left font-bold text-emerald-800 dark:text-emerald-300">Apellido</th>
                <th class="p-2 text-left font-bold text-emerald-800 dark:text-emerald-300">Nombre</th>
                <th class="p-2 text-left font-bold text-emerald-800 dark:text-emerald-300">División</th>
                <th class="p-2 text-left font-bold text-emerald-800 dark:text-emerald-300">DNI</th>
                <th class="p-2 text-left font-bold text-emerald-800 dark:text-emerald-300">ID MiEsc.</th>
              </tr></thead>
              <tbody class="divide-y divide-emerald-100 dark:divide-emerald-900">${rowsAll}</tbody>
            </table>
          </div>
          ${updateBlock}
        </details>`;
    }

    // ── SOLO EN FIREBASE (sin coincidencia ni parcial) — con vinculación manual al JSON ──
    if (_lastSobran.length > 0) {
      // Opciones = registros JSON que quedaron sin match (faltantes). Permite forzar la unión manual.
      const optFaltantes = _lastFaltantes.map((f, i) =>
        `<option value="${i}">${escaparHTML(_titleCase(f.apOrig))}, ${escaparHTML(_titleCase(f.noOrig))} — ${escaparHTML(f.seccion || 's/secc')} — DNI ${escaparHTML(f.dni || '—')}</option>`
      ).join('');
      const selectorHtml = _lastFaltantes.length
        ? (sid) => `<div class="flex gap-1 items-center">
            <select id="iny_${escaparHTML(sid)}" class="text-xs border border-slate-300 dark:border-slate-600 rounded px-1 py-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 max-w-[220px]">
              <option value="">— registro JSON a inyectar —</option>${optFaltantes}
            </select>
            <button onclick="app.inyectarManual('${escaparHTML(sid)}')" class="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-2 py-1 rounded flex items-center gap-1"><i class="ph ph-syringe"></i> Inyectar</button>
          </div>`
        : () => '<span class="text-xs text-slate-400">no hay registros JSON sueltos</span>';

      const rows = _lastSobran.map(e => `<tr class="bg-white dark:bg-slate-900 hover:bg-amber-50 dark:hover:bg-amber-900/20">
          <td class="p-2 font-semibold text-slate-800 dark:text-slate-200">${escaparHTML(e.apOrig)}</td>
          <td class="p-2 text-slate-700 dark:text-slate-300">${escaparHTML(e.noOrig)}</td>
          <td class="p-2 text-xs text-slate-400">${escaparHTML(e.curso)}</td>
          <td class="p-2 text-xs font-mono text-slate-400">${escaparHTML(e.dni)}</td>
          <td class="p-2">${selectorHtml(e.id)}</td></tr>`)
        .join('');
      html += `
        <details class="group">
          <summary class="cursor-pointer list-none flex items-center gap-2 font-bold text-amber-700 dark:text-amber-400 text-sm select-none mb-3">
            <i class="ph ph-caret-right text-base group-open:rotate-90 transition-transform"></i>
            <i class="ph ph-user-plus text-lg"></i> Solo en Firebase — ${_lastSobran.length} estudiante(s) sin correspondencia automática
          </summary>
          <p class="text-xs text-slate-500 mb-2">Si sabés que un alumno de acá es en realidad uno del JSON (nombres muy distintos), elegí el registro JSON y "Inyectar": se le cargan DNI, email, fecha nac., ID MiEscuela y se corrige el nombre. Se conserva la división de la base.</p>
          <div class="overflow-x-auto rounded-lg border border-amber-100 dark:border-amber-900">
            <table class="w-full text-sm">
              <thead class="bg-amber-50 dark:bg-amber-900/30"><tr>
                <th class="p-2 text-left font-bold text-amber-800 dark:text-amber-300">Apellido</th>
                <th class="p-2 text-left font-bold text-amber-800 dark:text-amber-300">Nombre</th>
                <th class="p-2 text-left font-bold text-amber-800 dark:text-amber-300">División</th>
                <th class="p-2 text-left font-bold text-amber-800 dark:text-amber-300">DNI</th>
                <th class="p-2 text-left font-bold text-amber-800 dark:text-amber-300">Vincular con JSON</th>
              </tr></thead>
              <tbody class="divide-y divide-amber-100 dark:divide-amber-900">${rows}</tbody>
            </table>
          </div>
        </details>`;
    }

    if (faltantesDisplay.length === 0 && sobranDisplay.length === 0 && parciales.length === 0) {
      html += `<div class="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 p-4 rounded-lg font-bold flex items-center gap-2 border border-emerald-200 dark:border-emerald-800">
        <i class="ph ph-check-circle text-2xl"></i> ¡La matrícula coincide exactamente con la referencia!
      </div>`;
    }

    container.innerHTML = html;
  } catch(e) {
    console.error(e);
    container.innerHTML = `<div class="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 p-4 rounded-lg font-bold">Error al consultar Firebase: ${escaparHTML(e.message)}</div>`;
  }
}

export async function importarFaltantes() {
  if (window.app.currentUser?.rolActivo !== 'SUPERADMIN') return;

  const checks = [...document.querySelectorAll('.chk-faltante:checked')];
  if (!checks.length) { showToast('Seleccioná al menos un estudiante.', 'error'); return; }

  const seleccionados = checks.map(c => {
    const idx = +c.dataset.idx;
    const faltante = _lastFaltantes[idx];
    const divSel = document.querySelector(`.sel-division-faltante[data-idx="${idx}"]`)?.value || '';
    return { ...faltante, divisionSideac: divSel };
  }).filter(Boolean);

  const sinDiv = seleccionados.filter(s => !s.divisionSideac);
  if (sinDiv.length) {
    showToast(`${sinDiv.length} alumno(s) sin división SIDEAC. Elegí la división antes de importar.`, 'error');
    return;
  }

  const preview = seleccionados.slice(0, 5).map(s => `• ${_titleCase(s.apOrig)}, ${_titleCase(s.noOrig)} → ${s.divisionSideac}`).join('\n');
  const extra   = seleccionados.length > 5 ? `\n... y ${seleccionados.length - 5} más` : '';

  const ok = await window.app.showConfirm(
    'Importar estudiantes a Firebase',
    `Se crearán ${seleccionados.length} documento(s) nuevos.\nEstado: activo | Materias: vacío (usar "Integridad" luego).\n\n${preview}${extra}\n\n¿Confirmar?`
  );
  if (!ok) return;

  try {
    const batch = writeBatch(db);
    seleccionados.forEach(s => {
      const ref = doc(collection(db, _auditPath('estudiantes')));
      batch.set(ref, {
        apellido:         _titleCase(s.apOrig),
        nombre:           _titleCase(s.noOrig),
        curso:            s.divisionSideac,
        dni:              s.dni              || '',
        email:            s.email            || '',
        id_miescuela:     s.id_miescuela     || '',
        fecha_nacimiento: s.fecha_nacimiento || '',
        estado:           'activo',
        materias:         [],
      });
    });
    await batch.commit();
    showToast(`${seleccionados.length} estudiante(s) importados. Ejecutá "Integridad" para asignar materias.`, 'success');
    compararMatricula();
  } catch(e) {
    console.error(e);
    showToast('Error al importar: ' + e.message, 'error');
  }
}

export async function confirmarParciales() {
  if (window.app.currentUser?.rolActivo !== 'SUPERADMIN') return;

  const checks = [...document.querySelectorAll('.chk-parcial:checked')];
  if (!checks.length) { showToast('Seleccioná al menos un par.', 'error'); return; }

  const seleccionados = checks.map(c => _lastParciales[+c.dataset.idx]).filter(Boolean);

  const preview = seleccionados.slice(0, 5).map(p =>
    `• JSON: "${_titleCase(p.ref.apOrig)}, ${_titleCase(p.ref.noOrig)}" = BD: "${p.dbe.apOrig}, ${p.dbe.noOrig}"`
  ).join('\n');
  const extra = seleccionados.length > 5 ? `\n... y ${seleccionados.length - 5} más` : '';

  const ok = await window.app.showConfirm(
    'Confirmar coincidencias parciales',
    `Se corregirá el nombre en BD con el del JSON y se completarán DNI, email, fecha de nacimiento e ID MiEscuela.\n\nSe CONSERVA de la base: división, materias, estado, inscripciones y asistencias (mismo legajo).\n\n${preview}${extra}\n\n¿Confirmar?`
  );
  if (!ok) return;

  try {
    const batch = writeBatch(db);
    seleccionados.forEach(({ ref, dbe }) => {
      const docRef = doc(db, _auditPath('estudiantes'), dbe.id);
      const upd = {
        apellido: _titleCase(ref.apOrig),
        nombre:   _titleCase(ref.noOrig),
      };
      if (ref.dni)              upd.dni              = ref.dni;
      if (ref.email)            upd.email            = ref.email;
      if (ref.id_miescuela)     upd.id_miescuela     = ref.id_miescuela;
      if (ref.fecha_nacimiento) upd.fecha_nacimiento = ref.fecha_nacimiento;
      batch.update(docRef, upd);
    });
    await batch.commit();
    showToast(`${seleccionados.length} par(es) confirmados y actualizados.`, 'success');
    compararMatricula();
  } catch(e) {
    console.error(e);
    showToast('Error al confirmar: ' + e.message, 'error');
  }
}

// Vinculación manual: inyecta un registro JSON (faltante) en un estudiante de "Solo en Firebase".
export async function inyectarManual(sobranId) {
  if (window.app.currentUser?.rolActivo !== 'SUPERADMIN') return;

  const sel = document.getElementById('iny_' + sobranId);
  const idx = sel?.value;
  if (idx === '' || idx == null) { showToast('Elegí el registro JSON a inyectar.', 'error'); return; }

  const ref = _lastFaltantes[+idx];
  const dbe = _lastSobran.find(x => x.id === sobranId);
  if (!ref || !dbe) { showToast('No encontré el par. Recompará.', 'error'); return; }

  const ok = await window.app.showConfirm(
    'Inyectar datos del JSON',
    `Vas a marcar que el alumno de la base:\n  "${dbe.apOrig}, ${dbe.noOrig}" (${dbe.curso})\nes en realidad el del JSON:\n  "${_titleCase(ref.apOrig)}, ${_titleCase(ref.noOrig)}" (${ref.seccion || 's/secc'})\n\nSe corrige el nombre y se cargan DNI, email, fecha nac. e ID MiEscuela. Se CONSERVA la división y las asistencias de la base.\n\n¿Confirmar?`
  );
  if (!ok) return;

  try {
    const docRef = doc(db, _auditPath('estudiantes'), dbe.id);
    const upd = {
      apellido: _titleCase(ref.apOrig),
      nombre:   _titleCase(ref.noOrig),
    };
    if (ref.dni)              upd.dni              = ref.dni;
    if (ref.email)            upd.email            = ref.email;
    if (ref.id_miescuela)     upd.id_miescuela     = ref.id_miescuela;
    if (ref.fecha_nacimiento) upd.fecha_nacimiento = ref.fecha_nacimiento;
    const batch = writeBatch(db);
    batch.update(docRef, upd);
    await batch.commit();
    showToast(`Datos inyectados en "${dbe.apOrig}, ${dbe.noOrig}".`, 'success');
    compararMatricula();
  } catch(e) {
    console.error(e);
    showToast('Error al inyectar: ' + e.message, 'error');
  }
}

export async function actualizarCoincidentes() {
  if (window.app.currentUser?.rolActivo !== 'SUPERADMIN') return;

  const checks = [...document.querySelectorAll('.chk-actualizar:checked')];
  if (!checks.length) { showToast('Seleccioná al menos un estudiante.', 'error'); return; }

  const _hasDif = e =>
    (e.ref.dni && e.ref.dni !== e.dni) ||
    (e.ref.apOrig && _titleCase(e.ref.apOrig) !== e.apOrig) ||
    (e.ref.noOrig && _titleCase(e.ref.noOrig) !== e.noOrig) ||
    (e.ref.email && !e.email) ||
    (e.ref.id_miescuela && !e.id_miescuela) ||
    (e.ref.fecha_nacimiento && !e.fecha_nacimiento);

  const conDif = _lastCoincidentes.filter(_hasDif).sort((a, b) => a.apOrig.localeCompare(b.apOrig));
  const seleccionados = checks.map(c => conDif[+c.dataset.idx]).filter(Boolean);

  const preview = seleccionados.slice(0, 5).map(s => `• ${s.apOrig}, ${s.noOrig}`).join('\n');
  const extra   = seleccionados.length > 5 ? `\n... y ${seleccionados.length - 5} más` : '';

  const ok = await window.app.showConfirm(
    'Actualizar datos desde JSON',
    `Se enriquecerán ${seleccionados.length} estudiante(s) con datos del JSON (DNI, email, fecha nac., ID MiEscuela y normalización de nombre).\n\nSe CONSERVA de la base: división, materias, estado, inscripciones y asistencias (mismo legajo, no se pierde historial).\n\n${preview}${extra}\n\n¿Confirmar?`
  );
  if (!ok) return;

  try {
    const batch = writeBatch(db);
    seleccionados.forEach(s => {
      const ref = doc(db, _auditPath('estudiantes'), s.id);
      const upd = {};
      if (s.ref.dni && s.ref.dni !== s.dni)                             upd.dni              = s.ref.dni;
      if (s.ref.apOrig && _titleCase(s.ref.apOrig) !== s.apOrig)        upd.apellido         = _titleCase(s.ref.apOrig);
      if (s.ref.noOrig && _titleCase(s.ref.noOrig) !== s.noOrig)        upd.nombre           = _titleCase(s.ref.noOrig);
      if (s.ref.email            && !s.email)                            upd.email            = s.ref.email;
      if (s.ref.id_miescuela     && !s.id_miescuela)                     upd.id_miescuela     = s.ref.id_miescuela;
      if (s.ref.fecha_nacimiento && !s.fecha_nacimiento)                 upd.fecha_nacimiento = s.ref.fecha_nacimiento;
      if (Object.keys(upd).length) batch.update(ref, upd);
    });
    await batch.commit();
    showToast(`${seleccionados.length} estudiante(s) actualizados.`, 'success');
    compararMatricula();
  } catch(e) {
    console.error(e);
    showToast('Error al actualizar: ' + e.message, 'error');
  }
}

// ==========================================
// DETECTOR DE ESTUDIANTES DUPLICADOS
// ==========================================
// Agrupa estudiantes de la BD presumiblemente repetidos por tres criterios:
// 1. Mismo DNI (no vacío)  2. Misma clave de nombre (palabras ordenadas)
// 3. Nombres parcialmente similares (≥2 palabras comunes y ≥60% del más corto)
// Solo lectura: la resolución se hace con la herramienta de Fusión en Matrícula.
export async function detectarDuplicadosEstudiantes() {
  if (window.app.currentUser?.rolActivo !== 'SUPERADMIN') return;

  const container = document.getElementById('duplicadosResultados');
  container.innerHTML = `<div class="text-center py-6"><i class="ph ph-spinner animate-spin text-2xl text-indigo-500"></i><p class="text-sm text-slate-500 mt-2">Analizando estudiantes...</p></div>`;

  try {
    // Estudiantes + asistencias + evaluaciones (para contar registros por alumno y saber cuál priorizar)
    const [snap, snapAsist, snapEval] = await Promise.all([
      getDocs(collection(db, _auditPath('estudiantes'))),
      getDocs(collection(db, _auditPath('asistencias'))),
      getDocs(collection(db, _auditPath('evaluaciones'))),
    ]);

    // Cuenta cuántas marcas de asistencia reales tiene cada alumno (por su id en registros)
    const asistPorId = new Map();
    snapAsist.forEach(d => {
      const regs = d.data().registros || {};
      Object.entries(regs).forEach(([aid, marca]) => {
        if (marca !== undefined && marca !== null && marca !== '' && marca !== '-') {
          asistPorId.set(aid, (asistPorId.get(aid) || 0) + 1);
        }
      });
    });
    // Cuenta docs de evaluaciones por alumnoId
    const evalPorId = new Map();
    snapEval.forEach(d => {
      const aid = d.data().alumnoId;
      if (aid) evalPorId.set(aid, (evalPorId.get(aid) || 0) + 1);
    });

    const alumnos = [];
    snap.forEach(d => {
      const data = d.data();
      alumnos.push({
        id: d.id,
        apellido: data.apellido || '',
        nombre:   data.nombre   || '',
        curso:    data.curso    || '',
        dni:      (data.dni || '').toString().trim(),
        estado:   data.estado   || '',
        asistencias: asistPorId.get(d.id) || 0,
        evaluaciones: evalPorId.get(d.id) || 0,
        key:      _normKey(_normStr(data.apellido || ''), _normStr(data.nombre || '')),
      });
    });

    const grupos = [];       // { motivo, alumnos: [...] }
    const yaAgrupados = new Set();

    // 1. Mismo DNI
    const porDni = new Map();
    alumnos.forEach(a => {
      if (!a.dni) return;
      if (!porDni.has(a.dni)) porDni.set(a.dni, []);
      porDni.get(a.dni).push(a);
    });
    porDni.forEach((lista, dni) => {
      if (lista.length > 1) {
        grupos.push({ motivo: `DNI repetido: ${dni}`, alumnos: lista });
        lista.forEach(a => yaAgrupados.add(a.id));
      }
    });

    // 2. Misma clave de nombre exacta
    const porKey = new Map();
    alumnos.forEach(a => {
      if (!a.key || yaAgrupados.has(a.id)) return;
      if (!porKey.has(a.key)) porKey.set(a.key, []);
      porKey.get(a.key).push(a);
    });
    porKey.forEach(lista => {
      if (lista.length > 1) {
        // Si todos tienen DNI y son distintos entre sí, son homónimos reales, no duplicados
        const dnis = lista.map(a => a.dni).filter(Boolean);
        const todosDniDistintos = dnis.length === lista.length && new Set(dnis).size === lista.length;
        if (todosDniDistintos) return;
        grupos.push({ motivo: 'Nombre idéntico (mismas palabras)', alumnos: lista });
        lista.forEach(a => yaAgrupados.add(a.id));
      }
    });

    // 3. Similitud parcial entre pares restantes
    const restantes = alumnos.filter(a => a.key && !yaAgrupados.has(a.id));
    for (let i = 0; i < restantes.length; i++) {
      for (let j = i + 1; j < restantes.length; j++) {
        const a = restantes[i], b = restantes[j];
        if (yaAgrupados.has(a.id) || yaAgrupados.has(b.id)) continue;
        // DNIs distintos = personas distintas, no comparar nombres
        if (a.dni && b.dni && a.dni !== b.dni) continue;
        const wa = a.key.split(' '), wb = b.key.split(' ');
        const setA = new Set(wa);
        const comunes = wb.filter(w => setA.has(w)).length;
        const minLen = Math.min(wa.length, wb.length);
        if (comunes >= 2 && comunes / minLen >= 0.6) {
          grupos.push({ motivo: 'Nombres muy similares (posible duplicado)', alumnos: [a, b] });
          yaAgrupados.add(a.id); yaAgrupados.add(b.id);
        }
      }
    }

    if (grupos.length === 0) {
      container.innerHTML = `<div class="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 p-4 rounded-lg font-bold flex items-center gap-2 border border-emerald-200 dark:border-emerald-800">
        <i class="ph ph-check-circle text-2xl"></i> No se detectaron estudiantes duplicados (${alumnos.length} analizados).
      </div>`;
      return;
    }

    let html = `
      <div class="bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 p-4 rounded-lg font-semibold flex items-center gap-2 border border-amber-200 dark:border-amber-800 mb-4">
        <i class="ph ph-users-three text-2xl"></i> ${grupos.length} grupo(s) de posibles duplicados sobre ${alumnos.length} estudiantes.
        <span class="text-xs font-normal block mt-1">La fusión traspasa asistencias y notas de AMBOS al primario — no se pierde nada elijas cual elijas. Elegí como PRIMARIO al del NOMBRE correcto. Las columnas Asist./Notas solo confirman que los registros existen.</span>
      </div>`;

    grupos.forEach(g => {
      // El candidato con más datos (asist + notas) es el sugerido como PRIMARIO
      const maxDatos = Math.max(...g.alumnos.map(a => a.asistencias + a.evaluaciones));
      const rows = g.alumnos.map(a => {
        const total = a.asistencias + a.evaluaciones;
        const esPrimarioSugerido = total === maxDatos && total > 0;
        const badge = esPrimarioSugerido
          ? '<span class="ml-2 text-[9px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 px-1.5 py-0.5 rounded font-black uppercase">más registros</span>'
          : '';
        return `
        <tr class="${esPrimarioSugerido ? 'bg-emerald-50/60 dark:bg-emerald-900/10' : 'bg-white dark:bg-slate-900'}">
          <td class="p-2 font-semibold text-slate-800 dark:text-slate-200">${escaparHTML(a.apellido)}, ${escaparHTML(a.nombre)}${badge}</td>
          <td class="p-2 text-xs text-slate-500">${escaparHTML(a.curso)}</td>
          <td class="p-2 text-xs font-mono text-slate-500">${escaparHTML(a.dni || '—')}</td>
          <td class="p-2 text-center text-xs font-bold ${a.asistencias ? 'text-blue-600 dark:text-blue-400' : 'text-slate-300'}">${a.asistencias}</td>
          <td class="p-2 text-center text-xs font-bold ${a.evaluaciones ? 'text-purple-600 dark:text-purple-400' : 'text-slate-300'}">${a.evaluaciones}</td>
          <td class="p-2 text-xs text-slate-400">${escaparHTML(a.estado)}</td>
          <td class="p-2 text-xs font-mono text-slate-300">${escaparHTML(a.id.substring(0, 8))}…</td>
        </tr>`;
      }).join('');
      html += `
        <div class="mb-4 rounded-lg border border-amber-200 dark:border-amber-800 overflow-hidden">
          <p class="bg-amber-50 dark:bg-amber-900/30 px-3 py-2 text-xs font-bold text-amber-800 dark:text-amber-300">${escaparHTML(g.motivo)}</p>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-slate-50 dark:bg-slate-800 text-[11px] uppercase text-slate-500"><tr>
                <th class="p-2 text-left">Estudiante</th>
                <th class="p-2 text-left">División</th>
                <th class="p-2 text-left">DNI</th>
                <th class="p-2 text-center" title="Marcas de asistencia">Asist.</th>
                <th class="p-2 text-center" title="Planillas de notas">Notas</th>
                <th class="p-2 text-left">Estado</th>
                <th class="p-2 text-left">ID</th>
              </tr></thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800">${rows}</tbody>
            </table>
          </div>
        </div>`;
    });

    container.innerHTML = html;
  } catch(e) {
    console.error(e);
    container.innerHTML = `<div class="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 p-4 rounded-lg font-bold">Error: ${escaparHTML(e.message)}</div>`;
  }
}

// ==========================================
// MIGRADOR: DATOS DE ROOT → ESCUELA (TENANT)
// ==========================================
// Las calificaciones/asistencias cargadas en contexto "root" quedan fuera de toda
// escuela. Esta herramienta las copia al path de la escuela elegida, junto con los
// estudiantes root, preservando docIds (así se mantienen los vínculos alumnoId+materia
// de evaluaciones y curso+registros de asistencias). No borra root ni pisa lo existente.

// Construye el path de una colección para un tenant explícito, replicando getPath().
function _tenantColPath(tenant, col) {
  return (typeof __app_id !== 'undefined')
    ? `artifacts/${appId}/public/data/instituciones/${tenant}/${col}`
    : `instituciones/${tenant}/${col}`;
}

// Path de una colección en ROOT (contexto sin escuela).
function _rootColPath(col) {
  return (typeof __app_id !== 'undefined')
    ? `artifacts/${appId}/public/data/${col}`
    : col;
}

// Un valor "presente" = no vacío y no marcador '-'. Usado para no pisar buenos con vacíos.
function _valPresente(v) {
  if (v === undefined || v === null) return false;
  const s = String(v).trim();
  return s !== '' && s !== '-';
}

let _rootMigracionData = null;
let _reconPlan = null;

export async function analizarDatosRoot() {
  if (window.app.currentUser?.rolActivo !== 'SUPERADMIN') return;

  const cont = document.getElementById('migracionRootResultados');
  cont.innerHTML = `<div class="text-center py-6"><i class="ph ph-spinner animate-spin text-2xl text-indigo-500"></i><p class="text-sm text-slate-500 mt-2">Leyendo datos en root...</p></div>`;

  try {
    const [snapEst, snapEval, snapAsist, snapLocks, snapEsc] = await Promise.all([
      getDocs(collection(db, _rootColPath('estudiantes'))),
      getDocs(collection(db, _rootColPath('evaluaciones'))),
      getDocs(collection(db, _rootColPath('asistencias'))),
      getDocs(collection(db, _rootColPath('evaluaciones_locks'))),
      getDocs(collection(db, getPath('escuelas'))),
    ]);

    _rootMigracionData = {
      estudiantes: snapEst.docs.map(d => ({ id: d.id, data: d.data() })),
      evaluaciones: snapEval.docs.map(d => ({ id: d.id, data: d.data() })),
      asistencias: snapAsist.docs.map(d => ({ id: d.id, data: d.data() })),
      locks: snapLocks.docs.map(d => ({ id: d.id, data: d.data() })),
    };

    const escuelasOpts = snapEsc.docs
      .map(d => `<option value="${escaparHTML(d.id)}">${escaparHTML(d.data().nombre || d.id)}</option>`)
      .join('');

    const total = _rootMigracionData.estudiantes.length + _rootMigracionData.evaluaciones.length +
                  _rootMigracionData.asistencias.length + _rootMigracionData.locks.length;

    if (total === 0) {
      cont.innerHTML = `<div class="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 p-4 rounded-lg font-bold flex items-center gap-2 border border-emerald-200 dark:border-emerald-800">
        <i class="ph ph-check-circle text-2xl"></i> No hay datos en root. Nada para reconciliar.
      </div>`;
      return;
    }

    // Detalle de las calificaciones en root (resuelve alumnoId → nombre)
    const nombrePorId = new Map(_rootMigracionData.estudiantes.map(e => [e.id, `${e.data.apellido || ''}, ${e.data.nombre || ''}`.trim()]));
    const CAMPOS_NOTA = ['b1', 'b2', 'b3', 'b4', 'po_dic', 'po_feb'];
    const detalleEval = _rootMigracionData.evaluaciones.map(ev => {
      const d = ev.data;
      const notas = CAMPOS_NOTA.filter(k => _valPresente(d[k])).map(k => `${k}=${d[k]}`).join(' · ') || '(sin notas cargadas)';
      const nombre = nombrePorId.get(d.alumnoId) || d.alumnoId || '(alumno desconocido)';
      return `<tr class="border-b dark:border-slate-800">
        <td class="p-2 text-xs font-semibold text-slate-700 dark:text-slate-200">${escaparHTML(nombre)}</td>
        <td class="p-2 text-xs text-slate-500">${escaparHTML(d.materia || '')}</td>
        <td class="p-2 text-xs font-mono text-slate-600 dark:text-slate-300">${escaparHTML(notas)}</td>
      </tr>`;
    }).join('');

    const bloqueEval = _rootMigracionData.evaluaciones.length ? `
      <details class="mb-4 group">
        <summary class="cursor-pointer list-none flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200 text-sm select-none">
          <i class="ph ph-caret-right group-open:rotate-90 transition-transform"></i>
          Ver las ${_rootMigracionData.evaluaciones.length} calificaciones en root
        </summary>
        <div class="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 mt-2">
          <table class="w-full text-sm">
            <thead class="bg-slate-50 dark:bg-slate-800 text-[11px] uppercase text-slate-500"><tr>
              <th class="p-2 text-left">Estudiante</th><th class="p-2 text-left">Materia</th><th class="p-2 text-left">Notas</th>
            </tr></thead>
            <tbody>${detalleEval}</tbody>
          </table>
        </div>
      </details>` : '';

    cont.innerHTML = `
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div class="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-center"><p class="text-2xl font-black text-slate-700 dark:text-slate-200">${_rootMigracionData.estudiantes.length}</p><p class="text-[11px] font-bold text-slate-500 uppercase">Estudiantes</p></div>
        <div class="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-center"><p class="text-2xl font-black text-slate-700 dark:text-slate-200">${_rootMigracionData.evaluaciones.length}</p><p class="text-[11px] font-bold text-slate-500 uppercase">Calificaciones</p></div>
        <div class="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-center"><p class="text-2xl font-black text-slate-700 dark:text-slate-200">${_rootMigracionData.asistencias.length}</p><p class="text-[11px] font-bold text-slate-500 uppercase">Asistencias</p></div>
        <div class="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-center"><p class="text-2xl font-black text-slate-700 dark:text-slate-200">${_rootMigracionData.locks.length}</p><p class="text-[11px] font-bold text-slate-500 uppercase">Bloqueos</p></div>
      </div>
      ${bloqueEval}
      <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 p-4 rounded-lg">
        <label class="text-sm font-bold text-indigo-800 dark:text-indigo-300 whitespace-nowrap">Reconciliar con:</label>
        <select id="migracionEscuelaDestino" class="flex-1 p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">— Seleccionar escuela destino —</option>${escuelasOpts}
        </select>
        <button onclick="app.previsualizarReconciliacion()" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-5 rounded-lg transition flex items-center justify-center gap-2 text-sm whitespace-nowrap">
          <i class="ph ph-git-diff"></i> Previsualizar
        </button>
      </div>
      <p class="text-xs text-slate-400 mt-2">Modo reconciliación aditiva: solo agrega documentos que faltan en la escuela y rellena campos vacíos. NUNCA pisa un valor existente. La escuela es la fuente de verdad.</p>`;
  } catch(e) {
    console.error(e);
    cont.innerHTML = `<div class="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 p-4 rounded-lg font-bold">Error: ${escaparHTML(e.message)}</div>`;
  }
}

// Calcula qué se escribiría para un doc: null si nada, o { tipo, data, campos }.
// tipo 'nuevo' = doc no existe en destino. 'completar' = existe pero faltan campos/registros.
function _planearDoc(col, rootData, destData) {
  if (!destData) return { tipo: 'nuevo', data: rootData, campos: ['(documento completo)'] };

  const upd = {};
  const campos = [];

  // Gap-fill de campos de primer nivel (no toca 'registros', se maneja aparte)
  Object.keys(rootData).forEach(k => {
    if (k === 'registros') return;
    if (_valPresente(rootData[k]) && !_valPresente(destData[k])) {
      upd[k] = rootData[k];
      campos.push(k);
    }
  });

  // Asistencias: rellenar solo los alumnos que faltan/están vacíos en el destino
  if (col === 'asistencias' && rootData.registros) {
    const destReg = destData.registros || {};
    const regUpd = {};
    Object.entries(rootData.registros).forEach(([alu, val]) => {
      if (_valPresente(val) && !_valPresente(destReg[alu])) regUpd[alu] = val;
    });
    if (Object.keys(regUpd).length) {
      upd.registros = regUpd;  // set merge fusiona claves sin borrar las existentes
      campos.push(`${Object.keys(regUpd).length} registro(s) de alumno`);
    }
  }

  if (Object.keys(upd).length === 0) return null;
  return { tipo: 'completar', data: upd, campos };
}

export async function previsualizarReconciliacion() {
  if (window.app.currentUser?.rolActivo !== 'SUPERADMIN') return;
  if (!_rootMigracionData) { showToast('Primero analizá los datos de root.', 'error'); return; }

  const tenant = document.getElementById('migracionEscuelaDestino')?.value;
  if (!tenant) { showToast('Elegí la escuela destino.', 'error'); return; }

  const cont = document.getElementById('migracionRootResultados');
  cont.innerHTML = `<div class="text-center py-6"><i class="ph ph-spinner animate-spin text-2xl text-indigo-500"></i><p class="text-sm text-slate-500 mt-2">Comparando root con ${escaparHTML(tenant)}...</p></div>`;

  try {
    const [dEst, dEval, dAsist, dLocks] = await Promise.all([
      getDocs(collection(db, _tenantColPath(tenant, 'estudiantes'))),
      getDocs(collection(db, _tenantColPath(tenant, 'evaluaciones'))),
      getDocs(collection(db, _tenantColPath(tenant, 'asistencias'))),
      getDocs(collection(db, _tenantColPath(tenant, 'evaluaciones_locks'))),
    ]);
    const destMaps = {
      estudiantes: new Map(dEst.docs.map(d => [d.id, d.data()])),
      evaluaciones: new Map(dEval.docs.map(d => [d.id, d.data()])),
      asistencias: new Map(dAsist.docs.map(d => [d.id, d.data()])),
      evaluaciones_locks: new Map(dLocks.docs.map(d => [d.id, d.data()])),
    };

    const cols = [
      ['estudiantes', _rootMigracionData.estudiantes],
      ['evaluaciones', _rootMigracionData.evaluaciones],
      ['asistencias', _rootMigracionData.asistencias],
      ['evaluaciones_locks', _rootMigracionData.locks],
    ];

    const plan = [];
    const resumen = {};
    cols.forEach(([col, lista]) => {
      resumen[col] = { nuevo: 0, completar: 0, sinCambio: 0 };
      lista.forEach(({ id, data }) => {
        const p = _planearDoc(col, data, destMaps[col].get(id));
        if (!p) { resumen[col].sinCambio++; return; }
        resumen[col][p.tipo]++;
        plan.push({ col, id, tipo: p.tipo, data: p.data, campos: p.campos });
      });
    });

    _reconPlan = { tenant, plan };

    const totalCambios = plan.length;
    if (totalCambios === 0) {
      cont.innerHTML = `<div class="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 p-4 rounded-lg font-bold flex items-center gap-2 border border-emerald-200 dark:border-emerald-800">
        <i class="ph ph-check-circle text-2xl"></i> "${escaparHTML(tenant)}" ya tiene todo lo de root. No hay nada que reconciliar (dato bueno intacto).
      </div>`;
      return;
    }

    const filaResumen = (col, label) => `
      <tr class="border-b dark:border-slate-700">
        <td class="p-2 font-semibold text-slate-700 dark:text-slate-200">${label}</td>
        <td class="p-2 text-center text-emerald-600 font-bold">${resumen[col].nuevo}</td>
        <td class="p-2 text-center text-blue-600 font-bold">${resumen[col].completar}</td>
        <td class="p-2 text-center text-slate-400">${resumen[col].sinCambio}</td>
      </tr>`;

    // Detalle de los 'completar' de calificaciones y asistencias (lo relevante)
    const detalles = plan
      .filter(p => p.tipo !== 'nuevo' || p.col === 'evaluaciones' || p.col === 'asistencias')
      .slice(0, 40)
      .map(p => `<tr class="border-b dark:border-slate-800">
        <td class="p-2 text-xs">${p.tipo === 'nuevo' ? '<span class="text-emerald-600 font-bold">NUEVO</span>' : '<span class="text-blue-600 font-bold">completar</span>'}</td>
        <td class="p-2 text-xs text-slate-500">${escaparHTML(p.col)}</td>
        <td class="p-2 text-xs font-mono text-slate-400">${escaparHTML(p.id.substring(0, 28))}</td>
        <td class="p-2 text-xs text-slate-600 dark:text-slate-300">${escaparHTML(p.campos.join(', '))}</td>
      </tr>`).join('');

    cont.innerHTML = `
      <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg mb-4">
        <h4 class="font-bold text-blue-800 dark:text-blue-300 flex items-center gap-2 mb-2"><i class="ph ph-git-diff"></i> Plan de reconciliación → "${escaparHTML(tenant)}"</h4>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="text-[11px] uppercase text-slate-500"><tr>
              <th class="p-2 text-left">Colección</th><th class="p-2 text-center">Nuevos</th><th class="p-2 text-center">Completar</th><th class="p-2 text-center">Sin cambio</th>
            </tr></thead>
            <tbody>
              ${filaResumen('estudiantes', 'Estudiantes')}
              ${filaResumen('evaluaciones', 'Calificaciones')}
              ${filaResumen('asistencias', 'Asistencias')}
              ${filaResumen('evaluaciones_locks', 'Bloqueos')}
            </tbody>
          </table>
        </div>
        <p class="text-xs text-slate-500 mt-2">Nuevos = no existen en la escuela. Completar = existen pero se rellenan campos vacíos. Sin cambio = ya están completos (no se tocan).</p>
      </div>
      <div class="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 mb-4">
        <table class="w-full text-sm">
          <thead class="bg-slate-50 dark:bg-slate-800 text-[11px] uppercase text-slate-500"><tr>
            <th class="p-2 text-left">Acción</th><th class="p-2 text-left">Colección</th><th class="p-2 text-left">Doc</th><th class="p-2 text-left">Qué se agrega</th>
          </tr></thead>
          <tbody>${detalles}</tbody>
        </table>
      </div>
      ${plan.length > 40 ? `<p class="text-xs text-slate-400 mb-3">Mostrando 40 de ${plan.length} cambios.</p>` : ''}
      <button onclick="app.aplicarReconciliacion()" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-5 rounded-lg transition flex items-center gap-2 text-sm">
        <i class="ph ph-check-fat"></i> Aplicar reconciliación (${totalCambios} cambios)
      </button>`;
  } catch(e) {
    console.error(e);
    cont.innerHTML = `<div class="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 p-4 rounded-lg font-bold">Error: ${escaparHTML(e.message)}</div>`;
  }
}

export async function aplicarReconciliacion() {
  if (window.app.currentUser?.rolActivo !== 'SUPERADMIN') return;
  if (!_reconPlan || !_reconPlan.plan.length) { showToast('Previsualizá primero.', 'error'); return; }

  const { tenant, plan } = _reconPlan;
  const nuevos = plan.filter(p => p.tipo === 'nuevo').length;
  const completar = plan.filter(p => p.tipo === 'completar').length;

  const ok = await window.app.showConfirm(
    'Aplicar reconciliación',
    `En "${tenant}":\n- ${nuevos} documento(s) nuevos\n- ${completar} documento(s) a completar (solo campos vacíos)\n\nNo se pisa ningún valor existente. No se borra nada de root.\n\n¿Confirmar?`
  );
  if (!ok) return;

  const cont = document.getElementById('migracionRootResultados');
  try {
    let escritos = 0;
    for (let i = 0; i < plan.length; i += 450) {
      const chunk = plan.slice(i, i + 450);
      const batch = writeBatch(db);
      chunk.forEach(p => {
        const ref = doc(db, _tenantColPath(tenant, p.col), p.id);
        batch.set(ref, p.data, { merge: true });
      });
      await batch.commit();
      escritos += chunk.length;
    }

    showToast(`✅ Reconciliación aplicada: ${escritos} cambio(s) en "${tenant}". Nada bueno se pisó.`, 'success');
    cont.innerHTML = `<div class="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 p-4 rounded-lg font-bold flex items-center gap-2 border border-emerald-200 dark:border-emerald-800">
      <i class="ph ph-check-circle text-2xl"></i> Reconciliación completa: ${escritos} cambio(s) en "${escaparHTML(tenant)}". Entrá al contexto de esa escuela para verificar.
    </div>`;
    _reconPlan = null;
  } catch(e) {
    console.error(e);
    showToast('Error al aplicar: ' + e.message, 'error');
    cont.innerHTML = `<div class="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 p-4 rounded-lg font-bold">Error: ${escaparHTML(e.message)}. Es seguro reintentar (aditivo, idempotente).</div>`;
  }
}

// ==========================================
// BACKUP TOTAL DE LA BASE (root + todas las escuelas)
// ==========================================
export async function backupTotalBaseDatos() {
  if (window.app.currentUser?.rolActivo !== 'SUPERADMIN') return;

  const cont = document.getElementById('backupTotalResultados');
  if (cont) cont.innerHTML = `<div class="text-center py-4"><i class="ph ph-spinner animate-spin text-2xl text-indigo-500"></i><p class="text-sm text-slate-500 mt-2">Leyendo toda la base...</p></div>`;

  const COLS = ['estudiantes', 'asistencias', 'evaluaciones', 'evaluaciones_locks', 'materias', 'horarios', 'config'];

  try {
    // Globales
    const [snapUsuarios, snapEscuelas] = await Promise.all([
      getDocs(collection(db, getPath('usuarios'))),
      getDocs(collection(db, getPath('escuelas'))),
    ]);

    const backup = {
      exportado: new Date().toISOString(),
      version: '2.0-total',
      globales: { usuarios: {}, escuelas: {} },
      namespaces: {},   // { root: {col: {id: data}}, EEM1DE20: {...}, ... }
    };
    snapUsuarios.forEach(d => { backup.globales.usuarios[d.id] = d.data(); });
    snapEscuelas.forEach(d => { backup.globales.escuelas[d.id] = d.data(); });

    // Namespaces: root + cada escuela
    const tenants = ['root', ...snapEscuelas.docs.map(d => d.id)];

    let totalDocs = 0;
    for (const ns of tenants) {
      backup.namespaces[ns] = {};
      for (const col of COLS) {
        const path = ns === 'root' ? _rootColPath(col) : _tenantColPath(ns, col);
        try {
          const snap = await getDocs(collection(db, path));
          const obj = {};
          snap.forEach(d => { obj[d.id] = d.data(); });
          backup.namespaces[ns][col] = obj;
          totalDocs += snap.size;
        } catch(colErr) {
          backup.namespaces[ns][col] = { __error: colErr.message };
        }
      }
    }

    const fecha = new Date().toISOString().split('T')[0];
    const blob  = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url   = URL.createObjectURL(blob);
    const a     = Object.assign(document.createElement('a'), { href: url, download: `backup_TOTAL_sideac_${fecha}.json` });
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);

    const resumen = tenants.map(ns => {
      const c = backup.namespaces[ns];
      return `${ns}: ${Object.keys(c.estudiantes||{}).length} est · ${Object.keys(c.evaluaciones||{}).length} calif · ${Object.keys(c.asistencias||{}).length} asist`;
    }).join('<br>');

    showToast(`✅ Backup TOTAL descargado: ${totalDocs} documentos.`, 'success');
    if (cont) cont.innerHTML = `<div class="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 p-4 rounded-lg border border-emerald-200 dark:border-emerald-800">
      <p class="font-bold flex items-center gap-2 mb-2"><i class="ph ph-check-circle text-xl"></i> Backup descargado (${totalDocs} docs · ${Object.keys(backup.globales.usuarios).length} usuarios)</p>
      <p class="text-xs font-mono leading-relaxed">${resumen}</p>
    </div>`;
  } catch(e) {
    console.error(e);
    if (cont) cont.innerHTML = `<div class="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 p-4 rounded-lg font-bold">Error: ${escaparHTML(e.message)}</div>`;
  }
}

// ==========================================
// LIMPIEZA DE ROOT (borra datos operativos redundantes)
// ==========================================
// Solo borra las 4 colecciones operativas de root (estudiantes, evaluaciones,
// asistencias, evaluaciones_locks) DESPUÉS de verificar que cada doc existe en la
// escuela canónica. Nunca toca usuarios/escuelas (globales) ni materias/horarios/config.
const _COLS_LIMPIEZA = ['estudiantes', 'evaluaciones', 'asistencias', 'evaluaciones_locks'];
let _planLimpiezaRoot = null;

export async function prepararLimpiezaRoot() {
  if (window.app.currentUser?.rolActivo !== 'SUPERADMIN') return;
  const cont = document.getElementById('limpiezaRootResultados');
  cont.innerHTML = `<div class="text-center py-3"><i class="ph ph-spinner animate-spin text-xl text-indigo-500"></i></div>`;
  try {
    const snapEsc = await getDocs(collection(db, getPath('escuelas')));
    const opts = snapEsc.docs.map(d => `<option value="${escaparHTML(d.id)}">${escaparHTML(d.data().nombre || d.id)}</option>`).join('');
    cont.innerHTML = `
      <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-lg">
        <label class="text-sm font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">Copia buena está en:</label>
        <select id="limpiezaEscuelaCanonica" class="flex-1 p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">— Seleccionar escuela canónica —</option>${opts}
        </select>
        <button onclick="app.analizarLimpiezaRoot()" class="bg-slate-700 hover:bg-slate-800 text-white font-bold py-2 px-5 rounded-lg transition flex items-center justify-center gap-2 text-sm whitespace-nowrap"><i class="ph ph-shield-check"></i> Verificar y analizar</button>
      </div>`;
  } catch(e) {
    cont.innerHTML = `<div class="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 p-4 rounded-lg font-bold">Error: ${escaparHTML(e.message)}</div>`;
  }
}

export async function analizarLimpiezaRoot() {
  if (window.app.currentUser?.rolActivo !== 'SUPERADMIN') return;

  const tenant = document.getElementById('limpiezaEscuelaCanonica')?.value;
  if (!tenant) { showToast('Elegí la escuela que tiene la copia buena.', 'error'); return; }

  const cont = document.getElementById('limpiezaRootResultados');
  cont.innerHTML = `<div class="text-center py-4"><i class="ph ph-spinner animate-spin text-2xl text-indigo-500"></i><p class="text-sm text-slate-500 mt-2">Verificando que ${escaparHTML(tenant)} tenga todo lo de root...</p></div>`;

  try {
    const faltantes = [];   // docs de root que NO están en la escuela → bloquean el borrado
    const aBorrar = [];     // { col, id }
    let totalRoot = 0;

    for (const col of _COLS_LIMPIEZA) {
      const [snapRoot, snapDest] = await Promise.all([
        getDocs(collection(db, _rootColPath(col))),
        getDocs(collection(db, _tenantColPath(tenant, col))),
      ]);
      const destIds = new Set(snapDest.docs.map(d => d.id));
      snapRoot.forEach(d => {
        totalRoot++;
        if (destIds.has(d.id)) aBorrar.push({ col, id: d.id });
        else faltantes.push({ col, id: d.id });
      });
    }

    if (totalRoot === 0) {
      cont.innerHTML = `<div class="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 p-4 rounded-lg font-bold flex items-center gap-2 border border-emerald-200 dark:border-emerald-800"><i class="ph ph-check-circle text-2xl"></i> Root ya está limpio.</div>`;
      return;
    }

    if (faltantes.length > 0) {
      _planLimpiezaRoot = null;
      const filas = faltantes.slice(0, 30).map(f => `<tr class="border-b dark:border-slate-800"><td class="p-2 text-xs text-slate-500">${escaparHTML(f.col)}</td><td class="p-2 text-xs font-mono">${escaparHTML(f.id)}</td></tr>`).join('');
      cont.innerHTML = `<div class="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-4 rounded-lg">
        <p class="font-bold text-red-700 dark:text-red-300 flex items-center gap-2 mb-2"><i class="ph ph-warning-octagon text-xl"></i> NO se puede limpiar: ${faltantes.length} doc(s) de root NO están en "${escaparHTML(tenant)}".</p>
        <p class="text-xs text-slate-500 mb-2">Borrar ahora perdería esos datos. Reconciliá primero (o revisá si la escuela canónica es la correcta).</p>
        <div class="overflow-x-auto rounded border border-red-100 dark:border-red-900"><table class="w-full text-sm"><thead class="bg-red-50 dark:bg-red-900/30 text-[11px] uppercase text-red-700"><tr><th class="p-2 text-left">Colección</th><th class="p-2 text-left">Doc</th></tr></thead><tbody>${filas}</tbody></table></div>
      </div>`;
      return;
    }

    _planLimpiezaRoot = { tenant, aBorrar };
    const porCol = _COLS_LIMPIEZA.map(c => `${c}: ${aBorrar.filter(x => x.col === c).length}`).join(' · ');
    cont.innerHTML = `<div class="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 p-4 rounded-lg">
      <p class="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-2 mb-2"><i class="ph ph-check-circle text-xl"></i> Verificado: los ${aBorrar.length} docs de root ya están en "${escaparHTML(tenant)}".</p>
      <p class="text-xs font-mono text-slate-600 dark:text-slate-300 mb-3">${porCol}</p>
      <p class="text-xs text-slate-500 mb-3">Se borrarán SOLO de root. No se toca usuarios, escuelas, ni materias/horarios/config de root. Irreversible (por eso el backup).</p>
      <button onclick="app.ejecutarLimpiezaRoot()" class="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-5 rounded-lg transition flex items-center gap-2 text-sm"><i class="ph ph-trash"></i> Borrar ${aBorrar.length} docs de root</button>
    </div>`;
  } catch(e) {
    console.error(e);
    cont.innerHTML = `<div class="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 p-4 rounded-lg font-bold">Error: ${escaparHTML(e.message)}</div>`;
  }
}

export async function ejecutarLimpiezaRoot() {
  if (window.app.currentUser?.rolActivo !== 'SUPERADMIN') return;
  if (!_planLimpiezaRoot || !_planLimpiezaRoot.aBorrar.length) { showToast('Analizá la limpieza primero.', 'error'); return; }

  const { tenant, aBorrar } = _planLimpiezaRoot;

  const ok = await window.app.showConfirm(
    'Borrar datos de root',
    `Se borrarán ${aBorrar.length} documentos de ROOT (estudiantes, calificaciones, asistencias, bloqueos).\n\nYa verificado que todos existen en "${tenant}". ¿Descargaste el backup total?\n\nEsto es IRREVERSIBLE. ¿Confirmar?`
  );
  if (!ok) return;

  const cont = document.getElementById('limpiezaRootResultados');
  try {
    let borrados = 0;
    for (let i = 0; i < aBorrar.length; i += 450) {
      const chunk = aBorrar.slice(i, i + 450);
      const batch = writeBatch(db);
      chunk.forEach(it => batch.delete(doc(db, _rootColPath(it.col), it.id)));
      await batch.commit();
      borrados += chunk.length;
    }
    showToast(`✅ Root limpio: ${borrados} documentos borrados.`, 'success');
    cont.innerHTML = `<div class="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 p-4 rounded-lg font-bold flex items-center gap-2 border border-emerald-200 dark:border-emerald-800"><i class="ph ph-check-circle text-2xl"></i> Root limpio: ${borrados} documentos borrados. Los datos siguen en "${escaparHTML(tenant)}".</div>`;
    _planLimpiezaRoot = null;
  } catch(e) {
    console.error(e);
    showToast('Error al borrar: ' + e.message, 'error');
    cont.innerHTML = `<div class="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 p-4 rounded-lg font-bold">Error: ${escaparHTML(e.message)}. Reintentá (idempotente).</div>`;
  }
}
