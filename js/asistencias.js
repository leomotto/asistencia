// js/asistencias.js — Toma diaria, planilla grilla, panel BI y creación de columnas

import { doc, setDoc, getDoc, collection, getDocs, query, where, orderBy, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db, getPath } from "./firebase-config.js?v=9.10";
import { showToast } from "./ui.js?v=9.10";
import { PERIODOS_CALENDARIO } from "./constants.js?v=9.10";
import { HORARIOS_DINAMICOS } from "./materias.js?v=9.10";
import { normalizeDateToISO, formatISOToDisplay, escaparHTML } from "./utils.js?v=9.10";

// ==========================================
// TOMA DIARIA — VALIDACIÓN DE HORARIO
// ==========================================

export function verificarDiaSemana() {
  const curso  = document.getElementById('tomaCurso').value;
  const fecha  = document.getElementById('tomaFecha').value;
  const alerta = document.getElementById('alertaDiaSemana');
  if (!curso || !fecha) { alerta.classList.add('hidden'); return; }
  const horario = HORARIOS_DINAMICOS[curso];
  if (!horario) return;
  const [anio, mes, dia] = fecha.split('-');
  const diaSemana = new Date(anio, mes - 1, dia).getDay();
  // Compatible con formato nuevo {dia, horaInicio, horaFin} y viejo (número)
  const tieneElDia = horario.dias.some(d => (typeof d === 'number' ? d : d.dia) === diaSemana);
  if (!tieneElDia) alerta.classList.remove('hidden');
  else             alerta.classList.add('hidden');
}

export function actualizarHorariosYFechasRapidas() {
  const curso      = document.getElementById('tomaCurso').value;
  const badge      = document.getElementById('badgeHorario');
  const container  = document.getElementById('quickDatesContainer');
  const buttonsDiv = document.getElementById('quickDatesButtons');

  if (!curso) { badge.classList.add('hidden'); container.classList.add('hidden'); return; }

  const horario = HORARIOS_DINAMICOS[curso];
  if (horario && horario.dias && horario.dias.length > 0) {
    // Badge enriquecido: muestra el horario del día actual si existe, o el primero de la lista
    const hoy    = new Date().getDay();
    const diaHoy = horario.dias.find(d => (typeof d === 'number' ? d : d.dia) === hoy);
    const diaRef = diaHoy || horario.dias[0];
    const NOMBRES_CORTOS = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
    if (diaRef && typeof diaRef === 'object' && (diaRef.horaInicio || diaRef.horaFin)) {
      const partes = [`Cursa: ${NOMBRES_CORTOS[diaRef.dia]}`];
      if (diaRef.horaInicio) partes.push(diaRef.horaFin ? `${diaRef.horaInicio}–${diaRef.horaFin}` : diaRef.horaInicio);
      badge.innerText = partes.join(' ');
    } else {
      badge.innerText = `Cursa: ${horario.nombre || 'Días config.'}`;
    }
    badge.classList.remove('hidden');

    const fechasCalculadas = [];
    let aux = new Date(), intentos = 0;
    while (fechasCalculadas.length < 3 && intentos < 60) {
      if (horario.dias.some(d => (typeof d === 'number' ? d : d.dia) === aux.getDay())) fechasCalculadas.push(new Date(aux));
      aux.setDate(aux.getDate() - 1); intentos++;
    }
    buttonsDiv.innerHTML = '';
    fechasCalculadas.forEach(f => {
      const anio = f.getFullYear(), mes = String(f.getMonth() + 1).padStart(2,'0'), dia = String(f.getDate()).padStart(2,'0');
      const fechaStr = `${anio}-${mes}-${dia}`;
      const nombres  = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
      const btn = document.createElement('button');
      btn.type = "button";
      btn.className = "bg-white border border-emerald-300 text-emerald-800 font-bold px-3 py-1.5 rounded-lg text-xs hover:bg-emerald-600 hover:text-white transition shadow-sm";
      btn.innerText = `${nombres[f.getDay()]} ${dia}/${mes}`;
      btn.onclick = () => { document.getElementById('tomaFecha').value = fechaStr; verificarDiaSemana(); cargarAlumnos(); };
      buttonsDiv.appendChild(btn);
    });
    container.classList.remove('hidden');
  } else {
    badge.classList.add('hidden'); container.classList.add('hidden');
  }
}

// ==========================================
// TOMA DIARIA — ALUMNOS Y ASISTENCIA
// ==========================================

