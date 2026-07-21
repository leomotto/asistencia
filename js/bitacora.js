// js/bitacora.js — Log de acciones sobre calificaciones (auditoría/histórico, NO para BI).
// Colección aparte ("log_calificaciones"), nunca se cruza con las queries de asistencia/BI.

import { db, getPath } from "./firebase-config.js?v=10.89";
import { collection, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// accion: 'guardar_calificacion' | 'importar_miescuela' | 'enviar_miescuela' | 'tomar_nota_oficial' | 'ppi_masivo'
export async function registrarBitacora(accion, detalle = {}) {
  try {
    const ref = doc(collection(db, getPath('log_calificaciones')));
    await setDoc(ref, {
      accion,
      tenant: window.app?.currentTenant || 'root',
      usuario: window.app?.currentUser?.email || 'desconocido',
      ts: new Date().toISOString(),
      ...detalle,
    });
  } catch (e) {
    console.error('[Bitácora] No se pudo registrar:', e);   // nunca bloquea la acción principal
  }
}
