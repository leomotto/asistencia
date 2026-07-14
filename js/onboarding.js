import { getDoc, doc, getDocs, collection, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db, getPath } from "./firebase-config.js?v=9.99";

export async function cargarOnboardingEscuelas() {
  const container = document.getElementById('onboardingFormContainer');
  if (!container) return;

  try {
    const qSnap = await getDocs(collection(db, getPath("escuelas")));
    let options = '<option value="">Seleccione una escuela...</option>';
    qSnap.forEach(d => {
      options += `<option value="${d.id}">${d.data().nombre || d.id}</option>`;
    });

    container.innerHTML = `
      <div class="space-y-4">
        <div>
          <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">ESCUELA</label>
          <select id="onboardingEscuelaSelect" class="w-full p-3 border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 transition" onchange="app.onboardingEscuelaCambiada()">
            ${options}
          </select>
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">ROL SOLICITADO</label>
          <select id="onboardingRolSelect" class="w-full p-3 border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 transition">
            <option value="DOCENTE">Docente</option>
            <option value="ADMIN">Administrador</option>
          </select>
        </div>
        <div id="onboardingMateriasContainer" class="hidden">
          <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">MATERIAS QUE DICTA</label>
          <div id="onboardingMateriasList" class="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700 max-h-60 overflow-y-auto space-y-2">
            <!-- Checkboxes will be populated here -->
          </div>
        </div>
        <button onclick="app.solicitarUnirseEscuela()" class="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-md transition-all flex items-center justify-center gap-2 mt-6">
          <i class="ph ph-paper-plane-right text-lg"></i> Enviar Solicitud
        </button>
        <button onclick="window.app.cerrarSesion()" class="w-full py-3 bg-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-bold rounded-lg transition-colors text-sm">
          Cerrar Sesión
        </button>
      </div>
    `;
  } catch (e) {
    console.error("Error al cargar escuelas para onboarding:", e);
    container.innerHTML = '<p class="text-red-500">Error al cargar las escuelas. Por favor, reintente.</p>';
  }
}

export async function onboardingEscuelaCambiada() {
  const select = document.getElementById('onboardingEscuelaSelect');
  const matContainer = document.getElementById('onboardingMateriasContainer');
  const matList = document.getElementById('onboardingMateriasList');
  
  if (!select.value) {
    matContainer.classList.add('hidden');
    return;
  }
  
  matList.innerHTML = '<p class="text-slate-500 text-sm italic">Cargando materias...</p>';
  matContainer.classList.remove('hidden');
  
  try {
    // Hack: Forzamos temporalmente currentTenant para que getPath() funcione en la colección materias.
    const originalTenant = window.app.currentTenant;
    window.app.currentTenant = select.value;
    
    const snap = await getDocs(collection(db, getPath("materias")));
    
    window.app.currentTenant = originalTenant; // Restore
    
    let html = '';
    const grupos = {};
    snap.forEach(d => {
      const m = d.data();
      const div = m.division || '(Sin división)';
      if (!grupos[div]) grupos[div] = [];
      grupos[div].push(m);
    });
    
    if (Object.keys(grupos).length === 0) {
      matList.innerHTML = '<p class="text-slate-500 text-sm italic">No hay materias registradas en esta escuela.</p>';
      return;
    }
    
    Object.keys(grupos).sort().forEach(div => {
      html += `<div class="mb-3 last:mb-0">
        <h4 class="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1 border-b dark:border-slate-700 pb-1">${div}</h4>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">`;
      grupos[div].forEach(m => {
        const uniqueId = `chk_${btoa(unescape(encodeURIComponent(m.nombre))).replace(/=/g, '')}`;
        html += `
          <label class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
            <input type="checkbox" class="onboarding-materia-cb rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" value="${m.nombre}">
            <span class="truncate" title="${m.nombre}">${m.materiaBase || m.nombre}</span>
          </label>
        `;
      });
      html += `</div></div>`;
    });
    
    matList.innerHTML = html;
  } catch (e) {
    console.error("Error cargando materias de la escuela seleccionada:", e);
    matList.innerHTML = '<p class="text-red-500 text-sm">Error cargando materias.</p>';
  }
}

export async function solicitarUnirseEscuela() {
  const select = document.getElementById('onboardingEscuelaSelect');
  if (!select) return;
  const codigo = select.value;
  
  if (!codigo) {
    window.app.showToast("Debe seleccionar una escuela", "error");
    return;
  }
  
  const rolSelect = document.getElementById('onboardingRolSelect');
  const rolSugerido = rolSelect ? rolSelect.value : 'DOCENTE';
  
  const checkboxes = document.querySelectorAll('.onboarding-materia-cb:checked');
  const materiasSeleccionadas = Array.from(checkboxes).map(cb => cb.value);
  
  try {
    const escSnap = await getDoc(doc(db, "escuelas", codigo));
    if (!escSnap.exists()) {
      window.app.showToast("La escuela seleccionada ya no existe", "error");
      return;
    }
    
    if (!window.app.currentUser || !window.app.currentUser.uid) {
      window.app.showToast("Error: No se identificó su usuario", "error");
      return;
    }
    
    const userRef = doc(db, "usuarios", window.app.currentUser.uid);
    await updateDoc(userRef, {
      [`escuelas.${codigo}.rol`]: "PENDIENTE",
      [`escuelas.${codigo}.rolSugerido`]: rolSugerido,
      [`escuelas.${codigo}.materias`]: materiasSeleccionadas
    });
    
    window.app.showToast("Solicitud enviada correctamente", "success");
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  } catch (e) {
    console.error(e);
    window.app.showToast("Error al enviar la solicitud: " + e.message, "error");
  }
}