export async function cargarAlumnos() {
  const curso             = document.getElementById('tomaCurso').value;
  const fechaSeleccionada = document.getElementById('tomaFecha').value;
  const contenedor        = document.getElementById('listaTomaDiaria');

  // Persistir último curso usado para restaurarlo al volver
  if (curso) localStorage.setItem('lastCurso', curso);
  // Resetear badge "ya guardada" al cambiar curso o fecha
  document.getElementById('badgeGuardada')?.classList.add('hidden');

  if (!curso || !fechaSeleccionada) {
    contenedor.innerHTML = '<p class="text-sm text-slate-400 text-center py-8">Complete curso y fecha para listar alumnos activos.</p>';
    window.app.alumnosActivos = [];
    return;
  }
  contenedor.innerHTML = '<p class="text-sm text-blue-500 text-center py-8 animate-pulse">Sincronizando alumnos desde la DB...</p>';

  try {
    const snap = await getDocs(collection(db, getPath("estudiantes")));
    let todos = [];
    snap.forEach(d => todos.push({ id: d.id, ...d.data() }));

    window.app.alumnosActivos = todos.filter(a => {
      const pertenece = a.curso === curso || (a.materias && a.materias.includes(curso));
      if (!pertenece) return false;
      let insc = (a.inscripciones && a.inscripciones[curso] && a.inscripciones[curso].length > 0)
        ? a.inscripciones[curso][a.inscripciones[curso].length - 1]
        : { estado: a.estado || 'ACTIVO', desde: a.fechaIngreso || '', hasta: a.fechaBaja || '' };
      if (insc.estado.toLowerCase() !== 'activo') return false;
      const fIngreso = normalizeDateToISO(insc.desde);
      const fBaja    = normalizeDateToISO(insc.hasta);
      if (fIngreso && fechaSeleccionada < fIngreso) return false;
      if (fBaja    && fechaSeleccionada > fBaja)    return false;
      return true;
    }).sort((a, b) => a.apellido.localeCompare(b.apellido));

    if (window.app.alumnosActivos.length === 0) {
      contenedor.innerHTML = '<p class="text-sm text-amber-600 text-center py-8">No hay alumnos activos para este curso en la fecha seleccionada.</p>';
      return;
    }

    contenedor.innerHTML = '';
    window.app.alumnosActivos.forEach((est, index) => {
      const apodo      = est.apodo ? ` (${escaparHTML(est.apodo)})` : "";
      const notasTxt   = est.notes || est.notas;
      const notas      = notasTxt ? `<p class="text-xs text-amber-600 bg-amber-50 p-1.5 rounded mt-1 border dark:border-slate-700 border-amber-200">📌 ${escaparHTML(notasTxt)}</p>` : "";
      const grupoCurso = (est.grupos && est.grupos[curso]) || est.grupo || 'GENERAL';
      const grupoTag   = grupoCurso !== 'GENERAL'
        ? `<span class="text-[10px] bg-amber-100 text-amber-700 border dark:border-slate-700 border-amber-200 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">${escaparHTML(grupoCurso)}</span>`
        : '';

      const fila = document.createElement('div');
      fila.className = `flex flex-col sm:flex-row p-3 border-b ${index % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50 dark:bg-slate-800/50'}`;
      fila.innerHTML = `
        <div class="flex-1 mb-2 sm:mb-0">
          <p class="font-bold text-sm"><span class="cursor-pointer hover:underline text-indigo-600 dark:text-indigo-400 font-bold perfil-link" data-id="${escaparHTML(est.id)}" data-curso="${escaparHTML(curso)}">${escaparHTML(est.apellido)}, ${escaparHTML(est.nombre)}</span><span class="text-blue-600 font-medium">${apodo}</span>${est.dni ? `<span class="ml-2 text-[10px] font-mono text-slate-400">${escaparHTML(est.dni)}</span>` : ''}</p>
          <div class="flex flex-wrap gap-1.5 items-center mt-0.5">${grupoTag}<span class="text-[10px] text-slate-400">Ingreso: ${formatISOToDisplay(est.fechaIngreso)}</span></div>
          ${notas}
        </div>
        <div class="w-full sm:w-32 text-left sm:text-right flex sm:block justify-end">
          <select id="asist_${est.id}" class="w-24 p-2 border dark:border-slate-700 border-slate-200 dark:border-slate-700 rounded-lg font-bold text-center focus:ring-2 focus:ring-slate-500 outline-none bg-white dark:bg-slate-800">
            <option value="">-</option>
            <option value="P" class="text-emerald-600">P</option>
            <option value="A" class="text-red-600">A</option>
            <option value="ACP" class="text-amber-500">ACP</option>
          </select>
        </div>
      `;
      const perfilLink = fila.querySelector('.perfil-link');
      if (perfilLink) perfilLink.addEventListener('click', () => app.abrirPerfilAlumno(perfilLink.dataset.id, perfilLink.dataset.curso));
      contenedor.appendChild(fila);

      // A11y: navegación por teclado en el select de asistencia
      const sel = fila.querySelector(`#asist_${est.id}`);
      sel.addEventListener('keydown', (e) => {
        const lista   = window.app.alumnosActivos;
        const selects = lista.map(a => document.getElementById(`asist_${a.id}`)).filter(Boolean);
        const pos     = selects.indexOf(sel);

        if (e.key === 'ArrowDown' && pos < selects.length - 1) {
          e.preventDefault();
          selects[pos + 1].focus();
        } else if (e.key === 'ArrowUp' && pos > 0) {
          e.preventDefault();
          selects[pos - 1].focus();
        } else if (e.key === 'p' || e.key === 'P') {
          e.preventDefault();
          sel.value = 'P';
          sel.dispatchEvent(new Event('change'));
        } else if (e.key === 'a' || e.key === 'A') {
          e.preventDefault();
          sel.value = 'A';
          sel.dispatchEvent(new Event('change'));
        } else if (e.key === 'j' || e.key === 'J') {
          e.preventDefault();
          sel.value = 'ACP';
          sel.dispatchEvent(new Event('change'));
        } else if (e.key === '-' || e.key === 'Backspace') {
          e.preventDefault();
          sel.value = '';
          sel.dispatchEvent(new Event('change'));
        }
      });
    });

    await traerAsistencia(true);
  } catch (error) {
    console.error(error);
    showToast('Error de conexión a Firestore.', 'error');
  }
}

