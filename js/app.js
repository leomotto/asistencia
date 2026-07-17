// js/app.js — Entry point: ensambla el namespace window.app y arranca la aplicación

import { showToast, mostrarSkeletonTable, mostrarSkeletonCards, showConfirm, switchTab, toggleDarkMode, popularCursos, popularPeriodos, initTheme, toggleMenuMobile, toggleSidebar, initSidebar, cargarVersion, renderAgenda, buildContextSwitcher, switchContext, enterContextAndGoTo } from "./ui.js?v=10.61";
import { setupAuthListener, iniciarSesionGoogle, cerrarSesion, entrarModoDesarrollo, showDevButton, initAuth, setAppTenant, actualizarBadgePendientes } from "./auth.js?v=10.61";
import { cargarOnboardingEscuelas, onboardingEscuelaCambiada, solicitarUnirseEscuela } from "./onboarding.js?v=10.61";
import { HORARIOS_DINAMICOS, cargarMateriasDinamicas, cargarListaMateriasAdmin, abrirModalMateria, cerrarModalMateria, agregarDiaMateria, guardarMateria, eliminarMateria, abrirModalGenerador, cerrarModalGenerador, ejecutarGenerador } from "./materias.js?v=10.61";
import { 
  cargarAlumnosMatricula, ordenarMatricula, abrirModalAlumnoConId, _cambiarDivisionPrimaria, _sincronizarGlobales, _marcarBajaDivision,
  _toggleMateriasIndividuales, eliminarAlumno, toggleInscripcionDetails, abrirModalAlumno, 
  cerrarModalAlumno, guardarAlumnoMatricula, exportarBackup, abrirModalFusion, cerrarModalFusion, 
  buscarParaFusion, seleccionarParaFusion, ejecutarFusion, abrirModalNormalizacion, 
  cerrarModalNormalizacion, toggleNormalizacionItem, ejecutarNormalizacionSeleccionada, 
  abrirPerfilAlumno, cerrarPerfilAlumno, emitirPase, cerrarModalPase, confirmarEmitirPase
} from "./estudiantes.js?v=10.61";
import { cargarListaUsuarios, guardarAsignacionDocente, eliminarDocente, agregarMateriaChip } from "./usuarios.js?v=10.61";
import { verificarDiaSemana, actualizarHorariosYFechasRapidas, cargarAlumnos, llenarPresentes, guardarAsistencia, cambiarPeriodoGrilla, cambiarTipoColumna, cargarPlanillaGrilla, registrarCambioGrilla, guardarCambiosMasivosGrilla, abrirModalNuevaColumna, cerrarModalNuevaColumna, crearColumnaPlanilla, seleccionarPeriodo, cargarPanelBI, exportarGrillaCSV, exportarBICSV, invalidarCacheBI, setBiView } from "./asistencias.js?v=10.61";
import { registrarCambioEvaluacion, cargarPlanillaEvaluaciones, guardarCambiosEvaluaciones, toggleBloqueoCurso, guardarConfiguracionHabilitacion, cargarConfiguracionHabilitacion, agregarColumnaAdicional, eliminarColumnaAdicional, moverColumnaAdicional, guardarEstructuraColumnas, registrarCambioAdicionalEvaluacion, abrirModalConfigEval } from "./evaluaciones.js?v=10.61";
import { iniciarAuditoriaDatos, simularMigracionAuditoria, ejecutarMigracionAuditoria, analizarIntegridadEstudiantes, ejecutarMigracionIntegridad, analizarEstructuraRelacional, ejecutarMigracionEstructura, restaurarBackup, ejecutarRestauracionParcial, auditarAsistencias, compararMatricula, importarFaltantes, confirmarParciales, inyectarManual, actualizarCoincidentes, detectarDuplicadosEstudiantes, analizarDatosRoot, previsualizarReconciliacion, aplicarReconciliacion, backupTotalBaseDatos, prepararLimpiezaRoot, analizarLimpiezaRoot, ejecutarLimpiezaRoot, setAuditTenant, poblarSelectorAuditoria } from "./auditoria.js?v=10.61";
import { cargarListaEscuelas, abrirModalEscuela, cerrarModalEscuela, guardarEscuela, eliminarEscuela, abrirModalUnirseEscuela, solicitarUnirseOtraEscuela, cargarMateriasParaEscuela } from "./escuelas.js?v=10.61";

