// js/ui.js — Toast, navegación de tabs, dark mode, dropdowns de cursos



export function mostrarSkeletonCards(count = 3) {
  let html = `<div class="animate-pulse flex flex-col gap-4">`;
  for(let i=0; i<count; i++){
    html += `
      <div class="bg-white dark:bg-slate-800 p-4 rounded-xl border dark:border-slate-700 shadow-sm flex flex-col sm:flex-row gap-4 items-start sm:items-center w-full">
        <div class="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-full flex-shrink-0"></div>
        <div class="flex-1 space-y-3 w-full">
          <div class="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
          <div class="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/4"></div>
        </div>
      </div>`;
  }
  html += `</div>`;
  return html;
}

export function mostrarSkeletonTable(colsCount = 4, rowsCount = 5) {
  let html = "";
  for(let i=0; i<rowsCount; i++){
    html += `<tr class="animate-pulse bg-white dark:bg-slate-800 border-b dark:border-slate-700">`;
    for(let j=0; j<colsCount; j++){
      html += `<td class="p-4"><div class="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full"></div></td>`;
    }
    html += `</tr>`;
  }
  return html;
}

export function showConfirm(title, text, confirmText = "Confirmar", isDestructive = true) {
  return new Promise((resolve) => {
    let modal = document.getElementById("modalConfirmCustom");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "modalConfirmCustom";
      modal.className = "fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 transition-opacity";
      document.body.appendChild(modal);
    }
    
    const iconClass = isDestructive ? "bg-red-100 text-red-600" : "bg-indigo-100 text-indigo-600";
    const iconIcon  = isDestructive ? "ph-warning" : "ph-question";
    const btnClass  = isDestructive ? "bg-red-600 hover:bg-red-700" : "bg-indigo-600 hover:bg-indigo-700";
    
    modal.innerHTML = `
      <div class="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border dark:border-slate-700 w-full max-w-sm overflow-hidden scale-in">
        <div class="p-6 text-center">
          <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full ${iconClass} mb-4">
            <i class="ph ${iconIcon} text-2xl"></i>
          </div>
          <h3 class="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">${title}</h3>
          <p class="text-sm text-slate-500 dark:text-slate-400">${text}</p>
        </div>
        <div class="bg-slate-50 dark:bg-slate-900/50 px-4 py-3 flex gap-3 justify-end border-t dark:border-slate-700">
          <button id="btnConfirmCustomCancel" class="px-4 py-2 bg-white dark:bg-slate-800 border dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition text-sm flex-1">Cancelar</button>
          <button id="btnConfirmCustomOk" class="px-4 py-2 text-white font-bold rounded-lg transition text-sm flex-1 ${btnClass}">${confirmText}</button>
        </div>
      </div>
    `;
    
    modal.classList.remove("hidden");
    
    const cleanup = () => {
      modal.classList.add("hidden");
    };
    
    document.getElementById("btnConfirmCustomCancel").onclick = () => {
      cleanup();
      resolve(false);
    };
    
    document.getElementById("btnConfirmCustomOk").onclick = () => {
      cleanup();
      resolve(true);
    };
  });
}

export function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');
  toastMsg.innerText = msg;
  const base = "fixed top-4 left-1/2 transform -translate-x-1/2 text-white px-6 py-3 rounded-lg shadow-lg z-50 transition-opacity duration-300";
  if (type === 'error')     toast.className = `${base} bg-red-600`;
  else if (type === 'info') toast.className = `${base} bg-blue-600`;
  else                      toast.className = `${base} bg-emerald-600`;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3500);
}

