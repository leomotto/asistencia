// js/app.js — Entry point: ensambla el namespace window.app y arranca la aplicación

import { switchTab, toggleDarkMode, popularCursos, popularPeriodos, initTheme, toggleMenuMobile, toggleSidebar, initSidebar, cargarVersion } from "./ui.js?v=9.41";
import { setupAuthListener, iniciarSesionGoogle, cerrarSesion, entrarModoDesarrollo, showDevButton, initAuth } from "./auth.js?v=9.41";
import { cargarMateriasDinamicas, cargarListaMateriasAdmin, abrirModalMateria, cerrarModalMateria, agregarDiaMateria, guardarMateria, eliminarMateria, migrarMateriasHistoricas, abrirModalGenerador, cerrarModalGenerador, ejecutarGenerador } from "./materias.js?v=9.41";
import { cargarAlumnosMatricula, abrirModalAlumnoConId, _cambiarDivisionPrimaria, _sincronizarGlobales, _toggleMateriasIndividuales, eliminarAlumno, toggleInscripcionDetails, abrirModalAlumno, cerrarModalAlumno, guardarAlumnoMatricula, exportarBackup, abrirModalFusion, cerrarModalFusion, buscarParaFusion, seleccionarParaFusion, ejecutarFusion, abrirModalNormalizacion, cerrarModalNormalizacion, toggleNormalizacionItem, ejecutarNormalizacionSeleccionada, abrirPerfilAlumno, cerrarPerfilAlumno, toggleDivisionMaestra } from "./estudiantes.js?v=9.41";
import { cargarListaUsuarios, guardarAsignacionDocente } from "./usuarios.js?v=9.41";
import { verificarDiaSemana, actualizarHorariosYFechasRapidas, cargarAlumnos, llenarPresentes, guardarAsistencia, cambiarPeriodoGrilla, cambiarTipoColumna, cargarPlanillaGrilla, registrarCambioGrilla, guardarCambiosMasivosGrilla, abrirModalNuevaColumna, cerrarModalNuevaColumna, crearColumnaPlanilla, seleccionarPeriodo, cargarPanelBI, exportarGrillaCSV, exportarBICSV, invalidarCacheBI, setBiView } from "./asistencias.js?v=9.41";
import { registrarCambioEvaluacion, cargarPlanillaEvaluaciones, guardarCambiosEvaluaciones, toggleBloqueoCurso, guardarConfiguracionHabilitacion, cargarConfiguracionHabilitacion, agregarColumnaAdicional, eliminarColumnaAdicional, moverColumnaAdicional, guardarEstructuraColumnas, registrarCambioAdicionalEvaluacion } from "./evaluaciones.js?v=9.41";

// ==========================================
// NAMESPACE GLOBAL — Estado compartido
// ==========================================
window.app = {
  currentUser:             null,
  cursos:                  [],
  alumnosActivos:          [],
  alumnosMatriculaCache:   [],
  cambiosPendientesGrilla: {},

  tienePermiso: function(curso) {
    if (!this.currentUser) return false;
    if (this.currentUser.rol === 'ADMIN') return true;
    if (this.currentUser.rol === 'DOCENTE' && this.currentUser.materias?.includes(curso)) return true;
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

// ui.js
window.app.toggleDarkMode   = toggleDarkMode;
window.app.popularCursos    = popularCursos;
window.app.toggleMenuMobile = toggleMenuMobile;
window.app.toggleSidebar    = toggleSidebar;

// materias.js
window.app.cargarMateriasDinamicas  = cargarMateriasDinamicas;
window.app.cargarListaMateriasAdmin = cargarListaMateriasAdmin;
window.app.abrirModalMateria        = abrirModalMateria;
window.app.cerrarModalMateria       = cerrarModalMateria;
window.app.agregarDiaMateria        = agregarDiaMateria;
window.app.guardarMateria           = guardarMateria;
window.app.eliminarMateria          = eliminarMateria;
window.app.migrarMateriasHistoricas = migrarMateriasHistoricas;
window.app.abrirModalGenerador      = abrirModalGenerador;
window.app.cerrarModalGenerador     = cerrarModalGenerador;
window.app.ejecutarGenerador        = ejecutarGenerador;

// usuarios.js
window.app.cargarListaUsuarios      = cargarListaUsuarios;
window.app.guardarAsignacionDocente = guardarAsignacionDocente;

// estudiantes.js
window.app.cargarAlumnosMatricula    = cargarAlumnosMatricula;
window.app.abrirModalAlumnoConId     = abrirModalAlumnoConId;
window.app._cambiarDivisionPrimaria = _cambiarDivisionPrimaria;
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
window.app._toggleDivisionMaestra    = toggleDivisionMaestra;

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

// ==========================================
// ESCUCHAS DOM
// ==========================================
document.getElementById('tomaCurso')?.addEventListener('change', () => {
  actualizarHorariosYFechasRapidas();
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
