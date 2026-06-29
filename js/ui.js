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

  document.querySelectorAll('.select-curso-global').forEach(select => {
    select.innerHTML = `<option value="">Seleccione división...</option>`;
    window.app.cursos.forEach(mat => {
      // RBAC: docentes solo ven sus materias asignadas
      if (esDocente && !materiasPermitidas.includes(mat)) return;
      
      // Filtrar Talleres en el módulo de evaluaciones
      if (select.id === 'evalCurso' && mat.toLowerCase().includes('taller')) {
        return;
      }
      
      const opt = document.createElement('option');
      opt.value = mat; opt.innerText = mat;
      select.appendChild(opt);
    });
  });

  // Opción "Todos" solo en el selector de Matrícula (siempre visible para ADMIN)
  const mCursoSel = document.getElementById('mCurso');
  if (mCursoSel && !esDocente) {
    const optTodos = document.createElement('option');
    optTodos.value = '__TODOS__';
    optTodos.innerText = '📋 TODOS LOS ESTUDIANTES';
    optTodos.style.fontWeight = 'bold';
    mCursoSel.insertBefore(optTodos, mCursoSel.children[1]);
  }
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