export function switchTab(tabId) {
  if (window.app.currentUser?.rolActivo === 'PENDIENTE') {
    showToast('⚠️ Tu cuenta está pendiente de autorización por un Administrador.', 'error');
    return;
  }

  const performSwitch = () => {
    ['inicioTab', 'tomaDiaria', 'planillaGrilla', 'evaluaciones', 'panelBI', 'gestionAlumnos', 'gestionMaterias', 'gestionDocentes', 'auditoriaTab', 'gestionEscuelas'].forEach(id => {
      document.getElementById(id)?.classList.add('hidden');
    });
    const targetSection = document.getElementById(tabId);
    targetSection?.classList.remove('hidden');
    targetSection?.scrollTo({ top: 0, behavior: 'instant' });

    ['btnInicio', 'btnToma', 'btnGrilla', 'btnEval', 'btnPanel', 'btnGestion', 'btnMaterias', 'btnDocentes', 'btnAuditoria', 'btnEscuelas'].forEach(id => {
      document.getElementById(id)?.classList.remove('bg-white/10');
    });
    ['btnMobileInicio', 'btnMobileToma', 'btnMobileGrilla', 'btnMobileEval', 'btnMobileGestion'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.classList.remove('text-indigo-600', 'dark:text-indigo-400');
        el.classList.add('text-slate-500', 'dark:text-slate-400');
      }
    });
    const btnMap = {
      inicioTab:       'btnInicio',
      tomaDiaria:      'btnToma',
      planillaGrilla:  'btnGrilla',
      evaluaciones:    'btnEval',
      panelBI:         'btnPanel',
      gestionAlumnos:  'btnGestion',
      gestionMaterias: 'btnMaterias',
      gestionDocentes: 'btnDocentes',
      auditoriaTab:    'btnAuditoria',
      gestionEscuelas: 'btnEscuelas'
    };
    if (btnMap[tabId]) document.getElementById(btnMap[tabId])?.classList.add('bg-white/10');
    
    const mobileBtnMap = {
      inicioTab:      'btnMobileInicio',
      tomaDiaria:     'btnMobileToma',
      planillaGrilla: 'btnMobileGrilla',
      evaluaciones:   'btnMobileEval',
      gestionAlumnos: 'btnMobileGestion'
    };
    if (mobileBtnMap[tabId]) {
      const activeEl = document.getElementById(mobileBtnMap[tabId]);
      if (activeEl) {
        activeEl.classList.remove('text-slate-500', 'dark:text-slate-400');
        activeEl.classList.add('text-indigo-600', 'dark:text-indigo-400');
      }
    }
  };

  // View Transitions API para transiciones suaves entre pestañas (Chrome 111+)
  if (document.startViewTransition) {
    document.startViewTransition(() => performSwitch());
  } else {
    performSwitch();
  }

  if (tabId === 'inicioTab')       window.app.renderAgenda?.();
  if (tabId === 'planillaGrilla')  window.app.cargarPlanillaGrilla();
  if (tabId === 'evaluaciones')    window.app.cargarPlanillaEvaluaciones();
  if (tabId === 'gestionAlumnos')  window.app.cargarAlumnosMatricula();
  if (tabId === 'gestionMaterias') window.app.cargarListaMateriasAdmin();
  if (tabId === 'gestionDocentes') window.app.cargarListaUsuarios();
  if (tabId === 'gestionEscuelas') window.app.cargarListaEscuelas();

  // Auto-focus en desktop: dirige la atención al primer campo a completar
  if (window.matchMedia('(min-width: 768px)').matches) {
    const dualFocusId = { tomaDiaria: 'tomaCurso', evaluaciones: 'evalCurso', planillaGrilla: 'grillaCurso', panelBI: 'biCurso' }[tabId];
    if (dualFocusId) {
      setTimeout(() => {
        const orig = document.getElementById(dualFocusId);
        const dual = orig && orig.nextElementSibling;
        const target = (dual && dual.classList.contains('dual-select-container')) ? dual.querySelector('.select-div') : orig;
        target?.focus();
      }, 80);
    } else if (tabId === 'gestionAlumnos') {
      setTimeout(() => document.getElementById('mBuscadorAlumno')?.focus(), 80);
    }
  }

  // Cerrar menú lateral al navegar en móvil
  const nav = document.getElementById('sideNav');
  if (nav && !nav.classList.contains('-translate-x-full')) toggleMenuMobile();
}