export function llenarPresentes() {
  if (window.app.alumnosActivos.length === 0) return;
  let cont = 0;
  window.app.alumnosActivos.forEach(est => {
    const sel = document.getElementById(`asist_${est.id}`);
    if (sel && sel.value === "") { sel.value = "P"; cont++; }
  });
  showToast(`Se cargaron ${cont} presentes.`);
}

export async function guardarAsistencia() {
  const curso     = document.getElementById('tomaCurso').value;
  const fecha     = document.getElementById('tomaFecha').value;
  const tipoClase = document.getElementById('tomaTipo').value;

  if (!curso || !fecha) { showToast('⚠️ Complete Curso y Fecha antes de guardar.', 'error'); return; }
  if (!window.app.tienePermiso(curso)) { showToast('⛔ No tenés permisos para modificar la asistencia de esta materia.', 'error'); return; }

  const registros = {};
  window.app.alumnosActivos.forEach(est => {
    registros[est.id] = document.getElementById(`asist_${est.id}`).value || "-";
  });

  const docId = `${curso.replace(/\s+/g, '')}_${fecha}`;
  const btn   = document.getElementById('btnGuardarAsistencia');
  const icon  = document.getElementById('iconGuardarAsistencia');
  const text  = document.getElementById('textGuardarAsistencia');
  btn.disabled = true; icon.className = "ph ph-spinner animate-spin text-xl"; text.innerText = "GUARDANDO...";

  try {
    await setDoc(doc(db, getPath("asistencias"), docId), {
      curso, fecha, tipoClase, registros, timestamp: new Date().toISOString()
    });
    invalidarCacheBI();
    document.getElementById('badgeGuardada')?.classList.remove('hidden');
    showToast(`✅ Asistencia de ${curso} guardada con éxito.`);
  } catch (error) {
    console.error(error);
    showToast('❌ Error al guardar asistencia.', 'error');
  } finally {
    btn.disabled = false; icon.className = "ph ph-floppy-disk text-xl"; text.innerText = "GUARDAR ASISTENCIA EN BASE DE DATOS";
  }
}

export async function traerAsistencia(silent = false) {
  const curso = document.getElementById('tomaCurso').value;
  const fecha = document.getElementById('tomaFecha').value;
  if (!curso || !fecha) { if (!silent) showToast('⚠️ Complete Curso y Fecha para buscar.', 'error'); return; }

  const docId = `${curso.replace(/\s+/g, '')}_${fecha}`;
  try {
    const docSnap = await getDoc(doc(db, getPath("asistencias"), docId));
    const badgeGuardada = document.getElementById('badgeGuardada');
    if (docSnap.exists()) {
      const data = docSnap.data();
      document.getElementById('tomaTipo').value = data.tipoClase || "CLASE";
      window.app.alumnosActivos.forEach(est => {
        const sel = document.getElementById(`asist_${est.id}`);
        if (sel && data.registros && data.registros[est.id]) {
          sel.value = data.registros[est.id] === "-" ? "" : data.registros[est.id];
        }
      });
      badgeGuardada?.classList.remove('hidden');
      if (!silent) showToast('📥 Datos históricos importados.', 'info');
    } else {
      badgeGuardada?.classList.add('hidden');
      if (!silent) showToast('ℹ️ No existen registros previos para esta fecha.', 'info');
    }
  } catch (error) {
    console.error(error);
    if (!silent) showToast('❌ Error al buscar en la base de datos.', 'error');
  }
}

// ==========================================
// PLANILLA GRILLA
// ==========================================

export function cambiarPeriodoGrilla() { cargarPlanillaGrilla(); }

export async function cambiarTipoColumna(fecha, nuevoTipo) {
  const curso = document.getElementById('grillaCurso').value;
  if (!curso) return;
  try {
    const docId = `${curso.replace(/\s+/g, '')}_${fecha}`;
    await setDoc(doc(db, getPath("asistencias"), docId), { tipoClase: nuevoTipo }, { merge: true });
    showToast(`✅ ${fecha} → ${nuevoTipo}`);
    cargarPlanillaGrilla();
  } catch (e) { console.error(e); showToast('❌ Error al cambiar el tipo.', 'error'); }
}