// ==========================================
// NAMESPACE GLOBAL — Estado compartido
// ==========================================
window.app = {
  currentUser:             null,
  currentTenant:           null,
  cursos:                  [],
  alumnosActivos:          [],
  alumnosMatriculaCache:   [],
  cambiosPendientesGrilla: {},

  tienePermiso: function(curso) {
    if (!this.currentUser) return false;
    if (this.currentUser.rolActivo === 'ADMIN' || this.currentUser.rolActivo === 'SUPERADMIN') return true;
    if (this.currentUser.rolActivo === 'DOCENTE' && this.currentUser.materiasActivas?.includes(curso)) return true;
    return false;
  }
};

// ==========================================
// WIRING — exponer módulos en window.app
// ==========================================

// auth.js
window.app.iniciarSesionGoogle  = iniciarSesionGoogle;
window.app.cerrarSesion         = cerrarSesion;
window.app.entrarModoDesarrollo = entrarModoDesarrollo;
window.app.solicitarUnirseEscuela = solicitarUnirseEscuela;
window.app.cargarOnboardingEscuelas = cargarOnboardingEscuelas;
window.app.onboardingEscuelaCambiada = onboardingEscuelaCambiada;
window.app.setAppTenant = setAppTenant;
window.app.actualizarBadgePendientes = actualizarBadgePendientes;


// ui.js
window.app.showToast          = showToast;
window.app.showConfirm        = showConfirm;
window.app.mostrarSkeletonTable = mostrarSkeletonTable;
window.app.mostrarSkeletonCards = mostrarSkeletonCards;
window.app.toggleDarkMode   = toggleDarkMode;
window.app.popularCursos    = popularCursos;
window.app.toggleMenuMobile = toggleMenuMobile;
window.app.toggleSidebar    = toggleSidebar;
window.app.initSidebar      = initSidebar;
window.app.cargarVersion    = cargarVersion;
window.app.switchTab        = switchTab;
window.app.renderAgenda     = renderAgenda;
window.app.buildContextSwitcher = buildContextSwitcher;
window.app.switchContext    = switchContext;
window.app.enterContextAndGoTo = enterContextAndGoTo;

// materias.js
window.app.HORARIOS_DINAMICOS       = HORARIOS_DINAMICOS;
window.app.cargarMateriasDinamicas  = cargarMateriasDinamicas;
window.app.cargarListaMateriasAdmin = cargarListaMateriasAdmin;
window.app.abrirModalMateria        = abrirModalMateria;
window.app.cerrarModalMateria       = cerrarModalMateria;
window.app.agregarDiaMateria        = agregarDiaMateria;
window.app.guardarMateria           = guardarMateria;
window.app.eliminarMateria          = eliminarMateria;

window.app.abrirModalGenerador      = abrirModalGenerador;
window.app.cerrarModalGenerador     = cerrarModalGenerador;
window.app.ejecutarGenerador        = ejecutarGenerador;

// usuarios.js
window.app.cargarListaUsuarios      = cargarListaUsuarios;
window.app.guardarAsignacionDocente = guardarAsignacionDocente;
window.app.eliminarDocente          = eliminarDocente;
window.app.agregarMateriaChip       = agregarMateriaChip;

