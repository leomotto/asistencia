// js/auth.js — Sesión, login, logout y listener de autenticación

import { doc, setDoc, getDoc, getDocs, collection, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { db, auth, getPath, initAuth as fbInitAuth, loginWithGoogle, loginAnonymously, logout } from "./firebase-config.js?v=9.20";
import { showToast } from "./ui.js?v=9.20";
import { PERIODOS_CALENDARIO } from "./constants.js?v=9.20";

const DEV_HOSTNAMES = ['localhost', '127.0.0.1', ''];

export async function iniciarSesionGoogle() {
  const btn = document.querySelector('#loginScreen button');
  try {
    btn.innerHTML = `<i class="ph ph-spinner animate-spin text-xl"></i> Conectando...`;
    btn.disabled = true;
    await loginWithGoogle();
  } catch (e) {
    showToast('❌ Error de autenticación', 'error');
    btn.innerHTML = `<i class="ph ph-google-logo text-xl text-red-500"></i> Iniciar sesión con Google`;
    btn.disabled = false;
  }
}

export async function cerrarSesion() {
  if (confirm("¿Querés cerrar sesión?")) await logout();
}

export async function entrarModoDesarrollo() {
  const btn = document.querySelector('#devModeContainer button');
  try {
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ph ph-spinner animate-spin"></i> Conectando...'; }
    await loginAnonymously();
  } catch(e) {
    console.error(e);
    showToast('❌ Activá "Anonymous" en Firebase Console → Authentication → Sign-in providers', 'error');
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ph ph-code text-lg"></i> Entrar como Admin (Dev Local)'; }
  }
}

export function showDevButton() {
  if (DEV_HOSTNAMES.includes(location.hostname)) {
    const devContainer = document.getElementById('devModeContainer');
    if (devContainer) devContainer.classList.remove('hidden');
  }
}

export function setupAuthListener() {
  onAuthStateChanged(auth, async (user) => {
    const loadingScreen= document.getElementById('loadingScreen');
    const status       = document.getElementById('authStatus');
    const loginScreen  = document.getElementById('loginScreen');
    const appContainer = document.getElementById('appContainer');

    if (user) {
      const esDevLocal = user.isAnonymous && DEV_HOSTNAMES.includes(location.hostname);

      try {
        let userData;
        if (esDevLocal) {
          userData = { rol: 'ADMIN', materias: [], email: 'dev@localhost', nombre: 'Dev Admin' };
        } else {
          // Leer rol desde Firestore
          const userDoc = await getDoc(doc(db, getPath("usuarios"), user.uid));
          userData = { rol: "PENDIENTE", materias: [] };
          if (userDoc.exists()) {
            userData = userDoc.data();
          } else {
            // Usuario nuevo → siempre PENDIENTE (promover el primer admin desde Firebase Console)
            userData = { rol: "PENDIENTE", materias: [] };
            await setDoc(doc(db, getPath("usuarios"), user.uid), {
              rol: "PENDIENTE", email: user.email || '', nombre: user.displayName || ''
            });
          }
        }
        window.app.currentUser = { uid: user.uid, email: user.email, ...userData };
      } catch(e) {
        console.error("Error al obtener rol:", e);
        window.app.currentUser = { uid: user.uid, rol: "ERROR" };
      }

      // Ocultar pantalla de carga, mostrar app
      loadingScreen?.classList.add('hidden');
      loginScreen.classList.add('hidden');
      appContainer.classList.remove('hidden');

      const rol = window.app.currentUser.rol;
      let rolBadge;
      if (esDevLocal)           rolBadge = `<span class="bg-amber-100 text-amber-800 text-[9px] px-1 rounded uppercase font-bold ml-1">DEV</span>`;
      else if (rol === 'ADMIN') rolBadge = `<span class="bg-purple-100 text-purple-800 text-[9px] px-1 rounded uppercase font-bold ml-1">ADMIN</span>`;
      else if (rol === 'PENDIENTE') rolBadge = `<span class="bg-yellow-100 text-yellow-800 text-[9px] px-1 rounded uppercase font-bold ml-1">PENDIENTE</span>`;
      else                      rolBadge = `<span class="bg-blue-100 text-blue-800 text-[9px] px-1 rounded uppercase font-bold ml-1">${rol}</span>`;

      // Visibilidad de tabs y controles según rol
      const esAdmin = (rol === 'ADMIN');

      // Tabs exclusivos de Admin
      document.getElementById('btnMaterias')?.classList.toggle('hidden', !esAdmin);
      document.getElementById('btnDocentes')?.classList.toggle('hidden', !esAdmin);

      // Tab Matrícula: Admin lo ve siempre; Docente no tiene acceso a inscripciones
      document.getElementById('btnGestion')?.classList.toggle('hidden', rol === 'DOCENTE');

      // Botones de herramientas destructivas (solo Admin)
      document.getElementById('btnFusion')?.classList.toggle('hidden', !esAdmin);
      document.getElementById('btnBackup')?.classList.toggle('hidden', !esAdmin);

      const displayName  = esDevLocal ? 'Dev Admin' : (user.displayName || user.email);
      const displayEmail = esDevLocal ? 'localhost'  : user.email;
      status.innerHTML = `
        <div class="flex flex-col gap-1 items-start w-full">
          <span class="flex items-center gap-1 ${esDevLocal ? 'text-amber-400' : 'text-emerald-400'} font-medium">
            <i class="ph ${esDevLocal ? 'ph-code' : 'ph-user-circle'} text-lg"></i>
            <span class="truncate max-w-[150px]" title="${displayEmail}">${displayName}</span> ${rolBadge}
          </span>
          ${!esDevLocal ? `<button onclick="app.cerrarSesion()" class="text-[10px] text-slate-400 hover:text-red-400 transition"><i class="ph ph-sign-out"></i> Cerrar Sesión</button>` : ''}
        </div>
      `;

      document.getElementById('tomaFecha').valueAsDate = new Date();
      await window.app.cargarMateriasDinamicas();

      const limites = PERIODOS_CALENDARIO["CLASES REGULARES"];
      document.getElementById('biFechaDesde').value = limites.desde;
      document.getElementById('biFechaHasta').value = limites.hasta;

      window.app.popularCursos();

      // Cargar configuración de evaluaciones (columnas habilitadas) — requiere auth
      window.app.cargarConfiguracionHabilitacion?.();

      // #1 Restaurar último curso usado en Toma Diaria
      const lastCurso = localStorage.getItem('lastCurso');
      if (lastCurso) {
        const selCurso = document.getElementById('tomaCurso');
        if (selCurso && [...selCurso.options].some(o => o.value === lastCurso)) {
          selCurso.value = lastCurso;
          window.app.actualizarHorariosYFechasRapidas?.();
          window.app.cargarAlumnos?.();
        }
      }

      // #3 Badge de usuarios PENDIENTE para admin
      if (esAdmin) {
        try {
          const pendSnap = await getDocs(query(collection(db, getPath('usuarios')), where('rol', '==', 'PENDIENTE')));
          if (pendSnap.size > 0) {
            const btnDoc = document.getElementById('btnDocentes');
            if (btnDoc) {
              btnDoc.querySelector('#pendientesBadge')?.remove();
              const badge = document.createElement('span');
              badge.id = 'pendientesBadge';
              badge.className = 'ml-auto flex-shrink-0 inline-flex items-center justify-center min-w-[1rem] h-4 px-0.5 text-[9px] font-bold bg-red-500 text-white rounded-full';
              badge.textContent = pendSnap.size;
              btnDoc.appendChild(badge);
            }
          }
        } catch(e) { console.warn('No se pudo verificar usuarios pendientes:', e); }
      }

    } else {
      // Sin sesión: ocultar carga, mostrar login
      loadingScreen?.classList.add('hidden');
      loginScreen.classList.remove('hidden');
      appContainer.classList.add('hidden');
      const btn = document.querySelector('#loginScreen button');
      if (btn) {
        btn.innerHTML = `<i class="ph ph-google-logo text-xl text-red-500"></i> Iniciar sesión con Google`;
        btn.disabled = false;
      }
      status.innerHTML = `<i class="ph ph-warning text-red-500"></i> Desconectado`;
    }
  });
}

export function initAuth() {
  fbInitAuth();

  // Seguridad: si Firebase Auth no responde en 10 segundos (dominio no autorizado, red caída, etc.)
  // forzamos la transición a la pantalla de login para evitar el loader eterno.
  const TIMEOUT_MS = 10_000;
  const safetyTimer = setTimeout(() => {
    const loadingScreen = document.getElementById('loadingScreen');
    const loginScreen   = document.getElementById('loginScreen');
    if (loadingScreen && !loadingScreen.classList.contains('hidden')) {
      console.warn('[SIDEAC] Firebase Auth no respondió en ' + TIMEOUT_MS + 'ms. Mostrando pantalla de login.');
      loadingScreen.classList.add('hidden');
      if (loginScreen) loginScreen.classList.remove('hidden');
    }
  }, TIMEOUT_MS);

  // Si la auth sí responde (exitosa o no), cancelamos el timer
  onAuthStateChanged(auth, () => clearTimeout(safetyTimer));
}
