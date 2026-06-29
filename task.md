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