export async function cargarPlanillaGrilla() {
  const curso      = document.getElementById('grillaCurso').value;
  const periodo    = document.getElementById('grillaPeriodo').value;
  const gridHeader = document.getElementById('grillaHeader');
  const gridBody   = document.getElementById('grillaBody');
  const saveFooter = document.getElementById('grillaFooterGuardado');

  if (!curso) {
    gridHeader.innerHTML = '<th class="px-4 py-3 text-left">Estudiante</th>';
    gridBody.innerHTML   = '<tr><td class="px-4 py-8 text-center text-slate-400 italic">Por favor seleccione una división.</td></tr>';
    saveFooter.classList.add('hidden'); return;
  }

  gridBody.innerHTML = '<tr><td class="px-4 py-8 text-center text-indigo-600 animate-pulse font-semibold">Cargando grilla interactiva...</td></tr>';
  saveFooter.classList.add('hidden');
  window.app.cambiosPendientesGrilla = {};

  try {
    const limites = PERIODOS_CALENDARIO[periodo];
    const fDesde  = limites ? limites.desde : "2026-03-02";
    const fHasta  = limites ? limites.hasta : "2026-12-03";

    const snapAlumnos = await getDocs(collection(db, getPath("estudiantes")));
    let alumnos = [];
    snapAlumnos.forEach(d => {
      const data = { id: d.id, ...d.data() };
      if (data.curso === curso || (data.materias && data.materias.includes(curso))) alumnos.push(data);
    });
    alumnos = alumnos.sort((a, b) => a.apellido.localeCompare(b.apellido));

    const snapAsistencias = await getDocs(query(
      collection(db, getPath("asistencias")),
      where("curso", "==", curso),
      where("fecha", ">=", fDesde),
      where("fecha", "<=", fHasta),
      orderBy("fecha", "asc")
    ));
    const asistencias = [];
    snapAsistencias.forEach(d => asistencias.push(d.data()));

    const tipoColors = { CLASE:'bg-slate-800', FERIADO:'bg-red-700', PARO:'bg-amber-600', JORNADA:'bg-blue-700', LICENCIA:'bg-purple-700', OTROS:'bg-gray-600' };
    let headerHTML = `<th class="px-4 py-3 sticky-header-col w-64 text-left shadow text-white">Estudiante</th>`;
    asistencias.forEach(asist => {
      const [, mes, dia] = asist.fecha.split('-');
      const tag          = mes && dia ? `${dia}/${mes}` : asist.fecha;
      const tipoActual   = asist.tipoClase || 'CLASE';
      const colBg        = tipoColors[tipoActual] || 'bg-slate-800';
      headerHTML += `
        <th class="px-2 py-1 text-center text-xs font-black border-l dark:border-slate-700 border-gray-600 min-w-[80px] ${colBg}">
          <div class="font-black">${tag}</div>
          <select onchange="app.cambiarTipoColumna('${asist.fecha}', this.value)"
            class="mt-0.5 w-full text-[10px] bg-white/20 dark:bg-slate-800/20 text-white border border-white/30 rounded px-1 py-0.5 outline-none cursor-pointer font-bold text-center"
            title="Cambiar tipo de esta columna">
            ${['CLASE','FERIADO','PARO','JORNADA','LICENCIA','OTROS'].map(t =>
              `<option value="${t}" ${tipoActual===t?'selected':''} class="text-slate-900 dark:text-white bg-white dark:bg-slate-800">${t}</option>`
            ).join('')}
          </select>
        </th>`;
    });
    gridHeader.innerHTML = headerHTML;

    if (alumnos.length === 0) {
      gridBody.innerHTML = '<tr><td class="px-4 py-8 text-center text-red-500 font-medium">No se encontraron alumnos en esta división.</td></tr>';
      return;
    }

    // Persistir datos para exportarGrillaCSV sin re-consultar Firestore
    window.app._grillaData = { curso, periodo, alumnos, asistencias };

    gridBody.innerHTML = '';
    alumnos.forEach((al, index) => {
      const tr = document.createElement('tr');
      tr.className = `hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors ${index % 2 !== 0 ? 'bg-slate-50 dark:bg-slate-800/50' : 'bg-white dark:bg-transparent'}`;
      const stickyBg = index % 2 !== 0 ? 'bg-slate-50 dark:bg-slate-800' : 'bg-white dark:bg-slate-800';
      let estadoActual = "ACTIVO";
      if (al.inscripciones && al.inscripciones[curso] && al.inscripciones[curso].length > 0) {
        estadoActual = al.inscripciones[curso][al.inscripciones[curso].length - 1].estado || "ACTIVO";
      } else if (al.estado) {
        estadoActual = al.estado;
      }
      const apodoStr = al.apodo ? ` (${escaparHTML(al.apodo)})` : "";
      let htmlFila = `
        <td class="px-4 py-3 sticky-student-col ${stickyBg} text-xs border-r dark:border-slate-700 shadow">
          <span class="cursor-pointer hover:underline text-indigo-600 dark:text-indigo-400 font-bold perfil-link" data-id="${escaparHTML(al.id)}" data-curso="${escaparHTML(curso)}">${escaparHTML(al.apellido)}, ${escaparHTML(al.nombre)}</span><span class="text-blue-600 text-[11px] font-medium">${apodoStr}</span>
          ${estadoActual.toLowerCase() !== 'activo' ? `<span class="ml-1.5 text-[9px] bg-red-100 text-red-600 px-1 rounded font-bold uppercase">${escaparHTML(estadoActual)}</span>` : ''}
        </td>`;
      asistencias.forEach(asist => {
        const valor = (asist.registros && asist.registros[al.id]) ? asist.registros[al.id] : "-";
        let color = "text-slate-400";
        if (valor==="P") color="text-emerald-600 font-bold";
        if (valor==="A") color="text-red-600 font-bold";
        if (valor==="ACP") color="text-amber-500 font-bold";
        htmlFila += `
          <td class="px-1 py-1.5 border-l border-slate-200 dark:border-slate-700 text-center">
            <select onchange="app.registrarCambioGrilla('${asist.fecha}','${al.id}',this)" class="bg-transparent font-black text-center text-xs w-14 outline-none cursor-pointer focus:ring-0 focus:border-indigo-500 ${color}">
              <option value="-" ${valor==="-"?"selected":""}>-</option>
              <option value="P" ${valor==="P"?"selected":""}>P</option>
              <option value="A" ${valor==="A"?"selected":""}>A</option>
              <option value="ACP" ${valor==="ACP"?"selected":""}>ACP</option>
            </select>
          </td>`;
      });
      tr.innerHTML = htmlFila;
      const perfilLink = tr.querySelector('.perfil-link');
      if (perfilLink) perfilLink.addEventListener('click', () => app.abrirPerfilAlumno(perfilLink.dataset.id, perfilLink.dataset.curso));
      gridBody.appendChild(tr);
    });
  } catch (e) {
    console.error(e);
    gridBody.innerHTML = '<tr><td class="px-4 py-8 text-center text-red-500 font-medium">Error al generar grilla.</td></tr>';
  }
}

