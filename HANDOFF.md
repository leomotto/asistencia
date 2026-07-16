# 📌 Contexto y Handoff del Proyecto: Muchacho Loco Asistencia

Este archivo contiene el contexto más reciente del proyecto para asistir a otros agentes de IA, IDEs (como Cursor, Windsurf) u otras herramientas de programación agentica.

## 📝 Resumen del Proyecto
* **Aplicación:** PWA de gestión de asistencia escolar.
* **Stack:** JavaScript Vanilla (ES Modules), HTML5, CSS (Tailwind CSS referenciado/estilado custom), Firebase (Firestore + Auth para Base de Datos y Autenticación, PERO NO PARA HOSTING).
* **Despliegue:** `ssh-muchacholoco.alwaysdata.net` mediante el script local `./deploy.sh`. NO se usa `firebase deploy`.
* **Última Versión Estable:** `v10.21` (JS modules `?v=10.21`, CSS `css/styles.css?v=9.68`)

## 🚨 Últimos Cambios Importantes (Julio 2026 - Arquitectura SaaS Multi-Tenant)
1. **Transformación a SaaS Multi-Tenant:**
   - La base de datos ahora aísla la información (estudiantes, materias, asistencias) por institución (`tenantId`).
   - El SuperAdmin (leomotto@gmail.com) puede crear, editar y eliminar colegios (CRUD en `escuelas.js`).
   - Los permisos y materias de los usuarios en `usuarios.js` ya no son un array plano global, sino que están atados al contexto de la escuela (`escuelas.tenantId.rol` y `escuelas.tenantId.materias`).
2. **Onboarding de Docentes (Fase 2):**
   - Los nuevos usuarios, al autenticarse y no tener escuelas, son presentados con un asistente ("Onboarding") donde deben ingresar el código de la escuela a la cual quieren unirse (estado `PENDIENTE`).
   - Los Admins de esa escuela aprueban las solicitudes filtradas por su propio "tenant" en la vista de Gestión de Docentes.
3. **Pases de Estudiantes (Fase 3):**
   - Se habilitó el botón "Emitir Pase" en el perfil de estudiantes (sólo visible para Admins).
   - El legajo del estudiante se migra del tenant activo a un repositorio global llamado `EXTERIOR`. El historial de presentismo queda intacto en la base de la escuela original pero no se migra.
4. **Mejoras Estéticas (UI/UX):**
   - Se migró la tipografía global de `Plus Jakarta Sans` a `Outfit` para una estética más moderna y elegante.
   - La agenda de `Inicio` se pulió para mostrar correctamente si el docente tiene el "Día Libre" y cuándo es su próxima clase.

## ⚠️ Advertencias para Futuros Agentes (REGLAS ESTRICTAS)
- **DEPLOYMENT:** El proyecto se sube a producción con `./deploy.sh "mensaje"`. El Frontend vive en SSH/FTP (Alwaysdata). **Para Firestore**: `npx firebase-tools deploy --only firestore:rules`. **NUNCA `firebase deploy` para Hosting**.
- **Gestión de Versiones (Caché):** Usa `./deploy.sh "mensaje"` — automatiza bump.js + commit + rsync. **NO usar sed manual** para versiones: bump.js lee el primer `?v=X.XX` en index.html y reemplaza TODAS las ocurrencias en index.html + js/*.js. La versión CSS (`css/styles.css?v=9.68`) es independiente — bump.js no la toca.
- **Compatibilidad JS:** Hay dispositivos/navegadores antiguos en producción. EVITAR sintaxis ES2020+ (`?.`, `??`).
- **Guardado en Firestore:** Siempre `{merge: true}` en `setDoc`.
- **Multi-tenant:** Usar siempre `getPath(coleccion)` de `firebase-config.js` para rutas Firestore — nunca strings hardcodeados. Verificar `window.app.currentTenant` antes de operaciones de datos.
- **`.hidden { display: none !important; }`** en styles.css — INTENCIONAL. La sección `evaluaciones` tiene `hidden flex flex-col` simultáneamente; sin `!important`, `flex` ganaría la cascada y mostraría la sección oculta.

## 📁 Módulos JS actuales (`js/`)

- `app.js` — entry point, namespace `window.app`
- `auth.js` — Google Auth, flujo multi-tenant, `setAppTenant()`
- `firebase-config.js` — config Firebase, `getPath()` helper
- `asistencias.js` — toma, grilla, BI, CSV
- `estudiantes.js` — matrícula, perfil, fusión, backup, pases
- `materias.js` — CRUD materias, `HORARIOS_DINAMICOS`, generador
- `usuarios.js` — docentes, roles
- `ui.js` — toast, tabs, dark mode, skeleton, confirm, agenda, context switcher
- `utils.js` — helpers de fecha y XSS
- `constants.js` — `PERIODOS_CALENDARIO`
- `onboarding.js` — wizard para docentes nuevos (join school)
- `escuelas.js` — CRUD escuelas (SuperAdmin)
- `auditoria.js` — integridad de BD (Admin)

## 🚀 Próximos Pasos (Backlog)
- [x] **Ajuste de Evaluaciones:** Reducción de celdas de calificación implementada (px-1 py-1.5, max-w-[74px], text-xs).
- [ ] **Normalización UI:** Selector curso/división posicionado consistentemente en todas las secciones (referencia: estilo "Matrícula" — filtro con label debajo del heading).
- [ ] **Normalización columnas tablas:** Unificar nombres "Alumno" / "Estudiante" / "Nombre" en todas las tablas.
- [ ] **Tab en grilla de evaluaciones:** (a) Tab navega entre inputs de calificación; (b) auto-focus al primer campo al cambiar de sección en switchTab().
- [ ] **Empaquetador/Transpilador:** Integrar Vite o ESBuild al script de deploy.
