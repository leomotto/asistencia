// js/miescuela.js — Sincronizador de calificaciones SIDEAC ↔ MiEscuela (GCABA / phinxlab)
//
// La app NO puede pegarle a MiEscuela directo (CORS). La extensión "SIDEAC Conector"
// hace de puente: este módulo le manda los pedidos por window.postMessage, el content-script
// los reenvía al background, y el background hace el fetch real (sin CORS) con el token capturado.
//
// Flujo (según spec GCABA): GET (estado actual) → MATCH (cruce con notas locales) → POST/PUT.

import { db, getPath } from "./firebase-config.js?v=10.78";
import { collection, getDocs, query, where, doc, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { showToast } from "./ui.js?v=10.78";
import { escaparHTML } from "./utils.js?v=10.78";
import { registrarBitacora } from "./bitacora.js?v=10.78";

const API_BASE = 'https://api.prod.miescuela2.phinxlab.com';
const EP_GET   = `${API_BASE}/api/calificaciones/secundariocustom`;
const EP_WRITE = `${API_BASE}/api/calificaciones/secundario/`;

let _bridgeReady = false;
window.addEventListener('message', (ev) => {
  if (ev.source === window && ev.data && ev.data.__sideac && ev.data.type === 'MIESCUELA_BRIDGE_READY') {
    _bridgeReady = true;
  }
});

// Envía un pedido a la extensión y espera la respuesta (por reqId). Rechaza si no hay extensión.
function _bridge(type, payload, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const reqId = 'r' + Date.now() + Math.random().toString(36).slice(2);
    const onMsg = (ev) => {
      if (ev.source !== window) return;
      const m = ev.data;
      if (!m || !m.__sideac || m.reqId !== reqId || m.type !== type + '_RESULT') return;
      window.removeEventListener('message', onMsg);
      clearTimeout(timer);
      resolve(m.result);
    };
    const timer = setTimeout(() => {
      window.removeEventListener('message', onMsg);
      reject(new Error('La extensión SIDEAC Conector no respondió. ¿Está instalada y activa?'));
    }, timeoutMs);
    window.addEventListener('message', onMsg);
    window.postMessage({ __sideac: true, type, reqId, payload }, '*');
  });
}

async function _getToken() {
  const r = await _bridge('MIESCUELA_GET_TOKEN');
  if (!r || !r.token) throw new Error('No hay token capturado. Abrí MiEscuela logueado y volvé a intentar.');
  return r.token;
}

async function _api(method, url, token, body) {
  const r = await _bridge('MIESCUELA_FETCH', { method, url, token, body });
  if (!r) throw new Error('Sin respuesta de la extensión.');
  if (r.status === 401 || r.status === 403) throw new Error('401/403: Token expirado o período cerrado en MiEscuela.');
  if (r.status === 422) throw new Error('422: Error de validación del GCABA (planilla posiblemente cerrada).');
  if (!r.ok) throw new Error(`Error ${r.status || ''}: ${r.error || 'fallo la petición'}`);
  return r.data;
}

// nota (string/num) → boolean de aprobación GCABA. Aprobado si >= 6.
function _aprobado(nota) {
  const n = parseFloat(nota);
  return !isNaN(n) && n >= 6;
}

// Extrae de la respuesta del GET la lista normalizada por alumno.
// La forma exacta de la respuesta hay que confirmarla con un GET real; se parsea defensivo.
function _parsearGet(data) {
  const items = Array.isArray(data) ? data : (data?.data || data?.results || []);
  return items.map(it => ({
    idAlumno:       it.idAlumno ?? it.alumno?.idAlumno ?? it.alumno ?? null,
    idCalificacion: it.idCalificacion ?? it.calificacion?.idCalificacion ?? null,
    idConocimiento: it.nota?.idConocimiento ?? it.idConocimiento ?? null,
    notaGCABA:      it.nota?.nota ?? it.nota ?? it.data?.calificacion ?? '',
    ppi:            it.data?.ppi ?? it.nota?.ppi ?? it.ppi ?? false,
    nombre:         [it.alumno?.apellido, it.alumno?.nombre].filter(Boolean).join(', '),
  })).filter(x => x.idAlumno != null);
}

export function abrirModalMiescuela() {
  const modal = document.getElementById('modalMiescuela');
  if (!modal) return;
  // Popular materias con los cursos activos de SIDEAC
  const sel = document.getElementById('miMateria');
  if (sel) {
    const cursos = window.app.cursos || [];
    sel.innerHTML = cursos.map(c => `<option value="${escaparHTML(c)}">${escaparHTML(c)}</option>`).join('') ||
      '<option value="">(sin materias cargadas)</option>';
  }
  document.getElementById('miResultados').innerHTML = '';
  document.getElementById('miAvisoExtension')?.classList.toggle('hidden', _bridgeReady);
  modal.classList.remove('hidden');
}

