// js/materias.js — Gestión de materias/divisiones y horarios dinámicos

import { doc, setDoc, getDoc, addDoc, deleteDoc, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db, getPath } from "./firebase-config.js?v=10.71";
import { showToast } from "./ui.js?v=10.71";

export const HORARIOS_DINAMICOS = {};

// ==========================================
// HELPERS
// ==========================================

export function parseDias(rawDias) {
  if (!rawDias || rawDias.length === 0) return [];
  return rawDias.map(d =>
    typeof d === 'number' ? { dia: d, horaInicio: '', horaFin: '' } : d
  );
}

const DIAS_NOMBRES = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];

function formatDiaHorario(diaObj) {
  const nombre = DIAS_NOMBRES[diaObj.dia] || `Día ${diaObj.dia}`;
  if (diaObj.horaInicio && diaObj.horaFin) return `${nombre} ${diaObj.horaInicio}–${diaObj.horaFin}`;
  if (diaObj.horaInicio) return `${nombre} ${diaObj.horaInicio}`;
  return nombre;
}

// Feature 2: selectores split H / M independientes (UX móvil)
function opcionesHoras() {
  return Array.from({length: 24}, (_, h) => {
    const v = String(h).padStart(2, '0');
    return `<option value="${v}">${v}</option>`;
  }).join('');
}
function opcionesMinutos() {
  return Array.from({length: 12}, (_, i) => {
    const v = String(i * 5).padStart(2, '0');
    return `<option value="${v}">${v}</option>`;
  }).join('');
}

// Genera dos selects H:M con el valor pre-seleccionado a partir de "08:30"
function selectHM(claseH, claseM, hora = '') {
  const [h = '', m = ''] = hora ? hora.split(':') : [];
  const selH = `<select class="${claseH} py-2 md:py-1 px-1 border dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-base md:text-xs outline-none w-12">
    <option value="">HH</option>${opcionesHoras().replace(`value="${h}"`, `value="${h}" selected`)}</select>`;
  const selM = `<select class="${claseM} py-2 md:py-1 px-1 border dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-base md:text-xs outline-none w-12">
    <option value="">MM</option>${opcionesMinutos().replace(`value="${m}"`, `value="${m}" selected`)}</select>`;
  return `${selH}<span class="font-bold">:</span>${selM}`;
}

// ==========================================
// CARGA DE MATERIAS
// ==========================================

export async function cargarMateriasDinamicas() {
  try {
    const snap = await getDocs(collection(db, getPath("materias")));
    window.app.cursos = [];
    Object.keys(HORARIOS_DINAMICOS).forEach(k => delete HORARIOS_DINAMICOS[k]);
    if (snap.empty) {
      console.warn("Colección materias vacía.");
    } else {
      snap.forEach(d => {
        const data = d.data();
        window.app.cursos.push(data.nombre);
        HORARIOS_DINAMICOS[data.nombre] = {
          dias:   parseDias(data.dias),
          nombre: data.nombreDias || '',
          materiaBase: data.materiaBase || '',
          division:    data.division    || ''
        };
      });
      window.app.cursos.sort((a, b) => a.localeCompare(b));
    }
  } catch (e) {
    console.error("Error al cargar materias de Firestore", e);
  }
}