export function registrarCambioGrilla(fecha, alumnoId, selector) {
  if (!window.app.cambiosPendientesGrilla[fecha]) window.app.cambiosPendientesGrilla[fecha] = {};
  window.app.cambiosPendientesGrilla[fecha][alumnoId] = selector.value;
  selector.className = "bg-transparent font-black text-center text-xs w-14 outline-none cursor-pointer focus:ring-0 focus:border-indigo-500";
  if      (selector.value==="P")   selector.classList.add("text-emerald-600","font-bold");
  else if (selector.value==="A")   selector.classList.add("text-red-600","font-bold");
  else if (selector.value==="ACP") selector.classList.add("text-amber-500","font-bold");
  else                             selector.classList.add("text-slate-400");
  document.getElementById('grillaFooterGuardado').classList.remove('hidden');
}

export async function guardarCambiosMasivosGrilla() {
  const curso = document.getElementById('grillaCurso').value;
  if (!curso) return;
  if (!window.app.tienePermiso(curso)) { showToast('⛔ No tenés permisos para guardar cambios en esta materia.', 'error'); return; }

  showToast("Guardando cambios consolidados...", "info");
  const btn  = document.getElementById('btnGuardarGrilla');
  const icon = document.getElementById('iconGuardarGrilla');
  const text = document.getElementById('textGuardarGrilla');
  btn.disabled = true; icon.className = "ph ph-spinner animate-spin text-lg"; text.innerText = "GUARDANDO CAMBIOS...";

  try {
    const LIMITE_BATCH = 450;
    const fechas = Object.keys(window.app.cambiosPendientesGrilla);
    let totalChanges = 0;

    // Procesar en chunks para no superar el límite de 500 operaciones por batch
    for (let i = 0; i < fechas.length; i += LIMITE_BATCH) {
      const chunk = fechas.slice(i, i + LIMITE_BATCH);
      const batch = writeBatch(db);
      for (const fecha of chunk) {
        const docId  = `${curso.replace(/\s+/g, '')}_${fecha}`;
        const docRef = doc(db, getPath("asistencias"), docId);
        const snap   = await getDoc(docRef);
        const registrosActuales = snap.exists() ? (snap.data().registros || {}) : {};
        const tipoClase         = snap.exists() ? (snap.data().tipoClase || "CLASE") : "CLASE";
        Object.assign(registrosActuales, window.app.cambiosPendientesGrilla[fecha]);
        batch.set(docRef, { curso, fecha, tipoClase, registros: registrosActuales, timestamp: new Date().toISOString() });
        totalChanges++;
      }
      await batch.commit();
    }

    invalidarCacheBI();
    showToast("🎉 ¡La planilla se guardó correctamente en Firestore!");
    cargarPlanillaGrilla();
  } catch (e) {
    console.error(e);
    showToast("❌ Error al guardar modificaciones.", "error");
  } finally {
    btn.disabled = false; icon.className = "ph ph-floppy-disk text-lg"; text.innerText = "GUARDAR TODOS LOS CAMBIOS DE LA PLANILLA";
  }
}