export function toggleMenuMobile() {
  const nav     = document.getElementById('sideNav');
  const overlay = document.getElementById('menuOverlay');
  if (!nav || !overlay) return;
  const isOpen = !nav.classList.contains('-translate-x-full');
  nav.classList.toggle('-translate-x-full', isOpen);
  overlay.classList.toggle('hidden', isOpen);
}

export function toggleDarkMode() {
  const html = document.documentElement;
  html.classList.toggle('dark');
  const isDark = html.classList.contains('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  const icon = document.getElementById('iconTheme');
  const text = document.getElementById('textTheme');
  if (isDark) { icon.className = "ph ph-sun text-xl text-yellow-400";  text.innerText = "Modo Claro"; }
  else        { icon.className = "ph ph-moon text-xl text-indigo-200"; text.innerText = "Modo Noche"; }
}

export function popularPeriodos() {
  const hoy  = new Date();
  const Y    = hoy.getMonth() >= 2 ? hoy.getFullYear() : hoy.getFullYear() - 1;
  const Y1   = Y + 1;
  const MESES = ['MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];

  const opciones = [
    ['CLASES REGULARES', 'CLASES REGULARES'],
    ['1er BIMESTRE',     '1er BIMESTRE'],
    ['2do BIMESTRE',     '2do BIMESTRE'],
    ['3er BIMESTRE',     '3er BIMESTRE'],
    ['4to BIMESTRE',     '4to BIMESTRE'],
    ['1er CUATRIMESTRE', '1er CUATRIMESTRE'],
    ['2do CUATRIMESTRE', '2do CUATRIMESTRE'],
    ['PO DIC',           'PO DIC'],
    ['PO FEB-MAR',       'PO FEB-MAR'],
    ...MESES.map(m => [`${m} ${Y}`, `${m} ${Y}`]),
    [`ENERO ${Y}`,       `ENERO ${Y} (${Y1})`],
    [`FEBRERO ${Y}`,     `FEBRERO ${Y} (${Y1})`],
  ];

  const html = opciones.map(([v, t]) => `<option value="${v}">${t}</option>`).join('');
  document.querySelectorAll('.select-periodo-global').forEach(sel => {
    const hasFechaManual = sel.dataset.fechaManual === 'true';
    sel.innerHTML = html + (hasFechaManual ? '<option value="FECHA MANUAL">FECHA MANUAL</option>' : '');
  });
}

export async function buildContextSwitcher() {
  const container = document.getElementById('contextSwitcherContainer');
  if (!container) return;

  const currentUser = window.app.currentUser;
  if (!currentUser) return;

  const escuelasIds = Object.keys(currentUser.escuelas || {});
  
  if (currentUser.superadmin) {
    // Si es superadmin mostramos un selector con todas las escuelas
    container.innerHTML = `
      <div class="flex items-center justify-between mb-1">
        <label class="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Modo SuperAdmin</label>
      </div>
      <div class="flex items-center gap-2 w-full">
        <select id="superadminTenantSelect" class="bg-slate-700 text-white text-xs p-1.5 rounded w-full border border-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500">
          <option value="root">Cargando...</option>
        </select>
        <button onclick="app.switchContext(document.getElementById('superadminTenantSelect').value)" class="bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1.5 rounded text-xs transition" title="Ir a Escuela">
          <i class="ph ph-arrow-right"></i>
        </button>
      </div>
    `;
    
    try {
      const { getDocs, collection } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
      const { db, getPath } = await import("./firebase-config.js?v=10.65");
      
      const qSnap = await getDocs(collection(db, getPath("escuelas")));
      let html = `<option value="root" ${window.app.currentTenant === 'root' ? 'selected' : ''}>[SUPERADMIN] ROOT</option>`;
      qSnap.forEach(doc => {
        html += `<option value="${doc.id}" ${window.app.currentTenant === doc.id ? 'selected' : ''}>${doc.data().nombre || doc.id}</option>`;
      });
      document.getElementById('superadminTenantSelect').innerHTML = html;
    } catch (e) {
      console.error(e);
      document.getElementById('superadminTenantSelect').innerHTML = `<option value="root">[SUPERADMIN] ROOT</option>`;
    }
    return;
  }

  // Para usuarios normales, un botón que abre el modal de escuelas y roles
  const tenantName = window.app.currentTenant !== 'root' ? window.app.currentTenant : 'Sin escuela activa';
  
  container.innerHTML = `
    <div class="mt-2">
      <button onclick="app.abrirModalUnirseEscuela()" class="w-full bg-slate-700 hover:bg-slate-600 text-white text-xs p-2 rounded border border-slate-600 focus:outline-none transition flex items-center justify-between group">
        <div class="flex flex-col items-start truncate">
          <span class="text-[10px] text-slate-400 font-bold uppercase tracking-wider group-hover:text-slate-300">Mis Escuelas</span>
          <span class="truncate font-semibold mt-0.5">${tenantName}</span>
        </div>
        <i class="ph ph-buildings text-lg text-indigo-400"></i>
      </button>
    </div>
  `;
}

export async function switchContext(newTenant) {
  if (!newTenant || newTenant === window.app.currentTenant) return;
  
  if (window.app.setAppTenant) {
    await window.app.setAppTenant(newTenant);
    buildContextSwitcher();
    
    // Recargar datos de la escuela para no mezclar
    if (window.app.cargarMateriasDinamicas) {
      await window.app.cargarMateriasDinamicas();
      window.app.popularCursos?.();
      window.app.actualizarBadgePendientes?.();
    }
    
    // Encontrar el tab activo buscando el que tenga bg-white/10
    let currentTabId = 'inicioTab';
    const tabBtns = document.querySelectorAll('.tab-btn');
    for (const btn of tabBtns) {
      // Las clases activas son bg-white/10 en desktop o text-indigo-600 en mobile
      if (btn.classList.contains('bg-white/10') || btn.classList.contains('text-indigo-600')) {
        currentTabId = btn.dataset.tab;
        break;
      }
    }
    
    // Si pasamos de root a una escuela, los tabs de admin global no existen
    if (newTenant !== 'root' && (currentTabId === 'gestionEscuelas' || currentTabId === 'auditoriaTab')) {
      currentTabId = 'inicioTab';
    }
    // Y viceversa
    if (newTenant === 'root' && currentTabId !== 'gestionEscuelas' && currentTabId !== 'auditoriaTab' && currentTabId !== 'usuarios') {
       currentTabId = 'gestionEscuelas';
    }
    
    switchTab(currentTabId);
  } else {
    localStorage.setItem('activeTenant', newTenant);
    window.location.reload();
  }
}

export function popularCursos() {
  const esDocente          = window.app.currentUser?.rolActivo === 'DOCENTE';
  const materiasPermitidas = window.app.currentUser?.materiasActivas || [];

  // Lista base permitida
  let permitidas = [];
  window.app.cursos.forEach(mat => {
    if (esDocente && !materiasPermitidas.includes(mat)) return;
    permitidas.push(mat);
  });

  document.querySelectorAll('.select-curso-global').forEach(originalSelect => {
    // Filtrar Talleres en el módulo de evaluaciones
    let opcionesLocal = permitidas;
    if (originalSelect.id === 'evalCurso') {
      opcionesLocal = permitidas.filter(m => !m.toLowerCase().includes('taller'));
    }

    // 1. Caso especial: Matricula solo usa divisiones
    if (originalSelect.id === 'mCurso') {
      const divisionesUnicas = [...new Set(opcionesLocal.map(m => {
        const idx = m.indexOf(' - ');
        return idx > -1 ? m.substring(0, idx) : 'General';
      }))];
      
      originalSelect.innerHTML = `<option value="">Filtrar por División...</option>`;
      if (!esDocente) {
        originalSelect.innerHTML += `<option value="__TODOS__" class="font-bold text-indigo-700">📋 TODOS LOS ESTUDIANTES</option>`;
      }
      divisionesUnicas.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d; opt.innerText = d;
        originalSelect.appendChild(opt);
      });
      
      const nextNode = originalSelect.nextElementSibling;
      if (nextNode && nextNode.classList.contains('dual-select-container')) {
        nextNode.remove();
      }
      originalSelect.style.display = '';
      return; // Fin para mCurso
    }

    // 2. Ocultar el original y llenarlo (por si otro script lee sus options)
    originalSelect.innerHTML = `<option value="">Seleccione...</option>`;
    opcionesLocal.forEach(mat => {
      const opt = document.createElement('option');
      opt.value = mat; opt.innerText = mat;
      originalSelect.appendChild(opt);
    });
    originalSelect.style.display = 'none';

    // 2. Crear los dos dropdowns si no existen
    let dualContainer = originalSelect.nextElementSibling;
    if (!dualContainer || !dualContainer.classList.contains('dual-select-container')) {
      dualContainer = document.createElement('div');
      dualContainer.className = 'dual-select-container flex flex-wrap sm:flex-nowrap gap-2 w-full';
      
      const selDiv = document.createElement('select');
      selDiv.className = 'flex-1 min-w-0 p-2 text-base md:text-sm border dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 outline-none font-medium select-div cursor-pointer focus:ring-2 focus:ring-indigo-500 transition-shadow';
      
      const selAsig = document.createElement('select');
      selAsig.className = 'flex-1 min-w-0 p-2 text-base md:text-sm border dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 outline-none font-medium select-asig cursor-pointer focus:ring-2 focus:ring-indigo-500 transition-shadow disabled:opacity-50';
      selAsig.disabled = true;

      // Si es el módulo de matrícula, ocultamos el select de asignatura
      if (originalSelect.id === 'mCurso') {
        selAsig.style.display = 'none';
      }

      dualContainer.appendChild(selDiv);
      dualContainer.appendChild(selAsig);
      
      originalSelect.parentNode.insertBefore(dualContainer, originalSelect.nextSibling);

      // Lógica de dependencia
      selDiv.addEventListener('change', () => {
        const div = selDiv.value;

        // Caso Matrícula: solo filtramos por división
        if (originalSelect.id === 'mCurso') {
          originalSelect.value = div || '';
          originalSelect.dispatchEvent(new Event('change'));
          return;
        }

        if (!div) {
          selAsig.innerHTML = '<option value="">Asignatura...</option>';
          selAsig.disabled = true;
          originalSelect.value = '';
          originalSelect.dispatchEvent(new Event('change'));
          return;
        }
        if (div === '__TODOS__') {
          selAsig.innerHTML = '<option value="">--</option>';
          selAsig.disabled = true;
          originalSelect.value = '__TODOS__';
          originalSelect.dispatchEvent(new Event('change'));
          return;
        }

        const asigs = opcionesLocal
          .filter(m => {
            const idx = m.indexOf(' - ');
            const d = idx > -1 ? m.substring(0, idx) : 'General';
            return d === div;
          })
          .map(m => {
            const idx = m.indexOf(' - ');
            return idx > -1 ? m.substring(idx + 3) : m;
          });
        
        selAsig.innerHTML = '<option value="">Asignatura...</option>' + asigs.map(a => `<option value="${a}">${a}</option>`).join('');
        selAsig.disabled = false;
        
        if (asigs.length === 1) {
          selAsig.value = asigs[0];
          originalSelect.value = div === 'General' ? asigs[0] : `${div} - ${asigs[0]}`;
        } else {
          originalSelect.value = '';
        }
        originalSelect.dispatchEvent(new Event('change'));
      });

      selAsig.addEventListener('change', () => {
        if (originalSelect.id === 'mCurso') return; // En matrícula no importa

        const div = selDiv.value;
        const asig = selAsig.value;
        if (!asig) {
          originalSelect.value = '';
        } else {
          originalSelect.value = div === 'General' ? asig : `${div} - ${asig}`;
        }
        originalSelect.dispatchEvent(new Event('change'));
      });
    }

    // 3. Resetear y poblar el dropdown de División
    const selectDiv = dualContainer.querySelector('.select-div');
    const selectAsig = dualContainer.querySelector('.select-asig');
    
    const divisionesUnicas = [...new Set(opcionesLocal.map(m => {
      const idx = m.indexOf(' - ');
      return idx > -1 ? m.substring(0, idx) : 'General';
    }))];
    
    selectDiv.innerHTML = '<option value="">División...</option>';
    if (originalSelect.id === 'mCurso' && !esDocente) {
      selectDiv.innerHTML += `<option value="__TODOS__" class="font-bold text-indigo-700">📋 TODOS LOS ESTUDIANTES</option>`;
    }
    divisionesUnicas.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d; opt.innerText = d;
      selectDiv.appendChild(opt);
    });

    selectAsig.innerHTML = '<option value="">Asignatura...</option>';
    selectAsig.disabled = true;
  });
}