// estudiantes.js
window.app.cargarAlumnosMatricula    = cargarAlumnosMatricula;
window.app.ordenarMatricula          = ordenarMatricula;
window.app.abrirModalAlumnoConId     = abrirModalAlumnoConId;
window.app._cambiarDivisionPrimaria = _cambiarDivisionPrimaria;
window.app._marcarBajaDivision      = _marcarBajaDivision;
window.app._sincronizarGlobales     = _sincronizarGlobales;
window.app._toggleMateriasIndividuales = _toggleMateriasIndividuales;
window.app.eliminarAlumno           = eliminarAlumno;
window.app._toggleInscripcionDetails = toggleInscripcionDetails;
window.app.abrirModalAlumno          = abrirModalAlumno;
window.app.cerrarModalAlumno         = cerrarModalAlumno;
window.app.guardarAlumnoMatricula    = guardarAlumnoMatricula;
window.app.exportarBackup            = exportarBackup;
window.app.abrirModalFusion          = abrirModalFusion;
window.app.cerrarModalFusion         = cerrarModalFusion;
window.app.buscarParaFusion          = buscarParaFusion;
window.app.seleccionarParaFusion     = seleccionarParaFusion;
window.app.ejecutarFusion            = ejecutarFusion;
window.app.abrirModalNormalizacion   = abrirModalNormalizacion;
window.app.cerrarModalNormalizacion  = cerrarModalNormalizacion;
window.app.toggleNormalizacionItem   = toggleNormalizacionItem;
window.app.ejecutarNormalizacionSeleccionada = ejecutarNormalizacionSeleccionada;
window.app.abrirPerfilAlumno         = abrirPerfilAlumno;
window.app.cerrarPerfilAlumno        = cerrarPerfilAlumno;
window.app.emitirPase                = emitirPase;
window.app.cerrarModalPase           = cerrarModalPase;
window.app.confirmarEmitirPase       = confirmarEmitirPase;

// asistencias.js
window.app.verificarDiaSemana              = verificarDiaSemana;
window.app.actualizarHorariosYFechasRapidas= actualizarHorariosYFechasRapidas;
window.app.cargarAlumnos                   = cargarAlumnos;
window.app.llenarPresentes                 = llenarPresentes;
window.app.guardarAsistencia               = guardarAsistencia;
window.app.cambiarPeriodoGrilla            = cambiarPeriodoGrilla;
window.app.cambiarTipoColumna              = cambiarTipoColumna;
window.app.cargarPlanillaGrilla            = cargarPlanillaGrilla;
window.app.registrarCambioGrilla           = registrarCambioGrilla;
window.app.guardarCambiosMasivosGrilla     = guardarCambiosMasivosGrilla;
window.app.abrirModalNuevaColumna          = abrirModalNuevaColumna;
window.app.cerrarModalNuevaColumna         = cerrarModalNuevaColumna;
window.app.crearColumnaPlanilla            = crearColumnaPlanilla;
window.app.seleccionarPeriodo              = seleccionarPeriodo;
window.app.cargarPanelBI                   = cargarPanelBI;
window.app.exportarGrillaCSV               = exportarGrillaCSV;
window.app.exportarBICSV                   = exportarBICSV;
window.app.invalidarCacheBI                = invalidarCacheBI;
window.app.setBiView                       = setBiView;