// Trae la última planilla de calificaciones que el docente abrió en MiEscuela (capturada por
// la extensión). Autocompleta sección + período GCABA — cero IDs tipeados a mano.
export async function usarUltimaPlanillaMiescuela() {
  try {
    const r = await _bridge('MIESCUELA_ULTIMA_CALIF');
    const u = r?.ultima;
    if (!u || !u.espacioCurricularSeccion) {
      showToast('No hay planilla capturada. Abrí una planilla de calificaciones en MiEscuela y volvé.', 'error');
      return;
    }
    document.getElementById('miSeccion').value     = u.espacioCurricularSeccion;
    document.getElementById('miPeriodoGcaba').value = u.periodo || '';
    // GCABA numera los períodos corridos: 2=1er bim, 3=2do bim, 4=3er bim, 5=4to bim.
    // (confirmado: período 3 = 2do bimestre). Si algún caso no encaja, ajustá el dropdown a mano.
    const mapPer = { '2': 'b1', '3': 'b2', '4': 'b3', '5': 'b4' };
    const ps = mapPer[String(u.periodo)];
    if (ps) document.getElementById('miPeriodoSideac').value = ps;
    const nombreBim = { b1: '1er bim', b2: '2do bim', b3: '3er bim', b4: '4to bim' }[ps] || '(revisá el bimestre)';
    showToast(`Planilla detectada: sección ${u.espacioCurricularSeccion}, período GCABA ${u.periodo} → ${nombreBim}. Verificá el bimestre y elegí la materia.`, 'success');
  } catch (e) {
    showToast(e.message, 'error');
  }
}

let _staging = null;   // { idSeccion, idPeriodo, periodoSideac, filas: [...] }