export async function cargarListaMateriasAdmin() {
  const tbody = document.getElementById('listaMateriasAdmin');
  tbody.innerHTML = `${window.app.mostrarSkeletonTable(3, 5)}`;

  try {
    const snap = await getDocs(collection(db, getPath("materias")));
    const materias = [];
    snap.forEach(d => materias.push({ id: d.id, ...d.data() }));
    materias.sort((a, b) => a.nombre.localeCompare(b.nombre));

    if (materias.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" class="px-4 py-8 text-center text-slate-500 dark:text-slate-400 font-medium">No hay materias configuradas.</td></tr>';
      return;
    }

    tbody.innerHTML = materias.map(mat => {
      const diasParsed = parseDias(mat.dias);
      const horarioStr = diasParsed.length > 0
        ? diasParsed.map(formatDiaHorario).join(' | ')
        : 'Sin días configurados';
      const nombreSeguro = mat.nombre.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      return `
        <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors border-b dark:border-slate-700">
          <td class="px-4 py-3 font-bold text-slate-800 dark:text-slate-100">${nombreSeguro}</td>
          <td class="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">${horarioStr}</td>
          <td class="px-4 py-3 text-right">
            <button onclick="app.abrirModalMateria('${mat.id}')" class="text-blue-600 hover:text-blue-800 p-2 md:p-1" title="Editar">
              <i class="ph ph-pencil-simple text-lg"></i>
            </button>
            <button onclick="app.eliminarMateria('${mat.id}', '${nombreSeguro.replace(/'/g, "\\'")}')" class="text-red-600 hover:text-red-800 p-2 md:p-1 ml-2" title="Eliminar">
              <i class="ph ph-trash text-lg"></i>
            </button>
          </td>
        </tr>`;
    }).join('');
  } catch (e) {
    console.error(e);
    tbody.innerHTML = '<tr><td colspan="3" class="px-4 py-8 text-center text-red-500 font-medium">Error al cargar datos.</td></tr>';
  }
}

// ==========================================
// MODAL DE MATERIA
// ==========================================

export async function abrirModalMateria(id = null) {
  // Feature 1: dos inputs separados
  document.getElementById('formMateriaId').value        = id || '';
  document.getElementById('formMateriaAnio').value      = '';
  document.getElementById('formMateriaBase').value      = '';
  document.getElementById('formMateriaDivision').value  = '';
  document.getElementById('materiaDiasContainer').innerHTML = '';
  document.getElementById('modalMateriaTitulo').innerText   = id ? 'Editar en Plan de Estudio' : 'Agregar a Plan de Estudio';

  if (id) {
    try {
      const docSnap = await getDoc(doc(db, getPath("materias"), id));
      if (docSnap.exists()) {
        const data = docSnap.data();
        // Cargar campos nuevos o hacer split retrocompatible del nombre legacy
        if (data.planEstudio) {
          document.getElementById('formMateriaAnio').value = data.planEstudio;
        }
        if (data.materiaBase) {
          document.getElementById('formMateriaBase').value     = data.materiaBase;
          document.getElementById('formMateriaDivision').value = data.division || '';
        } else {
          const idx = (data.nombre || '').indexOf(' - ');
          if (idx !== -1) {
            document.getElementById('formMateriaDivision').value = data.nombre.substring(0, idx);
            document.getElementById('formMateriaBase').value     = data.nombre.substring(idx + 3);
          } else {
            document.getElementById('formMateriaBase').value = data.nombre || '';
          }
        }
        const dias = parseDias(data.dias);
        if (dias.length > 0) dias.forEach(d => agregarDiaMateria(d));
        else                   agregarDiaMateria();
      }
    } catch(e) { console.error(e); agregarDiaMateria(); }
  } else {
    agregarDiaMateria();
  }

  document.getElementById('modalMateria').classList.remove('hidden');
}

export function cerrarModalMateria() {
  document.getElementById('modalMateria').classList.add('hidden');
}

// diaObj: null | número (retrocompat) | { dia, horaInicio, horaFin }
export function agregarDiaMateria(diaObj = null) {
  const container = document.getElementById('materiaDiasContainer');
  const uid = Date.now();
  const div = document.createElement('div');
  div.className = "flex flex-wrap gap-2 items-center bg-slate-50 dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-700";
  div.id = `materiaDia_${uid}`;

  let diaNum = null, horaInicio = '', horaFin = '';
  if (diaObj !== null) {
    if (typeof diaObj === 'number')       diaNum = diaObj;
    else if (typeof diaObj === 'object') { diaNum = diaObj.dia; horaInicio = diaObj.horaInicio || ''; horaFin = diaObj.horaFin || ''; }
  }

  let diaSelectHtml = `<select class="dia-materia-select py-2 md:py-1 px-1 border dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-base md:text-xs font-medium outline-none min-w-[100px]">`;
  DIAS_NOMBRES.forEach((n, idx) => {
    if (idx > 0 && idx < 6) diaSelectHtml += `<option value="${idx}"${diaNum == idx ? ' selected' : ''}>${n}</option>`;
  });
  diaSelectHtml += `</select>`;

  // Feature 2: selects H y M separados para mejor UX en móvil
  div.innerHTML = `
    ${diaSelectHtml}
    <div class="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
      <span class="font-semibold text-slate-600 dark:text-slate-300">De</span>
      ${selectHM('hora-inicio-h', 'hora-inicio-m', horaInicio)}
      <span class="font-semibold text-slate-600 dark:text-slate-300">a</span>
      ${selectHM('hora-fin-h', 'hora-fin-m', horaFin)}
    </div>
    <button onclick="document.getElementById('materiaDia_${uid}').remove()" class="text-red-500 hover:bg-red-100 p-2 md:p-1 rounded transition ml-auto">
      <i class="ph ph-trash"></i>
    </button>
  `;
  container.appendChild(div);
}

