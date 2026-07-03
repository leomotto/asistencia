// js/usuarios.js — Panel de Gestión de Docentes (solo ADMIN)

import { doc, setDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db, getPath } from "./firebase-config.js?v=9.29";
import { showToast } from "./ui.js?v=9.29";

// Dado un nombre como "1ro A - Matemática", extrae base y división
function descomponerNombre(nombre = '') {
  const idx = nombre.indexOf(' - ');
  if (idx !== -1) return { base: nombre.substring(idx + 3), div: nombre.substring(0, idx) };
  return { base: nombre, div: '' };
}

// ==========================================
// LISTADO DE USUARIOS
// ==========================================

export async function cargarListaUsuarios() {
  const contenedor = document.getElementById('listaDocentes');
  if (!contenedor) return;
  contenedor.innerHTML = '<p class="text-center text-blue-500 animate-pulse py-8">Cargando usuarios...</p>';

  try {
    // Leer materias desde Firestore para obtener materiaBase/division
    const snapMaterias = await getDocs(collection(db, getPath('materias')));
    const materiasData = [];
    snapMaterias.forEach(d => {
      const data = d.data();
      const base = data.materiaBase || descomponerNombre(data.nombre).base;
      const div  = data.division    || descomponerNombre(data.nombre).div;
      materiasData.push({ nombre: data.nombre, base, div });
    });
    materiasData.sort((a, b) => a.nombre.localeCompare(b.nombre));

    // Agrupar por División: { "1ro A": [{nombre:"1ro A - Matemática", base:"Matemática"}, ...] }
    const grupos = {};
    materiasData.forEach(m => {
      const divisionKey = m.div || '(Sin División)';
      if (!grupos[divisionKey]) grupos[divisionKey] = [];
      grupos[divisionKey].push(m);
    });
    const divisionesOrdenadas = Object.keys(grupos).sort();

    // Leer usuarios
    const snapU = await getDocs(collection(db, getPath('usuarios')));
    const usuarios = [];
    snapU.forEach(d => usuarios.push({ uid: d.id, ...d.data() }));

    const filtrados = usuarios
      .filter(u => u.email && u.email !== 'dev@localhost')
      .sort((a, b) => (a.nombre || a.email).localeCompare(b.nombre || b.email));

    if (filtrados.length === 0) {
      contenedor.innerHTML = '<p class="text-center text-slate-400 py-8">No hay usuarios registrados.</p>';
      return;
    }

    contenedor.innerHTML = '';
    filtrados.forEach(u => {
      const esYoMismo = u.uid === window.app.currentUser?.uid;
      const rolActual = u.rol || 'PENDIENTE';
      const materiasU = Array.isArray(u.materias) ? u.materias : [];

      const rolBadgeClass = {
        ADMIN:    'bg-purple-100 text-purple-800',
        DOCENTE:  'bg-blue-100 text-blue-800',
        PENDIENTE:'bg-yellow-100 text-yellow-800',
      }[rolActual] || 'bg-slate-100 text-slate-700';

      // Renderizar materias agrupadas por División
      const materiasHtml = divisionesOrdenadas.length === 0
        ? '<p class="text-xs text-slate-400 italic">No hay materias configuradas.</p>'
        : divisionesOrdenadas.map(div => {
            const items = grupos[div];
            const checkboxes = items.map(m => `
              <label class="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer select-none">
                <input type="checkbox" class="cb-materia-docente h-4 w-4 rounded text-indigo-600"
                  value="${m.nombre}" ${materiasU.includes(m.nombre) ? 'checked' : ''}>
                <span>${m.base || m.nombre}</span>
              </label>`).join('');
            return `
              <div class="mb-3">
                <p class="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">${div}</p>
                <div class="flex flex-wrap gap-x-4 gap-y-1.5">${checkboxes}</div>
              </div>`;
          }).join('');

      const card = document.createElement('div');
      card.className = "bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 p-5 shadow-sm";
      card.dataset.uid = u.uid;
      card.innerHTML = `
        <div class="flex flex-col sm:flex-row justify-between items-start gap-3 mb-4">
          <div>
            <p class="font-bold text-slate-800 dark:text-slate-100 text-base">${u.nombre || '(sin nombre)'}</p>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${u.email}</p>
          </div>
          <div class="flex items-center gap-2 flex-shrink-0">
            <span class="text-[10px] font-bold px-2 py-1 rounded uppercase ${rolBadgeClass}">${rolActual}</span>
            ${esYoMismo
              ? '<span class="text-[10px] text-slate-400 italic">(sos vos)</span>'
              : `<select class="sel-rol-docente text-xs border dark:border-slate-700 rounded px-2 py-1 bg-white dark:bg-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 font-semibold text-slate-700 dark:text-slate-200">
                  <option value="ADMIN"    ${rolActual==='ADMIN'    ? 'selected':''}>ADMIN</option>
                  <option value="DOCENTE"  ${rolActual==='DOCENTE'  ? 'selected':''}>DOCENTE</option>
                  <option value="PENDIENTE"${rolActual==='PENDIENTE'? 'selected':''}>PENDIENTE</option>
                </select>`}
          </div>
        </div>
        <div>
          <p class="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Materias asignadas</p>
          <div class="bg-slate-50 dark:bg-slate-900 rounded-lg p-3 border dark:border-slate-700">
            ${materiasHtml}
          </div>
        </div>
        ${esYoMismo ? '' : `
          <div class="flex justify-end mt-4 pt-3 border-t dark:border-slate-700">
            <button onclick="app.guardarAsignacionDocente('${u.uid}', this)"
              class="bg-emerald-600 text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-emerald-700 transition flex items-center gap-2">
              <i class="ph ph-floppy-disk"></i> Guardar Cambios
            </button>
          </div>`}
      `;
      contenedor.appendChild(card);
    });

  } catch (e) {
    console.error(e);
    contenedor.innerHTML = '<p class="text-center text-red-500 py-8">Error al cargar usuarios.</p>';
    showToast('❌ Error al cargar la lista de usuarios.', 'error');
  }
}

// ==========================================
// GUARDAR ROL + MATERIAS DE UN DOCENTE
// ==========================================

export async function guardarAsignacionDocente(uid, btnEl) {
  const card = btnEl.closest('[data-uid]');
  if (!card) return;

  const selRol = card.querySelector('.sel-rol-docente');
  const rol    = selRol ? selRol.value : null;

  const materiasSeleccionadas = [];
  card.querySelectorAll('.cb-materia-docente:checked').forEach(cb => materiasSeleccionadas.push(cb.value));

  btnEl.disabled = true;
  const iconOriginal = btnEl.innerHTML;
  btnEl.innerHTML = '<i class="ph ph-spinner animate-spin"></i> Guardando...';

  try {
    await setDoc(doc(db, getPath('usuarios'), uid), { rol, materias: materiasSeleccionadas }, { merge: true });
    showToast(`✅ Permisos actualizados correctamente.`);
    await cargarListaUsuarios();
  } catch (e) {
    console.error(e);
    showToast('❌ Error al guardar los permisos.', 'error');
    btnEl.disabled = false;
    btnEl.innerHTML = iconOriginal;
  }
}