// ── PASO 1 + 2: GET del estado en GCABA y MATCH con las notas locales de SIDEAC ──
export async function traerYCompararMiescuela() {
  if (window.app.currentUser?.rolActivo !== 'ADMIN' && window.app.currentUser?.rolActivo !== 'SUPERADMIN') return;

  const idSeccion     = document.getElementById('miSeccion')?.value.trim();
  const idPeriodo     = document.getElementById('miPeriodoGcaba')?.value.trim();
  const periodoSideac = document.getElementById('miPeriodoSideac')?.value;   // b1..b4, po_dic, po_feb
  const materia       = document.getElementById('miMateria')?.value;         // materia SIDEAC (curso)
  const cont          = document.getElementById('miResultados');

  if (!idSeccion || !idPeriodo || !periodoSideac || !materia) {
    showToast('Completá materia, ID sección, período GCABA y período SIDEAC.', 'error');
    return;
  }

  cont.innerHTML = `<div class="text-center py-6"><i class="ph ph-spinner animate-spin text-2xl text-indigo-500"></i><p class="text-sm text-slate-500 mt-2">Consultando MiEscuela y comparando...</p></div>`;

  try {
    const token = await _getToken();

    // GET planilla GCABA
    const qs = [
      `espacioCurricularSeccion[equals]=${encodeURIComponent(idSeccion)}`,
      `calificacion.periodo[equals]=${encodeURIComponent(idPeriodo)}`,
      `group_start[group_start]=`,
      `and[and]=`,
      `offset=0`,
      `limit=100`,
    ].join('&');
    const dataGet = await _api('GET', `${EP_GET}?${qs}`, token);
    console.log('[MiEscuela] GET crudo (primer item para ajustar parser):', Array.isArray(dataGet) ? dataGet[0] : dataGet);
    const gcaba = _parsearGet(dataGet);

    // Notas locales SIDEAC: estudiantes (id_miescuela) + evaluaciones de la materia
    const [snapEst, snapEval] = await Promise.all([
      getDocs(collection(db, getPath('estudiantes'))),
      getDocs(collection(db, getPath('evaluaciones'))),
    ]);
    const localPorMiId = new Map();  // id_miescuela -> { nombre, notaSideac, ppiSideac ('', 'SI', 'NO') }
    const notasPorAlumno = new Map();
    snapEval.forEach(d => { const x = d.data(); if (x.materia === materia) notasPorAlumno.set(x.alumnoId, x); });
    snapEst.forEach(d => {
      const e = d.data();
      if (!e.id_miescuela) return;
      const notaDoc = notasPorAlumno.get(d.id) || {};
      const rawPpi = notaDoc.ppi?.[periodoSideac];
      const ppiSideac = rawPpi === true ? 'SI' : (rawPpi === 'SI' || rawPpi === 'NO') ? rawPpi : '';
      localPorMiId.set(String(e.id_miescuela), {
        nombre: `${e.apellido || ''}, ${e.nombre || ''}`,
        notaSideac: notaDoc[periodoSideac] ?? '',
        ppiSideac,
        estId: d.id,
      });
    });

    // MATCH
    const gcabaIds = new Set(gcaba.map(g => String(g.idAlumno)));
    const filas = gcaba.map(g => {
      const local = localPorMiId.get(String(g.idAlumno));
      let accion, motivo = '';
      const ppiBool = local ? local.ppiSideac === 'SI' : false;
      if (!local) { accion = 'huerfano_gcaba'; motivo = 'En MiEscuela pero no en SIDEAC'; }
      else {
        const nS = String(local.notaSideac ?? '').trim();
        const sinNota = nS === '' || nS === '-';
        if (local.ppiSideac !== '' && sinNota) {
          // MiEscuela exige nota si PPI está definido (SI o NO) — no se puede enviar así
          accion = 'ppi_sin_nota'; motivo = `PPI ${local.ppiSideac} definido pero sin nota (MiEscuela lo exige)`;
        } else if (sinNota) {
          accion = 'sin_nota'; motivo = 'Sin nota en SIDEAC';
        } else if (!g.idConocimiento) {
          accion = 'post';
        } else if (String(g.notaGCABA).trim() !== nS || !!g.ppi !== ppiBool) {
          accion = 'put';
        } else {
          accion = 'igual';
        }
      }
      return {
        idAlumno: g.idAlumno, idCalificacion: g.idCalificacion, idConocimiento: g.idConocimiento,
        estId: local?.estId || null, ppi: !!g.ppi, ppiSideac: local?.ppiSideac ?? '',
        nombre: local?.nombre || g.nombre || `ID ${g.idAlumno}`,
        notaSideac: local?.notaSideac ?? '', notaGCABA: g.notaGCABA ?? '', accion, motivo,
      };
    });

    // Huérfanos SIDEAC: local con id_miescuela que no está en el GET
    const huerfanosSideac = [];
    localPorMiId.forEach((v, miId) => {
      if (!gcabaIds.has(miId) && v.notaSideac !== '' && v.notaSideac !== '-') {
        huerfanosSideac.push({ nombre: v.nombre, miId, notaSideac: v.notaSideac });
      }
    });

    _staging = { idSeccion, idPeriodo, periodoSideac, materia, filas };
    _renderStaging(cont, filas, huerfanosSideac);
  } catch (e) {
    console.error(e);
    cont.innerHTML = `<div class="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 p-4 rounded-lg font-bold">${escaparHTML(e.message)}</div>`;
  }
}

