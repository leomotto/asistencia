import { db, getPath } from "./firebase-config.js?v=9.52";
import { collection, getDocs, writeBatch, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { showToast } from "./ui.js?v=9.52";

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
      // Nombre oficial en formato: "Materia Curso Division"
      const nombreCompleto = `${m.nombre} ${m.curso || m.materiaBase || ''} ${m.division || ''}`.replace(/\s+/g, ' ').trim();
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
            if (!huerfanos[mat]) huerfanos[mat] = [];
            huerfanos[mat].push(est);
          }
        });
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
              <th class="p-3 font-bold text-center">Alumnos Afectados</th>
              <th class="p-3 font-bold">Mapear a Materia Oficial...</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200 dark:divide-slate-700">
    `;
    
    const grupos = {};
    datosAuditoria.materiasOficiales.forEach(m => {
      const c = m.curso || 'Sin Curso';
      if (!grupos[c]) grupos[c] = [];
      grupos[c].push(m);
    });

    let opcionesOficiales = '';
    Object.keys(grupos).sort().forEach(curso => {
      opcionesOficiales += `<optgroup label="Curso: ${curso}">`;
      grupos[curso].forEach(m => {
        const divStr = m.division ? ` (Div: ${m.division})` : '';
        opcionesOficiales += `<option value="${m.nombreCompleto}">${m.nombre}${divStr}</option>`;
      });
      opcionesOficiales += `</optgroup>`;
    });
    
    Object.keys(huerfanos).sort().forEach(matVieja => {
      html += `
        <tr class="bg-white dark:bg-slate-900">
          <td class="p-3 font-bold text-rose-600 dark:text-rose-400">
            "${matVieja}"
            <div class="mt-2 text-xs font-normal text-slate-500 dark:text-slate-400">
              <b>Alumnos (${huerfanos[matVieja].length}):</b> 
              ${huerfanos[matVieja].map(e => `${e.apellido}, ${e.nombre}`).join(' &bull; ')}
            </div>
          </td>
          <td class="p-3 text-center font-mono bg-slate-50 dark:bg-slate-800/50">${huerfanos[matVieja].length}</td>
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
  
  alert(`SIMULACIÓN:\n\nSe han definido ${cambios} reglas de reemplazo.\n\nFase 2 Completada. \n\n(La ejecución real de Base de Datos se implementará en el siguiente paso del Roadmap, luego de que valides que estas son las inconsistencias reales a arreglar).`);
  console.log("Mapa de migración generado:", mapa);
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
  
  const confirmar = confirm(`Vas a migrar ${cambios} strings huérfanos.\n\nFase 3: Se descargará un Backup en formato JSON automáticamente.\nFase 4: Se actualizarán los estudiantes, asistencias y evaluaciones afectados.\n\n¿Deseas continuar?`);
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
    a.click();
    
    // FASE 4: MIGRACION ATOMICA
    progresoMsg.textContent = "🚀 Fase 4: Ejecutando WriteBatch atómico...";
    const batch = writeBatch(db);
    
    // 1. Estudiantes
    snapEst.forEach(d => {
      const data = d.data();
      if (data.materias && Array.isArray(data.materias)) {
        let modificado = false;
        // Evitar duplicados si por error tenia el viejo y el nuevo al mismo tiempo
        const nuevasMateriasSet = new Set();
        data.materias.forEach(m => {
          if (mapa[m]) {
            modificado = true;
            nuevasMateriasSet.add(mapa[m]);
          } else {
            nuevasMateriasSet.add(m);
          }
        });
        
        if (modificado) {
          const nuevoCursoPrin = mapa[data.curso] ? mapa[data.curso] : data.curso;
          batch.update(d.ref, { 
            materias: Array.from(nuevasMateriasSet),
            curso: nuevoCursoPrin
          });
        }
      }
    });
    
    // 2. Asistencias
    snapAsist.forEach(d => {
      const data = d.data();
      if (mapa[data.curso]) {
        const matNueva = mapa[data.curso];
        const nuevoDocId = `${matNueva.replace(/\s+/g, '')}_${data.fecha}`;
        const nuevaRef = doc(db, getPath('asistencias'), nuevoDocId);
        
        // merge: true por si ya habia un documento ese mismo dia para la materia oficial
        batch.set(nuevaRef, {
          ...data,
          curso: matNueva
        }, { merge: true });
        
        // Borramos el documento viejo con el string huérfano
        batch.delete(d.ref);
      }
    });
    
    // 3. Evaluaciones
    snapEval.forEach(d => {
      const data = d.data();
      if (mapa[data.curso]) {
        const matNueva = mapa[data.curso];
        const nuevoDocId = `${data.alumnoId}_${matNueva.replace(/\s+/g, '')}`;
        const nuevaRef = doc(db, getPath('evaluaciones'), nuevoDocId);
        
        batch.set(nuevaRef, {
          ...data,
          curso: matNueva
        }, { merge: true });
        
        batch.delete(d.ref);
      }
    });
    
    await batch.commit();
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