export function abrirModalNuevaColumna() {
  const curso = document.getElementById('grillaCurso').value;
  if (!curso) { showToast("⚠️ Seleccione una división.", "error"); return; }
  document.getElementById('formGrillaFecha').valueAsDate = new Date();
  document.getElementById('modalNuevaColumna').classList.remove('hidden');
}

export function cerrarModalNuevaColumna() {
  document.getElementById('modalNuevaColumna').classList.add('hidden');
}

export async function crearColumnaPlanilla() {
  const curso = document.getElementById('grillaCurso').value;
  const fecha = document.getElementById('formGrillaFecha').value;
  const tipo  = document.getElementById('formGrillaTipo')?.value || 'CLASE';
  if (!fecha) { showToast('⚠️ Seleccioná una fecha primero.', 'error'); return; }

  try {
    const docId = `${curso.replace(/\s+/g, '')}_${fecha}`;
    await setDoc(doc(db, getPath("asistencias"), docId), {
      curso, fecha, tipoClase: tipo, registros: {}, timestamp: new Date().toISOString()
    });
    cerrarModalNuevaColumna();
    showToast(`✅ Columna "${tipo}" creada para el ${fecha}.`);
    cargarPlanillaGrilla();
  } catch (e) { console.error(e); showToast("Error al crear columna.", "error"); }
}

// ==========================================
// PANEL BI
// ==========================================

export function seleccionarPeriodo() {
  const periodo    = document.getElementById('biPeriodo').value;
  const panelManual= document.getElementById('biFechasManuales');
  if (periodo === "FECHA MANUAL") {
    panelManual.classList.remove('hidden');
  } else {
    panelManual.classList.add('hidden');
    const limites = PERIODOS_CALENDARIO[periodo];
    if (limites) {
      document.getElementById('biFechaDesde').value = limites.desde;
      document.getElementById('biFechaHasta').value = limites.hasta;
    }
    cargarPanelBI();
  }
}

// Cache del Panel BI: evita re-consultar Firestore si los parámetros son idénticos y
// los datos tienen menos de 5 minutos de antigüedad o no hubo escrituras desde la última carga.
const _biCache = {};
const BI_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

export function invalidarCacheBI() {
  Object.keys(_biCache).forEach(k => delete _biCache[k]);
}

export async function cargarPanelBI() {
  const curso  = document.getElementById('biCurso').value;
  const fDesde = document.getElementById('biFechaDesde').value;
  const fHasta = document.getElementById('biFechaHasta').value;
  const tabla  = document.getElementById('tablaBI');

  if (!curso) { tabla.innerHTML = '<tr><td colspan="9" class="px-4 py-8 text-center text-slate-400">Seleccione un curso.</td></tr>'; return; }

  // Clave única para este conjunto de parámetros
  const cacheKey = `${curso}|${fDesde}|${fHasta}`;
  const ahora    = Date.now();
  const entrada  = _biCache[cacheKey];

  if (entrada && (ahora - entrada.ts) < BI_CACHE_TTL_MS) {
    // Datos frescos en caché → renderizar sin llamar a Firestore
    _renderizarTablaBI(tabla, entrada.alumnos, entrada.asistenciasValidas, curso);
    _actualizarKPIs(entrada.alumnos, entrada.asistenciasValidas);
    return;
  }

  tabla.innerHTML = '<tr><td colspan="9" class="px-4 py-8 text-center text-blue-500 animate-pulse">Analizando base de datos...</td></tr>';

  try {
    const snapAlumnos = await getDocs(collection(db, getPath("estudiantes")));
    let alumnos = [];
    snapAlumnos.forEach(d => {
      const data = { id: d.id, ...d.data() };
      if (data.curso === curso || (data.materias && data.materias.includes(curso))) alumnos.push(data);
    });
    alumnos = alumnos.sort((a, b) => a.apellido.localeCompare(b.apellido));

    const snapAsistencias = await getDocs(query(
      collection(db, getPath("asistencias")),
      where("curso", "==", curso),
      where("fecha", ">=", fDesde),
      where("fecha", "<=", fHasta),
      orderBy("fecha", "asc")
    ));
    let asistenciasValidas = [];
    snapAsistencias.forEach(d => asistenciasValidas.push(d.data()));
    if (fDesde) asistenciasValidas = asistenciasValidas.filter(a => a.fecha >= fDesde);
    if (fHasta) asistenciasValidas = asistenciasValidas.filter(a => a.fecha <= fHasta);

    // Guardar en caché para futuras consultas idénticas
    _biCache[cacheKey] = { ts: Date.now(), alumnos, asistenciasValidas };

    _renderizarTablaBI(tabla, alumnos, asistenciasValidas, curso);
    _actualizarKPIs(alumnos, asistenciasValidas);

  } catch(error) {
    console.error(error);
    tabla.innerHTML = '<tr><td colspan="9" class="px-4 py-8 text-center text-red-500">Error interno al procesar los datos de asistencia.</td></tr>';
  }
}

