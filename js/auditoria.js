import { db, getPath } from "./firebase-config.js?v=10.33";
import { collection, getDocs, writeBatch, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { showToast } from "./ui.js?v=10.33";
import { escaparHTML } from "./utils.js?v=10.33";

let datosAuditoria = {
  materiasOficiales: [],
  estudiantesConProblemas: []
};

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

let _lastFaltantes   = [];
let _lastCoincidentes = [];

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

  // Acepta formato procesado {apellidos,nombres} o raw MiEscuela {alumno.persona.*}
  // apOrig/noOrig: valor ORIGINAL del JSON (con ñ, acentos) — se usa al escribir en Firebase.
  // ap/no: normalizado sin tildes — solo para la clave de comparación.
  const refMap = new Map();
  refList.forEach(item => {
    const apOrig = (item.apellidos || item.apellido || item.alumno?.persona?.apellido || '').trim();
    const noOrig = (item.nombres   || item.nombre  || item.alumno?.persona?.nombre   || '').trim();
    if (!apOrig || !noOrig) return;
    const key = _normKey(_normStr(apOrig), _normStr(noOrig));
    if (!refMap.has(key)) refMap.set(key, {
      apOrig, noOrig,
      seccion:      item.seccion_completa || item.seccion?.nombreSeccion || '',
      dni:          item.dni || item.alumno?.persona?.documento || '',
      email:        item.email || item.alumno?.persona?.email || '',
      id_miescuela: item.id_miescuela || item.alumno?.idAlumno || '',
    });
  });

  const container = document.getElementById('matriculaResultados');
  container.innerHTML = `<div class="text-center py-6"><i class="ph ph-spinner animate-spin text-2xl text-indigo-500"></i><p class="text-sm text-slate-500 mt-2">Consultando Firebase...</p></div>`;

  try {
    // Carga paralela: estudiantes + materias (para obtener divisiones SIDEAC)
    const [snap, snapMat] = await Promise.all([
      getDocs(collection(db, getPath('estudiantes'))),
      getDocs(collection(db, getPath('materias'))),
    ]);

    // Divisiones registradas en SIDEAC (de la colección materias)
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
        id:    d.id,
        curso: data.curso || '',
        dni:   data.dni   || '',
        email: data.email || '',
        estado: data.estado || '',
      });
    });

    console.log('[Comparador] Firebase keys (primeras 5):', [...dbMap.keys()].slice(0, 5));
    console.log('[Comparador] Referencia keys (primeras 5):', [...refMap.keys()].slice(0, 5));

    const faltanEnDB    = [...refMap.entries()].filter(([k]) => !dbMap.has(k)).map(([, v]) => v);
    const sobranEnDB    = [...dbMap.entries()].filter(([k]) => !refMap.has(k)).map(([, v]) => v);
    const coincidenList = [...dbMap.entries()]
      .filter(([k]) => refMap.has(k))
      .map(([k, dbV]) => ({ ...dbV, ref: refMap.get(k) }));

    _lastFaltantes    = [...faltanEnDB].sort((a, b) => a.apOrig.localeCompare(b.apOrig));
    _lastCoincidentes = coincidenList;

    // Opciones de divisiones SIDEAC para el select de importación
    const opcionesDivisiones = sideacDivisiones.length
      ? sideacDivisiones.map(d => `<option value="${escaparHTML(d)}">${escaparHTML(d)}</option>`).join('')
      : '<option value="">— sin divisiones registradas —</option>';

    let html = `
      <div class="grid grid-cols-4 gap-3 mb-6">
        <div class="bg-emerald-50 dark:bg-emerald-900/30 rounded-xl p-3 text-center">
          <p class="text-2xl font-black text-emerald-600 dark:text-emerald-400">${dbMap.size}</p>
          <p class="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 uppercase">En Firebase</p>
        </div>
        <div class="bg-blue-50 dark:bg-blue-900/30 rounded-xl p-3 text-center">
          <p class="text-2xl font-black text-blue-600 dark:text-blue-400">${refMap.size}</p>
          <p class="text-[11px] font-bold text-blue-700 dark:text-blue-300 uppercase">En Referencia</p>
        </div>
        <div class="bg-slate-50 dark:bg-slate-700 rounded-xl p-3 text-center">
          <p class="text-2xl font-black text-slate-700 dark:text-slate-200">${coincidenList.length}</p>
          <p class="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase">Coinciden</p>
        </div>
        <div class="bg-red-50 dark:bg-red-900/30 rounded-xl p-3 text-center">
          <p class="text-2xl font-black text-red-600 dark:text-red-400">${faltanEnDB.length}</p>
          <p class="text-[11px] font-bold text-red-700 dark:text-red-300 uppercase">Faltan en BD</p>
        </div>
      </div>`;

    // ── FALTAN EN FIREBASE ──
    if (_lastFaltantes.length > 0) {
      const rows = _lastFaltantes.map((e, i) => {
        // Pre-seleccionar la división SIDEAC que más se parece a la sección del JSON
        const secNorm = _normStr(e.seccion);
        const presel  = sideacDivisiones.find(d => _normStr(d) === secNorm) || '';
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

    // ── COINCIDENTES (con opción de actualizar datos del JSON) ──
    if (coincidenList.length > 0) {
      // Solo mostramos en la tabla de actualización los que tienen diferencias
      const conDif = coincidenList.filter(e => {
        const dniDif   = e.ref.dni && e.ref.dni !== e.dni;
        const dniVacio = !e.dni && e.ref.dni;
        const apDif    = _normStr(e.ref.apOrig) !== _normStr(e.apOrig);
        const noDif    = _normStr(e.ref.noOrig) !== _normStr(e.noOrig);
        return dniDif || dniVacio || apDif || noDif;
      });

      const rowsAll = coincidenList
        .sort((a, b) => a.apOrig.localeCompare(b.apOrig))
        .map(e => `<tr class="bg-white dark:bg-slate-900">
          <td class="p-2 font-semibold text-slate-800 dark:text-slate-200">${escaparHTML(e.apOrig)}</td>
          <td class="p-2 text-slate-700 dark:text-slate-300">${escaparHTML(e.noOrig)}</td>
          <td class="p-2 text-xs text-slate-400">${escaparHTML(e.curso)}</td>
          <td class="p-2 text-xs font-mono text-slate-400">${escaparHTML(e.dni)}</td>
        </tr>`).join('');

      let updateBlock = '';
      if (conDif.length > 0) {
        const rowsDif = conDif
          .sort((a, b) => a.apOrig.localeCompare(b.apOrig))
          .map((e, i) => {
            const dniTag  = e.ref.dni && e.ref.dni !== e.dni
              ? `<span class="text-amber-600 font-bold">${escaparHTML(e.ref.dni)}</span>`
              : (e.ref.dni && !e.dni ? `<span class="text-red-600 font-bold">${escaparHTML(e.ref.dni)}</span>` : `<span class="text-slate-400">${escaparHTML(e.ref.dni||'—')}</span>`);
            const apTag   = _normStr(e.ref.apOrig) !== _normStr(e.apOrig)
              ? `<span class="text-amber-600">${escaparHTML(_titleCase(e.ref.apOrig))}</span>` : '—';
            const noTag   = _normStr(e.ref.noOrig) !== _normStr(e.noOrig)
              ? `<span class="text-amber-600">${escaparHTML(_titleCase(e.ref.noOrig))}</span>` : '—';
            return `
            <tr class="bg-white dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-blue-900/20">
              <td class="p-2 text-center"><input type="checkbox" class="chk-actualizar w-4 h-4 accent-blue-600" data-idx="${i}" checked></td>
              <td class="p-2 font-semibold text-slate-700 dark:text-slate-200">${escaparHTML(e.apOrig)}, ${escaparHTML(e.noOrig)}</td>
              <td class="p-2 text-xs">${dniTag}</td>
              <td class="p-2 text-xs">${apTag}</td>
              <td class="p-2 text-xs">${noTag}</td>
            </tr>`;
          }).join('');
        updateBlock = `
          <div class="mt-4 border-t border-emerald-200 dark:border-emerald-800 pt-4">
            <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
              <p class="text-sm font-bold text-blue-700 dark:text-blue-400 flex items-center gap-2">
                <i class="ph ph-arrows-clockwise text-base"></i> ${conDif.length} con diferencias de datos (DNI / nombre)
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
                  <th class="p-2 text-left font-bold text-blue-800 dark:text-blue-300">Alumno en BD</th>
                  <th class="p-2 text-left font-bold text-blue-800 dark:text-blue-300">DNI del JSON</th>
                  <th class="p-2 text-left font-bold text-blue-800 dark:text-blue-300">Apellido del JSON</th>
                  <th class="p-2 text-left font-bold text-blue-800 dark:text-blue-300">Nombre del JSON</th>
                </tr></thead>
                <tbody class="divide-y divide-blue-100 dark:divide-blue-900">${rowsDif}</tbody>
              </table>
            </div>
            <p class="text-xs text-slate-400 mt-2">Naranja = valor distinto al actual. Solo se actualiza lo que tenga valor nuevo en el JSON.</p>
          </div>`;
      }

      html += `
        <details class="mb-6 group">
          <summary class="cursor-pointer list-none flex items-center gap-2 font-bold text-emerald-700 dark:text-emerald-400 text-sm select-none">
            <i class="ph ph-caret-right text-base group-open:rotate-90 transition-transform"></i>
            <i class="ph ph-check-circle text-lg"></i> Coinciden — ${coincidenList.length} estudiante(s)${conDif.length ? ` · <span class="text-blue-600">${conDif.length} con diferencias</span>` : ''} — clic para ver
          </summary>
          <div class="overflow-x-auto rounded-lg border border-emerald-100 dark:border-emerald-900 mt-3">
            <table class="w-full text-sm">
              <thead class="bg-emerald-50 dark:bg-emerald-900/30"><tr>
                <th class="p-2 text-left font-bold text-emerald-800 dark:text-emerald-300">Apellido</th>
                <th class="p-2 text-left font-bold text-emerald-800 dark:text-emerald-300">Nombre</th>
                <th class="p-2 text-left font-bold text-emerald-800 dark:text-emerald-300">División</th>
                <th class="p-2 text-left font-bold text-emerald-800 dark:text-emerald-300">DNI en BD</th>
              </tr></thead>
              <tbody class="divide-y divide-emerald-100 dark:divide-emerald-900">${rowsAll}</tbody>
            </table>
          </div>
          ${updateBlock}
        </details>`;
    }

    // ── SOBRAN EN FIREBASE ──
    if (sobranEnDB.length > 0) {
      const rows = sobranEnDB
        .sort((a, b) => a.apOrig.localeCompare(b.apOrig))
        .map(e => `<tr class="bg-white dark:bg-slate-900 hover:bg-amber-50 dark:hover:bg-amber-900/20">
          <td class="p-2 font-semibold text-slate-800 dark:text-slate-200">${escaparHTML(e.apOrig)}</td>
          <td class="p-2 text-slate-700 dark:text-slate-300">${escaparHTML(e.noOrig)}</td>
          <td class="p-2 text-xs text-slate-400">${escaparHTML(e.curso)}</td></tr>`)
        .join('');
      html += `
        <div>
          <h4 class="font-bold text-amber-700 dark:text-amber-400 flex items-center gap-2 mb-3 text-sm">
            <i class="ph ph-user-plus text-lg"></i> Sobran en Firebase — ${sobranEnDB.length} estudiante(s)
            <span class="text-xs font-normal text-slate-400">(en la BD pero no en la referencia)</span>
          </h4>
          <div class="overflow-x-auto rounded-lg border border-amber-100 dark:border-amber-900">
            <table class="w-full text-sm">
              <thead class="bg-amber-50 dark:bg-amber-900/30"><tr>
                <th class="p-2 text-left font-bold text-amber-800 dark:text-amber-300">Apellido</th>
                <th class="p-2 text-left font-bold text-amber-800 dark:text-amber-300">Nombre</th>
                <th class="p-2 text-left font-bold text-amber-800 dark:text-amber-300">División en BD</th>
              </tr></thead>
              <tbody class="divide-y divide-amber-100 dark:divide-amber-900">${rows}</tbody>
            </table>
          </div>
        </div>`;
    }

    if (faltanEnDB.length === 0 && sobranEnDB.length === 0) {
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
    showToast(`${sinDiv.length} alumno(s) sin división SIDEAC asignada. Elegí la división antes de importar.`, 'error');
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
      const ref = doc(collection(db, getPath('estudiantes')));
      batch.set(ref, {
        apellido:     _titleCase(s.apOrig),
        nombre:       _titleCase(s.noOrig),
        curso:        s.divisionSideac,
        dni:          s.dni          || '',
        email:        s.email        || '',
        id_miescuela: s.id_miescuela || '',
        estado:       'activo',
        materias:     [],
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

export async function actualizarCoincidentes() {
  if (window.app.currentUser?.rolActivo !== 'SUPERADMIN') return;

  const checks = [...document.querySelectorAll('.chk-actualizar:checked')];
  if (!checks.length) { showToast('Seleccioná al menos un estudiante.', 'error'); return; }

  // conDif es el subset con diferencias — misma lógica que en compararMatricula
  const conDif = _lastCoincidentes.filter(e => {
    const dniDif   = e.ref.dni && e.ref.dni !== e.dni;
    const dniVacio = !e.dni && e.ref.dni;
    const apDif    = _normStr(e.ref.apOrig) !== _normStr(e.apOrig);
    const noDif    = _normStr(e.ref.noOrig) !== _normStr(e.noOrig);
    return dniDif || dniVacio || apDif || noDif;
  }).sort((a, b) => a.apOrig.localeCompare(b.apOrig));

  const seleccionados = checks.map(c => conDif[+c.dataset.idx]).filter(Boolean);

  const preview = seleccionados.slice(0, 5).map(s => {
    const parts = [];
    if (s.ref.dni) parts.push(`DNI: ${s.ref.dni}`);
    if (_normStr(s.ref.apOrig) !== _normStr(s.apOrig)) parts.push(`Ap: ${_titleCase(s.ref.apOrig)}`);
    if (_normStr(s.ref.noOrig) !== _normStr(s.noOrig)) parts.push(`No: ${_titleCase(s.ref.noOrig)}`);
    return `• ${s.apOrig}, ${s.noOrig} → ${parts.join(', ')}`;
  }).join('\n');
  const extra = seleccionados.length > 5 ? `\n... y ${seleccionados.length - 5} más` : '';

  const ok = await window.app.showConfirm(
    'Actualizar datos desde JSON',
    `Se actualizarán ${seleccionados.length} estudiante(s) con los datos del JSON de referencia.\n\n${preview}${extra}\n\n¿Confirmar?`
  );
  if (!ok) return;

  try {
    const batch = writeBatch(db);
    seleccionados.forEach(s => {
      const ref = doc(db, getPath('estudiantes'), s.id);
      const upd = {};
      if (s.ref.dni)                                          upd.dni      = s.ref.dni;
      if (_normStr(s.ref.apOrig) !== _normStr(s.apOrig))     upd.apellido = _titleCase(s.ref.apOrig);
      if (_normStr(s.ref.noOrig) !== _normStr(s.noOrig))     upd.nombre   = _titleCase(s.ref.noOrig);
      if (s.ref.email && !s.email)                            upd.email    = s.ref.email;
      if (s.ref.id_miescuela && !s.id_miescuela)              upd.id_miescuela = s.ref.id_miescuela;
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
