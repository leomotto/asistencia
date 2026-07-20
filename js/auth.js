// js/auth.js — Sesión, login, logout y listener de autenticación

import { doc, setDoc, getDoc, getDocs, collection, query, where, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { db, auth, getPath, initAuth as fbInitAuth, loginWithGoogle, loginAnonymously, logout } from "./firebase-config.js?v=10.74";
import { showToast } from "./ui.js?v=10.74";
import { PERIODOS_CALENDARIO } from "./constants.js?v=10.74";

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
  if (await window.app.showConfirm("Cerrar sesión", "¿Estás seguro de que querés salir?")) await logout();
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
            
            // Migrar a estructura multi-escuela si no existe
            if (!userData.escuelas) {
              const oldTenant = userData.tenantId || 'root';
              userData.escuelas = {};
              userData.escuelas[oldTenant] = {
                rol: userData.rol || 'PENDIENTE',
                materias: userData.materias || []
              };
            }
            
            // Auto-promover cuentas del dueño a SUPERADMIN si no lo son
            const ownerEmails = ['leomotto@gmail.com', 'leopoldo.motto@bue.edu.ar'];
            if (ownerEmails.includes(user.email) && userData.superadmin !== true) {
              userData.superadmin = true;
              userData.rol = 'SUPERADMIN'; // Para retrocompatibilidad
              try {
                await setDoc(doc(db, getPath("usuarios"), user.uid), { superadmin: true, rol: 'SUPERADMIN' }, { merge: true });
                if (userData.escuelas) {
                  // También asegurar que en todas las escuelas tenga rol ADMIN/SUPERADMIN
                  for (let esc in userData.escuelas) {
                    userData.escuelas[esc].rol = 'ADMIN';
                    await setDoc(doc(db, getPath("usuarios"), user.uid), { 
                      [`escuelas.${esc}.rol`]: 'ADMIN' 
                    }, { merge: true });
                  }
                }
              } catch(promoError) {
                console.warn("No se pudo guardar la auto-promoción en BD, pero se aplicó en memoria.", promoError);
              }
            }
          } else {
            // Usuario nuevo → siempre PENDIENTE (promover desde UI o wizard)
            const ownerEmails = ['leomotto@gmail.com', 'leopoldo.motto@bue.edu.ar'];
            let isSuper = ownerEmails.includes(user.email);
            let defaultRol = isSuper ? 'SUPERADMIN' : 'PENDIENTE';
            userData = { rol: defaultRol, superadmin: isSuper, escuelas: {} };
            try {
              await setDoc(doc(db, getPath("usuarios"), user.uid), {
                rol: defaultRol, superadmin: isSuper, escuelas: {}, email: user.email || '', nombre: user.displayName || ''
              });
            } catch(newUserError) {
              console.warn("No se pudo crear el documento de usuario nuevo en BD.", newUserError);
            }
          }
        }

        // Determinar currentTenant inicial
        let savedTenant = localStorage.getItem('activeTenant');
        const userEscuelas = Object.keys(userData.escuelas || {});
        
        let initialTenant = 'root';
        if (userData.superadmin) {
           initialTenant = savedTenant || 'root';
        } else {
           if (savedTenant && userEscuelas.includes(savedTenant)) {
               initialTenant = savedTenant;
           } else if (userEscuelas.length > 0) {
               initialTenant = userEscuelas[0];
               localStorage.setItem('activeTenant', initialTenant);
           }
        }
        
        window.app.currentUser = { uid: user.uid, email: user.email, ...userData };
        await setAppTenant(initialTenant);
      } catch(e) {
        console.error("Error al obtener datos del usuario:", e);
        window.app.currentUser = { uid: user.uid, email: user.email, nombre: user.displayName || '', rolActivo: "ERR: " + (e.name === 'FirebaseError' ? e.code : e.message), superadmin: false };
      }

      // Ocultar pantalla de carga, mostrar app
      loadingScreen?.classList.add('hidden');
      loginScreen.classList.add('hidden');
      appContainer.classList.remove('hidden');

      const rol = window.app.currentUser.rolActivo;
      let rolBadge;
      if (esDevLocal)           rolBadge = `<span class="bg-amber-100 text-amber-800 text-[9px] px-1 rounded uppercase font-bold ml-1">DEV</span>`;
      else if (rol === 'SUPERADMIN') rolBadge = `<span class="bg-purple-100 text-purple-800 text-[9px] px-1 rounded uppercase font-bold ml-1">SUPERADMIN</span>`;
      else if (rol === 'ADMIN') rolBadge = `<span class="bg-purple-100 text-purple-800 text-[9px] px-1 rounded uppercase font-bold ml-1">ADMIN</span>`;
      else if (rol === 'PENDIENTE') rolBadge = `<span class="bg-yellow-100 text-yellow-800 text-[9px] px-1 rounded uppercase font-bold ml-1">PENDIENTE</span>`;
      else                      rolBadge = `<span class="bg-blue-100 text-blue-800 text-[9px] px-1 rounded uppercase font-bold ml-1">${rol}</span>`;

      // Visibilidad de tabs y controles según rol
      const esAdmin = (rol === 'ADMIN' || rol === 'SUPERADMIN');

      // Tabs exclusivos de Admin
      document.getElementById('btnMaterias')?.classList.toggle('hidden', !esAdmin);
      document.getElementById('btnDocentes')?.classList.toggle('hidden', !esAdmin);
      document.getElementById('btnAuditoria')?.classList.toggle('hidden', !esAdmin);
      document.getElementById('btnEscuelas')?.classList.toggle('hidden', rol !== 'SUPERADMIN');

      // Tab Matrícula: Admin lo ve siempre; Docente no tiene acceso a inscripciones
      document.getElementById('btnGestion')?.classList.toggle('hidden', rol === 'DOCENTE');

      // Botones de herramientas destructivas (solo Admin)
      document.getElementById('btnFusion')?.classList.toggle('hidden', !esAdmin);
      document.getElementById('btnBackup')?.classList.toggle('hidden', !esAdmin);
      document.getElementById('btnMiescuela')?.classList.toggle('hidden', !esAdmin);

      const displayName  = esDevLocal ? 'Dev Admin' : (user.displayName || user.email);
      const displayEmail = esDevLocal ? 'localhost'  : user.email;
      
      status.innerHTML = `
        <div class="flex flex-col gap-1 items-start w-full">
          <span class="flex items-center gap-1 ${esDevLocal ? 'text-amber-400' : 'text-emerald-400'} font-medium flex-wrap">
            <i class="ph ${esDevLocal ? 'ph-code' : 'ph-user-circle'} text-lg"></i>
            <span class="truncate max-w-[150px]" title="${displayEmail}">${displayName}</span> 
            ${rolBadge}
          </span>
          ${!esDevLocal ? `<button onclick="app.cerrarSesion()" class="text-[10px] text-slate-400 hover:text-red-400 transition flex items-center gap-1 mt-1"><i class="ph ph-sign-out"></i> Cerrar Sesión</button>` : ''}
        </div>
      `;

      if (typeof window.app.buildContextSwitcher === 'function') {
        window.app.buildContextSwitcher();
      }

      // Si es un usuario nuevo (PENDIENTE) y no tiene escuelas, abrir el modal para unirse
      if (rol === 'PENDIENTE' && (!window.app.currentUser.escuelas || Object.keys(window.app.currentUser.escuelas).length === 0)) {
        setTimeout(() => {
          if (typeof window.app.abrirModalUnirseEscuela === 'function') {
            window.app.abrirModalUnirseEscuela();
          }
        }, 500);
      }

      // Si es PENDIENTE, evaluamos si ya pidió unirse a una escuela o no

      if (rol === 'PENDIENTE' && !window.app.currentUser.superadmin) {
        if (Object.keys(window.app.currentUser.escuelas || {}).length === 0) {
           appContainer.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-center p-6 bg-slate-50 dark:bg-slate-900 overflow-y-auto">
              <div class="max-w-xl w-full bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 text-left my-8">
                <div class="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mb-6 shadow-sm mx-auto">
                  <i class="ph ph-buildings text-3xl"></i>
                </div>
                <h2 class="text-2xl font-black text-slate-800 dark:text-slate-100 mb-2 text-center">Unite a tu escuela</h2>
                <p class="text-slate-500 dark:text-slate-400 text-sm mb-6 text-center">
                  Para comenzar a usar SIDEAC, necesitás solicitar acceso a la institución educativa en la que trabajás.
                </p>
                <div id="onboardingFormContainer" class="w-full">
                  <p class="text-center text-slate-400"><i class="ph ph-spinner animate-spin"></i> Cargando opciones...</p>
                </div>
              </div>
            </div>
          `;
          if (typeof window.app.cargarOnboardingEscuelas === 'function') {
             window.app.cargarOnboardingEscuelas();
          }
        } else {
          appContainer.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-center p-6">
              <div class="w-20 h-20 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mb-6 shadow-sm">
                <i class="ph ph-hourglass text-4xl"></i>
              </div>
              <h2 class="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-3">Solicitud en revisión</h2>
              <p class="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Tu solicitud para la escuela <strong>${Object.keys(window.app.currentUser.escuelas)[0]}</strong> está pendiente de aprobación por un administrador.
              </p>
              <button onclick="window.app.cerrarSesion()" class="mt-8 px-6 py-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold rounded-lg transition-colors">
                Cerrar Sesión
              </button>
            </div>
          `;
        }
        return; // Detener flujo normal
      }

      document.getElementById('tomaFecha').valueAsDate = new Date();
      await window.app.cargarMateriasDinamicas();

      const limites = PERIODOS_CALENDARIO["CLASES REGULARES"];
      document.getElementById('biFechaDesde').value = limites.desde;
      document.getElementById('biFechaHasta').value = limites.hasta;

      window.app.popularCursos();
      window.app.renderAgenda?.();

      // Cargar configuración de evaluaciones (columnas habilitadas) — requiere auth
      window.app.cargarConfiguracionHabilitacion?.();



      // #3 Badge de usuarios PENDIENTE para admin
      if (esAdmin) {
        await actualizarBadgePendientes();
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
  const TIMEOUT_MS = 10000;
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

export async function setAppTenant(newTenant) {
  if (!window.app.currentUser) return;
  
  window.app.currentTenant = newTenant;
  localStorage.setItem('activeTenant', newTenant);
  const userData = window.app.currentUser;
  
  if (userData.superadmin) {
     userData.rolActivo = 'SUPERADMIN';
     if (newTenant !== 'root') {
       // Usar materias del usuario en esta escuela si las tiene, si no sus materias globales
       userData.materiasActivas = userData.escuelas?.[newTenant]?.materias?.length
         ? userData.escuelas[newTenant].materias
         : (userData.materias || []);
     } else {
       userData.materiasActivas = userData.materias || [];
     }
  } else if (userData.escuelas && userData.escuelas[newTenant]) {
     userData.rolActivo = userData.escuelas[newTenant].rol || 'PENDIENTE';
     userData.materiasActivas = userData.escuelas[newTenant].materias || [];
  } else {
     userData.rolActivo = 'PENDIENTE';
     userData.materiasActivas = [];
  }
}

export async function actualizarBadgePendientes() {
  try {
    let q;
    if (window.app.currentTenant && window.app.currentTenant !== 'root') {
      q = query(collection(db, 'usuarios'), where(`escuelas.${window.app.currentTenant}.rol`, '==', 'PENDIENTE'));
    } else {
       q = query(collection(db, 'usuarios'), where('rol', '==', 'PENDIENTE'));
    }
    
    const pendSnap = await getDocs(q);
    const btnDoc = document.getElementById('btnDocentes');
    if (btnDoc) {
      btnDoc.querySelector('#pendientesBadge')?.remove();
      if (pendSnap.size > 0 && window.app.currentTenant !== 'root') {
        const badge = document.createElement('span');
        badge.id = 'pendientesBadge';
        badge.className = 'ml-auto flex-shrink-0 inline-flex items-center justify-center min-w-[1rem] h-4 px-0.5 text-[9px] font-bold bg-red-500 text-white rounded-full';
        badge.textContent = pendSnap.size;
        btnDoc.appendChild(badge);
      }
    }
  } catch(e) { console.warn('No se pudo verificar usuarios pendientes:', e); }
}
