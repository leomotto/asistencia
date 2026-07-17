import { doc, setDoc, collection, getDocs, query, where, updateDoc, deleteField } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db, getPath } from "./firebase-config.js?v=10.66";
import { showToast } from "./ui.js?v=10.66";

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
  contenedor.innerHTML = `${window.app.mostrarSkeletonCards(3)}`;

  try {
    const myTenant = window.app?.currentTenant || 'root';
    const currentUserUid = window.app?.currentUser?.uid;
    const isSuperAdmin = window.app.currentUser?.rolActivo === 'SUPERADMIN';
    const isMainAdmin = window.app.currentUser?.rolActivo === 'ADMIN' || isSuperAdmin;

    if (!isMainAdmin) {
       contenedor.innerHTML = '<p class="text-center text-red-500 py-8">No tienes permisos para gestionar docentes en esta escuela.</p>';
       return;
    }

    // Leer materias desde Firestore del tenant actual
    const snapMaterias = await getDocs(collection(db, getPath('materias')));
    const materiasData = [];
    snapMaterias.forEach(d => {
      const data = d.data();
      const base = data.materiaBase || descomponerNombre(data.nombre).base;
      const div  = data.division    || descomponerNombre(data.nombre).div;
      materiasData.push({ nombre: data.nombre, base, div });
    });
    materiasData.sort((a, b) => a.nombre.localeCompare(b.nombre));

    // Agrupar por División
    const grupos = {};
    materiasData.forEach(m => {
      const divisionKey = m.div || '(Sin División)';
      if (!grupos[divisionKey]) grupos[divisionKey] = [];
      grupos[divisionKey].push(m);
    });
    const divisionesOrdenadas = Object.keys(grupos).sort();

    // Leer usuarios (si es SUPERADMIN podría querer ver a todos o solo los del tenant, en este modulo ve los del tenant actual)
    let qUsers = collection(db, "usuarios");
    // Filtrar los que pertenecen a esta escuela
    // Firestore no soporta `where('escuelas.TENANT', '!=', null)` de forma simple a veces, así que traemos todos y filtramos en JS o usamos in.
    const snapU = await getDocs(qUsers);
    let usuarios = [];
    snapU.forEach(d => {
      const data = d.data();
      const uid = d.id;
      // Si el superadmin no tiene la escuela actual configurada pero está operando globalmente, se saltea.
      // Acá buscamos a la gente que tiene un rol en myTenant.
      if (data.superadmin || (data.escuelas && data.escuelas[myTenant])) {
         usuarios.push({ uid, ...data });
      }
    });

    const filtrados = usuarios
      .filter(u => u.email !== 'dev@localhost')
      .sort((a, b) => (a.nombre || a.email || '').localeCompare(b.nombre || b.email || ''));

    if (filtrados.length === 0) {
      contenedor.innerHTML = '<p class="text-center text-slate-400 py-8">No hay docentes registrados en esta escuela.</p>';
      return;
    }

    contenedor.innerHTML = '';
    filtrados.forEach(u => {
      const esYoMismo = (u.uid === currentUserUid);
      
      // Obtener rol y materias específicos de este tenant
      let rolEnTenant = 'DOCENTE';
      let materiasU = [];
      
      if (u.superadmin) {
        rolEnTenant = 'SUPERADMIN';
      } else if (u.escuelas && u.escuelas[myTenant]) {
        rolEnTenant = u.escuelas[myTenant].rol || 'PENDIENTE';
        materiasU = u.escuelas[myTenant].materias || [];
      } else {
        // En teoría no debería llegar acá por el filtro de arriba
        rolEnTenant = 'PENDIENTE';
      }

      let rolBadgeClass = "bg-slate-100 text-slate-500";
      if (rolEnTenant === 'SUPERADMIN') rolBadgeClass = "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
      else if (rolEnTenant === 'ADMIN') rolBadgeClass = "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
      else if (rolEnTenant === 'DOCENTE') rolBadgeClass = "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400";
      else if (rolEnTenant.startsWith('PENDIENTE')) rolBadgeClass = "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";

      // Filtrar materias asignadas vs no asignadas
      const assignedMaterias = materiasData.filter(m => materiasU.includes(m.nombre));
      const unassignedMaterias = materiasData.filter(m => !materiasU.includes(m.nombre));

      // Construir dropdown de no asignadas
      let optionsHtml = '<option value="">+ Asignar nueva materia...</option>';
      divisionesOrdenadas.forEach(div => {
        const unassignedInDiv = grupos[div].filter(m => !materiasU.includes(m.nombre));
        if (unassignedInDiv.length > 0) {
          optionsHtml += `<optgroup label="${div}">`;
          unassignedInDiv.forEach(m => {
            optionsHtml += `<option value="${m.nombre}">${m.base || m.nombre}</option>`;
          });
          optionsHtml += `</optgroup>`;
        }
      });

      // Filtrar materias solicitadas pero que no existen en la base de datos
      const unassignedButRequested = materiasU.filter(mu => !materiasData.find(m => m.nombre === mu));

      // Construir chips de asignadas
      let chipsHtml = assignedMaterias.length > 0 
        ? assignedMaterias.map(m => `
            <span class="inline-flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold px-2.5 py-1 rounded-md">
              <span><span class="opacity-70 font-normal mr-1">${m.div || ''}</span>${m.base || m.nombre}</span>
              ${!esYoMismo && !u.superadmin ? `<button type="button" onclick="this.parentElement.remove(); document.getElementById('btn-save-${u.uid}').classList.remove('hidden');" class="ml-1 hover:text-red-500 transition-colors"><i class="ph ph-x"></i></button>` : ''}
              <input type="hidden" class="cb-materia-docente" value="${m.nombre}" checked>
            </span>
          `).join('')
        : '';
        
      if (unassignedButRequested.length > 0) {
        chipsHtml += unassignedButRequested.map(mu => `
            <span class="inline-flex items-center gap-1 bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800 text-xs font-semibold px-2.5 py-1 rounded-md" title="Materia solicitada no encontrada en la escuela">
              <span>${mu} (Solicitada)</span>
              ${!esYoMismo && !u.superadmin ? `<button type="button" onclick="this.parentElement.remove(); document.getElementById('btn-save-${u.uid}').classList.remove('hidden');" class="ml-1 hover:text-red-500 transition-colors"><i class="ph ph-x"></i></button>` : ''}
              <input type="hidden" class="cb-materia-docente" value="${mu}" checked>
            </span>
        `).join('');
      }
      
      if (!chipsHtml) {
        chipsHtml = '<p class="text-xs text-slate-400 italic">No tiene materias asignadas o solicitadas.</p>';
      }

      const card = document.createElement('div');
      card.className = "bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 p-5 shadow-sm";
      card.dataset.uid = u.uid;
      card.innerHTML = `
        <div class="flex flex-col sm:flex-row justify-between items-start gap-4 mb-5 pb-4 border-b dark:border-slate-700">
          <div>
            <p class="font-bold text-slate-800 dark:text-slate-100 text-lg">${u.nombre || '(sin nombre)'}</p>
            <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">${u.email || '(sin email)'}</p>
          </div>
          <div class="flex flex-wrap items-center gap-3 flex-shrink-0">
            <span class="text-[11px] font-bold px-2.5 py-1 rounded-full uppercase shadow-sm ${rolBadgeClass}">${rolEnTenant}</span>
            <span class="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded uppercase border border-slate-200"><i class="ph ph-buildings"></i> ${myTenant}</span>
            ${esYoMismo || u.superadmin
              ? '<span class="text-[11px] text-slate-400 italic">(intocable)</span>'
              : `<select class="sel-rol-docente text-sm border dark:border-slate-700 rounded-lg px-3 py-1 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-700 dark:text-slate-200 transition-shadow" onchange="document.getElementById('btn-save-${u.uid}').classList.remove('hidden')">
                  <option value="ADMIN"    ${rolEnTenant==='ADMIN'    ? 'selected':''}>ADMIN</option>
                  <option value="DOCENTE"  ${rolEnTenant==='DOCENTE'  ? 'selected':''}>DOCENTE</option>
                  <option value="PENDIENTE"${rolEnTenant==='PENDIENTE'? 'selected':''}>PENDIENTE</option>
                </select>`}
          </div>
        </div>
        
        <div>
          <p class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3"><i class="ph ph-books mr-1"></i> Materias que dicta aquí</p>
          <div class="flex flex-wrap gap-2 mb-3" id="chip-container-${u.uid}">
            ${chipsHtml}
          </div>
          ${!esYoMismo && !u.superadmin ? `
            <div class="flex gap-2 mt-4 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
              <select id="sel-add-${u.uid}" class="text-sm border dark:border-slate-700 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-800 flex-1 outline-none text-slate-700 dark:text-slate-200">
                ${optionsHtml}
              </select>
              <button onclick="app.agregarMateriaChip('${u.uid}')" type="button" class="bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm font-bold px-4 py-1.5 rounded-lg transition-colors">
                Agregar
              </button>
            </div>
          ` : ''}
        </div>
        
        ${esYoMismo || u.superadmin ? '' : `
          <div class="flex justify-between items-center mt-5 pt-4 border-t dark:border-slate-700">
            <button onclick="app.eliminarDocente('${u.uid}')" class="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1">
              <i class="ph ph-trash"></i> Desvincular de escuela
            </button>
            <button id="btn-save-${u.uid}" onclick="app.guardarAsignacionDocente('${u.uid}', this)"
              class="hidden bg-emerald-600 text-white text-sm font-bold px-5 py-2 rounded-lg hover:bg-emerald-700 transition flex items-center gap-2 shadow-sm">
              <i class="ph ph-floppy-disk"></i> Guardar Cambios
            </button>
          </div>`}
      `;
      contenedor.appendChild(card);
    });

  } catch (error) {
    console.error("Error cargando usuarios:", error);
    contenedor.innerHTML = '<p class="text-center text-red-500 py-8">Error al cargar docentes. Revisá la consola.</p>';
  }
}

