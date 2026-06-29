# Tareas de Despliegue y Arquitectura

## 1. Auditoría de Seguridad (Firestore)
- `[x]` Ejecutar el skill de seguridad de Firebase.
- `[x]` Generar `firestore.rules` con validaciones de RBAC (Admin, Docente, Pendiente).
- `[x]` Validar que los permisos funcionen en la app.

## 2. Pipeline de Despliegue (Alwaysdata)
- `[x]` Crear script `deploy.sh`.
- `[x]` Configurar `rsync` con exclusiones y los datos del host `ssh-muchacholoco.alwaysdata.net`.
- `[x]` Ejecutar el script y validar que se suben los archivos.

## 3. Refactor Modular (Clean Code) *[COMPLETADO]*
- `[x]` Extraer lógica de UI → js/ui.js + js/constants.js + js/utils.js
- `[x]` Extraer lógica de Autenticación → js/auth.js
- `[x]` Extraer lógica de Materias → js/materias.js
- `[x]` Extraer lógica de Estudiantes → js/estudiantes.js
- `[x]` Extraer lógica de Asistencias → js/asistencias.js
- `[x]` app.js queda como entry point puro (110 líneas vs 1870 originales)

## 4. Auditoría, Hardening y Coherencia de Datos (v9.4) *[COMPLETADO]*
- `[x]` Hardening de `firestore.rules` (control de update bypass en asistencias y corrección de ruta en sandbox `getUserData`).
- `[x]` Desacoplamiento e invalidación de caché del Panel BI al agregar/editar alumnos o materias.
- `[x]` Cache busting general mediante incremento de versiones a `?v=9.4`.

## 5. Módulo de Calificaciones de Bimestres y PO (v9.5) *[COMPLETADO]*
- `[x]` Crear modulo de calificaciones (`js/evaluaciones.js`) con cálculo automático de promedios, notas finales y condición del estudiante.
- `[x]` Diseñar planilla interactiva de carga de notas en `index.html` con soporte sticky responsivo.
- `[x]` Configurar reglas de seguridad en `firestore.rules` específicas para la colección `evaluaciones` (RBAC).
- `[x]` Cache busting general mediante incremento de versiones a `?v=9.5`.

## 6. Panel de Bloqueo y Habilitación de Periodos (v9.7) *[COMPLETADO]*
- `[x]` Reemplazar inputs de calificaciones numéricas por cajas de elección (`<select>` del 1 al 10).
- `[x]` Añadir panel para que Administradores habiliten/deshabiliten periodos de carga.
- `[x]` Implementar sistema de bloqueo de planilla por materia/curso para evitar cambios involuntarios.
- `[x]` Configurar seguridad de Firestore para los documentos de configuración y bloqueo.
- `[x]` Cache busting general mediante incremento de versiones a `?v=9.7`.

## 7. Registro Histórico y Filtro de Talleres (v9.10) *[COMPLETADO]*
- `[x]` Conservar y mostrar estudiantes inactivos/históricos con notas ya cargadas en la planilla de calificaciones (con badge aclaratorio).
- `[x]` Filtrar asignaturas que contengan la palabra "Taller" del selector de calificaciones, manteniendo las académicas como "ARTES".
- `[x]` Cache busting general mediante incremento de versiones a `?v=9.10`.