export function toggleSidebar() {
  const nav = document.getElementById('sideNav');
  if (!nav) return;
  const collapsed = nav.classList.toggle('sidebar-collapsed');
  localStorage.setItem('sidebarCollapsed', collapsed ? '1' : '0');
  document.getElementById('iconCollapseSide')?.classList.toggle('hidden', collapsed);
  document.getElementById('iconExpandSide')?.classList.toggle('hidden', !collapsed);
}

export function initSidebar() {
  if (localStorage.getItem('sidebarCollapsed') === '1') {
    document.getElementById('sideNav')?.classList.add('sidebar-collapsed');
    document.getElementById('iconCollapseSide')?.classList.add('hidden');
    document.getElementById('iconExpandSide')?.classList.remove('hidden');
  }
}

export function initTheme() {
  const prefersDark = !('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (localStorage.theme === 'dark' || prefersDark) {
    document.documentElement.classList.add('dark');
    const icon = document.getElementById('iconTheme');
    const text = document.getElementById('textTheme');
    if (icon) icon.className = "ph ph-sun text-xl text-yellow-400";
    if (text) text.innerText = "Modo Claro";
  } else {
    document.documentElement.classList.remove('dark');
  }
}

export async function cargarVersion() {
  const el = document.getElementById('appVersion');
  if (!el) return;
  try {
    const r = await fetch('version.json?t=' + Date.now());
    if (!r.ok) { el.textContent = 'dev'; return; }
    const { hash, date, version } = await r.json();
    if (version) {
      el.textContent = `${version} · ${hash} · ${date}`;
    } else {
      el.textContent = `${hash} · ${date}`;
    }
  } catch (e) {
    el.textContent = 'dev';
  }
}