export function agregarMateriaChip(uid) {
  const select = document.getElementById(`sel-add-${uid}`);
  const val = select.value;
  if (!val) return;
  const texto = select.options[select.selectedIndex].text;

  const container = document.getElementById(`chip-container-${uid}`);
  const check = container.querySelector(`input[value="${val}"]`);
  if (check) {
    window.app.showToast("Esta materia ya está asignada", "info");
    return;
  }

  // Si había un mensaje de "No tiene materias...", sacarlo
  if (container.innerHTML.includes('No tiene materias asignadas')) {
    container.innerHTML = '';
  }

  // Div y base (aprox)
  const decomp = descomponerNombre(val);
  const divName = decomp.div;
  const baseName = decomp.base;

  const span = document.createElement('span');
  span.className = "inline-flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold px-2.5 py-1 rounded-md";
  span.innerHTML = `
    <span><span class="opacity-70 font-normal mr-1">${divName}</span>${baseName}</span>
    <button type="button" onclick="this.parentElement.remove(); document.getElementById('btn-save-${uid}').classList.remove('hidden');" class="ml-1 hover:text-red-500 transition-colors"><i class="ph ph-x"></i></button>
    <input type="hidden" class="cb-materia-docente" value="${val}" checked>
  `;
  container.appendChild(span);
  
  select.value = '';
  document.getElementById(`btn-save-${uid}`).classList.remove('hidden');
}