// --- Funciones privadas de renderizado del BI ---

function _renderizarTablaBI(tabla, alumnos, asistenciasValidas, curso) {
  tabla.innerHTML = '';
  if (alumnos.length === 0) {
    tabla.innerHTML = '<tr><td colspan="9" class="px-4 py-8 text-center text-amber-600">No se encontraron alumnos registrados para este curso.</td></tr>';
    return;
  }
  alumnos.forEach((est, index) => {
    let p = 0, a = 0, acp = 0, guion = 0;
    const inscripcionesDivision = (est.inscripciones && est.inscripciones[curso])
      ? est.inscripciones[curso]
      : [{ desde: est.fechaIngreso || "", hasta: est.fechaBaja || "", estado: est.estado || "ACTIVO" }];
    const estadoActual = inscripcionesDivision[inscripcionesDivision.length - 1].estado;

    asistenciasValidas.forEach(registroDia => {
      let estabaInscripto = false;
      for (const insc of inscripcionesDivision) {
        const fD = normalizeDateToISO(insc.desde), fH = normalizeDateToISO(insc.hasta);
        if ((!fD || registroDia.fecha >= fD) && (!fH || registroDia.fecha <= fH)) { estabaInscripto = true; break; }
      }
      if (estabaInscripto && ["CLASE","CLASES REGULARES","Migrada",undefined].includes(registroDia.tipoClase)) {
        const marca = registroDia.registros[est.id];
        if      (marca==="P")   p++;
        else if (marca==="A")   a++;
        else if (marca==="ACP") acp++;
        else                    guion++;
      }
    });

    const totalConRegistros = p + a + acp;
    const porcentaje        = totalConRegistros > 0 ? (p / totalConRegistros) * 100 : 0;
    let colorPorcentaje = "text-slate-500", colorBarra = "bg-gray-300";
    if (totalConRegistros > 0) {
      if      (porcentaje >= 80) { colorPorcentaje = "text-emerald-600"; colorBarra = "bg-emerald-500"; }
      else if (porcentaje >= 60) { colorPorcentaje = "text-amber-500";   colorBarra = "bg-amber-500"; }
      else                       { colorPorcentaje = "text-red-600";     colorBarra = "bg-red-500"; }
    }
    const apodoStr = est.apodo ? ` (${escaparHTML(est.apodo)})` : "";
    const fila = document.createElement('tr');
    fila.className = `border-b hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors ${index % 2 !== 0 ? 'bg-slate-50 dark:bg-slate-800/50' : 'bg-white dark:bg-transparent'}`;
    fila.innerHTML = `
      <td class="px-4 py-2 text-center text-slate-400 font-mono">${index + 1}</td>
      <td class="px-4 py-2">
        <span class="font-bold text-slate-800 dark:text-slate-100">${escaparHTML(est.apellido)}, ${escaparHTML(est.nombre)}</span><span class="text-blue-600 text-xs font-semibold">${apodoStr}</span>
        ${estadoActual && estadoActual.toLowerCase() !== 'activo' ? `<span class="ml-1.5 text-[9px] bg-red-100 text-red-600 px-1 rounded font-bold uppercase">${escaparHTML(estadoActual)}</span>` : ''}
      </td>
      <td class="px-4 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">${(est.materias || [est.curso]).map(escaparHTML).join(', ')}</td>
      <td class="px-4 py-2 text-center font-bold text-emerald-600">${p}</td>
      <td class="px-4 py-2 text-center font-bold text-red-600">${a}</td>
      <td class="px-4 py-2 text-center font-bold text-amber-500">${acp}</td>
      <td class="px-4 py-2 text-center text-slate-400 font-bold">${guion}</td>
      <td class="px-4 py-2 text-center font-black ${colorPorcentaje}">${totalConRegistros > 0 ? porcentaje.toFixed(1)+'%' : '0.0%'}</td>
      <td class="px-4 py-2 align-middle">
        ${totalConRegistros > 0
          ? `<div class="w-full bg-gray-200 rounded-full h-2.5"><div class="${colorBarra} h-2.5 rounded-full" style="width:${porcentaje}%"></div></div>`
          : `<span class="text-xs text-slate-400 italic">No computable</span>`}
      </td>`;
    tabla.appendChild(fila);
  });
}

