import { doc, getDocs, deleteDoc, collection } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db, getPath } from "./firebase-config.js";

const logEl = document.getElementById('log');
function log(msg) {
  logEl.innerHTML += msg + '\n';
  logEl.scrollTop = logEl.scrollHeight;
}

let cursosSueltos = [];

document.getElementById('btnEscanear').onclick = async () => {
  document.getElementById('btnEscanear').disabled = true;
  document.getElementById('btnLimpiar').classList.add('hidden');
  logEl.innerHTML = '';
  cursosSueltos = [];
  
  log('--- INICIANDO AUDITORÍA ---');
  
  try {
    log('1. Obteniendo todas las materias...');
    const matSnap = await getDocs(collection(db, getPath("materias")));
    const materias = [];
    matSnap.forEach(d => materias.push({ id: d.id, ...d.data() }));
    
    // Identificar materias "sueltas" (ej: "A", "B", "C" como division)
    const sueltas = materias.filter(m => {
      // Si la división es exactamente A, B, C, D, E o F
      const div = (m.division || "").trim().toUpperCase();
      return ["A", "B", "C", "D", "E", "F"].includes(div);
    });
    
    log(`Se encontraron ${sueltas.length} materias "sueltas" generadas por accidente.`);
    
    if (sueltas.length === 0) {
      log('\n✅ Tu base de datos está limpia. No hay materias sin prefijo de año.');
      return;
    }

    sueltas.forEach(s => log(`   - ${s.nombre} (División: ${s.division})`));
    
    log('\n2. Verificando si estas materias tienen registros de asistencia asociados...');
    const asisSnap = await getDocs(collection(db, getPath("asistencias")));
    const asistencias = [];
    asisSnap.forEach(d => asistencias.push({ id: d.id, ...d.data() }));
    
    let asistenciasHuerfanas = 0;
    
    sueltas.forEach(s => {
      const match = asistencias.filter(a => a.curso === s.nombre);
      if (match.length > 0) {
        log(`   ⚠️ ALERTA: La materia "${s.nombre}" tiene ${match.length} planillas de asistencia registradas.`);
        asistenciasHuerfanas += match.length;
      }
    });

    log('\n3. Verificando si estas materias tienen calificaciones asociadas...');
    const evalSnap = await getDocs(collection(db, getPath("evaluaciones")));
    const evaluaciones = [];
    evalSnap.forEach(d => evaluaciones.push({ id: d.id, ...d.data() }));

    let evaluacionesHuerfanas = 0;
    sueltas.forEach(s => {
      const match = evaluaciones.filter(a => a.materia === s.nombre || a.curso === s.division);
      if (match.length > 0) {
        log(`   ⚠️ ALERTA: La materia "${s.nombre}" (Div: ${s.division}) tiene ${match.length} planillas de calificaciones registradas.`);
        evaluacionesHuerfanas += match.length;
      }
    });
    
    if (asistenciasHuerfanas === 0 && evaluacionesHuerfanas === 0) {
      log('\n✅ EXCELENTE: Ninguno de estos cursos sueltos fue usado para tomar asistencia ni calificar. Se pueden borrar de forma segura.');
      cursosSueltos = sueltas;
      document.getElementById('btnLimpiar').classList.remove('hidden');
    } else {
      log(`\n❌ PELIGRO: Existen ${asistenciasHuerfanas} asistencias y ${evaluacionesHuerfanas} planillas de notas vinculadas a estos cursos sueltos.`);
      log('No se recomienda borrarlos automáticamente sin antes corregir o migrar los alumnos a sus cursos correctos.');
    }
    
  } catch(e) {
    console.error(e);
    log('\n❌ ERROR CRÍTICO: ' + e.message);
  } finally {
    document.getElementById('btnEscanear').disabled = false;
  }
};

document.getElementById('btnLimpiar').onclick = async () => {
  if (!confirm(`¿Estás 100% seguro de eliminar ${cursosSueltos.length} materias "sueltas" de la base de datos?\nEsta acción es irreversible.`)) return;
  
  document.getElementById('btnLimpiar').disabled = true;
  log('\n--- INICIANDO LIMPIEZA ---');
  
  try {
    let borradas = 0;
    for (const s of cursosSueltos) {
      log(`Borrando: ${s.nombre}...`);
      await deleteDoc(doc(db, getPath("materias"), s.id));
      borradas++;
    }
    log(`\n✅ LIMPIEZA FINALIZADA. Se eliminaron ${borradas} materias defectuosas.`);
    cursosSueltos = [];
    document.getElementById('btnLimpiar').classList.add('hidden');
  } catch(e) {
    console.error(e);
    log('\n❌ ERROR AL BORRAR: ' + e.message);
  }
};
