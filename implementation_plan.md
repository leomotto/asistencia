# 🛡️ Fase 10: Auditoría de Seguridad (RBAC) y Jerarquía Estudiantil

Has dado en la tecla con una preocupación arquitectónica crítica. He revisado a fondo cómo se relacionan los estudiantes, las asignaturas y las reglas de Firebase (`firestore.rules`). 

Actualmente tenemos dos grandes vectores de mejora para convertir esta app en un sistema a prueba de balas a nivel institucional:

## 1. Vulnerabilidades de Seguridad Detectadas en Firestore

En la configuración actual, confiamos demasiado en que la Interfaz de Usuario restrinja a los docentes. Pero si un docente supiera usar la consola del navegador, podría alterar datos ajenos.

**Problemas actuales:**
- `estudiantes`: Cualquier docente puede editar o eliminar a **cualquier** estudiante de toda la escuela, incluso de materias que no dicta (`allow write: if isDocente();`).
- `asistencias`: Cualquier usuario logueado puede **leer** las asistencias de toda la escuela (`allow read: if isAuthed();`).

**La Solución (Hardening de Rules):**
Vamos a reescribir `firestore.rules` para implementar un "Cierre Perimetral":
- **Estudiantes (Lectura/Escritura):** Solo el **ADMIN** podrá crear o eliminar estudiantes (la secretaría inscribe). Los **DOCENTES** solo tendrán permisos de *lectura* (para pasar lista), y *quizás* de actualización parcial (solo para dejar una nota, pero no para darlos de baja).
- **Asistencias (Lectura):** Un **DOCENTE** solo podrá leer (`allow read`) las planillas de asistencia de los cursos que tiene explícitamente asignados en su perfil (`docenteTieneCurso(resource.data.curso)`).

## 2. Jerarquía de Estudiante -> División -> Materia

Tal como indicas, un estudiante pertenece a una **División** (Ej. "1ro A"). Y la división tiene múltiples **Materias**.
Actualmente, el sistema matricula al alumno en el *nombre concatenado* (Ej. `1ro A - Matemática`). Esto es ineficiente: si "1ro A" tiene 12 materias, hay que tildar las 12 materias al crear un estudiante.

**Propuesta de Reestructuración (Sin romper la BD):**
1. **Modal Estudiantes:** En vez de listar 50 checkboxes planos, vamos a agruparlos por **División** (basado en la lógica que ya creamos en la Fase 7). 
2. Si un docente/admin inscribe a un alumno en la división "1ro A" con un solo clic, el código por debajo lo inscribirá automáticamente en todas las materias dependientes de "1ro A" (Matemática, Lengua, Historia, etc.).
3. **Escritura restringida:** Solo un rol `ADMIN` debería gestionar estas matrículas. Quitaremos el botón "Editar/Agregar" estudiante si el usuario que navega es solo `DOCENTE`. El Docente solo entra a tomar lista.

---

## 👨‍💻 Plan de Ejecución para Claude Code:

### [MODIFY] `firestore.rules`
- Endurecer accesos de `estudiantes` limitando `write` a `isAdmin()`.
- Limitar `read` en `asistencias` a `isAdmin() || docenteTieneCurso(resource.data.curso)`.

### [MODIFY] `js/estudiantes.js`
- Rediseñar el renderizado del `formMateriasContainer` en `abrirModalAlumno()` para que agrupe jerárquicamente por División.
- Un checkbox maestro "1ro A" que al tildarse, asigne todas las materias Base que pertenezcan a "1ro A".

### [MODIFY] `index.html` & `js/ui.js`
- Ocultar la pestaña de "Matrículas" o el botón "Agregar Estudiante" si el `rol` de Firebase del usuario no es `ADMIN`. Los docentes no matriculan, solo dictan clase.

---

> [!CAUTION]
> **Decisión de Negocio (Feedback Requerido):**
> 1. ¿Estás de acuerdo con que **sólo los Administradores** puedan crear alumnos y matricularlos? (Evita que los docentes borren alumnos por error).
> 2. ¿Confirmas la aplicación de las restricciones estrictas en Firebase para que un Docente no pueda husmear las asistencias de materias que no le pertenecen?