function _actualizarKPIs(alumnos, asistenciasValidas) {
  let totalPresentes = 0, totalAusencias = 0, sumaPorcentajes = 0, alumnosConHistorial = 0;
  alumnos.forEach(est => {
    let p = 0, a = 0, acp = 0;
    asistenciasValidas.forEach(r => {
      if (!["CLASE","CLASES REGULARES","Migrada",undefined].includes(r.tipoClase)) return;
      const m = r.registros[est.id];
      if (m==="P") p++; else if (m==="A") a++; else if (m==="ACP") acp++;
    });
    totalPresentes += p; totalAusencias += a;
    const total = p + a + acp;
    if (total > 0) { sumaPorcentajes += (p / total) * 100; alumnosConHistorial++; }
  });
  document.getElementById('kpiTotal').innerText     = alumnos.filter(a => (a.estado || 'activo').toLowerCase() === 'activo').length;
  document.getElementById('kpiPresentes').innerText = totalPresentes;
  document.getElementById('kpiAusencias').innerText = totalAusencias;
  document.getElementById('kpiPromedio').innerText  = (alumnosConHistorial > 0 ? (sumaPorcentajes / alumnosConHistorial).toFixed(1) : 0) + '%';
}

// ==========================================
// EXPORTACIÓN A CSV
// ==========================================

function escaparCSV(val) {
  const str = String(val ?? '');
  return (str.includes(',') || str.includes('"') || str.includes('\n'))
    ? `"${str.replace(/"/g, '""')}"` : str;
}

function descargarCSV(contenido, nombreArchivo) {
  const blob = new Blob(['﻿' + contenido], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: nombreArchivo });
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

export function exportarGrillaCSV() {
  const data = window.app._grillaData;
  if (!data?.alumnos?.length) {
    showToast('⚠️ Cargá la grilla primero.', 'info'); return;
  }
  const { curso, periodo, alumnos, asistencias } = data;

  const cols = ['Alumno', 'Estado', ...asistencias.map(a => a.fecha)];
  const rows = [cols.map(escaparCSV).join(',')];

  alumnos.forEach(al => {
    const inscArr = al.inscripciones?.[curso];
    const estado  = inscArr?.length ? inscArr[inscArr.length - 1].estado : (al.estado || 'ACTIVO');
    const nombre  = `${al.apellido}, ${al.nombre}`;
    const valores = asistencias.map(a => a.registros?.[al.id] || '-');
    rows.push([escaparCSV(nombre), escaparCSV(estado), ...valores.map(escaparCSV)].join(','));
  });

  descargarCSV(rows.join('\n'), `Planilla_${curso.replace(/\s+/g,'_')}_${periodo.replace(/\s+/g,'_')}.csv`);
  showToast(`✅ Planilla exportada: ${rows.length - 1} alumnos.`);
}

export function exportarBICSV() {
  const curso  = document.getElementById('biCurso').value;
  const fDesde = document.getElementById('biFechaDesde').value;
  const fHasta = document.getElementById('biFechaHasta').value;

  if (!curso) { showToast('⚠️ Seleccione un curso en el Panel BI.', 'error'); return; }

  const entrada = _biCache[`${curso}|${fDesde}|${fHasta}`];
  if (!entrada) { showToast('⚠️ Cargá el Panel BI primero.', 'info'); return; }

  const { alumnos, asistenciasValidas } = entrada;

  const cols = ['Estudiante', 'Divisiones', 'Presentes (P)', 'Ausentes (A)', 'Justificadas (ACP)', 'Sin Registro (-)', '% Asistencia'];
  const rows = [cols.map(escaparCSV).join(',')];

  alumnos.forEach(al => {
    let p = 0, a = 0, acp = 0, guion = 0;
    const inscripciones = al.inscripciones?.[curso]
      ? al.inscripciones[curso]
      : [{ desde: al.fechaIngreso || '', hasta: al.fechaBaja || '', estado: al.estado || 'ACTIVO' }];

    asistenciasValidas.forEach(r => {
      if (!['CLASE','CLASES REGULARES','Migrada',undefined].includes(r.tipoClase)) return;
      let ok = false;
      for (const insc of inscripciones) {
        const fD = normalizeDateToISO(insc.desde), fH = normalizeDateToISO(insc.hasta);
        if ((!fD || r.fecha >= fD) && (!fH || r.fecha <= fH)) { ok = true; break; }
      }
      if (!ok) return;
      const m = r.registros?.[al.id];
      if (m==='P') p++; else if (m==='A') a++; else if (m==='ACP') acp++; else guion++;
    });

    const conReg = p + a + acp;
    const pct    = conReg > 0 ? ((p / conReg) * 100).toFixed(1) + '%' : '0.0%';
    rows.push([
      escaparCSV(`${al.apellido}, ${al.nombre}`),
      escaparCSV((al.materias || [al.curso]).join(' | ')),
      p, a, acp, guion, pct
    ].join(','));
  });

  descargarCSV(rows.join('\n'), `ReporteBI_${curso.replace(/\s+/g,'_')}.csv`);
  showToast(`✅ Reporte BI exportado: ${rows.length - 1} estudiantes.`);
}
