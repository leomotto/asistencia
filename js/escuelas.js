import { db, getPath } from "./firebase-config.js?v=9.98";
import { collection, getDocs, doc, deleteDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ==========================================
// GESTION DE ESCUELAS (CRUD SUPERADMIN)
// ==========================================

export async function cargarListaEscuelas() {
  const container = document.getElementById('listaEscuelas');
  if (!container) return;

  if (window.app.currentUser?.rolActivo !== 'SUPERADMIN') {
    container.innerHTML = `<p class="text-center text-red-500 py-8">No tenés permisos para ver esto.</p>`;
    return;
  }

  try {
    const qSnapshot = await getDocs(collection(db, getPath("escuelas")));
    if (qSnapshot.empty) {
      container.innerHTML = `
        <div class="text-center py-8 text-slate-500">
          <i class="ph ph-buildings text-4xl mb-3 text-slate-300"></i>
          <p>No hay escuelas registradas.</p>
          <button onclick="app.abrirModalEscuela()" class="mt-4 text-purple-600 font-bold hover:underline">Crear primera escuela</button>
        </div>
      `;
      return;
    }

    let html = `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">`;
    qSnapshot.forEach(docSnap => {
      const e = docSnap.data();
      const isCurrent = window.app.currentTenant === docSnap.id;
      html += `
        <div class="bg-white dark:bg-slate-800 rounded-xl p-4 border ${isCurrent ? 'border-purple-500 ring-1 ring-purple-500' : 'border-slate-200 dark:border-slate-700'} shadow-sm relative group transition-all hover:shadow-md">
          ${isCurrent ? `<span class="absolute -top-2 -right-2 bg-purple-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm">ACTIVA</span>` : ''}
          <div class="flex justify-between items-start mb-2">
            <div>
              <h3 class="font-bold text-slate-800 dark:text-slate-100 text-lg leading-tight">${e.nombre}</h3>
              <p class="text-xs text-slate-400 font-mono mt-0.5">${docSnap.id}</p>
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
            <button onclick="app.abrirModalEscuela('${docSnap.id}', '${e.nombre.replace(/'/g, "\\'")}')" class="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1">
              <i class="ph ph-pencil-simple"></i> Editar
            </button>
            <button onclick="app.eliminarEscuela('${docSnap.id}')" class="text-xs text-red-600 dark:text-red-400 hover:underline flex items-center gap-1">
              <i class="ph ph-trash"></i> Eliminar
            </button>
            
            <div class="w-full flex gap-1 mt-2">
              <button onclick="app.enterContextAndGoTo('${docSnap.id}', 'inicioTab')" class="flex-1 text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-purple-100 hover:text-purple-700 py-1.5 rounded transition flex items-center justify-center gap-1 font-bold">
                <i class="ph ph-sign-in"></i> ENTRAR
              </button>
              <button onclick="app.enterContextAndGoTo('${docSnap.id}', 'gestionMaterias')" class="flex-1 text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-purple-100 hover:text-purple-700 py-1.5 rounded transition flex items-center justify-center gap-1">
                <i class="ph ph-books"></i> MATERIAS
              </button>
              <button onclick="app.enterContextAndGoTo('${docSnap.id}', 'gestionDocentes')" class="flex-1 text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-purple-100 hover:text-purple-700 py-1.5 rounded transition flex items-center justify-center gap-1">
                <i class="ph ph-users"></i> DOCENTES
              </button>
              <button onclick="app.enterContextAndGoTo('${docSnap.id}', 'gestionAlumnos')" class="flex-1 text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-purple-100 hover:text-purple-700 py-1.5 rounded transition flex items-center justify-center gap-1">
                <i class="ph ph-student"></i> ALUMNOS
              </button>
            </div>
          </div>
        </div>
      `;
    });
    html += `</div>`;
    container.innerHTML = html;
  } catch (error) {
    console.error("Error al cargar escuelas:", error);
    container.innerHTML = `<p class="text-center text-red-500 py-8">Error al cargar las escuelas. Ver consola.</p>`;
  }
}

export function abrirModalEscuela(id = '', nombre = '') {
  const modal = document.getElementById('modalEscuela');
  const inner = modal.querySelector('div');
  
  document.getElementById('formEscuelaId').value = id;
  const inputCodigo = document.getElementById('formEscuelaCodigo');
  const inputNombre = document.getElementById('formEscuelaNombre');
  
  inputCodigo.value = id;
  inputNombre.value = nombre;
  
  inputCodigo.disabled = !!id;
  
  document.getElementById('modalEscuelaTitle').innerHTML = id 
    ? '<i class="ph ph-buildings"></i> Editar Escuela' 
    : '<i class="ph ph-buildings"></i> Nueva Escuela';

  modal.classList.remove('hidden');
  setTimeout(() => {
    inner.classList.remove('scale-95', 'opacity-0');
    inner.classList.add('scale-100', 'opacity-100');
    if(!id) inputCodigo.focus();
    else inputNombre.focus();
  }, 10);
}

export function cerrarModalEscuela() {
  const modal = document.getElementById('modalEscuela');
  const inner = modal.querySelector('div');
  inner.classList.remove('scale-100', 'opacity-100');
  inner.classList.add('scale-95', 'opacity-0');
  setTimeout(() => modal.classList.add('hidden'), 300);
}

export async function guardarEscuela() {
  const idOriginal = document.getElementById('formEscuelaId').value;
  const codigo = document.getElementById('formEscuelaCodigo').value.trim().toUpperCase();
  const nombre = document.getElementById('formEscuelaNombre').value.trim();

  if (!codigo || !nombre) {
    window.app.showToast("El código y el nombre son obligatorios.", "error");
    return;
  }
  
  if (!/^[A-Z0-9_-]+$/.test(codigo)) {
    window.app.showToast("El código solo puede contener letras, números, guiones y sin espacios.", "error");
    return;
  }

  try {
    const docRef = doc(db, getPath("escuelas"), codigo);
    await setDoc(docRef, { nombre: nombre }, { merge: true });
    
    window.app.showToast("Escuela guardada exitosamente", "success");
    cerrarModalEscuela();
    cargarListaEscuelas();
    
    if (!idOriginal) {
      setTimeout(() => window.location.reload(), 1000);
    }
  } catch (error) {
    console.error("Error al guardar escuela:", error);
    window.app.showToast("Error al guardar: " + error.message, "error");
  }
}

export async function eliminarEscuela(id) {
  if (id === 'root') {
    window.app.showToast("No se puede eliminar el entorno ROOT", "error");
    return;
  }
  
  if (window.app.currentTenant === id) {
    window.app.showToast("No podés eliminar la escuela en la que estás actualmente. Cambiá de contexto primero.", "error");
    return;
  }

  const confirm = await window.app.showConfirm(
    "Eliminar Escuela",
    `¿Seguro que querés eliminar la escuela "${id}"? Esta acción borrará el registro de la escuela, pero los datos internos deberán borrarse manualmente desde Firebase para evitar pérdida de datos accidental.`
  );
  if (!confirm) return;
  
  try {
    const docRef = doc(db, "escuelas", id);
    await deleteDoc(docRef);
    window.app.showToast("Escuela eliminada exitosamente", "success");
    cargarListaEscuelas();
    
    // Si la escuela eliminada era la que teníamos activa, volvemos a la default
    if (window.app.currentTenant === id) {
      const escuelasDisponibles = Object.keys(window.app.currentUser?.escuelas || {});
      if (escuelasDisponibles.length > 0) {
        window.app.switchContext(escuelasDisponibles[0]);
      } else {
        window.app.switchContext('root'); // No le quedan escuelas
      }
    }
  } catch (error) {
    console.error("Error al eliminar escuela:", error);
    window.app.showToast("Error al eliminar la escuela", "error");
  }
}

// ==========================================
// MIS ESCUELAS Y ROLES (DOCENTES/ADMINS)
// ==========================================

export async function abrirModalUnirseEscuela() {
  let modal = document.getElementById('modalMisEscuelas');
  
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modalMisEscuelas';
    modal.className = 'fixed inset-0 bg-slate-900/50 backdrop-blur-sm hidden z-50 flex items-center justify-center p-4';
    modal.innerHTML = `
      <div class="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden transform transition-all scale-95 opacity-0 flex flex-col max-h-[90vh]">
        <div class="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50 shrink-0">
          <h3 class="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <i class="ph ph-buildings text-indigo-500"></i> Mis Escuelas
          </h3>
          <button onclick="document.getElementById('modalMisEscuelas').classList.add('hidden')" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition">
            <i class="ph ph-x text-xl"></i>
          </button>
        </div>
        
        <div class="overflow-y-auto flex-1 p-6 space-y-6">
          <!-- Mis Escuelas Actuales -->
          <div>
            <h4 class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Tus Escuelas</h4>
            <div id="listaMisEscuelas" class="space-y-2">
              <div class="text-center text-slate-400 py-4 text-sm"><i class="ph ph-spinner animate-spin text-xl"></i> Cargando...</div>
            </div>
          </div>

          <hr class="border-slate-100 dark:border-slate-700">

          <!-- Solicitar Nueva Escuela -->
          <div>
            <h4 class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Solicitar acceso a otra escuela</h4>
            <div class="space-y-4">
              <div>
                <label class="block text-xs text-slate-500 mb-1">Escuela</label>
                <select id="selectNuevaEscuela" onchange="app.cargarMateriasParaEscuela(this.value)" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                  <option value="">Cargando escuelas...</option>
                </select>
              </div>
              <div>
                <label class="block text-xs text-slate-500 mb-1">Rol Solicitado</label>
                <select id="selectNuevoRol" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                  <option value="DOCENTE">Docente / Profesor</option>
                  <option value="PRECEPTOR">Preceptor</option>
                  <option value="ADMIN">Administrativo / Directivo</option>
                </select>
              </div>
              <div>
                <label class="block text-xs text-slate-500 mb-1">Materias / Cursos a los que dictás clases</label>
                <div id="containerNuevasMaterias" class="max-h-32 overflow-y-auto space-y-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm">
                   <p class="text-[10px] text-slate-400">Seleccioná una escuela primero para ver sus materias.</p>
                </div>
              </div>
              <button onclick="app.solicitarUnirseOtraEscuela()" id="btnSolicitarEscuela" class="w-full px-4 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition flex items-center justify-center gap-2">
                <i class="ph ph-paper-plane-tilt"></i> Solicitar Acceso
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  modal.classList.remove('hidden');
  const inner = modal.querySelector('div.bg-white, div.dark\\:bg-slate-800');
  setTimeout(() => {
    inner.classList.remove('scale-95', 'opacity-0');
    inner.classList.add('scale-100', 'opacity-100');
  }, 10);

  const select = document.getElementById('selectNuevaEscuela');
  const btn = document.getElementById('btnSolicitarEscuela');
  const listaDiv = document.getElementById('listaMisEscuelas');
  
  select.innerHTML = '<option value="">Cargando escuelas...</option>';
  select.disabled = true;
  btn.disabled = true;
  
  try {
    const qSnapshot = await getDocs(collection(db, getPath("escuelas")));
    let html = '<option value="">-- Seleccionar Escuela --</option>';
    
    const misEscuelas = Object.keys(window.app.currentUser?.escuelas || {});
    
    // Generar la lista de mis escuelas
    if (misEscuelas.length === 0) {
      listaDiv.innerHTML = '<p class="text-sm text-slate-500">No tenés escuelas asignadas aún.</p>';
    } else {
      listaDiv.innerHTML = '';
      misEscuelas.forEach(escId => {
        const escData = window.app.currentUser.escuelas[escId];
        const esActiva = window.app.currentTenant === escId;
        const estadoLabel = escData.rol.startsWith('PENDIENTE') ? '<span class="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded ml-2">Pendiente</span>' : `<span class="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded ml-2">${escData.rol}</span>`;
        
        listaDiv.innerHTML += `
          <div class="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-700 rounded-lg ${esActiva ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800' : 'bg-white dark:bg-slate-800'}">
            <div>
              <p class="text-sm font-bold text-slate-800 dark:text-slate-100">${escId} ${estadoLabel}</p>
              ${esActiva ? '<p class="text-[10px] text-indigo-600 dark:text-indigo-400 mt-0.5">Escuela Actual</p>' : ''}
            </div>
            ${!esActiva && !escData.rol.startsWith('PENDIENTE') ? `
              <button onclick="app.switchContext('${escId}')" class="px-3 py-1.5 text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                Entrar
              </button>
            ` : ''}
          </div>
        `;
      });
    }

    let hayDisponibles = false;
    qSnapshot.forEach(docSnap => {
      const e = docSnap.data();
      if (!misEscuelas.includes(docSnap.id)) {
        html += `<option value="${docSnap.id}">${e.nombre} (${docSnap.id})</option>`;
        hayDisponibles = true;
      }
    });
    
    if (!hayDisponibles) {
      html = '<option value="">Ya estás en todas las escuelas disponibles</option>';
    }
    
    select.innerHTML = html;
    select.disabled = !hayDisponibles;
    btn.disabled = !hayDisponibles;
  } catch (error) {
    console.error("Error al cargar escuelas:", error);
    select.innerHTML = '<option value="">Error al cargar escuelas</option>';
  }
}

export async function solicitarUnirseOtraEscuela() {
  const select = document.getElementById('selectNuevaEscuela');
  const selRol = document.getElementById('selectNuevoRol');
  
  const escuelaId = select.value;
  const rol = selRol ? selRol.value : 'DOCENTE';
  
  // Recoger las materias seleccionadas con checkboxes
  const checks = document.querySelectorAll('input[name="chkNuevasMaterias"]:checked');
  const materiasList = Array.from(checks).map(c => c.value);
  
  if (!escuelaId) {
    window.app.showToast("Debes seleccionar una escuela", "error");
    return;
  }
  
  const uid = window.app.currentUser?.uid;
  if (!uid) return;
  
  const btn = document.getElementById('btnSolicitarEscuela');
  btn.disabled = true;
  btn.innerHTML = `<i class="ph ph-spinner animate-spin"></i> Solicitando...`;
  
  try {
    const userRef = doc(db, "usuarios", uid);
    
    await setDoc(userRef, {
      escuelas: {
        [escuelaId]: {
          rol: rol === 'DOCENTE' ? 'PENDIENTE' : `PENDIENTE_${rol}`,
          materias: materiasList
        }
      }
    }, { merge: true });
    
    window.app.showToast("Solicitud enviada. Un administrador deberá aprobarte.", "success");
    document.getElementById('modalMisEscuelas').classList.add('hidden');
    
    // Si no tenía ninguna escuela, lo mandamos a esta y recargamos
    const misEscuelas = Object.keys(window.app.currentUser?.escuelas || {});
    if (misEscuelas.length === 0) {
      window.app.switchContext(escuelaId);
    } else {
      setTimeout(() => window.location.reload(), 1500);
    }
  } catch (error) {
    console.error("Error al solicitar unirse:", error);
    window.app.showToast("Error: " + error.message, "error");
    btn.disabled = false;
    btn.innerHTML = `<i class="ph ph-paper-plane-tilt"></i> Solicitar Acceso`;
  }
}

export async function cargarMateriasParaEscuela(escuelaId) {
  const container = document.getElementById('containerNuevasMaterias');
  if (!escuelaId) {
    container.innerHTML = '<p class="text-[10px] text-slate-400">Seleccioná una escuela primero para ver sus materias.</p>';
    return;
  }
  container.innerHTML = '<div class="text-center text-slate-400 py-2"><i class="ph ph-spinner animate-spin"></i> Cargando materias...</div>';
  try {
    const isDev = typeof __app_id !== 'undefined';
    const aid = isDev ? __app_id : 'mi-app-asistencia';
    const path = isDev ? `artifacts/${aid}/public/data/instituciones/${escuelaId}/materias` : `instituciones/${escuelaId}/materias`;
    
    const qSnapshot = await getDocs(collection(db, path));
    if (qSnapshot.empty) {
      container.innerHTML = '<p class="text-[10px] text-slate-400">Esta escuela no tiene materias cargadas aún.</p>';
      return;
    }
    
    let html = '';
    qSnapshot.forEach(docSnap => {
      const m = docSnap.data();
      const nombreCompleto = m.nombre || docSnap.id;
      html += `
        <label class="flex items-center gap-2 px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer transition">
          <input type="checkbox" name="chkNuevasMaterias" value="${nombreCompleto}" class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 bg-white dark:bg-slate-700">
          <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">${nombreCompleto}</span>
        </label>
      `;
    });
    container.innerHTML = html;
  } catch(e) {
    console.error("Error al cargar materias de la escuela", e);
    container.innerHTML = '<p class="text-[10px] text-red-500">Error al cargar materias.</p>';
  }
}
