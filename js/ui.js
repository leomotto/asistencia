// js/ui.js — Toast, navegación de tabs, dark mode, dropdowns de cursos

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
  if (window.app.currentUser?.rol === 'PENDIENTE') {
    showToast('⚠️ Tu cuenta está pendiente de autorización por un Administrador.', 'error');
    return;
  }

  const performSwitch = () => {
    ['tomaDiaria', 'planillaGrilla', 'evaluaciones', 'panelBI', 'gestionAlumnos', 'gestionMaterias', 'gestionDocentes'].forEach(id => {
      document.getElementById(id)?.classList.add('hidden');
    });
    const targetSection = document.getElementById(tabId);
    targetSection?.classList.remove('hidden');
    targetSection?.scrollTo({ top: 0, behavior: 'instant' });

    ['btnToma', 'btnGrilla', 'btnEval', 'btnPanel', 'btnGestion', 'btnMaterias', 'btnDocentes'].forEach(id => {
      document.getElementById(id)?.classList.remove('bg-white/10');
    });
    const btnMap = {
      tomaDiaria:      'btnToma',
      planillaGrilla:  'btnGrilla',
      evaluaciones:    'btnEval',
      panelBI:         'btnPanel',
      gestionAlumnos:  'btnGestion',
      gestionMaterias: 'btnMaterias',
      gestionDocentes: 'btnDocentes'
    };
    if (btnMap[tabId]) document.getElementById(btnMap[tabId])?.classList.add('bg-white/10');
  };

  // View Transitions API para transiciones suaves entre pestañas (Chrome 111+)
  if (document.startViewTransition) {
    document.startViewTransition(() => performSwitch());
  } else {
    performSwitch();
  }

  if (tabId === 'planillaGrilla')  window.app.cargarPlanillaGrilla();
  if (tabId === 'evaluaciones')    window.app.cargarPlanillaEvaluaciones();
  if (tabId === 'gestionAlumnos')  window.app.cargarAlumnosMatricula();
  if (tabId === 'gestionMaterias') window.app.cargarListaMateriasAdmin();
  if (tabId === 'gestionDocentes') window.app.cargarListaUsuarios();

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

export function popularCursos() {
  const esDocente          = window.app.currentUser?.rol === 'DOCENTE';
  const materiasPermitidas = window.app.currentUser?.materias || [];

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

    // 1. Ocultar el original y llenarlo (por si otro script lee sus options)
    originalSelect.innerHTML = `<option value="">Seleccione...</option>`;
    if (originalSelect.id === 'mCurso' && !esDocente) {
      originalSelect.innerHTML += `<option value="__TODOS__">📋 TODOS LOS ESTUDIANTES</option>`;
    }
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
      selDiv.className = 'flex-1 min-w-0 p-2 text-sm border dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 outline-none font-medium select-div cursor-pointer focus:ring-2 focus:ring-indigo-500 transition-shadow';
      
      const selAsig = document.createElement('select');
      selAsig.className = 'flex-1 min-w-0 p-2 text-sm border dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 outline-none font-medium select-asig cursor-pointer focus:ring-2 focus:ring-indigo-500 transition-shadow disabled:opacity-50';
      selAsig.disabled = true;

      dualContainer.appendChild(selDiv);
      dualContainer.appendChild(selAsig);
      
      originalSelect.parentNode.insertBefore(dualContainer, originalSelect.nextSibling);

      // Lógica de dependencia
      selDiv.addEventListener('change', () => {
        const div = selDiv.value;
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
    const { hash, date } = await r.json();
    el.textContent = `${hash} · ${date}`;
  } catch {
    el.textContent = 'dev';
  }
}