function _renderStaging(cont, filas, huerfanosSideac) {
  const nPost = filas.filter(f => f.accion === 'post').length;
  const nPut  = filas.filter(f => f.accion === 'put').length;
  const badge = (a) => ({
    post:  '<span class="text-[9px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 px-1.5 py-0.5 rounded font-black uppercase">NUEVA (POST)</span>',
    put:   '<span class="text-[9px] bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 px-1.5 py-0.5 rounded font-black uppercase">ACTUALIZA (PUT)</span>',
    igual: '<span class="text-[9px] text-slate-400 uppercase">sin cambios</span>',
    sin_nota: '<span class="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase">sin nota SIDEAC</span>',
    ppi_sin_nota: '<span class="text-[9px] bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 px-1.5 py-0.5 rounded font-black uppercase" title="MiEscuela exige nota si hay PPI definido">PPI sin nota</span>',
    huerfano_gcaba: '<span class="text-[9px] bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 px-1.5 py-0.5 rounded font-black uppercase" title="No está en SIDEAC">solo GCABA</span>',
  }[a] || a);

  const ppiCell = (f) => {
    const ppiSideacBool = f.ppiSideac === 'SI';
    if (ppiSideacBool === f.ppi) return f.ppiSideac || (f.ppi ? 'SI' : '<span class="text-slate-300">—</span>');
    return `<span class="text-amber-600 font-bold" title="SIDEAC: ${f.ppiSideac || '(sin definir)'}, MiEscuela: ${f.ppi ? 'SI' : 'NO'}">${f.ppiSideac || '—'} ⚠️</span>`;
  };
  const rows = filas.map(f => `
    <tr class="border-b dark:border-slate-800">
      <td class="p-2 text-xs font-semibold text-slate-700 dark:text-slate-200">${escaparHTML(f.nombre)}</td>
      <td class="p-2 text-xs text-center font-mono">${escaparHTML(String(f.notaSideac || '—'))}</td>
      <td class="p-2 text-xs text-center font-mono text-slate-500">${escaparHTML(String(f.notaGCABA || '—'))}</td>
      <td class="p-2 text-xs text-center">${ppiCell(f)}</td>
      <td class="p-2 text-xs">${badge(f.accion)}</td>
    </tr>`).join('');

  const avisoHuerfanos = huerfanosSideac.length ? `
    <div class="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 p-3 rounded-lg mt-3 text-xs text-amber-800 dark:text-amber-300">
      <b>⚠️ ${huerfanosSideac.length} alumno(s) con nota en SIDEAC pero sin fila en MiEscuela</b> (no se pueden enviar; verificá su ID MiEscuela o la sección):
      ${escaparHTML(huerfanosSideac.slice(0, 8).map(h => h.nombre).join(' · '))}${huerfanosSideac.length > 8 ? '…' : ''}
    </div>` : '';

  cont.innerHTML = `
    <div class="grid grid-cols-2 gap-3 mb-3">
      <div class="bg-emerald-50 dark:bg-emerald-900/30 rounded-xl p-3 text-center"><p class="text-2xl font-black text-emerald-600 dark:text-emerald-400">${nPost}</p><p class="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 uppercase">Nuevas (POST)</p></div>
      <div class="bg-blue-50 dark:bg-blue-900/30 rounded-xl p-3 text-center"><p class="text-2xl font-black text-blue-600 dark:text-blue-400">${nPut}</p><p class="text-[11px] font-bold text-blue-700 dark:text-blue-300 uppercase">Actualiza (PUT)</p></div>
    </div>
    <div class="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
      <table class="w-full text-sm">
        <thead class="bg-slate-50 dark:bg-slate-800 text-[11px] uppercase text-slate-500"><tr>
          <th class="p-2 text-left">Alumno</th><th class="p-2 text-center">Nota SIDEAC</th><th class="p-2 text-center">Nota GCABA</th><th class="p-2 text-center">PPI</th><th class="p-2 text-left">Acción</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    ${avisoHuerfanos}
    <div class="flex flex-wrap gap-2 mt-4">
      <button onclick="app.importarNotasMiescuela()" class="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-5 rounded-lg transition flex items-center gap-2 text-sm">
        <i class="ph ph-download-simple"></i> Importar a SIDEAC (nota + PPI)
      </button>
      <button onclick="app.sincronizarMiescuela()" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-5 rounded-lg transition flex items-center gap-2 text-sm ${(nPost + nPut) === 0 ? 'opacity-40 pointer-events-none' : ''}">
        <i class="ph ph-upload-simple"></i> Enviar a MiEscuela (${nPost + nPut})
      </button>
    </div>`;
}

// ── PASO 3: POST (nuevas) + PUT (actualizaciones) ──
export async function sincronizarMiescuela() {
  if (!_staging) { showToast('Primero traé y compará.', 'error'); return; }
  const { idSeccion, filas } = _staging;

  const ahora = new Date().toISOString();
  const armar = (f, conConocimiento) => {
    const base = {
      alumno: f.idAlumno,
      espacioCurricularSeccion: { idEspacioCurricularSeccion: idSeccion },
      calificacion: { idCalificacion: f.idCalificacion },
      data: { ppi: f.ppiSideac === 'SI', calificacion: String(f.notaSideac) },
      nota: String(f.notaSideac),
      aprobado: _aprobado(f.notaSideac),
      asistenciaEc: false,
      createdAt: ahora,
    };
    if (conConocimiento) base.idConocimiento = f.idConocimiento;
    return base;
  };

  const postArr = filas.filter(f => f.accion === 'post').map(f => armar(f, false));
  const putArr  = filas.filter(f => f.accion === 'put').map(f => armar(f, true));

  if (postArr.length + putArr.length === 0) { showToast('No hay nada para enviar.', 'info'); return; }

  const ok = await window.app.showConfirm(
    'Enviar notas a MiEscuela',
    `Se enviarán a MiEscuela:\n- ${postArr.length} nota(s) nuevas (POST)\n- ${putArr.length} actualización(es) (PUT)\n\n¿Confirmar?`
  );
  if (!ok) return;

  const cont = document.getElementById('miResultados');
  try {
    const token = await _getToken();
    let enviados = 0;
    // Chunks de 50 por las dudas
    const enviar = async (metodo, arr) => {
      for (let i = 0; i < arr.length; i += 50) {
        const chunk = arr.slice(i, i + 50);
        await _api(metodo, EP_WRITE, token, chunk);
        enviados += chunk.length;
      }
    };
    if (postArr.length) await enviar('POST', postArr);
    if (putArr.length)  await enviar('PUT', putArr);

    showToast(`✅ ${enviados} nota(s) sincronizadas a MiEscuela.`, 'success');
    cont.insertAdjacentHTML('afterbegin', `<div class="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 p-3 rounded-lg font-bold mb-3"><i class="ph ph-check-circle"></i> ${enviados} nota(s) enviadas. Volvé a "Traer y comparar" para verificar.</div>`);
    registrarBitacora('enviar_miescuela', { materia: _staging.materia, periodoSideac: _staging.periodoSideac, post: postArr.length, put: putArr.length });
    _staging = null;
    // Refresca la planilla de Calificaciones si está cargada, sin recargar la página
    window.app.cargarPlanillaEvaluaciones?.();
  } catch (e) {
    console.error(e);
    showToast('Error al sincronizar: ' + e.message, 'error');
    cont.insertAdjacentHTML('afterbegin', `<div class="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 p-3 rounded-lg font-bold mb-3">${escaparHTML(e.message)}</div>`);
  }
}