export async function guardarAsignacionDocente(uid, btnEl) {
  const card = btnEl.closest(`[data-uid="${uid}"]`);
  if (!card) return;

  const selRol = card.querySelector('.sel-rol-docente');
  const nuevoRol = selRol ? selRol.value : 'DOCENTE';

  const hiddenInputs = card.querySelectorAll('.cb-materia-docente');
  const materiasSeleccionadas = Array.from(hiddenInputs).map(i => i.value);
  
  const myTenant = window.app.currentTenant;

  try {
    btnEl.innerHTML = `<i class="ph ph-spinner animate-spin"></i> Guardando...`;
    btnEl.disabled = true;

    // Actualizamos las propiedades específicas de este tenant
    const userRef = doc(db, "usuarios", uid);
    await updateDoc(userRef, {
      [`escuelas.${myTenant}.rol`]: nuevoRol,
      [`escuelas.${myTenant}.materias`]: materiasSeleccionadas
    });

    window.app.showToast("Cambios guardados con éxito", "success");
    btnEl.classList.add('hidden');
    
    // Recargar la lista para reflejar estado actual (ej: nuevo badge color)
    setTimeout(() => {
      cargarListaUsuarios();
    }, 500);

  } catch (error) {
    console.error("Error guardando cambios:", error);
    window.app.showToast("Hubo un error al guardar", "error");
    btnEl.disabled = false;
    btnEl.innerHTML = `<i class="ph ph-floppy-disk"></i> Guardar Cambios`;
  }
}

export async function eliminarDocente(uid) {
  const confirm = await window.app.showConfirm(
    "Desvincular de la Escuela",
    "¿Confirmás que querés remover a este docente de esta institución? Dejará de tener acceso a los cursos."
  );
  if (!confirm) return;

  try {
    const myTenant = window.app.currentTenant;
    const userRef = doc(db, "usuarios", uid);
    
    // Borramos su objeto tenant de 'escuelas'
    await updateDoc(userRef, {
      [`escuelas.${myTenant}`]: deleteField()
    });
    
    window.app.showToast("Docente desvinculado con éxito", "success");
    cargarListaUsuarios();
  } catch (e) {
    console.error(e);
    window.app.showToast("Error al desvincular", "error");
  }
}