// evaluaciones.js
window.app.registrarCambioEvaluacion       = registrarCambioEvaluacion;
window.app.cargarPlanillaEvaluaciones      = cargarPlanillaEvaluaciones;
window.app.guardarCambiosEvaluaciones      = guardarCambiosEvaluaciones;
window.app.toggleBloqueoCurso              = toggleBloqueoCurso;
window.app.guardarConfiguracionHabilitacion = guardarConfiguracionHabilitacion;
window.app.cargarConfiguracionHabilitacion = cargarConfiguracionHabilitacion;
window.app.agregarColumnaAdicional         = agregarColumnaAdicional;
window.app.eliminarColumnaAdicional        = eliminarColumnaAdicional;
window.app.moverColumnaAdicional           = moverColumnaAdicional;
window.app.guardarEstructuraColumnas       = guardarEstructuraColumnas;
window.app.registrarCambioAdicionalEvaluacion = registrarCambioAdicionalEvaluacion;
window.app.abrirModalConfigEval            = abrirModalConfigEval;
window.app.iniciarAuditoriaDatos           = iniciarAuditoriaDatos;
window.app.simularMigracionAuditoria       = simularMigracionAuditoria;
window.app.ejecutarMigracionAuditoria      = ejecutarMigracionAuditoria;
window.app.analizarIntegridadEstudiantes   = analizarIntegridadEstudiantes;
window.app.ejecutarMigracionIntegridad     = ejecutarMigracionIntegridad;
window.app.analizarEstructuraRelacional    = analizarEstructuraRelacional;
window.app.ejecutarMigracionEstructura     = ejecutarMigracionEstructura;
window.app.restaurarBackup                 = restaurarBackup;
window.app.ejecutarRestauracionParcial     = ejecutarRestauracionParcial;
window.app.auditarAsistencias              = auditarAsistencias;
window.app.compararMatricula               = compararMatricula;
window.app.importarFaltantes               = importarFaltantes;
window.app.confirmarParciales              = confirmarParciales;
window.app.inyectarManual                  = inyectarManual;
window.app.actualizarCoincidentes          = actualizarCoincidentes;
window.app.detectarDuplicadosEstudiantes   = detectarDuplicadosEstudiantes;
window.app.analizarDatosRoot               = analizarDatosRoot;
window.app.previsualizarReconciliacion     = previsualizarReconciliacion;
window.app.aplicarReconciliacion           = aplicarReconciliacion;
window.app.backupTotalBaseDatos            = backupTotalBaseDatos;
window.app.setAuditTenant                  = setAuditTenant;
window.app.poblarSelectorAuditoria         = poblarSelectorAuditoria;
window.app.prepararLimpiezaRoot            = prepararLimpiezaRoot;
window.app.analizarLimpiezaRoot            = analizarLimpiezaRoot;
window.app.ejecutarLimpiezaRoot            = ejecutarLimpiezaRoot;

// escuelas.js
window.app.cargarListaEscuelas = cargarListaEscuelas;
window.app.abrirModalEscuela = abrirModalEscuela;
window.app.cerrarModalEscuela = cerrarModalEscuela;
window.app.guardarEscuela = guardarEscuela;
window.app.eliminarEscuela = eliminarEscuela;
window.app.abrirModalUnirseEscuela = abrirModalUnirseEscuela;
window.app.solicitarUnirseOtraEscuela = solicitarUnirseOtraEscuela;
window.app.cargarMateriasParaEscuela = cargarMateriasParaEscuela;

// ==========================================
// ESCUCHAS DOM
// ==========================================
document.getElementById('tomaCurso')?.addEventListener('change', () => {
  actualizarHorariosYFechasRapidas();
  verificarDiaSemana();
  cargarAlumnos();
});
document.getElementById('tomaFecha')?.addEventListener('change', () => {
  verificarDiaSemana();
  cargarAlumnos();
});
document.getElementById('evalCurso')?.addEventListener('change', () => {
  cargarPlanillaEvaluaciones();
});
document.getElementById('evalPeriodo')?.addEventListener('change', () => {
  cargarPlanillaEvaluaciones();
});

// Alias global requerido por atributos onclick="switchTab(...)" en el HTML
window.switchTab = switchTab;

// ==========================================
// ARRANQUE
// ==========================================
try {
  initTheme();
  initSidebar();
  popularPeriodos();
  cargarVersion();
  setupAuthListener();
  initAuth();
  showDevButton();
} catch (bootError) {
  console.error('[SIDEAC] Error fatal en el arranque de la aplicación:', bootError);
  // Mostrar login en lugar del loader para que el usuario no quede bloqueado
  document.getElementById('loadingScreen')?.classList.add('hidden');
  document.getElementById('loginScreen')?.classList.remove('hidden');
}
