# 📌 Contexto y Handoff del Proyecto: Muchacho Loco Asistencia

Este archivo contiene el contexto más reciente del proyecto para asistir a otros agentes de IA, IDEs (como Cursor, Windsurf) u otras herramientas de programación agentica.

## 📝 Resumen del Proyecto
* **Aplicación:** PWA de gestión de asistencia escolar.
* **Stack:** JavaScript Vanilla (ES Modules), HTML5, CSS (Tailwind CSS referenciado/estilado custom), Firebase (Firestore + Auth).
* **Despliegue:** `ssh-muchacholoco.alwaysdata.net` mediante el script local `./deploy.sh`.
* **Última Versión Estable:** `v9.41`

## 🚨 Últimos Cambios Importantes (Julio 2026)
1. **Resolución de Crash Crítico (SyntaxError):** Se corrigió un error que dejaba la pantalla de carga bloqueada debido a incompatibilidades de navegador (uso de Optional Chaining `?.` y Nullish Coalescing `??` sin soporte en navegadores viejos) que, sumado a una llave `}` huérfana en `js/evaluaciones.js`, rompían la inicialización del AST en el navegador.
2. **Refactorización UI/UX (Mobile-First y Viewport):** 
   - Las tablas de gestión de asistencia y matrículas fueron transformadas para verse como "tarjetas" apiladas en pantallas de celular (usando clases `block md:table-row`), eliminando el scroll horizontal incómodo.
   - **Fix de "Flex Blowout":** Se corrigió el contenedor principal (`#appContainer`) forzándole límites estrictos (`min-w-0 flex-1 overflow-hidden`). Esto previno que la tabla de la grilla de asistencia creciera infinitamente empujando los filtros fuera de la pantalla (overflow en toda la ventana).
   - **Uso de Viewport Completo:** Se eliminó la restricción `max-w-6xl` en todos los contenedores principales (reemplazado por `max-w-full`) para que secciones como Gestión de Materias y Toma Diaria aprovechen el 100% de los monitores ultrawide/1080p, evitando que la interfaz luzca amontonada contra un borde.
3. **Limpieza de "Dead Code" (Ponytail Audit):** 
   - Se removió por completo la dependencia inútil `acorn` en `package.json` y la carpeta `node_modules` (el proyecto funciona puramente por CDN).
   - Se borraron tests en Python/JS zombis, scripts utilitarios no referenciados y el archivo huérfano `auditoria.js` y `auditoria.html`.
4. **Gestión de Matrícula Optimizada:** 
   - Se eliminaron las masivas listas de checkboxes por división.
   - Se implementó selección de "División Principal" (ej. "1ro A") que auto-inscribe en todas sus materias al vuelo.
   - Buscador rápido por nombre/apellido incorporado.

## ⚠️ Advertencias para Futuros Agentes
- **Compatibilidad JS:** El usuario ha reportado el uso de dispositivos/navegadores antiguos (probablemente Chrome 60-70). **EVITA** usar sintaxis de ES2020+ (`?.`, `??`, clases estáticas modernas) en los archivos `js/` a menos que se introduzca un paso formal de compilación (Babel/ESBuild) en el script de despliegue.
- **Gestión de Versiones (Caché):** Cuando hagas cambios en la lógica o en los archivos `.js` o `.css`, asegúrate de actualizar el número de versión (ej. de `v=9.41` a `v=9.42`) en todas las importaciones `<script src="...v=9.41">` en `index.html` y dentro de las importaciones de módulos en `js/`, así como en `version.json` para forzar a la PWA a limpiar caché y descargar la nueva versión.
- **Guardado en Firestore:** Utiliza siempre el flag `{merge: true}` al actualizar documentos complejos con `setDoc` para no destruir campos de información que no se estén mostrando/editando en ese momento en la UI.

## 🚀 Próximos Pasos (Backlog)
- [ ] **Empaquetador/Transpilador:** Integrar Vite o ESBuild al script de deploy para automatizar la compatibilidad hacia atrás del código y minificación, removiendo la gestión manual de "cache-busting".
- [ ] **Sistema de Fusión:** Validar y pulir la herramienta de fusión de cuentas de alumnos duplicados.
- [ ] **Manejo Offline Avanzado:** Extender el Service Worker para permitir caché local de mutaciones (Firestore offline) más robusto si se corta la conexión al tomar asistencia.
