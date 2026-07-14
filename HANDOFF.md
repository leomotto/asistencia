# 📌 Contexto y Handoff del Proyecto: Muchacho Loco Asistencia

Este archivo contiene el contexto más reciente del proyecto para asistir a otros agentes de IA, IDEs (como Cursor, Windsurf) u otras herramientas de programación agentica.

## 📝 Resumen del Proyecto
* **Aplicación:** PWA de gestión de asistencia escolar.
* **Stack:** JavaScript Vanilla (ES Modules), HTML5, CSS (Tailwind CSS referenciado/estilado custom), Firebase (Firestore + Auth para Base de Datos y Autenticación, PERO NO PARA HOSTING).
* **Despliegue:** `ssh-muchacholoco.alwaysdata.net` mediante el script local `./deploy.sh`. NO se usa `firebase deploy`.
* **Última Versión Estable:** `v9.84`

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
- **DEPLOYMENT:** El proyecto se sube a producción con el comando `./deploy.sh`. El Frontend vive en un FTP/SSH (Alwaysdata). **Para la base de datos (Firestore)**: La CLI de Firebase ya está instalada y autenticada; puedes usar `npx firebase-tools deploy --only firestore:rules` para actualizar reglas de seguridad en Firebase, pero **NUNCA uses `firebase deploy` para el Hosting**.
- **Gestión de Versiones (Caché):** Cuando hagas cambios en la lógica o en los archivos `.js` o `.css`, asegúrate de usar `./deploy.sh "mensaje"`, el cual ya automatiza el bump y commit.
- **Compatibilidad JS:** El usuario ha reportado el uso de dispositivos/navegadores antiguos. EVITA usar sintaxis hiper moderna (aunque se relajó un poco, sigue siendo buena práctica tener precaución con bugs raros).
- **Guardado en Firestore:** Utiliza siempre el flag `{merge: true}` al actualizar documentos complejos con `setDoc`.

## 🚀 Próximos Pasos (Backlog)
- [ ] **Ajuste de Evaluaciones:** Optimizar el espacio visual de la grilla de calificaciones ("calificaciones muy saturadas de información") en pantallas pequeñas.
- [ ] **Empaquetador/Transpilador:** Integrar Vite o ESBuild al script de deploy para automatizar el "cache-busting".