export function renderAgenda() {
  const container = document.getElementById('agendaContainer');
  if (!container) return;

  const materias = window.app?.currentUser?.materiasActivas || [];
  const esAdmin = window.app?.currentUser?.rolActivo === 'ADMIN' || window.app?.currentUser?.rolActivo === 'SUPERADMIN';
  const nombreUsuario = window.app?.currentUser?.nombre || window.app?.currentUser?.displayName || window.app?.currentUser?.email?.split('@')[0] || '';
  
  const titleEl = document.getElementById('welcomeUserTitle');
  if (titleEl && nombreUsuario) {
    titleEl.textContent = `¡Hola, ${nombreUsuario}!`;
  }

  if (esAdmin && materias.length === 0) {
    container.innerHTML = `
      <div class="bg-indigo-50 dark:bg-indigo-900/30 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300">
        <div class="flex items-center gap-2 font-bold mb-1"><i class="ph ph-shield-check text-xl"></i> Modo Administrador</div>
        <p class="text-sm">Tenés acceso a todas las secciones del sistema desde el menú principal.</p>
      </div>`;
    return;
  }

  if (materias.length === 0) {
    container.innerHTML = `<p class="text-slate-500 text-sm py-4">No tenés materias asignadas.</p>`;
    return;
  }

  const hoy = new Date().getDay();
  const DIAS_NOMBRES = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
  
  let materiasHoy = [];
  let proximasMaterias = [];

  materias.forEach(materia => {
    const horario = window.app.HORARIOS_DINAMICOS?.[materia];
    const dias = horario?.dias || [];
    let claseHoy = dias.find(d => d.dia === hoy);
    
    if (claseHoy) {
      materiasHoy.push({ materia, info: claseHoy });
    } else {
      // Find the next closest day
      let nextDay = null;
      let minDiff = 8;
      dias.forEach(d => {
        let diff = d.dia - hoy;
        if (diff <= 0) diff += 7; // Next week
        if (diff < minDiff) {
          minDiff = diff;
          nextDay = d;
        }
      });
      if (nextDay) {
        proximasMaterias.push({ materia, info: nextDay, diff: minDiff });
      }
    }
  });

  const btnTemplate = (matName, info, isToday) => {
    const timeStr = (info.horaInicio && info.horaFin) ? `${info.horaInicio} – ${info.horaFin}` : (info.horaInicio ? info.horaInicio : '');
    const badgeHtml = timeStr ? `<span class="mt-1 inline-block bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded-full">${timeStr}</span>` : '';
    const dayLabel = !isToday ? `<span class="mt-1 inline-block bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded-full">${DIAS_NOMBRES[info.dia]}</span>` : '';
    
    return `
      <button onclick="document.getElementById('tomaCurso').value = '${matName}'; window.app.switchTab('tomaDiaria'); document.getElementById('tomaCurso').dispatchEvent(new Event('change'));" 
              class="w-full bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 transition-colors text-left flex items-center justify-between group mb-2">
        <div class="flex items-center gap-3">
          <div class="bg-indigo-50 dark:bg-slate-700 p-2.5 rounded-lg text-indigo-500 dark:text-indigo-400 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
            <i class="ph ph-chalkboard-teacher text-xl"></i>
          </div>
          <div>
            <h4 class="font-bold text-slate-800 dark:text-slate-100 text-sm md:text-base leading-tight">${matName}</h4>
            <div class="flex gap-1 flex-wrap">
              ${badgeHtml}
              ${dayLabel}
            </div>
          </div>
        </div>
        <i class="ph ph-caret-right text-slate-300 group-hover:text-indigo-500 transition-colors"></i>
      </button>
    `;
  };

  if (materiasHoy.length > 0) {
    // Sort today's classes by start time if available
    materiasHoy.sort((a, b) => (a.info.horaInicio || '').localeCompare(b.info.horaInicio || ''));
    
    let html = `<h3 class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Clases de hoy</h3>`;
    html += materiasHoy.map(m => btnTemplate(m.materia, m.info, true)).join('');
    container.innerHTML = html;
  } else {
    let html = `
      <div class="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-center mb-4">
        <i class="ph ph-confetti text-3xl text-emerald-500 mb-2"></i>
        <h3 class="font-bold text-slate-800 dark:text-slate-100">¡Día libre!</h3>
        <p class="text-sm text-slate-500 dark:text-slate-400">Hoy no tenés clases asignadas.</p>
      </div>
    `;

    if (proximasMaterias.length > 0) {
      proximasMaterias.sort((a, b) => a.diff - b.diff);
      const nextDiff = proximasMaterias[0].diff;
      const nextClasses = proximasMaterias.filter(m => m.diff === nextDiff);
      // sort those by time
      nextClasses.sort((a, b) => (a.info.horaInicio || '').localeCompare(b.info.horaInicio || ''));
      
      const dayName = DIAS_NOMBRES[nextClasses[0].info.dia];
      html += `<h3 class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Próximas clases (${dayName})</h3>`;
      html += nextClasses.map(m => btnTemplate(m.materia, m.info, false)).join('');
    }
    
    container.innerHTML = html;
  }
}

export async function enterContextAndGoTo(tenant, tabId) {
  if (window.app.currentTenant !== tenant) {
    await switchContext(tenant);
  }
  switchTab(tabId);
}
