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

## 8. Cambio de Identidad Visual y Favicon (v9.11) *[COMPLETADO]*
- `[x]` Diseñar y crear el favicon en formato SVG corporativo (`favicon.svg`).
- `[x]` Renombrar la aplicación de "ASISTENCIA PRO" a "SISTEMA DE ASISTENCIA Y CALIFICACIÓN - SIDEAC" en toda la interfaz.
- `[x]` Cache busting general mediante incremento de versiones a `?v=9.11`.

## 9. Planilla por Periodo, Campos Dinámicos y Calificaciones en BI (v9.12) *[COMPLETADO]*
- `[x]` Cambiar la grilla de calificaciones por un selector de período de evaluación (`evalPeriodo`).
- `[x]` Diseñar un panel de administración para incorporar campos adicionales (labels y keys de base de datos) y reordenarlos/eliminarlos.
- `[x]` Adaptar el guardado masivo en Firestore usando nombres de campos planos para prevenir colisiones (`adicionales_[periodo]_[key]`).
- `[x]` Implementar pestaña "Calificaciones" en el Panel BI, mostrando promedios generales, tasas de aprobación, alumnos en PO, alumnos en riesgo académico, grilla completa anual y exportación a CSV.
- `[x]` Cache busting general mediante incremento de versiones a `?v=9.12`.

## 10. Refactorización UI de "Gestión de Materias" (v9.41) *[COMPLETADO]*
- `[x]` Revertir clases de tailwind "Mobile-First" (`block md:table`) en la tabla de Gestión de Materias para evitar fallos de renderizado que apilaban columnas.
- `[x]` Asegurar un 100% de ocupación horizontal con `max-w-full` en contenedores principales de pantallas para resoluciones ultra-wide.


## 11. Refinamiento Visual y Optimizaciones (v9.44) *[COMPLETADO]*
- `[x]` Paneles de administración en evaluaciones colapsables por defecto para ahorrar espacio.
- `[x]` Selectores de calificaciones compactados para mejorar densidad visual.
- `[x]` Consistencia de headings y cards (gestionDocentes vs gestionMaterias).
- `[x]` Corrección de cierres de div huérfanos en gestionAlumnos.