// ==========================================
// GUARDAR / ELIMINAR
// ==========================================

export async function guardarMateria() {
  // Feature 1: leer los dos inputs separados
  const materiaAnio      = document.getElementById('formMateriaAnio').value.trim();
  const materiaBase      = document.getElementById('formMateriaBase').value.trim();
  const materiaDivision  = document.getElementById('formMateriaDivision').value.trim();
  const id               = document.getElementById('formMateriaId').value;

  if (!materiaBase) { showToast('⚠️ Ingresá el nombre de la materia', 'error'); return; }

  // Concatenar para el campo `nombre` legacy que usa todo el sistema de asistencias
  const nombre = materiaDivision ? `${materiaDivision} - ${materiaBase}` : materiaBase;

  // Feature 2: combinar H:M de cada fila
  const diasArr = [];
  document.querySelectorAll('[id^="materiaDia_"]').forEach(fila => {
    const dia    = parseInt(fila.querySelector('.dia-materia-select').value);
    const hIni   = fila.querySelector('.hora-inicio-h')?.value || '';
    const mIni   = fila.querySelector('.hora-inicio-m')?.value || '';
    const hFin   = fila.querySelector('.hora-fin-h')?.value    || '';
    const mFin   = fila.querySelector('.hora-fin-m')?.value    || '';
    const horaInicio = (hIni && mIni) ? `${hIni}:${mIni}` : '';
    const horaFin    = (hFin && mFin) ? `${hFin}:${mFin}` : '';
    if (!diasArr.find(x => x.dia === dia)) diasArr.push({ dia, horaInicio, horaFin });
  });
  diasArr.sort((a, b) => a.dia - b.dia);

  const nombreDias = diasArr.map(formatDiaHorario).join(' | ');
  // Feature 1: guardar también los campos desacoplados
  const payload = { nombre, materiaBase, division: materiaDivision, dias: diasArr, nombreDias };
  if (materiaAnio) payload.planEstudio = materiaAnio;

  const btn  = document.getElementById('btnGuardarMateria');
  const icon = document.getElementById('iconGuardarMateria');
  const text = document.getElementById('textGuardarMateria');
  btn.disabled = true; icon.className = "ph ph-spinner animate-spin text-lg"; text.innerText = "GUARDANDO...";

  try {
    if (id) await setDoc(doc(db, getPath("materias"), id), payload, { merge: true });
    else    await addDoc(collection(db, getPath("materias")), payload);
    showToast('✅ Materia guardada correctamente');
    window.app.invalidarCacheBI?.();
    cerrarModalMateria();
    await cargarMateriasDinamicas();
    window.app.popularCursos();
    await cargarListaMateriasAdmin();
  } catch (e) {
    console.error(e);
    showToast('❌ Error al guardar', 'error');
  } finally {
    btn.disabled = false; icon.className = "ph ph-floppy-disk text-lg"; text.innerText = "GUARDAR MATERIA";
  }
}