// ── IMPORTAR: trae de MiEscuela a SIDEAC. Guarda nota + PPI en evaluaciones.oficial.{periodo}
//    y deriva un flag por bimestre a nivel estudiante (ppi_{periodo}) — PPI es por alumno/bimestre.
export async function importarNotasMiescuela() {
  if (!_staging) { showToast('Primero traé y compará.', 'error'); return; }
  const { periodoSideac, materia, filas } = _staging;

  // Solo alumnos que existen en SIDEAC (tienen estId) y tienen nota o ppi en GCABA
  const aImportar = filas.filter(f => f.estId && (String(f.notaGCABA).trim() !== '' || f.ppi));
  if (!aImportar.length) { showToast('No hay notas de MiEscuela para importar a estudiantes de SIDEAC.', 'info'); return; }

  const conPPI = aImportar.filter(f => f.ppi).length;
  const ok = await window.app.showConfirm(
    'Importar notas de MiEscuela a SIDEAC',
    `Se guardarán ${aImportar.length} nota(s) oficiales en SIDEAC (campo "oficial", sin tocar tus notas internas).\n${conPPI} con PPI.\nPeríodo: ${periodoSideac} · Materia: ${materia}\n\n¿Confirmar?`
  );
  if (!ok) return;

  const cont = document.getElementById('miResultados');
  try {
    const now = new Date().toISOString();
    let escritos = 0;
    for (let i = 0; i < aImportar.length; i += 400) {
      const chunk = aImportar.slice(i, i + 400);
      const batch = writeBatch(db);
      chunk.forEach(f => {
        const docId = `${f.estId}_${materia.replace(/[\s/]+/g, '')}`;
        const ref = doc(db, getPath('evaluaciones'), docId);
        batch.set(ref, {
          alumnoId: f.estId,
          materia,
          oficial: {
            [periodoSideac]: {
              nota: String(f.notaGCABA ?? ''),
              ppi: !!f.ppi,
              idCalificacion: f.idCalificacion ?? null,
              idConocimiento: f.idConocimiento ?? null,
              syncedAt: now,
            }
          }
        }, { merge: true });
        // Flag PPI por bimestre a nivel estudiante (para badges/filtros)
        if (f.ppi) {
          const estRef = doc(db, getPath('estudiantes'), f.estId);
          batch.set(estRef, { ppi: { [periodoSideac]: true } }, { merge: true });
        }
      });
      await batch.commit();
      escritos += chunk.length;
    }
    showToast(`✅ ${escritos} nota(s) oficiales importadas a SIDEAC.`, 'success');
    cont.insertAdjacentHTML('afterbegin', `<div class="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 p-3 rounded-lg font-bold mb-3"><i class="ph ph-check-circle"></i> ${escritos} nota(s) oficiales guardadas en SIDEAC (${conPPI} con PPI).</div>`);
    registrarBitacora('importar_miescuela', { materia, periodoSideac, cantidad: escritos, conPPI });
    // Refresca la planilla de Calificaciones si está cargada, sin recargar la página
    window.app.cargarPlanillaEvaluaciones?.();
  } catch (e) {
    console.error(e);
    showToast('Error al importar: ' + e.message, 'error');
    cont.insertAdjacentHTML('afterbegin', `<div class="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 p-3 rounded-lg font-bold mb-3">${escaparHTML(e.message)}</div>`);
  }
}
