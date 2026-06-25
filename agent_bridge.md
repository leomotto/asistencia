# 🌉 Agent Bridge: Architect <-> Developer

---

## 🏛️ Instrucciones del Arquitecto (Fase 10: Auditoría de Seguridad RBAC y Jerarquía Estudiantil)

**Para: Claude Code**
**De: Software Architect**

El cliente ha autorizado la restricción absoluta de accesos (Phase 10). **SOLO EL ADMIN** puede editar las estructuras de la institución (Alumnos, Materias, Horarios). Los Docentes tendrán un rol puramente operativo (Lectura de alumnos, Toma de asistencia).

Debes ejecutar las siguientes directrices estrictas:

---

### FEATURE 1: Hardening de Firebase Rules (`firestore.rules`)
Debes modificar el archivo local `firestore.rules` para reflejar estas políticas:
1. **`estudiantes`**: 
   - `allow read: if isDocente();` (Ambos leen para tomar lista).
   - `allow write: if isAdmin();` (Solo la secretaría inscribe, edita o elimina).
2. **`asistencias`**: 
   - `allow read: if isAdmin() || (isDocente() && docenteTieneCurso(resource.data.curso));` (Un docente no puede leer asistencias de cursos donde no dicta clases).
3. **`materias` y `horarios`**: Verifica que estén bloqueadas (`write: if isAdmin();`).

---

### FEATURE 2: Bloqueo de Interfaz de Usuario (UI)
En `js/ui.js` y `js/auth.js` (o donde proceses el login):
1. **Ocultar el Módulo de Estudiantes**: 
   - La pestaña de la barra lateral `btnTabEstudiantes` (o el link "Matrículas") debe estar oculta o deshabilitada en el DOM (clase `hidden`) si el usuario que inicia sesión es `rol === 'DOCENTE'`.
   - Asegúrate de ejecutar esta ocultación en `verificarEstadoAcceso()` o la función de ruteo post-login.
2. **Bloqueos preventivos**:
   - Oculta el botón "Fusión de Duplicados" (`btnAbrirFusion`) y el de "Exportar Backup" si no es Admin.

---

### FEATURE 3: Matrícula Inteligente por Bloque (División)
En `js/estudiantes.js`:
1. **Modal de Edición de Alumnos (`abrirModalAlumno`)**:
   - Actualmente generamos un checkbox plano por cada materia (`window.app.cursos`).
   - Tienes que agrupar estos checkboxes bajo su respectiva **División** (Ej. "1ro A", "2do B").
   - **Mejora UX:** Añade un "Checkbox Maestro" por División. Si el admin tilda "1ro A", mediante JS se deben tildar automáticamente todas las materias hijas (Matemática, Lengua, etc. que pertenezcan a 1ro A).
   - *Tip:* Puedes usar la misma lógica de agrupación que usaste en `usuarios.js` (basado en el substring de división o en el objeto que viene de BD).

---

### VERSIONADO Y DESPLIEGUE SECUNDARIO
- Incrementa a `?v=9.0` en los scripts de `index.html`.

### ✍️ Reporte de Ejecución (Claude Code)
> Claude: Al finalizar, documenta detalladamente las reglas que aplicaste.

**Fecha:** 2026-06-25 | **Estado:** ✅ Fase 10 completa — 10/10 módulos JS sin errores

---

#### FEATURE 1: Hardening Firestore Rules

**Archivo:** `firestore.rules` — 3 colecciones endurecidas.

##### `estudiantes`
```
// ANTES (inseguro — docentes podían modificar inscripciones)
allow read:  if isAuthed();
allow write: if isDocente();

// DESPUÉS
allow read:  if isDocente();   // Admin + Docente leen para tomar lista
allow write: if isAdmin();     // SOLO admin inscribe, edita, elimina
```

##### `asistencias`
```
// ANTES (inseguro — cualquier autenticado leía TODO)
allow read: if isAuthed();

// DESPUÉS — 4 reglas separadas
allow read, write: if isAdmin();                           // Admin total
allow read:        if isDocente() && resource != null &&
                      docenteTieneCurso(resource.data.curso);  // Docente solo su materia
allow create, update: if isDocente() &&
                         docenteTieneCurso(request.resource.data.curso);
allow delete:      if isDocente() && resource != null &&
                      docenteTieneCurso(resource.data.curso);
```

##### `materias` y `horarios` (verificación)
```
allow read:  if isAuthed();   // ✓ cualquiera lee
allow write: if isAdmin();    // ✓ solo admin escribe
```

**Nota sobre list queries:** `docenteTieneCurso(resource.data.curso)` funciona correctamente con `getDocs(query(..., where('curso','==',curso)))` porque Firestore evalúa la regla sobre cada documento del resultado. El frontend ya siempre filtra por `where('curso','==',curso)` en todas las consultas relevantes.

**Deploy:** `firebase.json` creado en la raíz. El deploy no pudo ejecutarse automáticamente porque la CLI requiere `firebase login` interactivo. **Para aplicar en producción:**
```bash
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules --project sistemaasistencia-a6c5b
```

---

#### FEATURE 2: Bloqueo de UI por Rol

**Archivo:** `js/auth.js` — bloque de visibilidad refactorizado con `classList.toggle`.

| Elemento | ADMIN | DOCENTE | PENDIENTE |
|---|---|---|---|
| `btnGestion` (Matrícula) | ✅ visible | ❌ oculto | ✅ visible* |
| `btnMaterias` (Materias) | ✅ visible | ❌ oculto | ❌ oculto |
| `btnDocentes` (Docentes) | ✅ visible | ❌ oculto | ❌ oculto |
| `btnFusion` (Fusión) | ✅ visible | ❌ oculto | ❌ oculto |
| `btnBackup` (Backup) | ✅ visible | ❌ oculto | ❌ oculto |

*PENDIENTE ve el tab Matrícula pero `switchTab` les bloquea la navegación con toast de aviso.

**Archivo:** `index.html` — Agregado `id="btnFusion"` al botón "Fusionar Duplicados" para poder manipularlo desde JS.

---

#### FEATURE 3: Matrícula Inteligente por Bloque

**Archivo:** `js/estudiantes.js` — función `abrirModalAlumno` completamente reescrita.

**Antes:** lista plana de checkboxes para todas las materias.

**Después:** agrupación jerárquica con checkbox maestro por división:
```
▼ 1ro A  [☐ marcar todo]
    ☐ Matemática
    ☐ Lengua
▼ 2do B  [☐ marcar todo]
    ☐ Físico-Química
    ☐ Historia
☐ ARTES  ← (sin división, sin maestro)
```

**Funciones nuevas:**
- `_descomponerMat(nombre)` — split de `"1ro A - Matemática"` → `{div:"1ro A", base:"Matemática"}`
- `_htmlDetallesInscripcion(mat)` — factoriza el HTML de fecha/grupo/estado
- `_sincronizarMaestra(divisionBlock)` — actualiza el estado del maestro (checked / indeterminate / unchecked) según sus hijos
- `toggleDivisionMaestra(masterCb)` — exportada, wired en `app._toggleDivisionMaestra`; al clicar el maestro marca/desmarca todos sus hijos y llama `toggleInscripcionDetails` por cada uno
- `toggleInscripcionDetails` actualizada para llamar `_sincronizarMaestra` al cambiar un hijo → mantiene coherencia bidireccional

**Estado `indeterminate`:** si algunos hijos están marcados y otros no, el maestro muestra el estado indeterminado del browser (guión en el checkbox), lo que da feedback visual inmediato.

---

#### node --check: 10/10 ✅ | Cache busting: ?v=9.0 (24 imports)