export async function eliminarMateria(id, nombre) {
  try {
    showToast('Verificando dependencias...', 'info');
    const [snapEst, snapAsist] = await Promise.all([
      getDocs(query(collection(db, getPath("estudiantes")), where("materias", "array-contains", nombre))),
      getDocs(query(collection(db, getPath("asistencias")), where("curso", "==", nombre)))
    ]);

    if (!snapEst.empty || !snapAsist.empty) {
      const force = await window.app.showConfirm("Confirmación", `⚠️ ATENCIÓN:\n\nLa materia "${nombre}" tiene vinculados:\n- ${snapEst.size} estudiantes\n- ${snapAsist.size} planillas de asistencia.\n\nSi la eliminás, estos registros NO se borrarán, sino que quedarán "huérfanos" con este nombre viejo. Luego podrás reasignarlos a la materia correcta (como Teatro) desde el módulo de Auditoría.\n\n¿Querés forzar la eliminación para convertirlos en huérfanos?`);
      if (!force) return;
    } else {
      if (!await window.app.showConfirm("Confirmación", `La materia "${nombre}" está vacía (sin estudiantes ni asistencias).\n\n¿Seguro que querés eliminarla permanentemente?`)) return;
    }

    await deleteDoc(doc(db, getPath("materias"), id));
    showToast(`✅ Materia ${nombre} eliminada.`);
    window.app.invalidarCacheBI?.();
    await cargarMateriasDinamicas();
    window.app.popularCursos();
    await cargarListaMateriasAdmin();
  } catch(e) {
    console.error(e);
    showToast('❌ Error al eliminar', 'error');
  }
}

// GENERADOR DE CURSOS AUTOMÁTICO
// ==========================================

export function abrirModalGenerador() {
  document.getElementById('genAño').value = '';
  document.getElementById('genPrefijoDivision').value = '';
  document.getElementById('genLetrasDivision').value = '';
  document.getElementById('genMaterias').value = '';
  document.getElementById('modalGeneradorCursos').classList.remove('hidden');
}

export function cerrarModalGenerador() {
  document.getElementById('modalGeneradorCursos').classList.add('hidden');
}

export async function ejecutarGenerador() {
  const anioRaw = document.getElementById('genAño').value.trim();
  const prefijoRaw = document.getElementById('genPrefijoDivision').value.trim();
  const letrasRaw = document.getElementById('genLetrasDivision').value.trim();
  const materiasRaw = document.getElementById('genMaterias').value.trim();

  if (!anioRaw || !prefijoRaw || !letrasRaw || !materiasRaw) {
    showToast('⚠️ Completa el Año, Prefijo, Letras y Materias', 'error');
    return;
  }

  const materiasNombres = materiasRaw.split(',').map(m => m.trim()).filter(Boolean);
  const letrasNombres = letrasRaw.split(',').map(d => d.trim()).filter(Boolean);

  if (materiasNombres.length === 0 || letrasNombres.length === 0) {
    showToast('⚠️ Revisa el formato de los datos separados por coma.', 'error');
    return;
  }

  // Generar divisiones
  const divisionesNombres = letrasNombres.map(letra => `${prefijoRaw} ${letra}`);

  const btn = document.getElementById('btnEjecutarGenerador');
  const icon = document.getElementById('iconEjecutarGenerador');
  const text = document.getElementById('textEjecutarGenerador');
  
  btn.disabled = true;
  icon.className = "ph ph-spinner animate-spin text-lg";
  text.innerText = "Generando...";

  let generadas = 0;

  try {
    const snap = await getDocs(collection(db, getPath("materias")));
    const materiasExistentes = snap.docs.map(d => d.data().nombre.toLowerCase());

    for (const division of divisionesNombres) {
      for (const materiaBase of materiasNombres) {
        const nombreCombinado = `${division} - ${materiaBase}`;
        
        // Evitar duplicados exactos
        if (!materiasExistentes.includes(nombreCombinado.toLowerCase())) {
          const payload = {
            nombre: nombreCombinado,
            materiaBase: materiaBase,
            division: division,
            dias: [],
            nombreDias: "",
            planEstudio: anioRaw
          };
          await addDoc(collection(db, getPath("materias")), payload);
          generadas++;
        }
      }
    }

    showToast(`✅ Generación completa: Se crearon ${generadas} materias.`, 'success');
    window.app.invalidarCacheBI?.();
    cerrarModalGenerador();
    await cargarMateriasDinamicas();
    window.app.popularCursos();
    await cargarListaMateriasAdmin();
  } catch (e) {
    console.error(e);
    showToast('❌ Error durante la generación', 'error');
  } finally {
    btn.disabled = false;
    icon.className = "ph ph-magic-wand text-lg";
    text.innerText = "Generar Materias";
  }
}
